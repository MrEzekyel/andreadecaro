import { File } from "expo-file-system";
import { resolveMerchant } from "./merchants";
import { supabase } from "./supabase";

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
  /** Righe lette dal file, il denominatore che rende verificabili le altre. */
  lette: number;
  importate: number;
  duplicate: number;
  illeggibili: number;
  /** Righe valide che il database ha rifiutato. Senza, sparirebbero. */
  fallite: number;
};

/**
 * Valuta della stringa formattata, come in `ingest-payment`.
 *
 * Duplicata e non condivisa perche' la Edge Function gira su Deno e questa
 * sull'app: le due copie devono restare allineate a mano, ed e' il motivo per
 * cui l'elenco delle valute e' scritto qui accanto invece che altrove.
 */
const CURRENCIES = new Set([
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "GBP", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK",
  "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
]);

const SYMBOLS: [string, string][] = [
  ["£", "GBP"], ["¥", "JPY"], ["₹", "INR"], ["₺", "TRY"],
  ["R$", "BRL"], ["kr", "SEK"], ["$", "USD"],
];

export function detectCurrency(input: string): string | null {
  const iso = input.toUpperCase().match(/(?<![A-Z])(?!EUR)([A-Z]{3})(?![A-Z])/);
  if (iso && CURRENCIES.has(iso[1])) return iso[1];
  if (/EUR/i.test(input)) return null;
  for (const [symbol, code] of SYMBOLS) {
    if (input.includes(symbol)) return code;
  }
  return null;
}

/**
 * `%` e `_` sono i jolly di LIKE.
 *
 * Un esercente che si chiama "Sconto 100% Store" passato grezzo a `ilike`
 * diventa un pattern che combacia con qualunque nome inizi per "Sconto 100":
 * una spesa vera verrebbe scambiata per doppione e scartata in silenzio.
 */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

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

/**
 * Legge il file e inserisce le spese mancanti.
 *
 * L'inserimento avviene dall'app e non passando dalla Edge Function perche'
 * quella vuole il token di ingestione, che si vede una volta sola e qui non
 * c'e'. L'esercente lo risolve `resolve_merchant()` nel database, la stessa
 * funzione che usano il foglio "Nuova spesa" e l'ingestione automatica: un
 * esercente gia' visto porta con se' la sua categoria e la sua insegna, uno
 * nuovo entra da categorizzare — esattamente cio' che succederebbe passando
 * dalla funzione, per un esercente mai visto.
 */
export async function recoverFromFile(uri: string): Promise<RecoverOutcome> {
  const text = await new File(uri).text();
  const { rows, illeggibili } = parseRecoveryFile(text);
  const lette = rows.length + illeggibili;

  if (rows.length === 0) {
    return { lette, importate: 0, duplicate: 0, illeggibili, fallite: 0 };
  }

  // `getSession` e non `getUser`: il secondo interroga il server per validare
  // il JWT, e qui la sessione locale basta — l'utente sta importando, non
  // autenticandosi.
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("Sessione scaduta: esci e rientra.");

  let importate = 0;
  let duplicate = 0;
  let fallite = 0;
  // Le righe con un importo illeggibile si sommano a quelle gia' scartate dal
  // parser. Insieme a `lette` e a `fallite` formano un conto che deve tornare:
  // e' l'unico modo perche' l'utente si accorga se qualcosa e' andato perso.
  let scartate = illeggibili;

  // Le righe inserite in questo giro non devono valere come "gia' presenti"
  // per le righe successive: due caffe' uguali nello stesso bar a due minuti
  // di distanza sono ordinaria amministrazione, mentre un doppione dentro allo
  // stesso file richiede che l'automazione sia scattata due volte *e* fallita
  // due volte. Senza questo insieme, il secondo caffe' verrebbe scartato.
  const inseriteOra = new Set<string>();

  for (const row of rows) {
    const amount = parseAmountText(row.amount);
    if (amount === null) {
      scartate += 1;
      continue;
    }

    // Una data illeggibile non diventa "adesso": sposterebbe una spesa da un
    // mese chiuso a uno aperto falsandone due, e in silenzio. Meglio dichiarare
    // la riga come non importata e lasciarla nel file.
    if (!row.occurred_at) {
      scartate += 1;
      continue;
    }
    const when = new Date(row.occurred_at);
    if (Number.isNaN(when.getTime())) {
      scartate += 1;
      continue;
    }

    // Stessa finestra della Edge Function, e come li' guarda solo **indietro**:
    // serve a riconoscere una spesa che nel frattempo era arrivata lo stesso,
    // perche' la Shortcut non sa se il timeout sia scattato prima o dopo la
    // registrazione. Guardare anche avanti scarterebbe il doppio.
    const since = new Date(when.getTime() - 5 * 60_000).toISOString();

    const { data: esistenti } = await supabase
      .from("payments")
      .select("id")
      .eq("amount", amount)
      .ilike("merchant_raw", escapeLike(row.merchant))
      .gte("occurred_at", since)
      .lte("occurred_at", when.toISOString())
      .limit(5);

    const precedente = (esistenti ?? []).find((r) => !inseriteOra.has(r.id));
    if (precedente) {
      duplicate += 1;
      continue;
    }

    const merchant = await resolveMerchant(userId, row.merchant);

    // La valuta si conserva. `parseAmountText` restituisce il numero grezzo,
    // che per una spesa in sterline **non e' euro**: scriverlo in `amount` come
    // se lo fosse riaprirebbe esattamente il difetto che la multi-valuta ha
    // chiuso, e per giunta in modo permanente — senza `original_currency` la
    // riga non verrebbe mai ripescata dal recupero cambi notturno.
    //
    // La conversione non si fa qui: `fx_rate` resta nullo e ci pensa
    // `sync-prices`, che e' gia' il posto dove quella logica vive.
    const currency = detectCurrency(row.amount);

    const { data: creata, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        amount,
        original_amount: currency ? amount : null,
        original_currency: currency,
        fx_rate: null,
        merchant_raw: row.merchant,
        merchant_name: merchant?.merchant_name ?? row.merchant,
        merchant_id: merchant?.merchant_id ?? null,
        category_id: merchant?.effective_category_id ?? null,
        occurred_at: when.toISOString(),
        source: "shortcut",
      })
      .select("id")
      .single();

    if (error || !creata) {
      // Una riga rifiutata dal database non deve evaporare fra i conteggi: la
      // funzione che esiste per recuperare spese perse non puo' perderne a sua
      // volta dichiarando di aver finito.
      fallite += 1;
      continue;
    }

    inseriteOra.add(creata.id);
    importate += 1;
  }

  return { lette, importate, duplicate, illeggibili: scartate, fallite };
}
