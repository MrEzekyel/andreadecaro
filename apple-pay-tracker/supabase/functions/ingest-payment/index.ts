// Edge Function: ingest-payment
//
// Riceve un pagamento (estratto da una notifica Wallet tramite una Shortcut iOS
// o dettato a Siri), risolve esercente e categoria, e lo salva in `payments`.
//
// Autenticazione: la Shortcut invia il proprio token nell'header
// `x-ingest-token`. La function ne calcola l'hash SHA-256 e lo cerca in
// `ingest_tokens` per risalire all'utente. Nessun segreto da configurare.
//
// Deploy: supabase functions deploy ingest-payment --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

type IngestBody = {
  amount: number | string;
  merchant: string;
  occurred_at?: string;
  raw_text?: string;
  dedup_key?: string;
  source?: string;
};

// Finestra entro cui due pagamenti identici sono considerati un doppio invio
// della stessa notifica Wallet.
const DEDUP_WINDOW_MINUTES = 5;

const ALLOWED_SOURCES = new Set(["shortcut", "siri", "manual", "recurring"]);

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const ALPHANUM = /[\p{L}\p{N}]/u;

/** Sotto questa lunghezza una chiave deve combaciare con una parola intera. */
const PREFIX_MIN = 5;

/**
 * Verifica se una regola si applica al nome esercente.
 *
 * La chiave deve iniziare a INIZIO PAROLA: senza questo vincolo "eni"
 * beccherebbe "tezenis" e "lime" beccherebbe "alimentari", assegnando
 * categorie sbagliate — che sono peggio di nessuna categoria, perche' non
 * si notano e falsano le statistiche.
 *
 * Le chiavi corte devono combaciare anche in coda ("ip" non deve prendere
 * "iphone"), mentre quelle lunghe restano libere cosi' "supermercat" copre
 * sia "supermercato" sia "supermercati".
 */
function keywordMatches(merchant: string, keyword: string) {
  const needle = normalize(keyword);
  if (!needle) return false;

  const wholeWord =
    needle.replace(/[^\p{L}\p{N}]/gu, "").length < PREFIX_MIN;

  let from = 0;
  for (;;) {
    const at = merchant.indexOf(needle, from);
    if (at === -1) return false;

    const before = at === 0 ? "" : merchant[at - 1];
    const after = merchant[at + needle.length] ?? "";

    const startsWord = !before || !ALPHANUM.test(before);
    const endsWord = !wholeWord || !after || !ALPHANUM.test(after);

    if (startsWord && endsWord) return true;
    from = at + 1;
  }
}

/**
 * Fra piu' regole che combaciano vince la piu' specifica, cioe' la piu'
 * lunga: "uber eats" deve battere "uber", altrimenti una cena diventa un
 * viaggio.
 */
function longestFirst<T extends { keyword: string }>(rules: T[]) {
  return [...rules].sort(
    (a, b) => b.keyword.trim().length - a.keyword.trim().length
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Le notifiche italiane usano la virgola come separatore decimale
// ("23,40 €") e il punto per le migliaia ("1.234,56 €").
export function parseAmount(input: number | string): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== "string") return null;

  const cleaned = input.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // Entrambi presenti: l'ultimo che compare e' il separatore decimale.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Solo virgola: decimale se seguita da 1-2 cifre, altrimenti migliaia.
    const decimals = cleaned.length - lastComma - 1;
    normalized =
      decimals > 0 && decimals <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastDot > -1) {
    // Solo punto: migliaia se seguito da esattamente 3 cifre (es. "1.234").
    const decimals = cleaned.length - lastDot - 1;
    normalized = decimals === 3 ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "function misconfigured" }, 500);
  }

  const token =
    req.headers.get("x-ingest-token") ?? req.headers.get("x-ingest-secret");

  if (!token) {
    return jsonResponse({ error: "missing x-ingest-token header" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("ingest_tokens")
    .select("id, user_id")
    .eq("token_hash", await sha256Hex(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (tokenError) {
    console.error("token lookup failed", tokenError);
    return jsonResponse({ error: "token lookup failed" }, 500);
  }
  if (!tokenRow) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = tokenRow.user_id;

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  const amount = parseAmount(body.amount);
  const merchantRaw = (body.merchant ?? "").toString().trim();

  if (amount === null || amount <= 0) {
    return jsonResponse({ error: "amount must be a positive number" }, 400);
  }
  if (!merchantRaw) {
    return jsonResponse({ error: "merchant is required" }, 400);
  }

  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return jsonResponse({ error: "occurred_at is not a valid date" }, 400);
  }

  const source =
    body.source && ALLOWED_SOURCES.has(body.source) ? body.source : "shortcut";

  // Il token e' valido: segna l'uso senza bloccare l'ingestione se fallisce.
  await supabase
    .from("ingest_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const merchantNormalized = normalize(merchantRaw);

  // Dedup senza chiave esplicita: stesso importo e stesso esercente
  // registrati pochi minuti fa = probabile doppio scatto della Shortcut.
  if (!body.dedup_key) {
    const since = new Date(
      occurredAt.getTime() - DEDUP_WINDOW_MINUTES * 60_000
    ).toISOString();

    const { data: recent } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("amount", amount)
      .ilike("merchant_raw", merchantRaw)
      .gte("occurred_at", since)
      .limit(1);

    if (recent && recent.length > 0) {
      return jsonResponse(
        { ok: true, skipped: "duplicate", payment_id: recent[0].id },
        200
      );
    }
  }

  // ── Esercente ─────────────────────────────────────────────────────────────
  // Cerca l'esercente gia' noto, altrimenti lo crea. La riga porta con se'
  // la categoria scelta dall'utente, se l'ha gia' corretta in passato.
  let merchantId: string | null = null;
  let categoryId: string | null = null;

  const { data: existingMerchant } = await supabase
    .from("merchants")
    .select("id, category_id")
    .eq("user_id", userId)
    .eq("normalized_name", merchantNormalized)
    .maybeSingle();

  if (existingMerchant) {
    merchantId = existingMerchant.id;
    categoryId = existingMerchant.category_id;
  } else {
    const { data: created, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        user_id: userId,
        normalized_name: merchantNormalized,
        display_name: merchantRaw,
      })
      .select("id, category_id")
      .single();

    // Una richiesta concorrente puo' aver creato lo stesso esercente:
    // in quel caso rileggo la riga vincente invece di fallire.
    if (merchantError?.code === "23505") {
      const { data: raced } = await supabase
        .from("merchants")
        .select("id, category_id")
        .eq("user_id", userId)
        .eq("normalized_name", merchantNormalized)
        .maybeSingle();
      merchantId = raced?.id ?? null;
      categoryId = raced?.category_id ?? null;
    } else if (merchantError) {
      console.error("merchant upsert failed", merchantError);
    } else {
      merchantId = created.id;
      categoryId = created.category_id;
    }
  }

  // ── Categoria ─────────────────────────────────────────────────────────────
  // 1. l'esercente e' gia' mappato -> certo, nessuna euristica
  // 2. regole keyword dell'utente -> quasi certo
  // 3. regole predefinite -> ipotesi
  // 4. NULL -> resta da categorizzare
  if (!categoryId) {
    const { data: userRules } = await supabase
      .from("merchant_categories")
      .select("keyword, category_id")
      .eq("user_id", userId);

    categoryId =
      longestFirst(userRules ?? []).find((rule) =>
        keywordMatches(merchantNormalized, rule.keyword)
      )?.category_id ?? null;
  }

  if (!categoryId) {
    const { data: defaultRules } = await supabase
      .from("default_merchant_categories")
      .select("keyword, category");

    const guessedName = longestFirst(defaultRules ?? []).find((rule) =>
      keywordMatches(merchantNormalized, rule.keyword)
    )?.category;

    if (guessedName) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", guessedName)
        .maybeSingle();
      categoryId = category?.id ?? null;
    }
  }

  const { data: inserted, error } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      amount,
      merchant_raw: merchantRaw,
      merchant_name: merchantRaw,
      merchant_id: merchantId,
      category_id: categoryId,
      occurred_at: occurredAt.toISOString(),
      raw_notification_text: body.raw_text ?? null,
      source,
      dedup_key: body.dedup_key ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = violazione del vincolo unico su (user_id, dedup_key)
    if (error.code === "23505") {
      return jsonResponse({ ok: true, skipped: "duplicate" }, 200);
    }
    console.error("insert failed", error);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true, payment: inserted }, 201);
});
