-- Le perdite silenziose dell'ingestione.
--
-- La deduplicazione (`dedup_key` + vincolo unico) protegge dai doppioni, non
-- dalle perdite. iOS Shortcuts non ritenta mai: telefono in aereo, segnale
-- scarso alla cassa, cold start di Supabase oltre il timeout, e la transazione
-- e' persa per sempre — in silenzio. Il totale del mese resta sbagliato in
-- difetto e sembra corretto: nessuno se ne accorge, ne' l'utente ne' l'app.
--
-- Non esiste una sorgente di verita' contro cui riconciliare in automatico
-- (l'app non parla con la banca), quindi l'unica cosa onesta e' trasformare un
-- errore invisibile in una domanda esplicita, una volta al mese: "il totale di
-- ottobre corrisponde all'estratto conto?". Questa tabella ricorda a quali
-- mesi si e' gia' risposto, cosi' la domanda non torna.

create table if not exists public.month_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sempre il primo giorno del mese: e' il mese a essere confermato, non un
  -- giorno preciso, e normalizzarlo qui evita che due righe diverse indichino
  -- lo stesso mese.
  month date not null,
  -- Il totale che l'app mostrava quando l'utente ha confermato. Serve per
  -- accorgersi che qualcosa e' cambiato *dopo* la conferma: se il mese torna a
  -- divergere, la conferma di allora non vale piu' per il mese di adesso.
  confirmed_total numeric(10, 2) not null,
  confirmed_at timestamptz not null default now()
);

create unique index if not exists month_checks_user_month_idx
  on public.month_checks (user_id, month);

alter table public.month_checks enable row level security;

create policy "users manage their own month checks"
  on public.month_checks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
