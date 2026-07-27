-- "Da categorizzare" non e' una categoria vera: e' l'assenza di categoria.
-- Tenerla come riga creerebbe due modi di rappresentare la stessa cosa
-- (categoria speciale oppure NULL), quindi resta solo NULL.
delete from public.category_templates where name = 'Da categorizzare';
delete from public.categories where name = 'Da categorizzare' and is_system;

-- Esercenti riconosciuti. merchants.category_id e' il meccanismo
-- "ricorda la scelta": una volta mappato, la Edge Function non deve piu'
-- indovinare la categoria di quell'esercente.
create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists merchants_user_id_idx
  on public.merchants (user_id);

alter table public.merchants enable row level security;

create policy "users manage their own merchants"
  on public.merchants
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Collega i pagamenti a categorie ed esercenti.
alter table public.payments
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists merchant_id uuid references public.merchants (id) on delete set null,
  add column if not exists note text;

create index if not exists payments_category_id_idx
  on public.payments (user_id, category_id);

create index if not exists payments_merchant_id_idx
  on public.payments (user_id, merchant_id);

-- Travasa la vecchia colonna testuale nelle nuove categorie, poi la elimina:
-- una sola fonte di verita'. NULL significa "non categorizzata".
update public.payments p
set category_id = c.id
from public.categories c
where c.user_id = p.user_id
  and c.name = p.category
  and p.category_id is null
  and p.category <> 'Da categorizzare';

alter table public.payments drop column if exists category;
