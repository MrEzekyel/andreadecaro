-- Ripristina l'automatismo tolto dalla 0025, risolvendo il duplicato invece di
-- rinunciarci: i piani devono inserire la rata da soli il giorno stabilito,
-- senza aspettare l'estratto conto.
--
-- La chiave e' dire la verita' sul dato. La rata generata da un piano non e'
-- un acquisto: e' una **previsione**. Non ha quote ne' prezzo — quelli li sa
-- solo il broker — quindi vale il suo importo, conta nel saldo, e resta fuori
-- da prezzo medio e rendimento, che altrimenti verrebbero calcolati su un
-- acquisto mai avvenuto a un prezzo mai pagato.

alter table public.investments drop constraint if exists investments_status_check;
alter table public.investments add constraint investments_status_check
  check (status in ('settled', 'pending', 'estimated'));

comment on column public.investments.status is
  'settled = eseguita, con quote e prezzo. pending = addebitata dal broker e '
  'in attesa di esecuzione (private market). estimated = rata prevista da un '
  'piano di accumulo, in attesa dell''operazione vera dall''estratto conto.';

-- Quando arriva l'operazione vera, la stima di quel mese sparisce da sola.
-- E' questo che rende sicuro l'automatismo: senza, ogni import raddoppierebbe
-- le rate del periodo che copre.
create or replace function public.drop_superseded_estimates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.source = 'import' and new.asset_id is not null then
    delete from public.investments e
    where e.user_id = new.user_id
      and e.asset_id = new.asset_id
      and e.status = 'estimated'
      and date_trunc('month', e.occurred_at) = date_trunc('month', new.occurred_at);
  end if;
  return new;
end;
$$;

revoke all on function public.drop_superseded_estimates() from public, anon, authenticated;

drop trigger if exists investments_drop_estimates on public.investments;
create trigger investments_drop_estimates
  after insert on public.investments
  for each row execute function public.drop_superseded_estimates();

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
    -- stima non serve piu' prima ancora di nascere.
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
        v_rule.card_name, v_rule.next_run_on::timestamptz,
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

select cron.schedule(
  'materialize-investments-daily',
  '0 3 * * *',
  $$select public.materialize_investments()$$
);

-- Anche le rate stimate valgono il loro importo finche' non diventano quote:
-- il denaro ha lasciato il conto il giorno stabilito, e lasciarle fuori
-- farebbe scendere il portafoglio ogni volta che un piano versa, salvo
-- risalire quando arriva l'estratto.
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
    -- Uscito dal conto ma non ancora convertito in quote: vale il suo costo.
    -- Vale sia per gli ordini che il broker deve ancora eseguire sia per le
    -- rate previste dai piani in attesa dell'estratto conto.
    left join lateral (
      select sum(o.amount) as in_transito
      from op o
      where o.asset_id = a.id and o.kind = 'buy'
        and o.addebito <= g.d
        and (o.status <> 'settled' or o.esecuzione > g.d)
    ) t on true
    group by g.d
  )
  select c.d, round(v.val, 2), round(c.versato, 2)
  from capitale c join valore v on v.d = c.d
  order by c.d;
$$;

revoke all on function public.portfolio_daily(uuid, text) from public, anon;
grant execute on function public.portfolio_daily(uuid, text) to authenticated;
