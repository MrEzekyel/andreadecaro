-- I fondi private market smettono di passare per uno stato "in esecuzione".
-- Non hanno un prezzo pubblico giornaliero, ma hanno comunque un ultimo NAV
-- noto (dalle esecuzioni reali importate, o da un aggiornamento manuale
-- futuro): si usa quello, l'investimento e' considerato fatto da subito, e
-- quando arriva un NAV piu' recente il valore si aggiorna in avanti — come
-- gia' succede per ogni altro asset. Prima l'attesa di un match preciso con
-- l'esecuzione del broker lasciava il capitale fuori da "investito questo
-- mese" e da ogni somma che filtra sugli acquisti, con la sensazione di
-- "500 diventano 450" senza un motivo leggibile.

-- Backfill: le rate gia' in sospeso si sistemano con l'ultimo NAV noto alla
-- loro data — non l'ultimo in assoluto, quello che si sapeva IN QUEL momento,
-- cosi' il prezzo medio di carico racconta quando sono davvero entrate.
with prezzo as (
  select i.id,
    (select pr.close_eur from public.asset_prices pr
     where pr.asset_id = i.asset_id and pr.on_date <= i.occurred_at::date
     order by pr.on_date desc limit 1) as close_eur,
    (select pr.on_date from public.asset_prices pr
     where pr.asset_id = i.asset_id and pr.on_date <= i.occurred_at::date
     order by pr.on_date desc limit 1) as on_date
  from public.investments i
  join public.assets a on a.id = i.asset_id
  where i.status <> 'settled' and i.kind = 'buy' and a.price_source = 'manual'
)
update public.investments i
set status = 'settled',
    quantity = round(i.amount / p.close_eur, 12),
    unit_price = p.close_eur,
    settled_on = p.on_date
from prezzo p
where p.id = i.id and p.close_eur is not null;

-- I piani sui fondi private market vengono investiti da subito, usando
-- l'ultimo NAV conosciuto in quel momento. Gli altri restano 'estimated' come
-- prima: per loro un prezzo del giorno esiste davvero, e vale la pena
-- aspettarlo invece di stimarlo.
create or replace function public.materialize_investments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule record;
  v_asset record;
  v_prezzo record;
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
    if v_rule.asset_id is not null and not exists (
      select 1 from public.investments i
      where i.user_id = v_rule.user_id
        and i.asset_id = v_rule.asset_id
        and i.source = 'import'
        and date_trunc('month', i.occurred_at)
            = date_trunc('month', v_rule.next_run_on::timestamptz)
    ) then
      select * into v_asset from public.assets where id = v_rule.asset_id;

      if v_asset.price_source = 'manual' then
        select close_eur, on_date into v_prezzo
        from public.asset_prices
        where asset_id = v_rule.asset_id and on_date <= v_rule.next_run_on
        order by on_date desc limit 1;
      else
        v_prezzo := null;
      end if;

      if v_asset.price_source = 'manual' and v_prezzo.close_eur is not null then
        insert into public.investments (
          user_id, asset_id, amount, label, card_name, occurred_at,
          source, kind, quantity, unit_price, status, settled_on, dedup_key
        )
        values (
          v_rule.user_id, v_rule.asset_id, v_rule.amount, v_rule.label,
          v_rule.card_name,
          (v_rule.next_run_on::text || ' 10:00')::timestamp at time zone 'Europe/Rome',
          'recurring', 'buy',
          round(v_rule.amount / v_prezzo.close_eur, 12), v_prezzo.close_eur,
          'settled', v_prezzo.on_date,
          'recurring:' || v_rule.id || ':' || v_rule.next_run_on
        )
        on conflict do nothing;
      else
        -- Asset a prezzo pubblico (in attesa della quotazione intraday), o un
        -- fondo private market di cui non si conosce ancora nessun NAV: caso
        -- limite, non dovrebbe capitare con i sei asset di oggi.
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
      end if;

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
