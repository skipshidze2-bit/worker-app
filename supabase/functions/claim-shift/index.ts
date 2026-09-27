// Worker claims a shift: reserve the slot, charge the employer's saved card into
// escrow (held on the platform until the worker is paid), then confirm the booking.
import { quoteBooking, shiftMinutes } from '../_shared/pricing.ts';
import { chargeSavedCard, PAID_STATUSES } from '../_shared/payze.ts';
import { admin, handler, hoursUntil, HttpError, json, notify, requireUser } from '../_shared/server.ts';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const { shift_id } = await req.json();
    if (!shift_id) throw new HttpError(400, 'shift_id is required');

    const { data: reserved, error } = await admin.rpc('reserve_shift', { p_shift_id: shift_id, p_worker_id: user.id });
    if (error) throw error;
    const { booking_id, is_repeat } = reserved[0];

    const { data: shift } = await admin.from('shifts').select('*').eq('id', shift_id).single();
    const quote = quoteBooking({
      hourlyRateCents: shift.hourly_rate_cents,
      minutes: shiftMinutes(shift.starts_at, shift.ends_at),
      isRepeat: is_repeat,
      hoursUntilStart: hoursUntil(shift.starts_at),
    });

    const { data: employer } = await admin
      .from('private_profiles')
      .select('card_token')
      .eq('id', shift.employer_id)
      .single();

    try {
      if (!employer?.card_token) throw new Error('employer has no card on file');
      const charge = await chargeSavedCard({
        token: employer.card_token,
        amountCents: quote.totalCents,
        currency: shift.currency,
        bookingId: booking_id,
        description: `${shift.role_title} shift ${shift.starts_at}`,
      });
      if (!PAID_STATUSES.has(charge.status)) throw new Error(`payment ${charge.status}`);

      await admin
        .from('bookings')
        .update({
          status: 'claimed',
          payment_id: charge.paymentId,
          wage_cents: quote.wageCents,
          fee_cents: quote.feeCents,
          fee_bps: quote.feeBps,
        })
        .eq('id', booking_id);
    } catch (e) {
      // Release the slot; the worker sees why it failed.
      await admin.from('bookings').update({ status: 'cancelled_by_employer', cancelled_at: new Date().toISOString() }).eq('id', booking_id);
      await notify(shift.employer_id, 'Payment failed', `A worker tried to book "${shift.role_title}" but your card was declined.`);
      console.error('charge failed', e);
      throw new HttpError(402, "The employer's payment didn't go through, so this shift can't be booked right now.");
    }

    await notify(shift.employer_id, 'Shift booked', `A worker booked "${shift.role_title}".`, { shift_id });
    return json({ booking_id, wage_cents: quote.wageCents });
  }),
);
