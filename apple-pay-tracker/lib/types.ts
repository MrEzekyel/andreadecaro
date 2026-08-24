export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
};

export type Merchant = {
  id: string;
  user_id: string;
  normalized_name: string;
  display_name: string;
  category_id: string | null;
  /**
   * L'insegna a cui appartiene questo punto vendita, se ce n'e' una.
   *
   * "McDonald's Cristoforo Col" punta a "McDonald's". L'albero e' profondo
   * uno per costruzione (trigger `merchants_keep_flat`): un brand di un brand
   * renderebbe ogni somma dipendente da quante volte si risale.
   */
  parent_id: string | null;
  /** Escluso dalle classifiche, ma non dai totali. */
  excluded_from_stats: boolean;
  created_at: string;
};

/** Quello che `resolve_merchant()` restituisce: la riga piu' il suo contesto. */
export type ResolvedMerchant = {
  merchant_id: string;
  brand_id: string | null;
  merchant_name: string;
  /** Il nome da mostrare negli elenchi: l'insegna, non il punto vendita. */
  brand_name: string;
  /** Del punto vendita se ce l'ha, altrimenti quella dell'insegna. */
  effective_category_id: string | null;
  effective_excluded: boolean;
};

export type Payment = {
  id: string;
  user_id: string;
  /** Quanto e' uscito dal conto. */
  amount: number;
  /** Quanto compete a me quando la spesa e' divisa. NULL = non divisa. */
  my_share: number | null;
  /** coalesce(my_share, amount), calcolato dal database. Usalo nelle somme. */
  effective_amount: number;
  /**
   * L'importo come lo ha visto l'utente, quando la spesa non era in euro.
   *
   * `amount` resta **sempre** in euro: questi tre campi sono informazione in
   * piu', non un sostituto. Se `amount` diventasse polimorfo ogni somma
   * dell'app mescolerebbe valute restituendo numeri plausibili e falsi.
   */
  original_amount: number | null;
  /** Codice ISO 4217. `null` = la spesa era gia' in euro. */
  original_currency: string | null;
  /** Cambio verso euro alla data della spesa. `null` = ancora da convertire. */
  fx_rate: number | null;
  merchant_raw: string;
  merchant_name: string;
  merchant_id: string | null;
  category_id: string | null;
  occurred_at: string;
  raw_notification_text: string | null;
  note: string | null;
  /** Campi opzionali dal trigger Transazione di iOS. */
  card_name: string | null;
  transaction_name: string | null;
  city: string | null;
  country: string | null;
  /** Esclusa dalle classifiche, ma non dai totali. */
  excluded_from_stats: boolean;
  source: string;
  dedup_key: string | null;
  /** Chi c'e' dall'altra parte, quando si sa. */
  person_id: string | null;
  /** Il lotto d'import da cui e' entrata. `null` = non viene da un file. */
  import_batch_id: string | null;
  created_at: string;
  /**
   * Le quote di questa spesa, quando la query le richiede esplicitamente
   * (join opzionale su `payment_splits`). `undefined` = non richieste,
   * `[]` = spesa non divisa: i chiamanti devono distinguere i due casi.
   */
  payment_splits?: { settled_at: string | null }[];
};

export type Person = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  /**
   * L'account Clinck di questa persona, quando ce l'ha.
   *
   * È la colonna che regge tutta la divisione fra account: le quote restano
   * attaccate al contatto della rubrica e il contatto punta all'account,
   * quindi un amico che scarica l'app mesi dopo si porta dietro tutto lo
   * storico senza che niente vada migrato (`link_person`).
   */
  linked_user_id: string | null;
  created_at: string;
};

/**
 * `local` = persona senza account, il comportamento di sempre.
 * `pending` = mandata a un account Clinck, in attesa di risposta.
 * `accepted` = accettata, ed è diventata una spesa nel conto dell'altro.
 * `declined` = rifiutata: la spesa di chi ha pagato **non** cambia da sola.
 */
export type SplitStatus = "local" | "pending" | "accepted" | "declined";

export type PaymentSplit = {
  id: string;
  payment_id: string;
  person_id: string;
  amount_owed: number;
  status: SplitStatus;
  responded_at: string | null;
  /** Quando il debitore ha dichiarato di aver pagato. Non salda da solo. */
  settle_requested_at: string | null;
  mirror_payment_id: string | null;
  settled_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

export type ConnectionStatus = "pending" | "accepted" | "declined" | "none";

/** Un amico, o una richiesta di amicizia in sospeso. */
export type Connection = {
  connection_id: string;
  other_user_id: string;
  handle: string;
  display_name: string;
  status: "pending" | "accepted";
  /** Vero se la richiesta l'ho ricevuta io e tocca a me rispondere. */
  incoming: boolean;
};

/** Il risultato della ricerca per tag: tre campi e basta. */
export type FoundProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  connection_status: ConnectionStatus;
};

/** Una quota che qualcun altro ha diviso con me. */
export type IncomingSplit = {
  split_id: string;
  amount_owed: number;
  status: "pending" | "accepted";
  settled_at: string | null;
  settle_requested_at: string | null;
  payer_name: string;
  payer_handle: string | null;
  /** Chi ha pagato — collegabile a `people.linked_user_id` per raggruppare
   *  per persona insieme alle quote che gli ho fatto io (migrazione 0041). */
  payer_user_id: string;
  merchant: string;
  occurred_at: string;
  /** Quanto ha pagato in tutto chi ha diviso: dà il contesto alla quota. */
  total_amount: number;
};

/** Una quota con accanto la spesa e la persona a cui si riferisce. */
export type OpenCredit = PaymentSplit & {
  person: Person;
  payment: Pick<Payment, "id" | "merchant_name" | "occurred_at" | "amount">;
};

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type RecurringRule = {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  category_id: string | null;
  card_name: string | null;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  weekday: number | null;
  start_on: string;
  end_on: string | null;
  next_run_on: string;
  active: boolean;
  created_at: string;
};

export type SpendingLimit = {
  id: string;
  user_id: string;
  period: "weekly" | "monthly";
  amount: number;
  /** NULL = limite complessivo su tutte le categorie. */
  category_id: string | null;
  warn_at_percent: number;
  active: boolean;
  created_at: string;
};

/**
 * Obiettivo di risparmio mensile.
 *
 * Sta sullo stesso asse di `SpendingLimit`, non su un asse suo: risparmiare
 * `amount` su `reference_income` di entrate significa non spendere piu' di
 * `reference_income - amount`. Vedi `lib/savings.ts`.
 */
export type SavingsGoal = {
  id: string;
  user_id: string;
  amount: number;
  /**
   * Le entrate su cui l'obiettivo e' calcolato, congelate al momento in cui
   * viene impostato. **Non** sono gli introiti del mese in corso: quelli
   * valgono zero fino a che lo stipendio non arriva, e un tetto derivato da
   * zero e' un allarme inventato.
   */
  reference_income: number;
  active: boolean;
  created_at: string;
};

/** I tre raggruppamenti del portafoglio, gli stessi che usa Trade Republic. */
export type AssetGroup = "conto_titoli" | "crypto" | "private_market";

export type Asset = {
  id: string;
  user_id: string;
  name: string;
  asset_group: AssetGroup;
  isin: string | null;
  price_source: "yahoo" | "manual";
  price_symbol: string | null;
  quote_currency: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type AssetPrice = {
  asset_id: string;
  on_date: string;
  close_eur: number;
  /** `fill` = prezzo di un'esecuzione reale sul conto. */
  source: "yahoo" | "manual" | "fill";
};

/**
 * Uno strumento della lista curata (migrazione 0040): un acceleratore per la
 * ricerca "per nome" nella creazione di un asset, non un catalogo completo.
 * Quando la ricerca qui non trova niente, l'app passa a Yahoo Finance
 * (`lib/instruments.ts` → `searchInstrumentsOnline`).
 */
export type Instrument = {
  symbol: string;
  name: string;
  currency: string;
  asset_group: "conto_titoli" | "crypto";
  sort_order: number;
};

/** Un candidato trovato su Yahoo Finance: da verificare prima di salvarlo. */
export type InstrumentCandidate = {
  symbol: string;
  name: string;
  currency: string | null;
  exchange: string | null;
};

export type Investment = {
  id: string;
  user_id: string;
  asset_id: string | null;
  amount: number;
  label: string;
  card_name: string | null;
  note: string | null;
  occurred_at: string;
  source: "manual" | "recurring" | "import";
  /** `amount` resta sempre positivo: la direzione del denaro la porta `kind`. */
  kind: "buy" | "sell" | "dividend";
  quantity: number | null;
  unit_price: number | null;
  fee: number;
  /**
   * `settled` = eseguita, con quote e prezzo. `pending` = addebitata dal broker
   * e in attesa di esecuzione (private market). `estimated` = rata prevista da
   * un piano di accumulo, in attesa dell'operazione vera dall'estratto conto.
   */
  status: "settled" | "pending" | "estimated";
  settled_on: string | null;
  external_id: string | null;
  dedup_key: string | null;
  created_at: string;
};

export type InvestmentRule = {
  id: string;
  user_id: string;
  /** Il piano punta a un asset: senza, non si saprebbe in quale sezione va. */
  asset_id: string | null;
  label: string;
  amount: number;
  card_name: string | null;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  weekday: number | null;
  start_on: string;
  end_on: string | null;
  next_run_on: string;
  active: boolean;
  created_at: string;
};

export type Income = {
  id: string;
  user_id: string;
  amount: number;
  label: string;
  note: string | null;
  occurred_at: string;
  /**
   * Denaro tornato indietro, non guadagnato.
   *
   * Resta in elenco e nel saldo, ma **non conta come introito** nelle medie e
   * nel "Risparmiato": i rimborsi da una persona sono decine di righe in un
   * estratto conto, e contarli come stipendio gonfia ogni statistica che
   * dipende dal reddito.
   */
  is_reimbursement: boolean;
  /** Chi c'e' dall'altra parte, quando si sa. */
  person_id: string | null;
  /** Il lotto d'import da cui e' entrata. `null` = non viene da un file. */
  import_batch_id: string | null;
  created_at: string;
};

/**
 * Un import, come lotto annullabile.
 *
 * Esiste per una ragione sola: rendere un import **reversibile**. Prima le
 * righe di due import diversi erano indistinguibili se non guardando
 * `created_at` a mano sul database, quindi un import andato male non si
 * poteva togliere.
 */
export type ImportBatch = {
  id: string;
  user_id: string;
  file_names: string[];
  spese: number;
  entrate: number;
  /** Righe riconosciute come gia' registrate: mai scritte, mai da togliere. */
  gia_presenti: number;
  created_at: string;
};

export type IngestToken = {
  id: string;
  user_id: string;
  token_hash: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type SubscriptionStatus = "trialing" | "active" | "expired";
export type SubscriptionPlan = "monthly" | "annual";

export type Profile = {
  user_id: string;
  /** Il Clinck Tag: minuscolo, 3-20 fra lettere, numeri e underscore. */
  handle: string | null;
  display_name: string | null;
  trial_ends_at: string;
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan | null;
  current_period_end: string | null;
  revenuecat_app_user_id: string | null;
  referral_code: string;
  bonus_months_granted: number;
  created_at: string;
};

export type ReferralStatus = "pending" | "confirmed";

export type Referral = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  status: ReferralStatus;
  created_at: string;
  confirmed_at: string | null;
};
