-- Apple Pay Tracker: schema iniziale
-- Applica con: supabase db push  (o incollando il contenuto nel SQL Editor di Supabase)

create extension if not exists pgcrypto;

-- Regole di categorizzazione predefinite (dati di riferimento, condivisi da tutti gli utenti)
create table if not exists public.default_merchant_categories (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  category text not null
);

alter table public.default_merchant_categories enable row level security;

create policy "default_merchant_categories are readable by authenticated users"
  on public.default_merchant_categories
  for select
  to authenticated
  using (true);

insert into public.default_merchant_categories (keyword, category) values
  ('esselunga', 'Spesa'),
  ('coop', 'Spesa'),
  ('conad', 'Spesa'),
  ('carrefour', 'Spesa'),
  ('lidl', 'Spesa'),
  ('eurospin', 'Spesa'),
  ('trenitalia', 'Trasporti'),
  ('italo', 'Trasporti'),
  ('atm', 'Trasporti'),
  ('uber', 'Trasporti'),
  ('freenow', 'Trasporti'),
  ('eni', 'Trasporti'),
  ('q8', 'Trasporti'),
  ('esso', 'Trasporti'),
  ('ryanair', 'Viaggi'),
  ('easyjet', 'Viaggi'),
  ('booking', 'Viaggi'),
  ('airbnb', 'Viaggi'),
  ('mcdonald', 'Ristorazione'),
  ('burger king', 'Ristorazione'),
  ('starbucks', 'Ristorazione'),
  ('deliveroo', 'Ristorazione'),
  ('glovo', 'Ristorazione'),
  ('just eat', 'Ristorazione'),
  ('bar ', 'Ristorazione'),
  ('ristorante', 'Ristorazione'),
  ('farmacia', 'Salute'),
  ('amazon', 'Shopping'),
  ('zara', 'Shopping'),
  ('h&m', 'Shopping'),
  ('ikea', 'Casa'),
  ('netflix', 'Abbonamenti'),
  ('spotify', 'Abbonamenti'),
  ('apple.com/bill', 'Abbonamenti')
on conflict (keyword) do nothing;

-- Regole personalizzate dell'utente (hanno priorità su quelle predefinite)
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
  amount numeric(10, 2) not null,
  merchant_raw text not null,
  merchant_name text not null,
  category text not null default 'Da categorizzare',
  occurred_at timestamptz not null default now(),
  raw_notification_text text,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_occurred_at_idx
  on public.payments (user_id, occurred_at desc);

alter table public.payments enable row level security;

create policy "users read their own payments"
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id);

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

-- Nessuna policy INSERT per authenticated/anon: i pagamenti vengono inseriti solo
-- dalla Edge Function "ingest-payment" tramite service role key, che bypassa la RLS.
