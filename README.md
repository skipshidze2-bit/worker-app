# Worker App

A phone app for one-day jobs in Tbilisi, Georgia. Businesses post shifts, verified workers claim them, and the app handles payment, check-in and ratings.

It follows the plan in the project's strategy notes: **employers pay a markup per shift, workers use it for free**, and the app stays worth using (so people don't swap numbers and leave) because pay is guaranteed, no-shows are replaced, and reputation only builds here.

## What's in version 1

| Area | What it does | Where |
|---|---|---|
| Sign-up | Phone number + SMS code. Workers add skills, areas, an ID photo and a selfie; employers add their business. | `src/app/sign-in.tsx`, `src/app/onboarding.tsx` |
| Shift feed | Open shifts with pay, time, area and employer rating. One tap to claim. | `src/app/(worker)/index.tsx`, `src/app/shift/[id].tsx` |
| Posting | Role, date, times, workers, pay, address. Shows the **total price (wage + fee) before posting**. Optional "favorites first" window for rebooking. | `src/app/(employer)/post.tsx` |
| Escrow payments | Charging the employer's saved card (Payze, in GEL) when a worker books, holding the money, refunding unworked hours, no-shows and cancellations. | `supabase/functions/_shared/payze.ts`, `claim-shift`, `shift-cron` |
| Worker payouts | Workers add their Georgian IBAN. Once hours are confirmed, the booking joins the admin payout list; the admin sends a bank transfer (or shares the list for a bulk upload) and marks it sent. | `src/app/payments.tsx`, `src/app/admin.tsx`, `admin_mark_paid()` |
| Check-in / out | GPS check-in within 300 m of the site, from 30 min before the start. | `src/app/booking/[id].tsx`, `check_in()` in the migration |
| Hours & ratings | Employer confirms or adjusts hours; auto-confirmed after 24h. Both sides rate each other. | `confirm_hours()`, `auto_confirm_hours()`, `rate_booking()` |
| Masked chat | Phone numbers (including spelled-out ones), emails, links, @handles and "WhatsApp/Telegram/call me" are hidden server-side and logged. | `supabase/functions/_shared/contact-mask.ts`, `send-message` |
| No-shows | 15 min after the start without check-in: employer refunded, shift reopened as urgent, worker gets a strike. 3 strikes suspend. | `mark_no_shows()`, `shift-cron` |
| Cancellations | Employer cancelling within 24h pays the worker 50% of the wage. Worker cancelling within 24h gets a strike. | `supabase/functions/cancel-booking` |
| Favorites & rebook | Favorite workers see new shifts first and cost 12% instead of 25%. | `src/app/(employer)/workers.tsx` |
| Admin | Approve or reject IDs, send worker payouts, review contact-sharing attempts, suspend accounts. | `src/app/admin.tsx` |
| Notifications | Push for bookings, chat, cancellations, payouts, and reminders 24h and 2h before a shift. | `src/lib/push.ts`, `notify()` in `_shared/server.ts` |

### How contact details stay private
- Phone numbers and payment ids live in `private_profiles`, which only the owner can read.
- The exact address is in `shift_locations`, visible only to the employer and workers with a paid booking.
- Chat can only be written through the `send-message` function, which masks contact info before storing it.
- Bios and shift descriptions are rejected by the database if they contain phone numbers, emails or social handles.
- Bookings, money, strikes and ratings can't be edited from the app; only database functions and edge functions change them.

### Pricing (in `supabase/functions/_shared/pricing.ts`)
| | Fee on top of wages |
|---|---|
| First booking with a worker | 25% |
| Repeat worker or favorite | 12% |
| Shift starts within 24h | +7.5% |
| Workers | 0% |

## Not built yet
- Masked phone calls on the day of the shift (Twilio Proxy or similar).
- Invoices as PDFs (Payze receipts cover each charge for now).
- Automatic worker payouts through a bank API (payouts are a daily admin task for now).
- Disputes and refunds inside the admin screen (use the Payze and Supabase dashboards).
- Employer subscriptions, instant pay, background checks, promoted posts, a web dashboard.

## Run it

You need Node 22, a [Supabase](https://supabase.com) project and a [Payze](https://payze.io) merchant account (Stripe doesn't support businesses in Georgia).

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
```

**Backend**
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push                          # applies supabase/migrations
npx supabase secrets set PAYZE_API_KEY=... PAYZE_API_SECRET=... CRON_SECRET=<random>
# optional: PAYZE_API_URL (sandbox), PAYZE_WEBHOOK_SECRET if different from the API secret
npx supabase functions deploy
```
Then:
- Payze sends payment notifications to `https://<ref>.supabase.co/functions/v1/payze-webhook` (the functions pass this URL with each payment).
- **Test the Payze calls in their sandbox first.** The request and webhook field names in `_shared/payze.ts` follow Payze's public docs but haven't been run against a live account yet.
- Run `supabase/cron.sql` in the SQL editor to schedule `shift-cron` every 5 minutes.
- In Supabase Auth, enable phone sign-in with an SMS provider (Twilio, MessageBird, Vonage).
- To make yourself an admin: `update profiles set role = 'admin' where id = '<your user id>';`

For local development, `npx supabase start` runs everything in Docker, and the numbers in `supabase/config.toml` sign in with code `123456`.

**App**
```bash
npx expo run:ios       # or run:android. Push notifications need a development build, not Expo Go.
```
`npx expo start --web` works for trying the screens without payments.

## Checks
```bash
npx tsc --noEmit && npx eslint .     # app types and lint
npm test                             # pricing and contact-masking rules
cd supabase/functions && deno check */index.ts
# database rules, against any Postgres 16:
psql -f supabase/tests/supabase-stub.sql -f supabase/migrations/20260927000000_init.sql -f supabase/tests/rls.test.sql
```
CI runs all of these on every pull request.

## Before launch
- Ask a lawyer whether collecting employers' money and paying workers needs registration with the National Bank of Georgia, or whether Payze's split payments to workers' IBANs should be used instead.
- Check with a lawyer how workers must be classified, and whether the platform must be the employer of record.
- Write the terms of service with the no-bypass clause and the permanent-hire fee.
