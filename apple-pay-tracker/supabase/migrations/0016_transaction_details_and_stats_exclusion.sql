-- Campi aggiuntivi che il trigger Transazione di iOS mette a disposizione.
alter table public.payments
  add column if not exists card_name text,
  add column if not exists transaction_name text,
  add column if not exists city text,
  add column if not exists country text;

-- Indice per la mappa e per i raggruppamenti geografici.
create index if not exists payments_city_idx
  on public.payments (user_id, city)
  where city is not null;

-- Esclusione dalle CLASSIFICHE, non dal totale speso.
-- Mutuo e rata auto sono spese vere e devono restare nei totali, ma in una
-- classifica "dove spendo di piu'" schiaccerebbero tutto il resto rendendola
-- inutile: sono importi fissi che non rappresentano una scelta di consumo.
alter table public.payments
  add column if not exists excluded_from_stats boolean not null default false;

alter table public.merchants
  add column if not exists excluded_from_stats boolean not null default false;

create index if not exists payments_ranked_idx
  on public.payments (user_id, occurred_at desc)
  where not excluded_from_stats;

-- Una spesa entra nelle classifiche solo se ne' lei ne' il suo esercente
-- sono esclusi. Tenerlo come vista evita di ripetere la condizione in ogni
-- query e di dimenticarsene in una.
create or replace view public.rankable_payments
with (security_invoker = true)
as
select p.*
from public.payments p
left join public.merchants m on m.id = p.merchant_id
where not p.excluded_from_stats
  and coalesce(m.excluded_from_stats, false) = false;
