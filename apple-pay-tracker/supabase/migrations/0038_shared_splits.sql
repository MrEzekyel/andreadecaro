-- Le quote che viaggiano fra due account Clinck.
--
-- Fino a qui una quota era una promemoria privato di chi ha pagato: "Marco mi
-- deve 20 euro" esisteva solo nella sua app. Ora, se Marco ha un account e il
-- contatto e' collegato al suo (`people.linked_user_id`, migrazione 0037), la
-- quota gli arriva davvero e lui puo' accettarla o rifiutarla.
--
-- La regola che tiene in piedi tutto: **una quota accettata diventa una spesa
-- vera nell'account di chi accetta**. Senza, l'amico si prenderebbe un debito
-- che nei suoi conti non compare da nessuna parte, e l'unica cosa che la
-- funzione gli darebbe sarebbe un promemoria in piu'.

alter table public.payment_splits
  -- 'local' = persona senza account collegato, cioe' il comportamento di
  -- sempre. Le righe che esistono gia' restano tutte cosi'.
  add column if not exists status text not null default 'local'
    check (status in ('local', 'pending', 'accepted', 'declined')),
  add column if not exists responded_at timestamptz,
  -- Quando il debitore dice "ho pagato". Non salda da solo: chi ha pagato
  -- e' l'unico a sapere se i soldi sono arrivati davvero, e Clinck non muove
  -- denaro — dare per chiuso un credito su parola del debitore sarebbe
  -- l'unica bugia che questa schermata puo' raccontare.
  add column if not exists settle_requested_at timestamptz,
  -- La spesa creata nell'account di chi accetta. Il collegamento sta qui e
  -- non dall'altra parte perche' la quota e' l'originale e la spesa e' la
  -- copia: cancellata la quota, la copia non ha piu' motivo di esistere.
  add column if not exists mirror_payment_id uuid
    references public.payments (id) on delete set null;

create index if not exists payment_splits_status_idx
  on public.payment_splits (status) where status = 'pending';

-- ── Le quote nascono gia' indirizzate ─────────────────────────────────────
create or replace function public.payment_splits_set_status()
returns trigger
language plpgsql
as $fn$
begin
  if exists (
    select 1 from public.people
    where id = new.person_id and linked_user_id is not null
  ) then
    new.status := 'pending';
  else
    new.status := 'local';
  end if;
  return new;
end;
$fn$;

drop trigger if exists payment_splits_set_status on public.payment_splits;
create trigger payment_splits_set_status
  before insert on public.payment_splits
  for each row execute function public.payment_splits_set_status();

-- ── La copia segue l'originale ────────────────────────────────────────────
-- Questi due trigger sono `security definer` perche' scrivono nell'account di
-- un altro utente: e' l'unico modo di tenere allineate le due parti senza
-- aprire una policy che permetta a chi ha pagato di toccare le spese altrui
-- in generale.
create or replace function public.payment_splits_drop_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.mirror_payment_id is not null then
    delete from public.payments where id = old.mirror_payment_id;
  end if;
  return old;
end;
$fn$;

drop trigger if exists payment_splits_drop_mirror on public.payment_splits;
create trigger payment_splits_drop_mirror
  after delete on public.payment_splits
  for each row execute function public.payment_splits_drop_mirror();

-- Se chi ha pagato corregge l'importo, la spesa dell'amico si corregge con
-- lui. L'alternativa — riportare la quota a "da accettare" — toglierebbe di
-- colpo una spesa gia' registrata dal mese dell'amico, che e' il verso
-- pericoloso di sbagliare: il suo totale calerebbe da solo.
create or replace function public.payment_splits_sync_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.payments
  set amount = new.amount_owed
  where id = new.mirror_payment_id;
  return null;
end;
$fn$;

drop trigger if exists payment_splits_sync_mirror on public.payment_splits;
create trigger payment_splits_sync_mirror
  after update of amount_owed on public.payment_splits
  for each row
  when (
    new.mirror_payment_id is not null
    and new.amount_owed is distinct from old.amount_owed
  )
  execute function public.payment_splits_sync_mirror();

-- ── RPC ───────────────────────────────────────────────────────────────────

/**
 * Le quote che qualcuno ha diviso con me.
 *
 * Passa da una RPC e non da una policy su `payment_splits` perche' leggere la
 * quota vuol dire leggere anche la spesa di un altro utente: una policy larga
 * su `payments` gli aprirebbe nota, carta, categoria e la sua quota di
 * competenza. Qui le colonne sono scritte a mano, una per una.
 */
create or replace function public.incoming_splits()
returns table (
  split_id uuid,
  amount_owed numeric,
  status text,
  settled_at timestamptz,
  settle_requested_at timestamptz,
  payer_name text,
  payer_handle text,
  merchant text,
  occurred_at timestamptz,
  total_amount numeric
)
language sql
security definer
set search_path = public
as $fn$
  select
    s.id,
    s.amount_owed,
    s.status,
    s.settled_at,
    s.settle_requested_at,
    coalesce(pr.display_name, pr.handle, 'Un amico'),
    pr.handle,
    pa.merchant_name,
    pa.occurred_at,
    pa.amount
  from public.payment_splits s
  join public.people pe on pe.id = s.person_id
  join public.payments pa on pa.id = s.payment_id
  left join public.profiles pr on pr.user_id = pa.user_id
  where pe.linked_user_id = auth.uid()
    and s.status in ('pending', 'accepted')
  order by pa.occurred_at desc;
$fn$;

revoke all on function public.incoming_splits() from public, anon;
grant execute on function public.incoming_splits() to authenticated;

/**
 * Accetta o rifiuta una quota.
 *
 * Accettare crea la spesa nel proprio account: e' il punto della funzione.
 * Rifiutare **non** tocca la spesa di chi ha pagato — riportargli la quota a
 * carico suo cambierebbe da solo un mese che lui aveva gia' chiuso, e in
 * silenzio. Gli arriva l'avviso e decide lui.
 */
create or replace function public.respond_to_split(p_split_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_split public.payment_splits;
  v_payment public.payments;
  v_payer_name text;
  v_merchant record;
  v_mirror_id uuid;
begin
  select s.* into v_split
  from public.payment_splits s
  join public.people pe on pe.id = s.person_id
  where s.id = p_split_id and pe.linked_user_id = auth.uid();

  if not found then
    raise exception 'Quota non trovata';
  end if;
  if v_split.status <> 'pending' then
    raise exception 'Hai già risposto a questa quota';
  end if;

  if not p_accept then
    update public.payment_splits
    set status = 'declined', responded_at = now()
    where id = p_split_id;
    return;
  end if;

  select * into v_payment from public.payments where id = v_split.payment_id;

  select coalesce(pr.display_name, pr.handle, 'un amico') into v_payer_name
  from public.profiles pr where pr.user_id = v_payment.user_id;

  -- L'esercente si risolve nella **propria** rubrica: la riga `merchants` di
  -- chi ha pagato e' sua, e puntarci dall'altra parte creerebbe una spesa che
  -- eredita la categoria di un altro utente.
  select * into v_merchant
  from public.resolve_merchant(auth.uid(), v_payment.merchant_name);

  insert into public.payments (
    user_id, amount, merchant_raw, merchant_name, merchant_id, category_id,
    occurred_at, note, source
  )
  values (
    auth.uid(),
    v_split.amount_owed,
    v_payment.merchant_name,
    v_payment.merchant_name,
    v_merchant.merchant_id,
    v_merchant.effective_category_id,
    v_payment.occurred_at,
    'La tua quota, divisa da ' || v_payer_name,
    'shared'
  )
  returning id into v_mirror_id;

  update public.payment_splits
  set status = 'accepted', responded_at = now(), mirror_payment_id = v_mirror_id
  where id = p_split_id;
end;
$fn$;

revoke all on function public.respond_to_split(uuid, boolean) from public, anon;
grant execute on function public.respond_to_split(uuid, boolean) to authenticated;

/** "Ho pagato": lo dichiara il debitore, lo conferma il creditore. */
create or replace function public.request_settle(p_split_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.payment_splits s
  set settle_requested_at = now()
  where s.id = p_split_id
    and s.settled_at is null
    and exists (
      select 1 from public.people pe
      where pe.id = s.person_id and pe.linked_user_id = auth.uid()
    );

  if not found then
    raise exception 'Quota non trovata';
  end if;
end;
$fn$;

revoke all on function public.request_settle(uuid) from public, anon;
grant execute on function public.request_settle(uuid) to authenticated;

/**
 * Collega un contatto della rubrica a un account Clinck — il tasto "Associa
 * spese".
 *
 * È il caso che rende utile tutto il disegno: si divide con un amico per
 * mesi mentre non ha l'app, poi la scarica, e da qui in poi le quote gia'
 * aperte diventano sue senza che niente vada migrato. Le quote gia' saldate
 * restano dove sono: sono storia chiusa, e farle comparire come "da
 * accettare" chiederebbe di rispondere a una domanda vecchia di mesi.
 */
create or replace function public.link_person(p_person_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_moved integer;
begin
  if not exists (
    select 1 from public.people
    where id = p_person_id and user_id = auth.uid()
  ) then
    raise exception 'Persona non trovata';
  end if;

  -- Solo con un amico che ha accettato: altrimenti basterebbe conoscere un
  -- uuid per mandare richieste di denaro a chiunque.
  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and least(c.requester_id, c.addressee_id) = least(auth.uid(), p_user_id)
      and greatest(c.requester_id, c.addressee_id) = greatest(auth.uid(), p_user_id)
  ) then
    raise exception 'Puoi associare solo un amico che ti ha accettato';
  end if;

  if exists (
    select 1 from public.people
    where user_id = auth.uid() and linked_user_id = p_user_id and id <> p_person_id
  ) then
    raise exception 'Hai già un contatto collegato a questo account';
  end if;

  update public.people set linked_user_id = p_user_id where id = p_person_id;

  update public.payment_splits s
  set status = 'pending'
  where s.person_id = p_person_id
    and s.status = 'local'
    and s.settled_at is null;

  get diagnostics v_moved = row_count;
  return v_moved;
end;
$fn$;

revoke all on function public.link_person(uuid, uuid) from public, anon;
grant execute on function public.link_person(uuid, uuid) to authenticated;

/**
 * Scollega un contatto dal suo account.
 *
 * Le quote ancora da accettare tornano private. Quelle **gia' accettate**
 * restano: l'amico ha gia' quella spesa nei suoi conti, e cancellargliela da
 * qui gli abbasserebbe un totale senza che nessuno glielo abbia chiesto.
 */
create or replace function public.unlink_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.people
    where id = p_person_id and user_id = auth.uid()
  ) then
    raise exception 'Persona non trovata';
  end if;

  update public.payment_splits
  set status = 'local', responded_at = null
  where person_id = p_person_id and status = 'pending';

  update public.people set linked_user_id = null where id = p_person_id;
end;
$fn$;

revoke all on function public.unlink_person(uuid) from public, anon;
grant execute on function public.unlink_person(uuid) to authenticated;
