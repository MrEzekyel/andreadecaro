-- Spese divise con altre persone.

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#71717a',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists people_user_idx on public.people (user_id);

alter table public.people enable row level security;

create policy "users manage their own people"
  on public.people for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quanto della spesa compete davvero a me. NULL = spesa non divisa.
alter table public.payments
  add column if not exists my_share numeric(10, 2)
    check (my_share is null or my_share >= 0);

-- Le statistiche devono usare la quota di competenza, non il totale pagato:
-- una cena divisa in quattro non deve gonfiare il mese. Come colonna
-- generata il calcolo sta in un posto solo e non si puo' dimenticare.
alter table public.payments
  add column if not exists effective_amount numeric(10, 2)
    generated always as (coalesce(my_share, amount)) stored;

create index if not exists payments_user_effective_idx
  on public.payments (user_id, occurred_at desc, effective_amount);

create table if not exists public.payment_splits (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  amount_owed numeric(10, 2) not null check (amount_owed >= 0),
  settled_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_id, person_id)
);

create index if not exists payment_splits_payment_idx
  on public.payment_splits (payment_id);

create index if not exists payment_splits_open_idx
  on public.payment_splits (person_id)
  where settled_at is null;

alter table public.payment_splits enable row level security;

-- La proprieta' di una quota discende da quella della spesa: non esiste una
-- quota "di nessuno", e replicare user_id qui creerebbe due verita' da tenere
-- allineate.
create policy "users manage splits of their own payments"
  on public.payment_splits for all to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_splits.payment_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_splits.payment_id and p.user_id = auth.uid()
    )
  );
