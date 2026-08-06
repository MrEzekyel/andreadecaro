-- Le rate hanno un orario preciso: le 10 del mattino, ora italiana, e il
-- prezzo e' quello di quel momento — non la chiusura di sera.
--
-- L'orario va scritto come "10:00 a Roma" e non come un orario UTC fisso,
-- altrimenti a ogni cambio di ora legale l'acquisto slitterebbe di un'ora, e
-- con un prezzo intraday quello slittamento si vedrebbe nei numeri.
-- `at time zone 'Europe/Rome'` risolve l'offset giusto per la data della rata.
create or replace function public.materialize_investments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule record;
  v_created integer := 0;
begin
  for v_rule in
    select * from public.investment_rules
    where active
      and next_run_on <= current_date
      and start_on <= current_date
      and (end_on is null or next_run_on <= end_on)
    for update skip locked
  loop
    -- Se l'operazione vera di quel mese e' gia' arrivata dall'estratto, la
    -- rata calcolata non serve piu' prima ancora di nascere.
    if v_rule.asset_id is not null and not exists (
      select 1 from public.investments i
      where i.user_id = v_rule.user_id
        and i.asset_id = v_rule.asset_id
        and i.source = 'import'
        and date_trunc('month', i.occurred_at)
            = date_trunc('month', v_rule.next_run_on::timestamptz)
    ) then
      insert into public.investments (
        user_id, asset_id, amount, label, card_name, occurred_at,
        source, kind, status, dedup_key
      )
      values (
        v_rule.user_id, v_rule.asset_id, v_rule.amount, v_rule.label,
        v_rule.card_name,
        (v_rule.next_run_on::text || ' 10:00')::timestamp at time zone 'Europe/Rome',
        'recurring', 'buy', 'estimated',
        'recurring:' || v_rule.id || ':' || v_rule.next_run_on
      )
      on conflict do nothing;

      v_created := v_created + 1;
    end if;

    update public.investment_rules
    set next_run_on = public.next_occurrence(
      v_rule.next_run_on, v_rule.frequency, v_rule.day_of_month, v_rule.weekday
    )
    where id = v_rule.id;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.materialize_investments() from public, anon, authenticated;

-- La rata deve esistere prima delle 10 italiane. 05:00 UTC ci sta sia con
-- l'ora legale sia con quella solare.
select cron.unschedule('materialize-investments-daily')
where exists (select 1 from cron.job where jobname = 'materialize-investments-daily');

select cron.schedule(
  'materialize-investments-daily',
  '0 5 * * *',
  $$select public.materialize_investments()$$
);

-- Il completamento passa alla Edge Function `settle-instalments`: il prezzo di
-- un istante preciso va chiesto alla fonte intraday, e il database da solo non
-- ci arriva.
select cron.unschedule('settle-plan-instalments-daily')
where exists (select 1 from cron.job where jobname = 'settle-plan-instalments-daily');

drop function if exists public.settle_plan_instalments();

select cron.unschedule('settle-instalments-daily')
where exists (select 1 from cron.job where jobname = 'settle-instalments-daily');

-- 09:00 UTC = 11:00 a Roma d'estate, 10:00 d'inverno: in entrambi i casi la
-- quotazione delle 10 italiane esiste gia'. Il secondo giro serale recupera i
-- casi in cui a quell'ora non c'era ancora (titoli poco scambiati, festivi).
select cron.schedule(
  'settle-instalments-daily',
  '0 9,20 * * *',
  $$select net.http_get(
      url := 'https://wcmxwhmiexhhbqvadbig.supabase.co/functions/v1/settle-instalments',
      timeout_milliseconds := 120000
    )$$
);
