// Helpers for edge functions (Deno). Not imported by the app.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

/** Service-role client: bypasses RLS. Only use after checking who the caller is. */
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'not signed in');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'not signed in');
  return data.user;
}

/** Wraps a handler with CORS, JSON parsing and error responses. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      const message = (e as { message?: string })?.message ?? 'unexpected error';
      // Postgres raise exception messages are meant for the user.
      if ((e as { code?: string })?.code === 'P0001') return json({ error: message }, 400);
      console.error(e);
      return json({ error: message }, 500);
    }
  };
}

export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

/** Refunds part of a booking's charge. */
export async function refund(paymentIntentId: string | null, cents: number, bookingId: string) {
  if (!paymentIntentId || cents <= 0) return;
  await stripe.refunds.create(
    { payment_intent: paymentIntentId, amount: cents, metadata: { booking_id: bookingId } },
    { idempotencyKey: `refund-${bookingId}-${cents}` },
  );
}

/** Sends the worker's share to their Stripe Connect account. */
export async function payout(opts: {
  bookingId: string;
  workerId: string;
  cents: number;
  currency: string;
  paymentIntentId: string | null;
}): Promise<string | null> {
  if (opts.cents <= 0) return null;
  const { data: priv } = await admin
    .from('private_profiles')
    .select('stripe_account_id, payouts_enabled')
    .eq('id', opts.workerId)
    .single();
  if (!priv?.stripe_account_id || !priv.payouts_enabled) return null; // retried by shift-cron once set up
  let sourceTransaction: string | undefined;
  if (opts.paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(opts.paymentIntentId);
    sourceTransaction = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  }
  const transfer = await stripe.transfers.create(
    {
      amount: opts.cents,
      currency: opts.currency,
      destination: priv.stripe_account_id,
      transfer_group: opts.bookingId,
      source_transaction: sourceTransaction,
      metadata: { booking_id: opts.bookingId },
    },
    { idempotencyKey: `payout-${opts.bookingId}` },
  );
  return transfer.id;
}

export async function notify(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  const { data: priv } = await admin.from('private_profiles').select('expo_push_token').eq('id', userId).single();
  if (!priv?.expo_push_token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: priv.expo_push_token, title, body, data }),
  }).catch((e) => console.error('push failed', e));
}
