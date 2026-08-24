-- Lotto di import: l'identificativo che rende un import annullabile.
--
-- Fino a qui un import non si poteva disfare. Le righe scritte da un estratto
-- conto portavano `source = 'import'` e `card_name = null`, esattamente come
-- quelle di ogni altro import: due import diversi si distinguevano **solo**
-- guardando `created_at` a mano sul database (11:45 del 22 agosto contro
-- 12:02 del 23). Dall'app non c'era nessun modo di dire "questi sono di
-- ieri, quelli di oggi", e quindi nessun modo di tornare indietro.
--
-- E' la premessa di tutto il resto della revisione dell'import, non un
-- accessorio: si puo' dare a chi importa piu' modi di intervenire sul file
-- solo dopo che sbagliare e' diventato reversibile. Chi importa male sei mesi
-- di spese e non puo' annullare non perde un pomeriggio, perde la fiducia
-- nell'app in un colpo solo.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- I nomi dei file, non il loro contenuto: servono a far riconoscere il
  -- lotto a colpo d'occhio nell'elenco ("revolut-gennaio.csv"), che e' il
  -- solo modo di sapere quale annullare senza aprirlo.
  file_names text[] not null default '{}',
  spese integer not null default 0,
  entrate integer not null default 0,
  -- Le righe riconosciute come gia' presenti: non sono state scritte, quindi
  -- annullando il lotto non tornano indietro. Si registrano lo stesso perche'
  -- il conto mostrato all'utente deve tornare anche a distanza di mesi.
  gia_presenti integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists import_batches_user_created_idx
  on public.import_batches (user_id, created_at desc);

alter table public.import_batches enable row level security;

create policy "users read their own import_batches"
  on public.import_batches
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users insert their own import_batches"
  on public.import_batches
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own import_batches"
  on public.import_batches
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own import_batches"
  on public.import_batches
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- `on delete set null` e non `cascade`, ed e' una scelta e non una svista.
--
-- Cancellare la riga del lotto non deve poter cancellare le spese: la
-- direzione sbagliata di questo vincolo trasformerebbe un'operazione di
-- pulizia dell'elenco import in una perdita di mesi di movimenti. Le spese si
-- tolgono **solo** da `undo_import_batch()`, che lo dichiara e conta cosa ha
-- tolto. Un movimento orfano del suo lotto resta un movimento vero.
alter table public.payments
  add column if not exists import_batch_id uuid
  references public.import_batches (id) on delete set null;

alter table public.incomes
  add column if not exists import_batch_id uuid
  references public.import_batches (id) on delete set null;

create index if not exists payments_import_batch_idx
  on public.payments (import_batch_id)
  where import_batch_id is not null;

create index if not exists incomes_import_batch_idx
  on public.incomes (import_batch_id)
  where import_batch_id is not null;

-- Annulla un import: toglie esattamente le righe di quel lotto, e niente altro.
--
-- Sta nel database e non nell'app perche' e' **una transazione sola**: dalle
-- tre chiamate separate che servirebbero lato client si puo' uscire a meta',
-- con le spese tolte e le entrate rimaste, e in quel caso il lotto sarebbe
-- annullato per finta — lo stato peggiore, perche' l'elenco direbbe di si'.
--
-- `security invoker` (il predefinito) di proposito: le policy di `payments` e
-- `incomes` restano quelle di sempre e valgono anche qui. Il confronto
-- esplicito su `auth.uid()` e' ridondante con la RLS, ed e' voluto: un giorno
-- qualcuno potrebbe cambiare questa funzione in `security definer` senza
-- accorgersi che cosi' facendo aprirebbe i lotti di tutti.
create or replace function public.undo_import_batch(p_batch uuid)
returns table (spese integer, entrate integer)
language plpgsql
as $$
declare
  v_spese integer;
  v_entrate integer;
begin
  delete from public.payments
   where import_batch_id = p_batch
     and user_id = auth.uid();
  get diagnostics v_spese = row_count;

  delete from public.incomes
   where import_batch_id = p_batch
     and user_id = auth.uid();
  get diagnostics v_entrate = row_count;

  -- Per ultimo: se una delle due cancellazioni fallisce, la transazione torna
  -- indietro tutta e il lotto resta nell'elenco, riprovabile. Un lotto
  -- scomparso con le sue righe ancora dentro non lo si potrebbe piu' togliere
  -- da nessuna parte.
  delete from public.import_batches
   where id = p_batch
     and user_id = auth.uid();

  return query select v_spese, v_entrate;
end;
$$;

revoke execute on function public.undo_import_batch(uuid) from anon;
