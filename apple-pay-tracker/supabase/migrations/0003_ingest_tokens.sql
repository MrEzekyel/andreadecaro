-- Token di ingestione per utente: consente a piu' utenti di usare la stessa
-- Edge Function, ognuno con il proprio segreto nella propria Shortcut.
-- In tabella viene salvato solo l'hash SHA-256: il token in chiaro viene
-- mostrato una sola volta, al momento della creazione.

create table if not exists public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Shortcut iPhone',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists ingest_tokens_user_id_idx
  on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

-- L'utente vede e revoca i propri token, ma non puo' inserirli a mano:
-- la creazione passa dalla funzione create_ingest_token().
create policy "users read their own ingest_tokens"
  on public.ingest_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own ingest_tokens"
  on public.ingest_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "users revoke their own ingest_tokens"
  on public.ingest_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Genera un nuovo token per l'utente autenticato e lo restituisce in chiaro.
-- E' l'unica occasione in cui il valore e' leggibile.
create or replace function public.create_ingest_token(p_label text default 'Shortcut iPhone')
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.ingest_tokens (user_id, token_hash, label)
  values (
    v_user_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    coalesce(nullif(trim(p_label), ''), 'Shortcut iPhone')
  );

  return v_token;
end;
$$;

revoke all on function public.create_ingest_token(text) from public;
grant execute on function public.create_ingest_token(text) to authenticated;
