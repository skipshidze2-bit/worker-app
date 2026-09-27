// Payze (payze.io) card payments for Georgia. Used by edge functions only.
//
// Flow:
//   1. Employer saves a card: savedCardSession() returns a hosted page URL. After
//      the employer enters the card (with 3-D Secure), Payze calls the webhook
//      with the card token.
//   2. When a worker books, chargeSavedCard() charges that token off-session.
//   3. refund() returns unworked hours, no-shows and cancellations.
// Worker pay goes out by bank transfer to their IBAN (see admin payout list).
//
// Request and webhook field names follow Payze's v2 API docs
// (https://docs.payze.io). Confirm them against the sandbox before going live.

const API = Deno.env.get('PAYZE_API_URL') ?? 'https://payze.io/v2/api';
const KEY = Deno.env.get('PAYZE_API_KEY') ?? '';
const SECRET = Deno.env.get('PAYZE_API_SECRET') ?? '';
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payze-webhook`;
const RETURN_URL = Deno.env.get('APP_RETURN_URL') ?? 'workerapp://payments';

type PayzePayment = { transactionId?: string; paymentId?: string; paymentUrl?: string; status?: string };

async function call(method: 'PUT' | 'GET', path: string, body?: unknown, idempotencyKey?: string): Promise<PayzePayment> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `${KEY}:${SECRET}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status?.errors?.length) {
    throw new Error(`Payze ${path} failed: ${JSON.stringify(json?.status?.errors ?? json).slice(0, 300)}`);
  }
  return (json?.data?.payment ?? json?.data ?? {}) as PayzePayment;
}

const toGel = (cents: number) => Math.round(cents) / 100;

function hooks() {
  return {
    webhookGateway: WEBHOOK_URL,
    successRedirectGateway: `${RETURN_URL}?card=saved`,
    errorRedirectGateway: `${RETURN_URL}?card=failed`,
  };
}

/** Starts a card-saving session. A small verification amount is blocked and released. */
export async function savedCardSession(): Promise<{ paymentId: string; url: string }> {
  const p = await call('PUT', '/payment', {
    source: 'Card',
    amount: 0,
    currency: 'GEL',
    language: 'KA',
    hooks: hooks(),
    cardPayment: { tokenizeCard: true },
  });
  if (!p.paymentUrl) throw new Error('Payze did not return a payment page');
  return { paymentId: (p.paymentId ?? p.transactionId)!, url: p.paymentUrl };
}

/** Charges a saved card without the cardholder present. */
export async function chargeSavedCard(opts: {
  token: string;
  amountCents: number;
  currency: string;
  bookingId: string;
  description: string;
}): Promise<{ paymentId: string; status: string }> {
  const p = await call(
    'PUT',
    '/payment',
    {
      source: 'Card',
      amount: toGel(opts.amountCents),
      currency: opts.currency.toUpperCase(),
      language: 'KA',
      hooks: hooks(),
      metadata: { order: { orderId: opts.bookingId, description: opts.description } },
      cardPayment: { token: opts.token },
    },
    `charge-${opts.bookingId}-${opts.amountCents}`,
  );
  return { paymentId: (p.paymentId ?? p.transactionId)!, status: p.status ?? 'Unknown' };
}

export async function refund(paymentId: string | null, amountCents: number, bookingId: string): Promise<void> {
  if (!paymentId || amountCents <= 0) return;
  await call('PUT', '/payment/refund', { transactionId: paymentId, amount: toGel(amountCents) }, `refund-${bookingId}-${amountCents}`);
}

/** Payze signs webhooks with HMAC-SHA256 of the raw body in the X-HMAC-Signature header. */
export async function verifyWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = Deno.env.get('PAYZE_WEBHOOK_SECRET') ?? SECRET;
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = btoa(String.fromCharCode(...mac));
  const given = signature.trim().toLowerCase();
  return given === hex || signature.trim() === b64;
}

/** Statuses Payze reports for a successful charge. */
export const PAID_STATUSES = new Set(['Captured', 'Blocked', 'Succeeded', 'Paid']);
