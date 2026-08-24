-- Le regole che si ricordano fra un import e l'altro.
--
-- Certe risposte non cambiano mai. Il conto cointestato dell'attivita' torna
-- in ogni estratto conto e ogni volta va spiegato daccapo che non e' un giro
-- fra conti propri; la stessa insegna arriva in quattro grafie e ogni volta va
-- rinominata a mano; il conto che si ricarica da un altro va escluso tutti i
-- mesi. Richiedere la stessa decisione dodici volte non e' rigore: e' il modo
-- piu' sicuro perche' alla terza si smetta di correggere e si importi e basta.
--
-- **Una regola non agisce mai da sola.** Arriva come proposta gia' spuntata
-- nella revisione, con scritto che e' una regola tua e cosa fa. Una regola
-- sbagliata che agisce senza dirlo e' peggio del problema che risolve: chi non
-- se ne accorge si ritrova movimenti mancanti, o rinominati, senza nessun modo
-- di risalire al perche'.
create table if not exists public.import_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Il criterio e' gia' **ripiegato** (minuscolo, senza accenti ne'
  -- punteggiatura) e calcolato sul nome della controparte, non sulla riga
  -- intera: "Pagamento a favore di LEONARDO BARESE" e "Pagamento da parte di
  -- LEONARDO BARESE" sono la stessa persona, e una regola che non lo vedesse
  -- andrebbe creata due volte. Lo ripiega `chiaveRegola()` lato app, che e' la
  -- stessa funzione usata per confrontare: se divergessero, una regola creata
  -- non combacerebbe mai piu' con niente.
  criterio text not null check (length(trim(criterio)) > 0),

  -- `esatto` per un nome preciso, `contiene` per una famiglia di righe che
  -- cambiano numero ogni volta ("Revolut**0519", "Revolut**0788"). Due modi e
  -- non dieci: una regola che non si riesce a prevedere a mente non si usa.
  confronto text not null default 'esatto'
    check (confronto in ('esatto', 'contiene')),

  -- Cosa farne. Tutti facoltativi e combinabili: una regola sola puo' dire
  -- "e' Rosa, ed e' un rimborso".
  ignora boolean not null default false,
  rinomina_in text,
  categoria_id uuid references public.categories (id) on delete set null,
  persona_id uuid references public.people (id) on delete set null,
  rimborso boolean not null default false,

  created_at timestamptz not null default now()
);

-- Una regola per criterio: crearne due uguali con azioni diverse renderebbe
-- imprevedibile quale vince. Chi rifa' la stessa scelta aggiorna quella che
-- c'e' gia' (`upsert` su questo indice).
create unique index if not exists import_rules_user_criterio_idx
  on public.import_rules (user_id, criterio, confronto);

alter table public.import_rules enable row level security;

create policy "users read their own import_rules"
  on public.import_rules
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users insert their own import_rules"
  on public.import_rules
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own import_rules"
  on public.import_rules
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own import_rules"
  on public.import_rules
  for delete
  to authenticated
  using (auth.uid() = user_id);
