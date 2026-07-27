-- Categorie: da testo libero a tabella, cosi' l'utente puo' crearne di proprie
-- e ognuna porta il colore e l'icona usati dal design.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#71717a',
  icon text not null default 'circle-help',
  is_system boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists categories_user_id_idx
  on public.categories (user_id, sort_order);

alter table public.categories enable row level security;

create policy "users manage their own categories"
  on public.categories
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Modello delle categorie assegnate a ogni nuovo utente.
-- I colori sono quelli validati per contrasto e distinguibilita'.
create table if not exists public.category_templates (
  name text primary key,
  color text not null,
  icon text not null,
  sort_order integer not null
);

insert into public.category_templates (name, color, icon, sort_order) values
  ('Spesa',        '#16a34a', 'shopping-cart', 10),
  ('Trasporti',    '#2563eb', 'train-front',   20),
  ('Ristorazione', '#ea580c', 'utensils',      30),
  ('Shopping',     '#db2777', 'shopping-bag',  40),
  ('Abbonamenti',  '#4f46e5', 'repeat',        50),
  ('Viaggi',       '#0891b2', 'plane',         60),
  ('Utenze',       '#a16207', 'plug-zap',      70),
  ('Casa',         '#7c3aed', 'house',         80),
  ('Salute',       '#dc2626', 'heart-pulse',   90),
  ('Cultura',      '#0d9488', 'film',         100),
  ('Sport',        '#65a30d', 'dumbbell',     110)
on conflict (name) do update
  set color = excluded.color,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

-- I template sono dati di riferimento: leggibili da chiunque sia autenticato.
alter table public.category_templates enable row level security;

create policy "category_templates readable by authenticated"
  on public.category_templates
  for select
  to authenticated
  using (true);

-- Copia le categorie modello nell'account di un utente.
-- Idempotente: richiamarla non duplica nulla.
create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.categories (user_id, name, color, icon, is_system, sort_order)
  select p_user_id, t.name, t.color, t.icon, true, t.sort_order
  from public.category_templates t
  on conflict (user_id, name) do nothing;
$$;

revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Ogni nuovo utente riceve subito le categorie predefinite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
