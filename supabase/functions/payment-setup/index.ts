// Employers: start saving a card with Payze. Returns the hosted card page URL.
// (Workers add their IBAN directly in the app.)
import { savedCardSession } from '../_shared/payze.ts';
import { admin, handler, HttpError, json, requireUser } from '../_shared/server.ts';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'employer') throw new HttpError(400, 'only employers add a card');

    const session = await savedCardSession();
    await admin.from('card_setups').insert({ payment_id: session.paymentId, user_id: user.id });
    return json({ url: session.url });
  }),
);
