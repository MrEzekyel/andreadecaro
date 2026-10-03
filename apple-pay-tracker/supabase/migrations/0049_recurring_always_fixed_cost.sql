-- Una spesa ricorrente (mutuo, rate, abbonamenti) e' per definizione un costo
-- fisso: va esclusa dalle classifiche fin dalla nascita.
--
-- `materialize_recurring()` non impostava `excluded_from_stats`, quindi ogni
-- rata nasceva "inclusa" e andava corretta a mano una per una (la REVOLUT BANK
-- di ottobre 2026). Il trigger sta sull'insert e non nella funzione: vale per
-- qualunque strada crei una riga `source='recurring'`, oggi e domani. Solo
-- sull'insert: se l'utente poi la reinclude a mano, la sua scelta resta.

create or replace function public.recurring_is_fixed_cost()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.source = 'recurring' then
    new.excluded_from_stats := true;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_recurring_is_fixed_cost on public.payments;
create trigger payments_recurring_is_fixed_cost
  before insert on public.payments
  for each row execute function public.recurring_is_fixed_cost();

-- Le rate gia' generate prima di questa migrazione.
update public.payments
set excluded_from_stats = true
where source = 'recurring' and not excluded_from_stats;
