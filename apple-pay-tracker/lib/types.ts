export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  merchant_raw: string;
  merchant_name: string;
  category: string;
  occurred_at: string;
  raw_notification_text: string | null;
  created_at: string;
};
