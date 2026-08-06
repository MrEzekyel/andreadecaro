-- Serie giornaliera del portafoglio: valore di mercato contro capitale netto
-- versato. Sta nel database e non nell'app perche' ricostruirla sul telefono
-- vorrebbe dire scaricare il prezzo di ogni asset per ognuno dei ~700 giorni
-- di storia a ogni apertura della schermata.
--
-- `security invoker` + RLS: la funzione vede solo le righe di chi la chiama.
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
  -- Le operazioni contano dal giorno in cui il denaro si muove davvero: per i
  -- private market e' la data di esecuzione, non quella della prenotazione.
  op as (
    select i.*, coalesce(i.settled_on, i.occurred_at::date) as il_giorno
    from public.investments i
    where i.user_id = auth.uid()
      and i.asset_id in (select id from mie)
      and i.status = 'settled'
  ),
  giorni as (
    select generate_series(min(il_giorno), current_date, interval '1 day')::date as d
    from op
  ),
  -- Capitale netto immobilizzato: i disinvestimenti tornano indietro, i
  -- dividendi non sono capitale versato e restano fuori.
  capitale as (
    select g.d, coalesce((
      select sum(case when o.kind = 'buy' then o.amount
                      when o.kind = 'sell' then -o.amount else 0 end)
      from op o where o.il_giorno <= g.d
    ), 0) as versato
    from giorni g
  ),
  valore as (
    select g.d, sum(coalesce(q.quote, 0) * coalesce(p.close_eur, 0)) as val
    from giorni g
    cross join mie a
    left join lateral (
      select sum(case when o.kind = 'sell' then -o.quantity else o.quantity end) as quote
      from op o
      where o.asset_id = a.id and o.quantity is not null and o.il_giorno <= g.d
    ) q on true
    -- Ultimo prezzo noto a quella data: fra un NAV e l'altro dei fondi private
    -- market il valore resta fermo invece di essere interpolato, perche' un
    -- prezzo intermedio la' in mezzo sarebbe inventato.
    left join lateral (
      select pr.close_eur from public.asset_prices pr
      where pr.asset_id = a.id and pr.on_date <= g.d
      order by pr.on_date desc limit 1
    ) p on true
    group by g.d
  )
  select c.d, round(v.val, 2), round(c.versato, 2)
  from capitale c join valore v on v.d = c.d
  order by c.d;
$$;

revoke all on function public.portfolio_daily(uuid) from public, anon;
grant execute on function public.portfolio_daily(uuid) to authenticated;

-- L'ultimo prezzo noto per ogni asset. Serve alla schermata portafoglio, che
-- altrimenti dovrebbe scaricare tutta la storia dei prezzi per leggerne
-- l'ultima riga.
create or replace function public.latest_asset_prices()
returns table (asset_id uuid, on_date date, close_eur numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (p.asset_id) p.asset_id, p.on_date, p.close_eur
  from public.asset_prices p
  join public.assets a on a.id = p.asset_id and a.user_id = auth.uid()
  order by p.asset_id, p.on_date desc;
$$;

revoke all on function public.latest_asset_prices() from public, anon;
grant execute on function public.latest_asset_prices() to authenticated;
