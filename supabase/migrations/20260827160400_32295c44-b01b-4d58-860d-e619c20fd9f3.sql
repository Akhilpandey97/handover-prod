CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('movement-report-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'movement-report-tick');

SELECT cron.schedule(
  'movement-report-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rqwbajayodjndcplzvlk.supabase.co/functions/v1/send-movement-report',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);