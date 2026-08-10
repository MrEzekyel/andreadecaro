-- Trial e abbonamento: due mesi di automazione gratis dalla registrazione,
-- poi 1,99 €/mese o 15 €/anno per continuare a usarla. Solo l'automazione si
-- blocca senza abbonamento: storico, statistiche, spese manuali ed export
-- restano sempre disponibili — non e' `profiles` a deciderlo, e' chi legge
-- `subscription_status` a farlo (ingest-payment, non il resto dell'app).
--
-- Nessuna colonna qui e' scrivibile dal client: subscription_status e
-- current_period_end cambiano solo per mano di un servizio con la
-- service_role key (ingest-payment per il bonus referral, in futuro il
-- webhook di RevenueCat) o della RPC redeem_referral_code piu' sotto.
-- Concedere l'update al client vorrebbe dire lasciargli scrivere
-- 'active' sul proprio abbonamento senza aver pagato nulla.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trial_ends_at timestamptz not null default (now() + interval '2 months'),
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'expired')),
  subscription_plan text
    check (subscription_plan in ('monthly', 'annual')),
  current_period_end timestamptz,
  revenuecat_app_user_id text,
  referral_code text not null unique,
  bonus_months_granted integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Chi ha invitato con successo: chi invita registra il referral, l'amico
-- invitato conferma "setuppando bene" l'automazione. Un utente puo' essere
-- invitato una volta sola (unique su referred_user_id), non puo' invitare
-- se stesso (check), e non puo' auto-confermarsi: lo status passa a
-- 'confirmed' solo da ingest-payment al primo pagamento automatico riuscito.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_user_id, status);

alter table public.referrals enable row level security;

create policy "users read referrals they sent"
  on public.referrals
  for select
  to authenticated
  using (auth.uid() = referrer_user_id);

-- Codice referral leggibile: 8 caratteri esadecimali maiuscoli, univoco per
-- costruzione (si riprova finche' non se ne trova uno libero). Non serve
-- essere imprevedibile quanto un token di sicurezza: e' pensato per essere
-- letto e digitato a mano da un amico.
create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(encode(extensions.gen_random_bytes(4), 'hex'));
    exit when not exists (
      select 1 from public.profiles where referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_referral_code() from public, anon, authenticated;

-- Ogni nuovo utente riceve subito le categorie predefinite e il proprio
-- profilo (trial di 2 mesi, codice referral).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_default_categories(new.id);

  insert into public.profiles (user_id, referral_code)
  values (new.id, public.generate_referral_code())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Collega chi si registra con un codice a chi l'ha invitato. Passa da RPC e
-- non da un insert diretto dal client: altrimenti chi si registra potrebbe
-- assegnarsi un referrer qualsiasi modificando la chiamata, o inviatarsi da
-- solo con un secondo account. Un codice sbagliato o l'autoinvito non sono
-- errori: semplicemente non si crea nessun referral, per non far notare a
-- chi digita un codice a caso se ha indovinato o no.
create or replace function public.redeem_referral_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_self uuid := auth.uid();
  v_referrer uuid;
begin
  if v_self is null then
    raise exception 'not authenticated';
  end if;

  select user_id into v_referrer
  from public.profiles
  where referral_code = upper(trim(p_code));

  if v_referrer is null or v_referrer = v_self then
    return;
  end if;

  insert into public.referrals (referrer_user_id, referred_user_id)
  values (v_referrer, v_self)
  on conflict (referred_user_id) do nothing;
end;
$$;

revoke all on function public.redeem_referral_code(text) from public, anon;
grant execute on function public.redeem_referral_code(text) to authenticated;
