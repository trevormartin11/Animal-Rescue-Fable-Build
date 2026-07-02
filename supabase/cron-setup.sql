-- Scheduled jobs (already applied to the Supabase project via pg_cron + pg_net).
-- Kept here for reference. If the app's domain changes, update the URLs:
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'biscuit-inbox-sync'), command := $$...$$);
-- Replace <CRON_SECRET> with the value of the CRON_SECRET env var.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'biscuit-inbox-sync',
  '*/10 * * * *',
  $$select net.http_get(
      url := 'https://animal-rescue-fable-build.vercel.app/api/cron/sync',
      headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
      timeout_milliseconds := 290000
    );$$
);

select cron.schedule(
  'biscuit-monthly-recap',
  '0 16 1 * *',
  $$select net.http_get(
      url := 'https://animal-rescue-fable-build.vercel.app/api/cron/recap',
      headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
      timeout_milliseconds := 290000
    );$$
);
