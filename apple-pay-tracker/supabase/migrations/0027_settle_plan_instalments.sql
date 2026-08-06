-- Le rate dei piani si completano da sole, senza estratto conto.
--
-- Il pezzo mancante di una rata appena inserita sono le quote comprate. Ma
-- quote = importo / prezzo del giorno, e il prezzo del giorno l'app lo scarica
-- gia' ogni sera: non serve chiedere niente a nessuno. Lo scarto rispetto
-- all'eseguito vero e' dello 0,3-0,4% sugli ETF e del 2% circa su Solana
-- (misurato su due anni di operazioni reali), perche' il broker esegue a
-- mercato aperto e la chiusura arriva poche ore dopo.
--
-- Il prezzo giusto e' quello della prima seduta **da quel giorno in poi**, non
-- dell'ultima precedente: se il 3 cade di sabato il broker esegue il lunedi',
-- e prendere la chiusura di venerdi' userebbe un prezzo di due giorni prima
-- dell'acquisto. Cosi' la rata resta in attesa finche' un prezzo utile non
-- esiste davvero, invece di completarsi subito con quello sbagliato.
--
-- Resta in attesa a tempo indeterminato solo cio' che un prezzo pubblico non
-- ce l'ha: i fondi private market. Quelli valgono il loro costo finche' non si
-- sa altro, che e' anche quello che mostra il broker fra un NAV e l'altro.
create or replace function public.settle_plan_instalments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_done integer;
begin
  with completabili as (
    select i.id, p.on_date, p.close_eur
    from public.investments i
    join public.assets a on a.id = i.asset_id and a.price_source = 'yahoo'
    join lateral (
      select pr.on_date, pr.close_eur
      from public.asset_prices pr
      where pr.asset_id = i.asset_id and pr.on_date >= i.occurred_at::date
      order by pr.on_date asc
      limit 1
    ) p on true
    where i.status = 'estimated' and i.kind = 'buy' and p.close_eur > 0
  )
  update public.investments i
  set quantity = round(i.amount / c.close_eur, 12),
      unit_price = c.close_eur,
      settled_on = c.on_date,
      status = 'settled'
  from completabili c
  where c.id = i.id;

  get diagnostics v_done = row_count;
  return v_done;
end;
$$;

revoke all on function public.settle_plan_instalments() from public, anon, authenticated;

-- Subito dopo la sincronizzazione dei prezzi delle 21:30: la rata inserita
-- alle 3 del mattino e' completa la sera stessa.
select cron.unschedule('settle-plan-instalments-daily')
where exists (select 1 from cron.job where jobname = 'settle-plan-instalments-daily');

select cron.schedule(
  'settle-plan-instalments-daily',
  '0 22 * * *',
  $$select public.settle_plan_instalments()$$
);

-- L'estratto conto, quando c'e', ha sempre ragione: sostituisce la rata del
-- piano di quel mese, che sia ancora in attesa o gia' completata col prezzo di
-- chiusura. Prima guardava solo le stime e avrebbe lasciato dei doppioni.
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
      and e.source = 'recurring'
      and date_trunc('month', e.occurred_at) = date_trunc('month', new.occurred_at);
  end if;
  return new;
end;
$$;

revoke all on function public.drop_superseded_estimates() from public, anon, authenticated;
