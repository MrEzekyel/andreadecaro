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
  /** Escluso dalle classifiche, ma non dai totali. */
  excluded_from_stats: boolean;
  created_at: string;
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
  created_at: string;
};

export type Person = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type PaymentSplit = {
  id: string;
  payment_id: string;
  person_id: string;
  amount_owed: number;
  settled_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
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

export type Investment = {
  id: string;
  user_id: string;
  amount: number;
  label: string;
  card_name: string | null;
  note: string | null;
  occurred_at: string;
  source: "manual" | "recurring";
  dedup_key: string | null;
  created_at: string;
};

export type InvestmentRule = {
  id: string;
  user_id: string;
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
