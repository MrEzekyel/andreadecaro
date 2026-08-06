-- I piani di accumulo non generano piu' le operazioni: quelle arrivano
-- dall'estratto conto del broker, e una regola che creasse anche la rata
-- stimata la farebbe contare due volte.
--
-- Va tolta la schedulazione, non solo disattivate le regole: finche' il job
-- esiste, riattivare un piano dalla schermata PAC ricomincerebbe a duplicare
-- in silenzio dalla notte dopo — una trappola lasciata armata.
select cron.unschedule('materialize-investments-daily')
where exists (select 1 from cron.job where jobname = 'materialize-investments-daily');

-- I piani tornano attivi: ora "attivo" descrive un piano in corso presso il
-- broker, non qualcosa che scrive righe.
update public.investment_rules set active = true where end_on is null;
