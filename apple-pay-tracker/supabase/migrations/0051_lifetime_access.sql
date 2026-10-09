-- Accesso permanente all'automazione, senza trial ne' abbonamento: per lo
-- sviluppatore (e in futuro, se servisse, per account omaggio). Un flag a
-- parte e non un `subscription_status = 'active'` finto: quello lo riscrivera'
-- il webhook di RevenueCat, e un periodo senza `current_period_end` verrebbe
-- mostrato in app come un abbonamento mensile pagato.
--
-- Come le altre colonne di `profiles`, non e' scrivibile dal client (nessuna
-- policy di update): si accende solo con la service_role o da migrazione.
alter table public.profiles
  add column if not exists lifetime_access boolean not null default false;

update public.profiles p
set lifetime_access = true
from auth.users u
where u.id = p.user_id
  and lower(u.email) = 'andrydeca2002@gmail.com';
