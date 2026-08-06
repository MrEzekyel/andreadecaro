-- Da "quanto ho versato" a "quanto vale". Fino a qui `investments` teneva solo
-- il flusso di cassa: 250 euro usciti il 3 del mese. Per un tracker serve la
-- posizione, cioe' quante quote possiedo e quanto valgono oggi, che e' un
-- fatto diverso e non deducibile dal versamento.

-- ASSET ------------------------------------------------------------------
-- Prima non esisteva un'entita' "cosa possiedo": l'asset era testo libero nel
-- campo `label`, e infatti si era gia' rotto da solo (gli acquisti manuali
-- dicevano "Apollo PM", le regole ricorrenti "Apollo": per il database erano
-- due cose diverse e i totali si sarebbero divisi in due).

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- I tre raggruppamenti di Trade Republic, che Andrea usa come mappa mentale.
  asset_group text not null
    check (asset_group in ('conto_titoli', 'crypto', 'private_market')),
  isin text,
  -- 'yahoo' = prezzo giornaliero automatico; 'manual' = valorizzazione inserita
  -- a mano (i fondi private market non hanno un prezzo pubblico).
  price_source text not null default 'manual'
    check (price_source in ('yahoo', 'manual')),
  price_symbol text,
  -- Valuta in cui quota la fonte, non la valuta del fondo: serve a sapere se
  -- il prezzo va convertito prima di essere salvato.
  quote_currency text not null default 'EUR',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),

  -- Un asset a prezzo automatico senza simbolo non e' sincronizzabile: meglio
  -- rifiutarlo qui che scoprirlo con un grafico vuoto.
  constraint assets_symbol_required_for_auto
    check (price_source <> 'yahoo' or price_symbol is not null)
);

create unique index if not exists assets_user_name_idx
  on public.assets (user_id, name);

create index if not exists assets_user_group_idx
  on public.assets (user_id, asset_group) where not archived;

alter table public.assets enable row level security;

create policy "users manage their own assets"
  on public.assets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- PREZZI -----------------------------------------------------------------
-- Cache storica: serve a disegnare il valore nel tempo senza richiamare una
-- API esterna a ogni apertura della schermata, e a tenere il grafico in piedi
-- anche quando la fonte non risponde.
--
-- `close_eur` e' sempre in euro, gia' convertito a monte: mescolare valute in
-- questa colonna sarebbe un errore silenzioso — i numeri tornerebbero
-- plausibili ma sbagliati del 15%.

create table if not exists public.asset_prices (
  asset_id uuid not null references public.assets (id) on delete cascade,
  on_date date not null,
  close_eur numeric(20, 8) not null check (close_eur > 0),
  -- 'fill' = prezzo ricavato da un'esecuzione reale sul conto. Per i private
  -- market e' l'unica valorizzazione che si ottiene senza inserirla a mano:
  -- il prezzo a cui il fondo esegue l'ordine mensile *e'* il suo NAV.
  source text not null default 'yahoo'
    check (source in ('yahoo', 'manual', 'fill')),
  primary key (asset_id, on_date)
);

alter table public.asset_prices enable row level security;

-- Nessun user_id qui: la proprieta' e' gia' definita dall'asset, duplicarla
-- vorrebbe dire poterla contraddire.
create policy "users manage prices of their own assets"
  on public.asset_prices for all to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_prices.asset_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_prices.asset_id and a.user_id = auth.uid()
    )
  );

-- INVESTMENTS COME REGISTRO ----------------------------------------------
-- La tabella diventa un registro di operazioni invece che di soli versamenti:
-- servono anche vendite e dividendi, altrimenti le quote possedute e il
-- rendimento reale non tornano.

alter table public.investments
  add column if not exists asset_id uuid references public.assets (id) on delete set null,
  add column if not exists kind text not null default 'buy',
  add column if not exists quantity numeric(28, 12),
  add column if not exists unit_price numeric(20, 8),
  add column if not exists fee numeric(10, 2) not null default 0,
  add column if not exists status text not null default 'settled',
  add column if not exists settled_on date,
  add column if not exists external_id text;

do $$
begin
  -- `amount` resta sempre positivo (il check originale lo impone): la
  -- direzione del denaro la porta `kind`, non il segno.
  if not exists (
    select 1 from pg_constraint where conname = 'investments_kind_check'
  ) then
    alter table public.investments add constraint investments_kind_check
      check (kind in ('buy', 'sell', 'dividend'));
  end if;

  -- 'pending' = ordine prenotato ma non ancora eseguito. Sui fondi private
  -- market passano ~2 settimane fra l'addebito e l'assegnazione delle quote:
  -- in mezzo quei soldi sono cassa impegnata, non capitale investito, e
  -- contarli come investiti falserebbe prezzo medio e rendimento.
  if not exists (
    select 1 from pg_constraint where conname = 'investments_status_check'
  ) then
    alter table public.investments add constraint investments_status_check
      check (status in ('settled', 'pending'));
  end if;
end $$;

-- 'import' come origine: le operazioni ricostruite dall'estratto conto del
-- broker non sono ne' inserimenti manuali ne' materializzazioni di una regola.
alter table public.investments drop constraint if exists investments_source_check;
alter table public.investments add constraint investments_source_check
  check (source in ('manual', 'recurring', 'import'));

-- L'id operazione del broker rende l'import ripetibile: si puo' riesportare
-- l'estratto e reimportarlo senza duplicare cio' che c'e' gia'.
create unique index if not exists investments_external_id_idx
  on public.investments (user_id, external_id)
  where external_id is not null;

create index if not exists investments_asset_idx
  on public.investments (asset_id, occurred_at);
