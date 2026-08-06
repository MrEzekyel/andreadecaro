-- Ogni sera dopo la chiusura delle borse europee. Non serve piu' spesso: il
-- grafico ragiona per giorni, non per minuti.
select cron.unschedule('sync-prices-daily')
where exists (select 1 from cron.job where jobname = 'sync-prices-daily');

select cron.schedule(
  'sync-prices-daily',
  '30 21 * * *',
  $$select net.http_get(
      url := 'https://wcmxwhmiexhhbqvadbig.supabase.co/functions/v1/sync-prices',
      timeout_milliseconds := 120000
    )$$
);
