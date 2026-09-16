-- Il cron dei piani di accumulo si e' rotto ogni giorno dal 3 settembre 2026.
--
-- `v_prezzo` e' dichiarata `record`, e in PL/pgSQL un record assegnato a
-- `null` non riacquisisce una struttura valida: la riga sotto lo fa per ogni
-- asset a prezzo pubblico (tutto tranne i due fondi private market),
--
--   v_prezzo := null;
--
-- e la condizione subito dopo, `v_asset.price_source = 'manual' and
-- v_prezzo.close_eur is not null`, prova comunque a leggere
-- `v_prezzo.close_eur` per costruire l'espressione — anche quando il primo
-- operando dell'`and` e' gia' falso, perche' l'accesso a un campo di record
-- in PL/pgSQL ha bisogno del tupdesc del record per essere risolto, non del
-- suo valore booleano finale. Il risultato e' "record v_prezzo is not
-- assigned yet", e siccome la funzione processa tutte le regole attive in un
-- solo blocco senza gestione dell'errore per singola riga, **la prima regola
-- su un asset non manuale manda in eccezione l'intera esecuzione**: zero
-- rate per zero piani, ogni giorno, perche' la transazione della funzione
-- va indietro portandosi via anche gli avanzamenti di `next_run_on` delle
-- regole gia' processate in quel giro.
--
-- Non e' esploso subito perche' i piani creati per primi erano tutti su
-- fondi private market (`price_source = 'manual'`), l'unico ramo che
-- assegna `v_prezzo` con una vera `select ... into`. Il primo piano su un
-- asset a prezzo pubblico ha fatto scattare il difetto.
--
-- La correzione: si sostituisce il record con un booleano che dice se un
-- prezzo manuale e' stato trovato, e il prezzo/data si leggono nelle
-- variabili scalari che servono davvero. Niente piu' `record` che puo'
-- restare "non assegnato".
create or replace function public.materialize_investments()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rule record;
  v_asset record;
  v_prezzo_trovato boolean;
  v_prezzo_eur numeric;
  v_prezzo_data date;
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

      v_prezzo_trovato := false;
      v_prezzo_eur := null;
      v_prezzo_data := null;

      if v_asset.price_source = 'manual' then
        select close_eur, on_date into v_prezzo_eur, v_prezzo_data
        from public.asset_prices
        where asset_id = v_rule.asset_id and on_date <= v_rule.next_run_on
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
          (v_rule.next_run_on::text || ' 10:00')::timestamp at time zone 'Europe/Rome',
          'recurring', 'buy',
          round(v_rule.amount / v_prezzo_eur, 12), v_prezzo_eur,
          'settled', v_prezzo_data,
          'recurring:' || v_rule.id || ':' || v_rule.next_run_on
        )
        on conflict do nothing;
      else
        -- Asset a prezzo pubblico (in attesa della quotazione intraday), o un
        -- fondo private market di cui non si conosce ancora nessun NAV.
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
$function$;
