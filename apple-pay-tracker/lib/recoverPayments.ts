import { File } from "expo-file-system";
import { supabase } from "./supabase";
import type { Merchant } from "./types";

/**
 * Recupero delle spese che la Shortcut non e' riuscita a mandare.
 *
 * iOS Shortcuts non ritenta mai: telefono in aereo, segnale scarso alla cassa,
 * cold start di Supabase oltre il timeout, e la spesa e' persa per sempre in
 * silenzio. Il ramo di fallimento dell'automazione scrive allora la stessa
 * riga che avrebbe mandato in rete su un file locale, e da qui la si rilegge.
 *
 * Il formato e' **una riga JSON per spesa**, identica al corpo della chiamata:
 *
 *   {"merchant":"Esselunga","amount":"12,99 €","occurred_at":"2026-08-07T14:32:00Z"}
 *
 * Un JSON per riga e non un CSV perche' i nomi degli esercenti contengono
 * virgole e punti e virgola ("Bar Sport, Roma"), e perche' `amount` deve
 * restare la **stringa formattata** cosi' com'e' arrivata da Wallet: e' li'
 * dentro che c'e' la valuta, e perderla rifarebbe nascere il difetto che la
 * multi-valuta ha appena chiuso.
 */

export type RecoveredRow = {
  merchant: string;
  amount: string;
  occurred_at?: string;
};

export type RecoverOutcome = {
  importate: number;
  duplicate: number;
  illeggibili: number;
};

/** Le righe leggibili del file, saltando quelle rotte invece di fermarsi. */
export function parseRecoveryFile(text: string): {
  rows: RecoveredRow[];
  illeggibili: number;
} {
  const rows: RecoveredRow[] = [];
  let illeggibili = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.merchant === "string" && parsed.merchant.trim()) {
        rows.push({
          merchant: parsed.merchant.trim(),
          amount: String(parsed.amount ?? ""),
          occurred_at: parsed.occurred_at,
        });
        continue;
      }
      illeggibili += 1;
    } catch {
      // Una riga rotta non deve far perdere le altre: il file viene scritto da
      // un'automazione che puo' essere interrotta a meta' riga.
      illeggibili += 1;
    }
  }

  return { rows, illeggibili };
}

/**
 * Importo dalla stringa formattata di Wallet ("12,99 €", "£12.99").
 *
 * Stessa logica di `parseAmount` nella Edge Function: virgola decimale se
 * seguita da una o due cifre, punto come migliaia quando ne segue tre.
 */
export function parseAmountText(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalized =
      decimals > 0 && decimals <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastDot > -1) {
    normalized =
      cleaned.length - lastDot - 1 === 3 ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Legge il file e inserisce le spese mancanti.
 *
 * L'inserimento avviene dall'app e non passando dalla Edge Function perche'
 * quella vuole il token di ingestione, che si vede una volta sola e qui non
 * c'e'. La risoluzione dell'esercente si fa allora sulla tabella `merchants`,
 * che l'app ha gia': un esercente gia' visto porta con se' la sua categoria,
 * uno nuovo entra da categorizzare — esattamente cio' che succederebbe
 * passando dalla funzione, per un esercente mai visto.
 */
export async function recoverFromFile(uri: string): Promise<RecoverOutcome> {
  const text = await new File(uri).text();
  const { rows, illeggibili } = parseRecoveryFile(text);

  if (rows.length === 0) {
    return { importate: 0, duplicate: 0, illeggibili };
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sessione scaduta: esci e rientra.");

  const { data: merchantRows, error: merchantError } = await supabase
    .from("merchants")
    .select("*");
  if (merchantError) throw new Error(merchantError.message);

  const perNome = new Map<string, Merchant>();
  for (const m of (merchantRows ?? []) as Merchant[]) {
    perNome.set(m.normalized_name, m);
  }

  let importate = 0;
  let duplicate = 0;
  // Le righe con un importo illeggibile si sommano a quelle gia' scartate dal
  // parser: un totale che non torna e' l'unico segnale che qualcosa e' andato
  // perso, e nasconderlo qui vanificherebbe tutto il recupero.
  let scartate = illeggibili;

  for (const row of rows) {
    const amount = parseAmountText(row.amount);
    if (amount === null) {
      scartate += 1;
      continue;
    }

    const occurredAt = row.occurred_at ? new Date(row.occurred_at) : new Date();
    const when = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

    // Stessa finestra della Edge Function: stesso importo e stesso esercente
    // entro cinque minuti e' un doppio invio, non due spese. Serve perche' il
    // file puo' contenere una spesa che nel frattempo e' arrivata lo stesso —
    // la Shortcut non sa se il timeout sia scattato prima o dopo la scrittura.
    const since = new Date(when.getTime() - 5 * 60_000).toISOString();
    const until = new Date(when.getTime() + 5 * 60_000).toISOString();

    const { data: esistenti } = await supabase
      .from("payments")
      .select("id")
      .eq("amount", amount)
      .ilike("merchant_raw", row.merchant)
      .gte("occurred_at", since)
      .lte("occurred_at", until)
      .limit(1);

    if (esistenti && esistenti.length > 0) {
      duplicate += 1;
      continue;
    }

    let merchant = perNome.get(normalize(row.merchant));
    if (!merchant) {
      const { data: created } = await supabase
        .from("merchants")
        .insert({
          user_id: userId,
          normalized_name: normalize(row.merchant),
          display_name: row.merchant,
        })
        .select("*")
        .single();
      if (created) {
        merchant = created as Merchant;
        perNome.set(merchant.normalized_name, merchant);
      }
    }

    const { error } = await supabase.from("payments").insert({
      user_id: userId,
      amount,
      merchant_raw: row.merchant,
      merchant_name: merchant?.display_name ?? row.merchant,
      merchant_id: merchant?.id ?? null,
      category_id: merchant?.category_id ?? null,
      occurred_at: when.toISOString(),
      source: "shortcut",
    });

    if (!error) importate += 1;
  }

  return { importate, duplicate, illeggibili: scartate };
}
