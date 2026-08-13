/**
 * Scrittura sul database dei movimenti letti da un estratto conto.
 *
 * Il rischio vero di questo import non e' sbagliare a leggere il file: e'
 * **contare due volte**. Chi usa l'app ha gia' le spese arrivate da Apple Pay,
 * e l'estratto conto contiene le stesse identiche operazioni con un'altra
 * data (la banca contabilizza uno o due giorni dopo l'acquisto) e un'altra
 * descrizione. Importarlo senza difese raddoppierebbe mesi di spese in un
 * colpo solo, e il danno si nota solo guardando un totale che non torna.
 *
 * Le difese sono due, diverse fra loro apposta:
 *
 * 1. `dedup_key`, che rende **innocuo reimportare lo stesso file** — anche
 *    piu' volte, anche sovrapposto a un altro periodo. Il vincolo unico
 *    (user_id, dedup_key) e' nel database, quindi regge anche se il controllo
 *    qui dovesse sfuggire.
 * 2. Un confronto per importo e data ravvicinata contro cio' che c'e' gia',
 *    che e' l'unico modo di riconoscere una spesa che era entrata da Apple Pay
 *    con un'altra chiave.
 */

import { resolveMerchant } from "./merchants";
import type { StatementRow } from "./statementImport";
import { supabase } from "./supabase";

export type ImportOutcome = {
  spese: number;
  entrate: number;
  /** Riconosciute come gia' registrate: doppioni evitati, non righe perse. */
  giaPresenti: number;
  /** Righe valide che il database ha rifiutato: vanno dette. */
  fallite: number;
};

/** Quanto puo' distare la data della banca da quella dell'acquisto. */
const DAYS_TOLERANCE = 4;
const DAY = 24 * 60 * 60 * 1000;
const PAGE = 1000;

type Existing = { id: string; amount: number; time: number };

/**
 * Legge tutte le pagine, non solo la prima.
 *
 * PostgREST tronca a mille righe **senza errore**: una lettura non paginata
 * qui non fallirebbe, si limiterebbe a non vedere le spese piu' vecchie — e
 * cio' che non vede lo reimporta come nuovo.
 */
async function readAll(
  table: "payments" | "incomes",
  from: string,
  to: string
): Promise<{ rows: Existing[]; keys: Set<string> } | null> {
  const rows: Existing[] = [];
  const keys = new Set<string>();

  for (let page = 0; ; page += 1) {
    const columns = table === "payments" ? "id, amount, occurred_at, dedup_key" : "id, amount, occurred_at";
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    // Un errore in lettura non puo' diventare "non c'era niente": si
    // importerebbe tutto da capo sopra a cio' che gia' esiste.
    if (error) return null;

    const batch = (data ?? []) as unknown as {
      id: string;
      amount: number | string;
      occurred_at: string;
      dedup_key?: string | null;
    }[];

    for (const item of batch) {
      rows.push({
        id: item.id,
        amount: Number(item.amount),
        time: new Date(item.occurred_at).getTime(),
      });
      if (item.dedup_key) keys.add(item.dedup_key);
    }

    if (batch.length < PAGE) break;
  }

  return { rows, keys };
}

/**
 * Cerca fra le operazioni gia' registrate una che sia plausibilmente la
 * stessa, e la **consuma**.
 *
 * Consumarla e' la parte che conta: due caffe' da 1,20 € nello stesso giorno
 * sono due spese, e devono trovare due corrispondenze distinte per essere
 * entrambe considerate gia' presenti. Senza il consumo, la seconda si
 * aggancerebbe di nuovo alla prima e andrebbe persa.
 */
function consumeMatch(pool: Existing[], used: Set<string>, amount: number, time: number) {
  let best: Existing | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    if (used.has(candidate.id)) continue;
    if (Math.abs(candidate.amount - amount) > 0.005) continue;
    const distance = Math.abs(candidate.time - time);
    if (distance > DAYS_TOLERANCE * DAY) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (!best) return false;
  used.add(best.id);
  return true;
}

export async function importStatementRows(
  rows: StatementRow[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportOutcome> {
  const empty: ImportOutcome = { spese: 0, entrate: 0, giaPresenti: 0, fallite: 0 };
  if (rows.length === 0) return empty;

  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("Sessione scaduta: esci e rientra.");

  const times = rows.map((r) => r.date.getTime());
  const from = new Date(Math.min(...times) - DAYS_TOLERANCE * DAY).toISOString();
  const to = new Date(Math.max(...times) + DAYS_TOLERANCE * DAY).toISOString();

  const existingPayments = await readAll("payments", from, to);
  const existingIncomes = await readAll("incomes", from, to);
  if (!existingPayments || !existingIncomes) {
    throw new Error(
      "Non sono riuscito a leggere i movimenti già registrati, quindi non importo niente: senza quel confronto rischierei di contare due volte le stesse spese. Riprova fra poco."
    );
  }

  const usedPayments = new Set<string>();
  const usedIncomes = new Set<string>();

  const toInsertOut: StatementRow[] = [];
  const toInsertIn: StatementRow[] = [];
  let giaPresenti = 0;

  // In ordine di data: il confronto per vicinanza deve incontrare prima le
  // righe piu' vecchie, altrimenti una spesa di marzo puo' rubare la
  // corrispondenza a una di febbraio.
  const ordered = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const row of ordered) {
    const time = row.date.getTime();

    if (row.direction === "out") {
      if (existingPayments.keys.has(row.dedupKey)) {
        giaPresenti += 1;
        continue;
      }
      if (consumeMatch(existingPayments.rows, usedPayments, row.amount, time)) {
        giaPresenti += 1;
        continue;
      }
      toInsertOut.push(row);
    } else {
      if (consumeMatch(existingIncomes.rows, usedIncomes, row.amount, time)) {
        giaPresenti += 1;
        continue;
      }
      toInsertIn.push(row);
    }
  }

  const total = toInsertOut.length + toInsertIn.length;
  let done = 0;
  let fallite = 0;

  // Gli esercenti si risolvono una volta per nome, non una per riga: sei mesi
  // di estratto conto sono centinaia di righe ma poche decine di negozi, e
  // ogni chiamata e' un giro sul server.
  const merchants = new Map<string, { name: string; id: string | null; category: string | null }>();
  for (const row of toInsertOut) {
    if (merchants.has(row.description)) continue;
    const resolved = await resolveMerchant(userId, row.description);
    merchants.set(row.description, {
      name: resolved?.merchant_name ?? row.description,
      id: resolved?.merchant_id ?? null,
      category: resolved?.effective_category_id ?? null,
    });
  }

  let spese = 0;
  for (const chunk of chunks(toInsertOut, 100)) {
    const payload = chunk.map((row) => {
      const merchant = merchants.get(row.description)!;
      return {
        user_id: userId,
        amount: row.amount,
        // Stessa regola del recupero da file: il numero grezzo di una spesa in
        // sterline non e' euro, e dichiararlo tale sarebbe irreversibile.
        // La conversione la fa `sync-prices`, che e' dove quella logica vive.
        original_amount: row.currency ? row.amount : null,
        original_currency: row.currency,
        fx_rate: null,
        merchant_raw: row.description,
        merchant_name: merchant.name,
        merchant_id: merchant.id,
        category_id: merchant.category,
        occurred_at: row.date.toISOString(),
        raw_notification_text: row.rawDescription,
        source: "import",
        dedup_key: row.dedupKey,
      };
    });

    const { error } = await supabase.from("payments").insert(payload);

    if (error) {
      // Un blocco intero rifiutato per colpa di una riga sola perderebbe le
      // altre novantanove: si riprova una per una, cosi' il conto finale dice
      // esattamente quante ne sono rimaste fuori.
      for (const single of payload) {
        const { error: singleError } = await supabase.from("payments").insert(single);
        if (singleError) {
          // 23505: la chiave unica ha riconosciuto un doppione. Non e' un
          // guasto, e' la difesa che ha funzionato.
          if (singleError.code === "23505") giaPresenti += 1;
          else fallite += 1;
        } else {
          spese += 1;
        }
      }
    } else {
      spese += payload.length;
    }

    done += chunk.length;
    onProgress?.(done, total);
  }

  let entrate = 0;
  for (const chunk of chunks(toInsertIn, 100)) {
    const payload = chunk.map((row) => ({
      user_id: userId,
      amount: row.amount,
      label: row.description,
      // Gli introiti non hanno colonne per la valuta: dirlo nella nota e'
      // meglio che lasciar credere che 500 sterline siano 500 euro.
      note: row.currency
        ? `${row.rawDescription} · importo in ${row.currency}`
        : row.rawDescription,
      occurred_at: row.date.toISOString(),
    }));

    const { error } = await supabase.from("incomes").insert(payload);

    if (error) {
      for (const single of payload) {
        const { error: singleError } = await supabase.from("incomes").insert(single);
        if (singleError) fallite += 1;
        else entrate += 1;
      }
    } else {
      entrate += payload.length;
    }

    done += chunk.length;
    onProgress?.(done, total);
  }

  return { spese, entrate, giaPresenti, fallite };
}

function* chunks<T>(items: T[], size: number) {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
