-- Metodo di pagamento della regola ricorrente, propagato a ogni spesa
-- generata. Prima mancava: mutuo, rate e abbonamenti addebitati sul conto
-- comparivano nel dettaglio senza "Metodo di pagamento", a differenza di
-- tutte le altre spese.
alter table public.recurring_rules
  add column if not exists card_name text;

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
      category_id, occurred_at, source, dedup_key, card_name
    )
    values (
      v_rule.user_id, v_rule.amount, v_rule.label, v_rule.label,
      v_rule.category_id, v_rule.next_run_on::timestamptz, 'recurring',
      'recurring:' || v_rule.id || ':' || v_rule.next_run_on, v_rule.card_name
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

revoke all on function public.materialize_recurring() from public, anon, authenticated;
