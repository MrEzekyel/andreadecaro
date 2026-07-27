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
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  merchant_raw: string;
  merchant_name: string;
  merchant_id: string | null;
  category_id: string | null;
  occurred_at: string;
  raw_notification_text: string | null;
  note: string | null;
  source: string;
  dedup_key: string | null;
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
