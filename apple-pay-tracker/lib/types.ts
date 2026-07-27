export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  merchant_raw: string;
  merchant_name: string;
  category: string;
  occurred_at: string;
  raw_notification_text: string | null;
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
