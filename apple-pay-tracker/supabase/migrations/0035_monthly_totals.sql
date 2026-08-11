-- Totali per mese: spese, introiti, investito.
--
-- Serve ai due grafici a barre della Home (il confronto coi mesi passati
-- nella scheda Uscite, le entrate mese per mese in quella Entrate). Si
-- calcola qui e non sul telefono per la stessa ragione di `portfolio_daily`:
-- aggregare lato app vorrebbe dire scaricare ogni pagamento di sei o dodici
-- mesi solo per sommarli, e PostgREST tronca a 1000 righe **senza dare
-- errore** — un mese vecchio comparirebbe piu' basso del vero senza che
-- niente lo segnali.
--
-- `security invoker` (il default) e non `definer`: qui la RLS serve, non va
-- aggirata. Ogni utente vede i propri totali perche' le policy sulle tabelle
-- sottostanti si applicano a lui.
create or replace function public.monthly_totals(p_months integer default 6)
returns table (
  month date,
  spese numeric,
  introiti numeric,
  investito numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with periodi as (
    select (
      date_trunc('month', (now() at time zone 'Europe/Rome'))::date
      - (scarto || ' months')::interval
    )::date as inizio
    from generate_series(0, greatest(coalesce(p_months, 6), 1) - 1) as scarto
  )
  select
    p.inizio as month,
    -- `effective_amount` e non `amount`: su una cena divisa in quattro il
    -- mese deve contare la propria quota, com'e' ovunque nell'app.
    coalesce((
      select sum(pay.effective_amount)
      from payments pay
      where pay.occurred_at >= p.inizio
        and pay.occurred_at < (p.inizio + interval '1 month')
    ), 0) as spese,
    coalesce((
      select sum(inc.amount)
      from incomes inc
      where inc.occurred_at >= p.inizio
        and inc.occurred_at < (p.inizio + interval '1 month')
    ), 0) as introiti,
    -- Solo gli acquisti eseguiti: vendite e dividendi sono denaro che
    -- rientra, e un ordine non ancora eseguito non ha comprato niente.
    coalesce((
      select sum(inv.amount)
      from investments inv
      where inv.kind = 'buy'
        and inv.status = 'settled'
        and inv.occurred_at >= p.inizio
        and inv.occurred_at < (p.inizio + interval '1 month')
    ), 0) as investito
  from periodi p
  order by p.inizio;
$$;

revoke all on function public.monthly_totals(integer) from public, anon;
grant execute on function public.monthly_totals(integer) to authenticated;
