-- Il denaro addebitato per un ordine non ancora eseguito resta nel portafoglio:
-- non e' ancora esposto al mercato, ma non e' nemmeno sparito. Tenerlo fuori
-- apriva un buco nella curva fra l'addebito e l'assegnazione delle quote (sui
-- private market sono ~2 settimane ogni mese) e faceva differire il totale da
-- quello che mostra il broker esattamente di quella cifra.
create or replace function public.portfolio_daily(p_asset uuid default null)
returns table (on_date date, value_eur numeric, invested_eur numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with mie as (
    select id from public.assets
    where user_id = auth.uid() and (p_asset is null or id = p_asset)
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
  -- Capitale versato: conta dal giorno in cui il denaro lascia il conto, non da
  -- quando arrivano le quote. I disinvestimenti tornano indietro, i dividendi
  -- non sono capitale versato e restano fuori.
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
    -- Ultimo prezzo noto a quella data: fra un NAV e l'altro dei fondi private
    -- market il valore resta fermo invece di essere interpolato, perche' un
    -- prezzo intermedio la' in mezzo sarebbe inventato.
    left join lateral (
      select pr.close_eur from public.asset_prices pr
      where pr.asset_id = a.id and pr.on_date <= g.d
      order by pr.on_date desc limit 1
    ) p on true
    -- Addebitato ma non ancora convertito in quote: vale il suo costo.
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

revoke all on function public.portfolio_daily(uuid) from public, anon;
grant execute on function public.portfolio_daily(uuid) to authenticated;
