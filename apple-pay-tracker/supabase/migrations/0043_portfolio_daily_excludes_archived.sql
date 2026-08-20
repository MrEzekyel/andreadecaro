-- `portfolio_daily` non escludeva gli asset archiviati.
--
-- `assets` letta dal client filtra sempre `archived = false` (usePortfolio.ts),
-- quindi `positions`/`totals` — il valore grande in cima a Investimenti — non
-- contano mai un asset archiviato. Questa funzione invece costruiva `mie`
-- (gli asset su cui sommare flussi e valore) senza quel filtro: un asset
-- archiviato restava dentro sia come capitale versato sia come valore di
-- oggi, quindi il grafico "andamento" non ne soffriva quanto l'XIRR (vedi
-- migrazione precedente) — ma se quell'asset performava peggio del resto,
-- trascinava giu' silenziosamente la linea "valore" rispetto a quella
-- "capitale versato" senza che l'header sopra il grafico raccontasse la
-- stessa cosa. Trovato archiviando una posizione crypto in perdita: il
-- grafico mostrava un guadagno vicino allo zero (le due linee quasi
-- coincidenti in punta) mentre il numero grande sopra diceva +11,5%.
create or replace function public.portfolio_daily(
  p_asset uuid default null,
  p_group text default null
)
returns table (on_date date, value_eur numeric, invested_eur numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with mie as (
    select id from public.assets
    where user_id = auth.uid()
      and archived = false
      and (p_asset is null or id = p_asset)
      and (p_group is null or asset_group = p_group)
  ),
  op as (
    select i.*,
      i.occurred_at::date as addebito,
      coalesce(i.settled_on, i.occurred_at::date) as esecuzione
    from public.investments i
    where i.user_id = auth.uid() and i.asset_id in (select id from mie)
  ),
  giorni as (
    select generate_series(min(addebito), current_date, interval '1 day')::date as d
    from op
  ),
  capitale as (
    select g.d, coalesce((
      select sum(case when o.kind = 'buy' then o.amount
                      when o.kind = 'sell' then -o.amount else 0 end)
      from op o where o.addebito <= g.d
    ), 0) as versato
    from giorni g
  ),
  valore as (
    select g.d, sum(
      coalesce(q.quote, 0) * coalesce(p.close_eur, 0) + coalesce(t.in_transito, 0)
    ) as val
    from giorni g
    cross join mie a
    left join lateral (
      select sum(case when o.kind = 'sell' then -o.quantity else o.quantity end) as quote
      from op o
      where o.asset_id = a.id and o.status = 'settled'
        and o.quantity is not null and o.esecuzione <= g.d
    ) q on true
    left join lateral (
      select pr.close_eur from public.asset_prices pr
      where pr.asset_id = a.id and pr.on_date <= g.d
      order by pr.on_date desc limit 1
    ) p on true
    left join lateral (
      select sum(o.amount) as in_transito
      from op o
      where o.asset_id = a.id and o.kind = 'buy'
        and o.addebito <= g.d
        and (o.status = 'pending' or o.esecuzione > g.d)
    ) t on true
    group by g.d
  )
  select c.d, round(v.val, 2), round(c.versato, 2)
  from capitale c join valore v on v.d = c.d
  order by c.d;
$$;
