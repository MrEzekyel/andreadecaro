-- Le rate dei piani cadono nel giorno in cui Trade Republic le esegue davvero.
--
-- Trade Republic esegue i piani il 2 (o 9, 16, 23) del mese, ma solo a borsa
-- aperta: se quel giorno e' sabato, domenica o una chiusura Xetra, l'ordine
-- passa al primo giorno di borsa successivo. Da qui le date "che si spostano"
-- negli estratti: 4 maggio 2026 (il 2 era sabato), 3 agosto (domenica),
-- 2 ottobre (venerdi'). Non e' un intervallo fisso di giorni.
--
-- La regola conserva il giorno nominale (`day_of_month`, `next_run_on`), e la
-- data effettiva si calcola al momento: cosi' il mese dopo riparte dal 2, non
-- dal giorno a cui si era spostato.

-- Domenica di Pasqua (algoritmo gregoriano anonimo / Meeus).
create or replace function public.easter_sunday(p_year integer)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  v_month int := (h + l - 7 * m + 114) / 31;
  v_day int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_year, v_month, v_day);
end;
$$;

-- Primo giorno di borsa Xetra a partire da `p_day` (incluso). Chiusure:
-- weekend, 1 gennaio, Venerdi' Santo, Lunedi' dell'Angelo, 1 maggio,
-- 24/25/26 e 31 dicembre.
create or replace function public.xetra_trading_day(p_day date)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_day date := p_day;
  v_easter date;
begin
  loop
    v_easter := public.easter_sunday(extract(year from v_day)::int);
    exit when extract(isodow from v_day) < 6
      and v_day <> v_easter - 2
      and v_day <> v_easter + 1
      and to_char(v_day, 'MM-DD') not in ('01-01', '05-01', '12-24', '12-25', '12-26', '12-31');
    v_day := v_day + 1;
  end loop;
  return v_day;
end;
$$;

create or replace function public.materialize_investments()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rule record;
  v_asset record;
  v_esecuzione date;
  v_prezzo_trovato boolean;
  v_prezzo_eur numeric;
  v_prezzo_data date;
  v_created integer := 0;
begin
  for v_rule in
    select * from public.investment_rules
    where active
      and public.xetra_trading_day(next_run_on) <= current_date
      and start_on <= current_date
      and (end_on is null or next_run_on <= end_on)
    for update skip locked
  loop
    v_esecuzione := public.xetra_trading_day(v_rule.next_run_on);

    if v_rule.asset_id is not null and not exists (
      select 1 from public.investments i
      where i.user_id = v_rule.user_id
        and i.asset_id = v_rule.asset_id
        and i.source = 'import'
        and date_trunc('month', i.occurred_at)
            = date_trunc('month', v_esecuzione::timestamptz)
    ) then
      select * into v_asset from public.assets where id = v_rule.asset_id;

      v_prezzo_trovato := false;
      v_prezzo_eur := null;
      v_prezzo_data := null;

      if v_asset.price_source = 'manual' then
        select close_eur, on_date into v_prezzo_eur, v_prezzo_data
        from public.asset_prices
        where asset_id = v_rule.asset_id and on_date <= v_esecuzione
        order by on_date desc limit 1;
        v_prezzo_trovato := v_prezzo_eur is not null;
      end if;

      if v_prezzo_trovato then
        insert into public.investments (
          user_id, asset_id, amount, label, card_name, occurred_at,
          source, kind, quantity, unit_price, status, settled_on, dedup_key
        )
        values (
          v_rule.user_id, v_rule.asset_id, v_rule.amount, v_rule.label,
          v_rule.card_name,
          (v_esecuzione::text || ' 10:00')::timestamp at time zone 'Europe/Rome',
          'recurring', 'buy',
          round(v_rule.amount / v_prezzo_eur, 12), v_prezzo_eur,
          'settled', v_prezzo_data,
          'recurring:' || v_rule.id || ':' || v_rule.next_run_on
        )
        on conflict do nothing;
      else
        insert into public.investments (
          user_id, asset_id, amount, label, card_name, occurred_at,
          source, kind, status, dedup_key
        )
        values (
          v_rule.user_id, v_rule.asset_id, v_rule.amount, v_rule.label,
          v_rule.card_name,
          (v_esecuzione::text || ' 10:00')::timestamp at time zone 'Europe/Rome',
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
$function$;

revoke all on function public.materialize_investments() from public, anon, authenticated;

-- I piani erano impostati al 3, ma Trade Republic esegue il 2: si riallineano.
update public.investment_rules
set day_of_month = 2,
    next_run_on = make_date(
      extract(year from next_run_on)::int, extract(month from next_run_on)::int, 2
    )
where frequency = 'monthly' and day_of_month = 3;
