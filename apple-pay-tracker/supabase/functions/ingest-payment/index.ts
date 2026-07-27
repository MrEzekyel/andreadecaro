// Edge Function: ingest-payment
//
// Riceve un pagamento (estratto da una notifica Wallet tramite una Shortcut iOS),
// lo categorizza in base all'esercente e lo salva nella tabella `payments`.
//
// Deploy: supabase functions deploy ingest-payment
// Secrets richiesti (supabase secrets set ...):
//   INGEST_SECRET     -> stringa segreta condivisa con la Shortcut (header x-ingest-secret)
//   TARGET_USER_ID     -> uuid dell'utente Supabase Auth a cui appartengono i pagamenti
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sono già disponibili di default nelle Edge Functions.

import { createClient } from "npm:@supabase/supabase-js@2";

type IngestBody = {
  amount: number;
  merchant: string;
  occurred_at?: string;
  raw_text?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const ingestSecret = Deno.env.get("INGEST_SECRET");
  const targetUserId = Deno.env.get("TARGET_USER_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!ingestSecret || !targetUserId || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "function misconfigured" }, 500);
  }

  if (req.headers.get("x-ingest-secret") !== ingestSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  const amount = Number(body.amount);
  const merchantRaw = (body.merchant ?? "").toString();

  if (!Number.isFinite(amount) || amount <= 0 || !merchantRaw.trim()) {
    return jsonResponse(
      { error: "amount (number > 0) and merchant (string) are required" },
      400
    );
  }

  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return jsonResponse({ error: "occurred_at is not a valid date" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const merchantNormalized = normalize(merchantRaw);

  // 1. regole personalizzate dell'utente hanno priorità
  const { data: userRules } = await supabase
    .from("merchant_categories")
    .select("keyword, category")
    .eq("user_id", targetUserId);

  let category =
    userRules?.find((rule) => merchantNormalized.includes(normalize(rule.keyword)))
      ?.category ?? null;

  // 2. altrimenti si guarda l'elenco predefinito
  if (!category) {
    const { data: defaultRules } = await supabase
      .from("default_merchant_categories")
      .select("keyword, category");

    category =
      defaultRules?.find((rule) =>
        merchantNormalized.includes(normalize(rule.keyword))
      )?.category ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("payments")
    .insert({
      user_id: targetUserId,
      amount,
      merchant_raw: merchantRaw,
      merchant_name: merchantRaw.trim(),
      category: category ?? "Da categorizzare",
      occurred_at: occurredAt.toISOString(),
      raw_notification_text: body.raw_text ?? null,
    })
    .select()
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true, payment: inserted }, 201);
});
