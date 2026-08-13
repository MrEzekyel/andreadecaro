-- Il Clinck Tag non lo sceglie l'utente: lo assegna l'app.
--
-- Nella prima versione (0037) era un nome scelto a mano, tipo `@andrea`. Ha
-- due difetti che si vedono solo con piu' di un utente: i nomi buoni finiscono
-- subito (il secondo Andrea che si registra trova occupato), e chiedere di
-- inventarsi un identificativo e' un passo in piu' proprio nel momento in cui
-- l'utente vuole solo entrare nell'app.
--
-- Formato `CLI-######`: sei cifre, cioe' un milione di combinazioni. Con 100k
-- utenti la probabilita' di dover riprovare a generarne uno resta bassa, e il
-- loop qui sotto la gestisce comunque; quando lo spazio si stringera' bastera'
-- allungare il formato, perche' il vincolo sta in un posto solo.

-- Prima il formato nuovo, poi i dati: il check va sostituito **prima** del
-- backfill, altrimenti i tag generati verrebbero rifiutati dal vincolo vecchio.
alter table public.profiles
  drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
    check (handle is null or handle ~ '^CLI-[0-9]{6}$');

/**
 * Un tag libero.
 *
 * Come `generate_referral_code()`: si riprova finche' non se ne trova uno non
 * occupato, cosi' l'unicita' e' garantita per costruzione invece che sperata.
 * Non serve essere imprevedibile — non protegge niente, e' un identificativo
 * pubblico fatto per essere letto e digitato da un amico.
 */
create or replace function public.generate_clinck_tag()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  candidate text;
begin
  loop
    candidate := 'CLI-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.profiles where handle = candidate
    );
  end loop;
  return candidate;
end;
$fn$;

revoke all on function public.generate_clinck_tag() from public, anon, authenticated;

-- Il tag nasce **con l'account**, insieme al codice referral: quando l'utente
-- arriva alla schermata di benvenuto ce l'ha gia', e non c'e' un momento in
-- cui un profilo esiste senza poter essere trovato dagli amici.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.seed_default_categories(new.id);

  insert into public.profiles (user_id, referral_code, handle)
  values (new.id, public.generate_referral_code(), public.generate_clinck_tag())
  on conflict (user_id) do nothing;

  return new;
end;
$fn$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Chi si era registrato prima di questa migrazione non ha un tag: gliene si
-- assegna uno adesso. Uno alla volta e non con un update unico, perche'
-- `generate_clinck_tag()` deve poter vedere i tag assegnati ai giri
-- precedenti per non ripeterli.
do $mig$
declare
  r record;
begin
  for r in select user_id from public.profiles where handle is null loop
    update public.profiles
    set handle = public.generate_clinck_tag()
    where user_id = r.user_id;
  end loop;
end;
$mig$;

/**
 * Il nome con cui gli amici ti vedono.
 *
 * Sostituisce `set_handle`: il tag non e' piu' modificabile, quindi l'unica
 * cosa che l'utente decide di se' e' come si chiama. Resta una RPC e non un
 * update diretto perche' `profiles` ha la sola policy di lettura — aprirla in
 * scrittura vorrebbe dire lasciar toccare dal client anche `trial_ends_at` e
 * `subscription_status`.
 */
create or replace function public.set_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Sessione scaduta';
  end if;

  if length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'Il nome deve avere da 2 a 40 caratteri';
  end if;

  update public.profiles
  set display_name = v_name
  where user_id = auth.uid();

  return v_name;
end;
$fn$;

revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

-- `set_handle` non ha piu' ragione di esistere: lasciarla in giro
-- significherebbe che un client puo' ancora riscriversi il tag a piacere,
-- aggirando l'unicita' garantita dal generatore.
drop function if exists public.set_handle(text, text);

/**
 * Cerca dal tag, con un po' di tolleranza su come viene incollato.
 *
 * Resta una corrispondenza **esatta** — niente ricerca a prefisso, che su una
 * tabella di profili e' un modo per farsi enumerare l'utenza. La tolleranza
 * riguarda solo la forma: maiuscole, spazi, e le sole sei cifre incollate
 * senza `CLI-` sono lo stesso tag scritto in modo diverso, non una ricerca
 * parziale.
 */
create or replace function public.find_profile_by_handle(p_handle text)
returns table (user_id uuid, handle text, display_name text, connection_status text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_handle text := upper(regexp_replace(coalesce(p_handle, ''), '\s', '', 'g'));
begin
  if auth.uid() is null then
    return;
  end if;

  if v_handle ~ '^[0-9]{6}$' then
    v_handle := 'CLI-' || v_handle;
  end if;

  if v_handle !~ '^CLI-[0-9]{6}$' then
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
