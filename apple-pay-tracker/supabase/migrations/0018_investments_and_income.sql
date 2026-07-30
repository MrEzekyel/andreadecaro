-- Tracker personale: oltre alle spese, tenere traccia di quanto va in
-- investimenti e di quanto entra, per poter calcolare quanto resta
-- risparmiato (introiti - spese - investimenti) invece di vedere solo
-- l'uscita.

-- INVESTIMENTI -----------------------------------------------------------
-- Stessa dualita' manuale/ricorrente delle spese: un versamento su un piano
-- di accumulo e' concettualmente identico a un abbonamento che si scala da
-- solo, solo che il denaro non esce dal patrimonio, si sposta.

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  label text not null,
  card_name text,
  note text,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'recurring')),
  dedup_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists investments_dedup_key_idx
  on public.investments (user_id, dedup_key)
  where dedup_key is not null;

create index if not exists investments_user_occurred_idx
  on public.investments (user_id, occurred_at desc);

alter table public.investments enable row level security;

create policy "users manage their own investments"
  on public.investments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.investment_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null check (amount > 0),
  card_name text,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  day_of_month integer check (day_of_month between 1 and 31),
  weekday integer check (weekday between 1 and 7),
  start_on date not null default current_date,
  end_on date,
  next_run_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists investment_rules_due_idx
  on public.investment_rules (next_run_on)
  where active;

alter table public.investment_rules enable row level security;

create policy "users manage their own investment_rules"
  on public.investment_rules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Riusa public.next_occurrence(), gia' generica: non dipende dalla tabella
-- di provenienza, solo da frequenza/giorno.
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
    insert into public.investments (
      user_id, amount, label, card_name, occurred_at, source, dedup_key
    )
    values (
      v_rule.user_id, v_rule.amount, v_rule.label, v_rule.card_name,
      v_rule.next_run_on::timestamptz, 'recurring',
      'recurring:' || v_rule.id || ':' || v_rule.next_run_on
    )
    on conflict do nothing;

    v_created := v_created + 1;

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

-- INTROITI -----------------------------------------------------------------
-- Solo manuali: stipendio e ricavi da attivita' personali variano ogni
-- volta, quindi una regola ricorrente darebbe un numero fisso sbagliato
-- quasi sempre.

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  label text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists incomes_user_occurred_idx
  on public.incomes (user_id, occurred_at desc);

alter table public.incomes enable row level security;

create policy "users manage their own incomes"
  on public.incomes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
