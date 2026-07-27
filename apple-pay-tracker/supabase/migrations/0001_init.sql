-- Apple Pay Tracker: schema iniziale

create extension if not exists pgcrypto;

-- Regole di categorizzazione predefinite (dati di riferimento condivisi)
create table if not exists public.default_merchant_categories (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  category text not null
);

alter table public.default_merchant_categories enable row level security;

create policy "default_merchant_categories readable by authenticated"
  on public.default_merchant_categories
  for select
  to authenticated
  using (true);

-- Regole personalizzate dell'utente (priorita' su quelle predefinite)
create table if not exists public.merchant_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  keyword text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, keyword)
);

alter table public.merchant_categories enable row level security;

create policy "users manage their own merchant_categories"
  on public.merchant_categories
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pagamenti registrati
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  merchant_raw text not null,
  merchant_name text not null,
  category text not null default 'Da categorizzare',
  occurred_at timestamptz not null default now(),
  raw_notification_text text,
  source text not null default 'shortcut',
  dedup_key text,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_occurred_at_idx
  on public.payments (user_id, occurred_at desc);

-- Evita doppi inserimenti quando la Shortcut scatta piu' volte
-- sulla stessa notifica Wallet.
create unique index if not exists payments_user_dedup_key_idx
  on public.payments (user_id, dedup_key)
  where dedup_key is not null;

alter table public.payments enable row level security;

create policy "users read their own payments"
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users insert their own payments"
  on public.payments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own payments"
  on public.payments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own payments"
  on public.payments
  for delete
  to authenticated
  using (auth.uid() = user_id);
