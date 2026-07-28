create extension if not exists pg_cron;

-- Ogni notte alle 03:00 UTC genera le spese ricorrenti dovute.
select cron.schedule(
  'materialize-recurring-daily',
  '0 3 * * *',
  $$select public.materialize_recurring()$$
);
