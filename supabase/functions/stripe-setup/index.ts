// Employers: save a card (Stripe customer + SetupIntent for the PaymentSheet).
// Workers: create a Stripe Connect Express account and return the onboarding link.
import { admin, handler, HttpError, json, requireUser, stripe } from '../_shared/server.ts';

const RETURN_URL = Deno.env.get('APP_RETURN_URL') ?? 'workerapp://payments';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', user.id).single();
    const { data: priv } = await admin.from('private_profiles').select('*').eq('id', user.id).single();
    if (!profile || !priv) throw new HttpError(400, 'finish your profile first');

    if (profile.role === 'employer') {
      let customerId = priv.stripe_customer_id as string | null;
      if (!customerId) {
        const { data: business } = await admin.from('businesses').select('name').eq('owner_id', user.id).single();
        const customer = await stripe.customers.create({
          name: business?.name ?? profile.full_name,
          phone: priv.phone ?? undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await admin.from('private_profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
      }
      const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2024-06-20' });
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: { user_id: user.id },
      });
      return json({
        customer_id: customerId,
        ephemeral_key: ephemeralKey.secret,
        setup_intent_client_secret: setupIntent.client_secret,
        publishable_key: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
      });
    }

    if (profile.role === 'worker') {
      let accountId = priv.stripe_account_id as string | null;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: Deno.env.get('STRIPE_CONNECT_COUNTRY') ?? 'US',
          capabilities: { transfers: { requested: true } },
          business_type: 'individual',
          metadata: { user_id: user.id },
        });
        accountId = account.id;
        await admin.from('private_profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: RETURN_URL,
        return_url: RETURN_URL,
      });
      return json({ onboarding_url: link.url });
    }

    throw new HttpError(400, 'unsupported role');
  }),
);
