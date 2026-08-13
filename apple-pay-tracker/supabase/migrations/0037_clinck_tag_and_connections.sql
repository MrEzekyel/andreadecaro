-- Il Clinck Tag e gli amici.
--
-- Fino a qui l'app e' stata a utente singolo: ogni policy dice
-- `auth.uid() = user_id`, senza eccezioni, e le persone con cui si divide una
-- spesa (`people`) sono contatti privati che esistono solo nella rubrica di
-- chi ha pagato. Da qui in poi due account possono vedersi, ed e' la prima
-- volta che un utente legge una riga che non e' sua: tutto quello che
-- attraversa il confine passa da una RPC con l'elenco delle colonne scritto a
-- mano, mai da una policy larga su una tabella intera.

-- ── Il tag ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists handle text,
  add column if not exists display_name text;

-- Minuscolo e senza spazi: un tag che differisce per una maiuscola sarebbe
-- un tag diverso, e due persone si scambierebbero @Andrea e @andrea senza
-- trovarsi. Il vincolo sta qui e non solo nell'app perche' e' l'unico posto
-- che vale anche per chi scrive dal client.
alter table public.profiles
  drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_handle_idx
  on public.profiles (handle) where handle is not null;

-- ── Le amicizie ───────────────────────────────────────────────────────────
-- Servono a due cose: potersi cercare una volta sola invece che a ogni
-- divisione, e non poter ricevere una richiesta di soldi da uno sconosciuto
-- che ha indovinato un tag.
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_not_self check (requester_id <> addressee_id)
);

-- Una coppia sola, in qualunque verso sia partita la richiesta: senza questo
-- indice due persone che si cercano nello stesso momento si ritroverebbero
-- con due amicizie fra loro, e ogni schermata dovrebbe decidere quale vale.
create unique index if not exists connections_pair_idx
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists connections_addressee_idx
  on public.connections (addressee_id) where status = 'pending';

alter table public.connections enable row level security;

-- Si legge una connessione solo se si e' una delle due parti. Non c'e'
-- policy di insert/update: passano dalle RPC, che sono l'unico posto in cui
-- si decide chi puo' invitare chi.
create policy "users read their own connections"
  on public.connections for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── La persona collegata a un account ─────────────────────────────────────
-- Questa colonna e' il punto di tutto il disegno: le quote restano attaccate
-- alla persona della rubrica, e la persona punta all'account. Quando un amico
-- con cui si divideva da mesi scarica Clinck, non c'e' niente da migrare —
-- si scrive un uuid in una colonna e tutto lo storico diventa suo.
alter table public.people
  add column if not exists linked_user_id uuid
    references auth.users (id) on delete set null;

create index if not exists people_linked_idx
  on public.people (linked_user_id) where linked_user_id is not null;

-- Due contatti diversi non possono puntare allo stesso account: le quote si
-- dividerebbero fra due rubriche e "quanto mi deve Marco" darebbe due
-- risposte diverse a seconda di quale contatto si guarda.
create unique index if not exists people_user_linked_idx
  on public.people (user_id, linked_user_id) where linked_user_id is not null;

alter table public.people
  drop constraint if exists people_linked_not_self;
alter table public.people
  add constraint people_linked_not_self
    check (linked_user_id is null or linked_user_id <> user_id);

-- ── RPC ───────────────────────────────────────────────────────────────────

/**
 * Sceglie o cambia il proprio tag.
 *
 * Il tag e' l'unico dato di un profilo che altri possono cercare, quindi la
 * validazione sta qui e non nell'app: un client puo' sempre chiamare
 * PostgREST direttamente.
 */
create or replace function public.set_handle(p_handle text, p_display_name text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_handle text := lower(btrim(coalesce(p_handle, '')));
begin
  if auth.uid() is null then
    raise exception 'Sessione scaduta';
  end if;

  if v_handle !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Il tag può avere da 3 a 20 caratteri fra lettere, numeri e underscore';
  end if;

  update public.profiles
  set handle = v_handle,
      display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
  where user_id = auth.uid();

  return v_handle;
exception
  when unique_violation then
    raise exception 'Questo tag è già di qualcun altro';
end;
$fn$;

revoke all on function public.set_handle(text, text) from public, anon;
grant execute on function public.set_handle(text, text) to authenticated;

/**
 * Cerca una persona dal tag **esatto**.
 *
 * Esatto e non "che inizia per": una ricerca a prefisso su una tabella di
 * profili e' un modo per farsi enumerare tutta l'utenza tre lettere alla
 * volta. Il tag si condivide, non si indovina — e chi lo ha ricevuto lo
 * scrive per intero.
 *
 * Restituisce tre campi e basta: chi cerca non deve poter dedurre nient'altro
 * di un account che non ha ancora accettato di conoscerlo.
 */
create or replace function public.find_profile_by_handle(p_handle text)
returns table (user_id uuid, handle text, display_name text, connection_status text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_handle text := lower(btrim(coalesce(p_handle, '')));
begin
  if auth.uid() is null or v_handle = '' then
    return;
  end if;

  return query
  select
    p.user_id,
    p.handle,
    coalesce(p.display_name, p.handle),
    coalesce(
      (
        select c.status from public.connections c
        where least(c.requester_id, c.addressee_id) = least(auth.uid(), p.user_id)
          and greatest(c.requester_id, c.addressee_id) = greatest(auth.uid(), p.user_id)
      ),
      'none'
    )
  from public.profiles p
  where p.handle = v_handle
    and p.user_id <> auth.uid();
end;
$fn$;

revoke all on function public.find_profile_by_handle(text) from public, anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;

/**
 * Crea il contatto in rubrica per un account collegato, o lo riusa.
 *
 * Chiamata da entrambe le parti quando un'amicizia viene accettata: senza,
 * l'amico sarebbe fra i contatti di chi ha invitato ma non viceversa, e la
 * divisione funzionerebbe in una direzione sola.
 */
create or replace function public.ensure_linked_person(p_owner uuid, p_linked uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_person_id uuid;
  v_name text;
begin
  select id into v_person_id
  from public.people
  where user_id = p_owner and linked_user_id = p_linked;

  if found then
    return v_person_id;
  end if;

  select coalesce(display_name, handle, 'Amico') into v_name
  from public.profiles where user_id = p_linked;

  -- `people` ha unique (user_id, name): se in rubrica esiste gia' un contatto
  -- scritto a mano con lo stesso nome, si collega quello invece di crearne un
  -- secondo. È il caso piu' comune in assoluto — l'amico era gia' in rubrica
  -- da prima, ed e' esattamente lo storico che si vuole conservare.
  select id into v_person_id
  from public.people
  where user_id = p_owner and lower(name) = lower(v_name) and linked_user_id is null;

  if found then
    update public.people set linked_user_id = p_linked where id = v_person_id;
    return v_person_id;
  end if;

  -- Il nome puo' essere gia' occupato da un contatto collegato a un altro
  -- account (due amici che si chiamano uguale): si disambigua col tag invece
  -- di far fallire l'accettazione dell'amicizia.
  begin
    insert into public.people (user_id, name, linked_user_id)
    values (p_owner, v_name, p_linked)
    returning id into v_person_id;
  exception
    when unique_violation then
      insert into public.people (user_id, name, linked_user_id)
      values (
        p_owner,
        v_name || ' (@' || (select handle from public.profiles where user_id = p_linked) || ')',
        p_linked
      )
      returning id into v_person_id;
  end;

  return v_person_id;
end;
$fn$;

revoke all on function public.ensure_linked_person(uuid, uuid) from public, anon, authenticated;

/** Manda la richiesta di amicizia. */
create or replace function public.request_connection(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_existing public.connections;
begin
  if auth.uid() is null then
    raise exception 'Sessione scaduta';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Non puoi aggiungere te stesso';
  end if;

  select * into v_existing
  from public.connections c
  where least(c.requester_id, c.addressee_id) = least(auth.uid(), p_user_id)
    and greatest(c.requester_id, c.addressee_id) = greatest(auth.uid(), p_user_id);

  if found then
    -- Se l'altro ci aveva gia' invitati, mandare una seconda richiesta
    -- sarebbe un modo lungo per accettare la sua.
    if v_existing.status = 'pending' and v_existing.addressee_id = auth.uid() then
      perform public.respond_connection(v_existing.id, true);
    elsif v_existing.status = 'declined' then
      update public.connections
      set status = 'pending', requester_id = auth.uid(), addressee_id = p_user_id,
          created_at = now(), responded_at = null
      where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  insert into public.connections (requester_id, addressee_id)
  values (auth.uid(), p_user_id)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.request_connection(uuid) from public, anon;
grant execute on function public.request_connection(uuid) to authenticated;

/** Accetta o rifiuta: solo chi ha ricevuto la richiesta puo' rispondere. */
create or replace function public.respond_connection(p_connection_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.connections;
begin
  select * into v_row from public.connections where id = p_connection_id;
  if not found then
    raise exception 'Richiesta non trovata';
  end if;
  if v_row.addressee_id <> auth.uid() then
    raise exception 'Non è una richiesta per te';
  end if;

  update public.connections
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_connection_id;

  -- I contatti nascono solo quando l'amicizia esiste davvero: una richiesta
  -- rifiutata non deve lasciare una persona in rubrica.
  if p_accept then
    perform public.ensure_linked_person(v_row.requester_id, v_row.addressee_id);
    perform public.ensure_linked_person(v_row.addressee_id, v_row.requester_id);
  end if;
end;
$fn$;

revoke all on function public.respond_connection(uuid, boolean) from public, anon;
grant execute on function public.respond_connection(uuid, boolean) to authenticated;

/** Amici e richieste in sospeso, con il verso di ciascuna. */
create or replace function public.list_connections()
returns table (
  connection_id uuid,
  other_user_id uuid,
  handle text,
  display_name text,
  status text,
  incoming boolean
)
language sql
security definer
set search_path = public
as $fn$
  select
    c.id,
    case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
    p.handle,
    coalesce(p.display_name, p.handle),
    c.status,
    c.addressee_id = auth.uid()
  from public.connections c
  join public.profiles p
    on p.user_id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
  where auth.uid() in (c.requester_id, c.addressee_id)
    and c.status <> 'declined'
  order by c.status desc, coalesce(p.display_name, p.handle);
$fn$;

revoke all on function public.list_connections() from public, anon;
grant execute on function public.list_connections() to authenticated;
