// Either side cancels a booking. Late employer cancellations still pay the
// worker part of the wage; late worker cancellations earn a strike.
import { settleCancellation } from '../_shared/pricing.ts';
import { admin, handler, hoursUntil, HttpError, json, notify, payout, refund, requireUser } from '../_shared/server.ts';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const { booking_id } = await req.json();

    const { data: b } = await admin
      .from('bookings')
      .select('*, shifts(employer_id, starts_at, role_title, currency)')
      .eq('id', booking_id)
      .single();
    const shift = b?.shifts as { employer_id: string; starts_at: string; role_title: string; currency: string } | undefined;
    if (!b || !shift) throw new HttpError(404, 'booking not found');

    const by = user.id === b.worker_id ? 'worker' : user.id === shift.employer_id ? 'employer' : null;
    if (!by) throw new HttpError(404, 'booking not found');
    if (b.status !== 'claimed') throw new HttpError(400, 'only upcoming bookings can be cancelled');

    const hoursBeforeStart = hoursUntil(shift.starts_at);
    const s = settleCancellation({
      by,
      hoursBeforeStart,
      chargedWageCents: b.wage_cents ?? 0,
      chargedFeeCents: b.fee_cents ?? 0,
    });

    // Claim the row first so a double tap can't refund twice.
    const { data: claimed } = await admin
      .from('bookings')
      .update({
        status: by === 'worker' ? 'cancelled_by_worker' : 'cancelled_by_employer',
        cancelled_at: new Date().toISOString(),
        refund_cents: s.refundCents,
        payout_cents: s.payoutCents,
      })
      .eq('id', booking_id)
      .eq('status', 'claimed')
      .select('id');
    if (!claimed?.length) throw new HttpError(409, 'booking already changed');

    await refund(b.payment_intent_id, s.refundCents, booking_id);
    if (s.payoutCents > 0) {
      const transferId = await payout({
        bookingId: booking_id,
        workerId: b.worker_id,
        cents: s.payoutCents,
        currency: shift.currency,
        paymentIntentId: b.payment_intent_id,
      });
      if (transferId) await admin.from('bookings').update({ transfer_id: transferId }).eq('id', booking_id);
    }

    if (by === 'worker') {
      if (s.late) await admin.rpc('add_strike', { p_worker_id: b.worker_id, p_booking_id: booking_id, p_reason: 'late cancellation' });
      // Reopen as urgent so someone else can take it.
      await admin.from('shifts').update({ is_urgent: hoursBeforeStart < 24 }).eq('id', b.shift_id);
      await notify(shift.employer_id, 'Worker cancelled', `We've reopened "${shift.role_title}" to find a replacement.`);
    } else {
      await notify(b.worker_id, 'Shift cancelled', s.payoutCents > 0
        ? `"${shift.role_title}" was cancelled late. You'll still be paid part of the wage.`
        : `"${shift.role_title}" was cancelled by the employer.`);
    }

    return json({ cancelled: true, late: s.late, refund_cents: s.refundCents, payout_cents: s.payoutCents });
  }),
);
