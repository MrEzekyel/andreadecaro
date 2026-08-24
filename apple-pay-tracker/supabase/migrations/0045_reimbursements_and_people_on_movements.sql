-- Un rimborso non e' un introito.
--
-- Nell'estratto conto vero, i soldi che tornano indietro da una persona
-- ("Pagamento da parte di ROSA PADUANO", 14 righe per 664,95 €) entravano in
-- `incomes` come qualunque altro accredito, accanto allo stipendio. Il danno
-- non e' il singolo numero: e' che le medie mensili degli introiti si gonfiano
-- di denaro che non e' mai stato guadagnato, e con loro il "Risparmiato" e il
-- reddito di riferimento su cui si calcola l'obiettivo.
--
-- La riga resta dov'e' e resta visibile: cambia solo che smette di contare
-- come introito nelle statistiche. Cancellarla sarebbe peggio — quel denaro
-- e' arrivato davvero sul conto, e un elenco che non lo mostra non torna piu'
-- con l'estratto della banca.
alter table public.incomes
  add column if not exists is_reimbursement boolean not null default false;

-- Chi c'e' dall'altra parte del movimento, quando lo si sa.
--
-- `on delete set null`: cancellare un contatto non deve portarsi via i
-- movimenti collegati. Il collegamento e' informazione in piu' sulla riga,
-- non la sua ragione di esistere.
alter table public.incomes
  add column if not exists person_id uuid
  references public.people (id) on delete set null;

alter table public.payments
  add column if not exists person_id uuid
  references public.people (id) on delete set null;

-- Parziale: le righe collegate a qualcuno sono una minoranza, e un indice
-- sull'intera tabella pagherebbe per tutte le altre.
create index if not exists incomes_person_idx
  on public.incomes (person_id) where person_id is not null;

create index if not exists payments_person_idx
  on public.payments (person_id) where person_id is not null;

-- Le statistiche leggono con `is_reimbursement = false`; questo indice serve
-- a quel filtro sulle letture per periodo.
create index if not exists incomes_user_real_idx
  on public.incomes (user_id, occurred_at desc) where is_reimbursement = false;

-- `monthly_totals` deve smettere di contare i rimborsi fra gli introiti.
--
-- E' la funzione da cui esce il **reddito di riferimento** proposto per
-- l'obiettivo di risparmio (`LimitsScreen`, mediana dei mesi chiusi): senza
-- questo filtro il flag resterebbe applicato a meta', giusto nella schermata
-- e sbagliato nel numero su cui si decide quanto si puo' spendere.
--
-- La firma non cambia, quindi `create or replace` sostituisce davvero invece
-- di creare un secondo overload.
create or replace function public.monthly_totals(p_months integer default 6)
returns table(month date, spese numeric, introiti numeric, investito numeric)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with periodi as (
    select (
      date_trunc('month', (now() at time zone 'Europe/Rome'))::date
      - (scarto || ' months')::interval
    )::date as inizio
    from generate_series(0, greatest(coalesce(p_months, 6), 1) - 1) as scarto
  )
  select
    p.inizio as month,
    coalesce((
      select sum(pay.effective_amount)
      from payments pay
      where pay.occurred_at >= p.inizio
        and pay.occurred_at < (p.inizio + interval '1 month')
    ), 0) as spese,
    coalesce((
      select sum(inc.amount)
      from incomes inc
      where inc.is_reimbursement = false
        and inc.occurred_at >= p.inizio
        and inc.occurred_at < (p.inizio + interval '1 month')
    ), 0) as introiti,
    coalesce((
      select sum(inv.amount)
      from investments inv
      where inv.kind = 'buy'
        and inv.status = 'settled'
        and inv.occurred_at >= p.inizio
        and inv.occurred_at < (p.inizio + interval '1 month')
    ), 0) as investito
  from periodi p
  order by p.inizio;
$function$;
