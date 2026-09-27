-- Run once in the SQL editor after deploying functions. Replace the two placeholders.
-- Schedules shift-cron every 5 minutes (no-shows, auto-confirm, payouts).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'shift-cron',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/shift-cron',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
