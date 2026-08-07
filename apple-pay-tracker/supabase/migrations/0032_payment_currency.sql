-- Multi-valuta sulle spese.
--
-- Prima di questa migrazione l'app assumeva che ogni importo fosse in euro:
-- una spesa a Londra veniva registrata come se "12,99" fossero euro invece di
-- sterline. Il numero restava plausibile ed era sbagliato del 15% — la stessa
-- classe di errore silenzioso gia' incontrata su `CBU8.DE`, dove una
-- quotazione dichiarava EUR e serviva USD.
--
-- **`amount` resta sempre in euro.** E' la scelta portante: se `amount`
-- diventasse polimorfo, ogni somma dell'app (totali, limiti, classifiche,
-- risparmi, export) mescolerebbe valute diverse restituendo numeri plausibili
-- e falsi. La valuta originale e' un'informazione **in piu'**, non un
-- sostituto.

alter table public.payments
  -- L'importo come lo ha visto l'utente sullo scontrino. Null quando la spesa
  -- era gia' in euro: non c'e' niente da ricordare.
  add column if not exists original_amount numeric(12, 2),
  -- Codice ISO 4217 (GBP, USD, CHF...). Null = euro.
  add column if not exists original_currency text,
  -- Cambio verso euro usato per la conversione, alla data della spesa.
  -- Salvarlo rende il calcolo verificabile a posteriori e stabile: senza,
  -- riaprire la stessa spesa fra un mese darebbe un controvalore diverso.
  add column if not exists fx_rate numeric(16, 8);

-- Le spese in valuta ancora da convertire: `original_currency` valorizzato ma
-- nessun cambio. Succede se frankfurter non risponde al momento
-- dell'ingestione. `sync-prices` le ripesca ogni notte, quindi un problema di
-- rete si ripara da solo invece di restare li' per sempre.
create index if not exists payments_da_convertire_idx
  on public.payments (user_id, occurred_at)
  where original_currency is not null and fx_rate is null;
