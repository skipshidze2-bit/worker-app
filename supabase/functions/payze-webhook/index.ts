// Payze payment notifications. Saves employers' card tokens after the card page.
import { verifyWebhook } from '../_shared/payze.ts';
import { admin } from '../_shared/server.ts';

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyWebhook(raw, req.headers.get('X-HMAC-Signature')))) {
    return new Response('bad signature', { status: 401 });
  }
  const event = JSON.parse(raw);
  const paymentId: string | undefined = event.PaymentId ?? event.paymentId;
  const token: string | undefined = event.Token ?? event.CardPayment?.Token;
  const status: string = event.PaymentStatus ?? event.Status ?? '';

  if (paymentId && token && ['Captured', 'Blocked', 'Succeeded', 'Paid', 'Refunded'].includes(status)) {
    const { data: setup } = await admin.from('card_setups').select('user_id').eq('payment_id', paymentId).maybeSingle();
    if (setup) {
      await admin
        .from('private_profiles')
        .update({ card_token: token, card_mask: event.CardMask ?? null, has_payment_method: true })
        .eq('id', setup.user_id);
      await admin.from('card_setups').delete().eq('payment_id', paymentId);
    }
  }
  return new Response('ok');
});
