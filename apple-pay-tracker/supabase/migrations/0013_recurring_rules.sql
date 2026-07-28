-- Spese ricorrenti: mutuo, rata auto, abbonamenti addebitati sul conto.

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  -- Per le mensili/annuali: giorno del mese. Per le settimanali: 1 = lunedi'.
  day_of_month integer check (day_of_month between 1 and 31),
  weekday integer check (weekday between 1 and 7),
  start_on date not null default current_date,
  end_on date,
  next_run_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recurring_rules_due_idx
  on public.recurring_rules (next_run_on)
  where active;

alter table public.recurring_rules enable row level security;

create policy "users manage their own recurring_rules"
  on public.recurring_rules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Calcola la scadenza successiva a partire da una data.
-- Il giorno viene limitato alla lunghezza del mese: una regola al 31 non
-- deve saltare febbraio, deve cadere sull'ultimo giorno utile. E poiche' il
-- giorno resta memorizzato sulla regola, il mese dopo torna al 31.
create or replace function public.next_occurrence(
  p_from date,
  p_frequency text,
  p_day_of_month integer,
  p_weekday integer
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_next date;
  v_month_start date;
  v_days_in_month integer;
begin
  if p_frequency = 'weekly' then
    v_next := p_from + 1;
    while extract(isodow from v_next)::integer <> coalesce(p_weekday, 1) loop
      v_next := v_next + 1;
    end loop;
    return v_next;
  end if;

  if p_frequency = 'monthly' then
    v_month_start := date_trunc('month', p_from)::date + interval '1 month';
  else
    v_month_start := date_trunc('month', p_from)::date + interval '1 year';
  end if;

  v_days_in_month := extract(
    day from (date_trunc('month', v_month_start) + interval '1 month - 1 day')
  )::integer;

  return v_month_start
       + (least(coalesce(p_day_of_month, 1), v_days_in_month) - 1);
end;
$$;

-- Genera i pagamenti dovuti e sposta avanti la scadenza.
-- La dedup_key include regola e data, quindi una doppia esecuzione o un
-- recupero dopo un fermo non creano duplicati.
create or replace function public.materialize_recurring()
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
    select * from public.recurring_rules
    where active
      and next_run_on <= current_date
      and start_on <= current_date
      and (end_on is null or next_run_on <= end_on)
    for update skip locked
  loop
    insert into public.payments (
      user_id, amount, merchant_raw, merchant_name,
      category_id, occurred_at, source, dedup_key
    )
    values (
      v_rule.user_id, v_rule.amount, v_rule.label, v_rule.label,
      v_rule.category_id, v_rule.next_run_on::timestamptz, 'recurring',
      'recurring:' || v_rule.id || ':' || v_rule.next_run_on
    )
    on conflict do nothing;

    v_created := v_created + 1;

    update public.recurring_rules
    set next_run_on = public.next_occurrence(
      v_rule.next_run_on, v_rule.frequency, v_rule.day_of_month, v_rule.weekday
    )
    where id = v_rule.id;
  end loop;

  return v_created;
end;
$$;

-- Elabora le regole di TUTTI gli utenti, quindi non deve essere raggiungibile
-- da /rest/v1/rpc. La esegue solo il job pg_cron, che gira con privilegi
-- propri e non passa da questi grant.
revoke all on function public.materialize_recurring() from public, anon, authenticated;
