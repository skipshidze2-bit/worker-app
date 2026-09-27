// Runs every 5 minutes (see supabase/cron.sql). Handles no-shows, automatic hour
// confirmation, settling confirmed bookings (refunding unworked hours and adding
// the worker to the admin payout list), reminders and closing finished shifts.
import { settleBooking } from '../_shared/pricing.ts';
import { refund } from '../_shared/payze.ts';
import { admin, json, notify } from '../_shared/server.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('forbidden', { status: 403 });
  }
  const report = { noShows: 0, autoConfirmed: 0, settled: 0, errors: [] as string[] };

  // 1. No-shows: refund the employer for that worker and reopen the slot as urgent.
  const { data: noShows, error: noShowError } = await admin.rpc('mark_no_shows');
  if (noShowError) report.errors.push(noShowError.message);
  for (const n of noShows ?? []) {
    report.noShows++;
    try {
      await refund(n.payment_id, (n.wage_cents ?? 0) + (n.fee_cents ?? 0), n.booking_id);
      await admin.from('bookings').update({ refund_cents: (n.wage_cents ?? 0) + (n.fee_cents ?? 0) }).eq('id', n.booking_id);
      await notify(n.employer_id, 'Worker did not check in', "We've reopened the shift as urgent and are finding a replacement.", { shift_id: n.shift_id });
      await notify(n.worker_id, 'Missed shift', 'You did not check in and received a strike. 3 strikes suspend your account.');
    } catch (e) {
      report.errors.push(`no-show ${n.booking_id}: ${(e as Error).message}`);
    }
  }

  // 2. Confirm hours nobody disputed within 24h.
  const { data: confirmed } = await admin.rpc('auto_confirm_hours');
  report.autoConfirmed = confirmed ?? 0;

  // 3. Settle confirmed bookings: refund unworked hours and fix the worker's pay.
  //    Payouts are then sent by bank transfer from the admin payout list.
  const { data: due } = await admin
    .from('bookings')
    .select('id, worker_id, wage_cents, fee_cents, confirmed_minutes, payment_id, shifts(hourly_rate_cents, role_title)')
    .eq('status', 'confirmed')
    .is('settled_at', null)
    .limit(100);
  for (const b of due ?? []) {
    const shift = b.shifts as unknown as { hourly_rate_cents: number; role_title: string };
    try {
      const s = settleBooking({
        chargedWageCents: b.wage_cents ?? 0,
        chargedFeeCents: b.fee_cents ?? 0,
        hourlyRateCents: shift.hourly_rate_cents,
        confirmedMinutes: b.confirmed_minutes ?? 0,
      });
      // Mark first so a crash can't refund twice (refunds are also idempotent at Payze).
      const { data: claimed } = await admin
        .from('bookings')
        .update({ settled_at: new Date().toISOString(), payout_cents: s.payoutCents, refund_cents: s.refundCents })
        .eq('id', b.id)
        .is('settled_at', null)
        .select('id');
      if (!claimed?.length) continue;
      await refund(b.payment_id, s.refundCents, b.id);
      await notify(b.worker_id, 'Hours confirmed', `Your pay for "${shift.role_title}" will reach your bank account by the next working day.`);
      report.settled++;
    } catch (e) {
      report.errors.push(`settle ${b.id}: ${(e as Error).message}`);
    }
  }

  // 4. Reminders the day before and 2 hours before.
  // A shift booked at short notice skips the day-before reminder.
  for (const [flag, hours, minHours, label] of [
    ['reminded_day_before', 24, 2, 'within a day'],
    ['reminded_two_hours', 2, 0, 'in 2 hours'],
  ] as const) {
    const { data: upcoming } = await admin
      .from('bookings')
      .select('id, worker_id, shifts!inner(role_title, starts_at)')
      .eq('status', 'claimed')
      .eq(flag, false)
      .lte('shifts.starts_at', new Date(Date.now() + hours * 3_600_000).toISOString())
      .gt('shifts.starts_at', new Date(Date.now() + minHours * 3_600_000).toISOString())
      .limit(200);
    for (const b of upcoming ?? []) {
      const shift = b.shifts as unknown as { role_title: string };
      await admin.from('bookings').update({ [flag]: true }).eq('id', b.id);
      await notify(b.worker_id, 'Shift reminder', `Your "${shift.role_title}" shift starts ${label}. Check in when you arrive.`, { booking_id: b.id });
    }
  }

  // 5. Close shifts with nothing left to settle.
  await admin.rpc('complete_finished_shifts');

  return json(report);
});
