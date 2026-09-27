// The only way to write a chat message. Contact details are masked before the
// message is stored, and attempts are logged as bypass signals.
import { maskContactInfo } from '../_shared/contact-mask.ts';
import { admin, handler, HttpError, json, notify, requireUser } from '../_shared/server.ts';

const CHAT_OPEN = ['claimed', 'checked_in', 'checked_out', 'confirmed'];

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const { booking_id, body } = await req.json();
    const text = String(body ?? '').trim().slice(0, 2000);
    if (!booking_id || !text) throw new HttpError(400, 'booking_id and body are required');

    const { data: booking } = await admin
      .from('bookings')
      .select('id, worker_id, status, shifts(employer_id, role_title)')
      .eq('id', booking_id)
      .single();
    const shift = booking?.shifts as unknown as { employer_id: string; role_title: string } | undefined;
    if (!booking || !shift || (booking.worker_id !== user.id && shift.employer_id !== user.id)) {
      throw new HttpError(404, 'booking not found');
    }
    if (!CHAT_OPEN.includes(booking.status)) throw new HttpError(400, 'chat is closed for this booking');

    const result = maskContactInfo(text);
    const { data: message, error } = await admin
      .from('messages')
      .insert({ booking_id, sender_id: user.id, body: result.text, was_masked: result.masked })
      .select()
      .single();
    if (error) throw error;

    if (result.masked) {
      await admin.from('bypass_flags').insert({ user_id: user.id, booking_id, reasons: result.reasons });
    }
    const recipient = user.id === booking.worker_id ? shift.employer_id : booking.worker_id;
    await notify(recipient, shift.role_title, result.text.slice(0, 120), { booking_id });

    return json({ message, masked: result.masked });
  }),
);
