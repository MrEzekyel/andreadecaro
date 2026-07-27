-- Limiti di spesa settimanali e mensili.
-- category_id NULL significa "tutte le categorie": e' il limite complessivo.

create table if not exists public.spending_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('weekly', 'monthly')),
  amount numeric(10, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete cascade,
  warn_at_percent integer not null default 80
    check (warn_at_percent between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un solo limite per combinazione periodo/categoria. `nulls not distinct`
-- fa si' che anche due limiti complessivi (category_id NULL) collidano,
-- che e' il comportamento voluto: altrimenti se ne creerebbero infiniti.
create unique index if not exists spending_limits_unique_idx
  on public.spending_limits (user_id, period, category_id)
  nulls not distinct;

create index if not exists spending_limits_user_idx
  on public.spending_limits (user_id, active);

alter table public.spending_limits enable row level security;

create policy "users manage their own spending_limits"
  on public.spending_limits
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
