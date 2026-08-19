-- Obiettivo di risparmio mensile.
--
-- Un obiettivo di risparmio **e' un limite di spesa scritto al contrario**:
--
--   Entrate - Spese = Risparmio    =>    Spese <= Entrate - Obiettivo
--
-- E' l'identita' che tiene insieme tutta la funzione: obiettivo e limite di
-- spesa vivono sullo stesso asse (quanto posso spendere questo mese), quindi
-- il semicerchio della Home non ha bisogno di una seconda forma per
-- mostrarli entrambi, e soprattutto il conflitto fra i due diventa
-- calcolabile invece che opinabile: `limite + obiettivo > entrate` e' vero o
-- falso, non "sembra tanto".
--
-- Gli investimenti contano come risparmio (scelta di Andrea): sono denaro
-- non consumato. Un PAC da 500 copre meta' di un obiettivo da 1000, e dirgli
-- il contrario lo spingerebbe a smettere di investire per "risparmiare".

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  -- Le entrate su cui l'obiettivo e' stato calcolato, **congelate qui**.
  --
  -- Non si derivano dagli `incomes` del mese in corso: il 3 del mese lo
  -- stipendio non e' ancora arrivato e la somma vale 0, quindi il tetto
  -- implicito varrebbe -1000 e la Home direbbe "sei oltre di 1.200 €" a chi
  -- ha speso normalmente. E' la stessa classe di errore per cui `useLimits`
  -- scarta una copia in cache di un'altra settimana invece di mostrare
  -- "0% del budget": un numero vero riferito a un periodo diverso, che
  -- diventa un via libera (o un allarme) inventato.
  --
  -- Si propone la mediana degli ultimi mesi e la si lascia correggere a mano:
  -- e' un dato dichiarato, e ovunque compaia il tetto derivato va scritto su
  -- quali entrate e' calcolato.
  reference_income numeric(10, 2) not null check (reference_income > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Uno solo per utente: l'obiettivo e' mensile e complessivo, non per
-- categoria. Senza il vincolo se ne creerebbero infiniti dal foglio di
-- inserimento, come sarebbe successo ai limiti senza il loro indice unico.
create unique index if not exists savings_goals_one_per_user_idx
  on public.savings_goals (user_id);

alter table public.savings_goals enable row level security;

create policy "users manage their own savings_goals"
  on public.savings_goals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
