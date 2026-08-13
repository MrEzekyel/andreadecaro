-- Lista curata di strumenti per la ricerca "per nome" nella creazione di un
-- asset (schermata Investimenti). L'utente non conosce quasi mai l'ISIN — lo
-- dice l'esperienza, non solo l'intuizione — quindi si cerca per **nome**, e
-- l'ISIN qui non compare: nessuna riga sotto è stata verificata contro un
-- ISIN, solo contro il ticker Yahoo (interrogato dal vivo, uno per uno,
-- prima di scrivere questa migrazione). Un ISIN sbagliato scritto a memoria
-- sarebbe un dato finanziario falso con l'aria di essere vero — peggio di
-- non averlo.
--
-- Questa tabella è un **acceleratore**, non un catalogo: copre gli strumenti
-- più comuni fra chi investe da un broker italiano (Trade Republic, Directa,
-- Fineco, Scalable). Quando la ricerca qui non trova niente, l'app passa a
-- Yahoo Finance (Edge Function `search-instruments`), e se nemmeno quello
-- basta l'utente inserisce nome e codice a mano — lo stesso schema già in
-- uso per i fondi private market (`price_source='manual'`).

create table if not exists public.instruments (
  symbol text primary key,
  name text not null,
  currency text not null,
  asset_group text not null default 'conto_titoli'
    check (asset_group in ('conto_titoli', 'crypto')),
  sort_order int not null default 0
);

-- Dato di riferimento condiviso, non per-utente: leggibile da chiunque sia
-- autenticato, scrivibile da nessuno lato client (si aggiorna solo con una
-- migrazione, come `default_merchant_categories`).
alter table public.instruments enable row level security;

create policy "authenticated users read instruments"
  on public.instruments for select to authenticated
  using (true);

insert into public.instruments (symbol, name, currency, asset_group, sort_order) values
  ('SWDA.MI', 'iShares Core MSCI World UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 10),
  ('IWDA.AS', 'iShares Core MSCI World UCITS ETF USD (Acc) — Amsterdam', 'EUR', 'conto_titoli', 11),
  ('VWCE.DE', 'Vanguard FTSE All-World UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 12),
  ('XDWD.MI', 'Xtrackers MSCI World UCITS ETF 1C', 'EUR', 'conto_titoli', 13),
  ('EIMI.MI', 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 20),
  ('VUSA.MI', 'Vanguard S&P 500 UCITS ETF', 'EUR', 'conto_titoli', 30),
  ('VUAA.MI', 'Vanguard S&P 500 UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 31),
  ('IUSA.MI', 'iShares Core S&P 500 UCITS ETF USD (Dist)', 'EUR', 'conto_titoli', 32),
  ('SXR8.DE', 'iShares Core S&P 500 UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 33),
  ('CSSPX.MI', 'iShares Core S&P 500 UCITS ETF USD (Acc) — Milano', 'EUR', 'conto_titoli', 34),
  ('SPXS.MI', 'Invesco S&P 500 UCITS ETF', 'EUR', 'conto_titoli', 35),
  ('EQQQ.MI', 'Invesco EQQQ Nasdaq-100 UCITS ETF', 'EUR', 'conto_titoli', 40),
  ('QDVE.DE', 'iShares S&P 500 Information Technology Sector UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 41),
  ('CHPX.MI', 'Global X AI Semiconductor & Quantum UCITS ETF USD (Acc)', 'EUR', 'conto_titoli', 42),
  ('ROBO.MI', 'L&G ROBO Global Robotics and Automation UCITS ETF', 'EUR', 'conto_titoli', 43),
  ('REUSE.MI', 'BNP Paribas Easy ECPI Circular Economy Leaders UCITS ETF', 'EUR', 'conto_titoli', 44),
  ('AGGH.MI', 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)', 'EUR', 'conto_titoli', 50),
  ('SGLD.MI', 'Invesco Physical Gold ETC', 'EUR', 'conto_titoli', 60),
  ('BTC-EUR', 'Bitcoin', 'EUR', 'crypto', 100),
  ('ETH-EUR', 'Ethereum', 'EUR', 'crypto', 101),
  ('SOL-EUR', 'Solana', 'EUR', 'crypto', 102),
  ('XRP-EUR', 'XRP', 'EUR', 'crypto', 103)
on conflict (symbol) do update set
  name = excluded.name,
  currency = excluded.currency,
  asset_group = excluded.asset_group,
  sort_order = excluded.sort_order;
