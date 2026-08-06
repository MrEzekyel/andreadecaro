-- Serie giornaliera filtrabile anche per gruppo, cosi' ogni sezione della
-- schermata puo' avere il suo grafico senza ricalcolare niente sul telefono.
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

revoke all on function public.portfolio_daily(uuid, text) from public, anon;
grant execute on function public.portfolio_daily(uuid, text) to authenticated;

-- I piani di accumulo puntano a un asset invece che a un nome scritto a mano:
-- e' lo stesso motivo per cui esiste `assets`, e senza il collegamento il
-- piano non saprebbe in quale sezione del portafoglio finisce.
alter table public.investment_rules
  add column if not exists asset_id uuid references public.assets (id) on delete set null;

update public.investment_rules r
set asset_id = a.id
from public.assets a
where a.user_id = r.user_id and r.asset_id is null
  and (a.name = r.label
       or (r.label = 'Apollo' and a.name = 'Apollo Global Private Markets')
       or (r.label = 'EQT' and a.name = 'EQT Nexus')
       or (r.label = 'AI & Semiconductors ETF' and a.name = 'AI Semiconductor & Quantum'));

create index if not exists investment_rules_asset_idx
  on public.investment_rules (asset_id);
