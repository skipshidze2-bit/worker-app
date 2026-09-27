// Keeps payment readiness flags in sync with Stripe.
import { admin, stripe } from '../_shared/server.ts';

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature') ?? '';
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, SECRET);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  switch (event.type) {
    case 'setup_intent.succeeded': {
      const userId = event.data.object.metadata?.user_id;
      if (userId) await admin.from('private_profiles').update({ has_payment_method: true }).eq('id', userId);
      break;
    }
    case 'account.updated': {
      const account = event.data.object;
      await admin
        .from('private_profiles')
        .update({ payouts_enabled: account.payouts_enabled === true && account.capabilities?.transfers === 'active' })
        .eq('stripe_account_id', account.id);
      break;
    }
  }
  return new Response('ok');
});
