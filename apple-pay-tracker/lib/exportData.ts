import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  buildCsv,
  csvBoolean,
  csvDate,
  csvNumber,
  csvQuantity,
  csvTime,
} from "./csv";
import { supabase } from "./supabase";
import type {
  Asset,
  Category,
  Income,
  Investment,
  Payment,
  PaymentSplit,
  Person,
} from "./types";

export type ExportKind = "payments" | "incomes" | "investments" | "splits";

export type ExportResult = {
  /** Righe scritte nel file, per poterlo dire all'utente. */
  rows: number;
  /**
   * Somma di una colonna precisa del file appena scritto.
   *
   * Non e' "il totale che mostra l'app": tranne che per le divisioni, quel
   * numero a schermo non esiste (Home e Statistiche sono sempre per periodo,
   * mai su tutto lo storico) oppure risponde a una domanda diversa — "Capitale
   * versato" nel portafoglio e' al netto dei disinvestimenti e solo sugli
   * asset non archiviati, mentre il file contiene ogni operazione.
   *
   * E' invece un controllo che l'utente puo' davvero fare: somma quella
   * colonna nel foglio di calcolo e deve ritrovare questo numero. Se non
   * torna, il file e' incompleto — ed e' il modo piu' diretto di accorgersi di
   * un troncamento.
   */
  total: number;
  /** Nome esatto della colonna che `total` somma, per poterla indicare. */
  totalColumn: string;
};

const LABEL: Record<ExportKind, string> = {
  payments: "spese",
  incomes: "introiti",
  investments: "investimenti",
  splits: "divisioni",
};

/** `spese-2026-08-07.csv` */
function filenameFor(kind: ExportKind) {
  const today = new Date();
  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return `${LABEL[kind]}-${stamp}.csv`;
}

/**
 * Errore con un messaggio gia' scritto per l'utente.
 *
 * Un export che fallisce a meta' deve dire cosa non e' riuscito a leggere, non
 * produrre un file parziale: un CSV con dentro solo tre mesi su due anni e'
 * peggio di nessun CSV, perche' sembra completo.
 */
class ExportError extends Error {}

/** Non c'e' niente da esportare: nessun guasto, solo un'entita' vuota. */
export class NothingToExport extends Error {}

/**
 * Quante righe chiedere per volta.
 *
 * PostgREST tronca ogni risposta a un tetto massimo (1000 righe di default sui
 * progetti hosted) **senza restituire un errore**: una `select` senza range su
 * due anni di Apple Pay tornerebbe le prime mille righe e sembrerebbe riuscita.
 * Un CSV troncato e' peggio di nessun CSV, perche' sembra completo — e il
 * controllo sull'errore esplicito non lo intercetta.
 */
const PAGE = 1000;

async function readAll<T>(
  table: string,
  columns: string,
  order: string
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      // Secondo ordinamento sulla chiave: `occurred_at` ha duplicati (le rate
      // di un piano cadono tutte alle 10:00), e con un ordinamento ambiguo
      // Postgres puo' restituire la stessa riga in due pagine diverse e
      // saltarne un'altra.
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw new ExportError(
        `Non è stato possibile leggere ${table}: ${error.message}`
      );
    }

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function buildPayments(): Promise<{ csv: string } & ExportResult> {
  const [payments, categories] = await Promise.all([
    readAll<Payment>("payments", "*", "occurred_at"),
    readAll<Category>("categories", "*", "sort_order"),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const rows = payments.map((payment) => [
    csvDate(payment.occurred_at),
    csvTime(payment.occurred_at),
    payment.merchant_name ?? "",
    payment.category_id
      ? (categoryName.get(payment.category_id) ?? "")
      : "Da categorizzare",
    payment.card_name ?? "",
    csvNumber(Number(payment.amount)),
    csvNumber(Number(payment.effective_amount)),
    payment.city ?? "",
    payment.note ?? "",
    payment.source,
    csvBoolean(payment.excluded_from_stats),
  ]);

  const csv = buildCsv(
    [
      "Data",
      "Ora",
      "Esercente",
      "Categoria",
      "Metodo di pagamento",
      "Importo pagato",
      // Il nome dice quale delle due colonne fa i totali: su una cena divisa
      // in quattro le due differiscono, e senza questa riga di intestazione
      // chi apre il file non ha modo di sapere quale guardare.
      "Quota tua (è questa che l'app somma)",
      "Città",
      "Note",
      "Come è stata registrata",
      "Esclusa dalle classifiche",
    ],
    rows
  );

  return {
    csv,
    rows: payments.length,
    total: payments.reduce((sum, p) => sum + Number(p.effective_amount), 0),
    totalColumn: "Quota tua",
  };
}

async function buildIncomes(): Promise<{ csv: string } & ExportResult> {
  const incomes = await readAll<Income>("incomes", "*", "occurred_at");

  const csv = buildCsv(
    ["Data", "Descrizione", "Importo", "Note"],
    incomes.map((income) => [
      csvDate(income.occurred_at),
      income.label ?? "",
      csvNumber(Number(income.amount)),
      income.note ?? "",
    ])
  );

  return {
    csv,
    rows: incomes.length,
    total: incomes.reduce((sum, i) => sum + Number(i.amount), 0),
    totalColumn: "Importo",
  };
}

const KIND_LABEL: Record<Investment["kind"], string> = {
  buy: "acquisto",
  sell: "vendita",
  dividend: "dividendo",
};

const GROUP_LABEL: Record<Asset["asset_group"], string> = {
  conto_titoli: "Conto titoli",
  crypto: "Crypto",
  private_market: "Private market",
};

async function buildInvestments(): Promise<{ csv: string } & ExportResult> {
  const [investments, assets] = await Promise.all([
    readAll<Investment>("investments", "*", "occurred_at"),
    readAll<Asset>("assets", "*", "sort_order"),
  ]);

  const assetById = new Map(assets.map((a) => [a.id, a]));

  const rows = investments.map((investment) => {
    const asset = investment.asset_id
      ? assetById.get(investment.asset_id)
      : undefined;
    return [
      csvDate(investment.occurred_at),
      csvTime(investment.occurred_at),
      asset?.name ?? investment.label ?? "",
      asset ? GROUP_LABEL[asset.asset_group] : "",
      asset?.isin ?? "",
      KIND_LABEL[investment.kind],
      csvNumber(Number(investment.amount)),
      csvQuantity(investment.quantity),
      csvQuantity(investment.unit_price),
      csvNumber(Number(investment.fee)),
      investment.status,
      investment.source,
      investment.note ?? "",
    ];
  });

  const csv = buildCsv(
    [
      "Data",
      "Ora",
      "Asset",
      "Gruppo",
      "ISIN",
      "Operazione",
      "Importo",
      "Quote",
      "Prezzo unitario",
      "Commissioni",
      "Stato",
      "Origine",
      "Note",
    ],
    rows
  );

  // Solo gli acquisti eseguiti. **Non** e' "Capitale versato" della schermata
  // Investimenti, che vale invece acquisti meno vendite e guarda solo gli
  // asset non archiviati con un `asset_id`: sono due domande diverse, entrambe
  // legittime, e dopo un disinvestimento i due numeri divergono davvero.
  const total = investments
    .filter((i) => i.kind === "buy" && i.status === "settled")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return {
    csv,
    rows: investments.length,
    total,
    totalColumn: 'Importo, sulle righe "acquisto" con stato settled',
  };
}

async function buildSplits(): Promise<{ csv: string } & ExportResult> {
  const [splits, payments, people] = await Promise.all([
    readAll<PaymentSplit>("payment_splits", "*", "created_at"),
    readAll<Payment>("payments", "*", "occurred_at"),
    readAll<Person>("people", "*", "name"),
  ]);

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const personById = new Map(people.map((p) => [p.id, p]));

  const rows = splits.map((split) => {
    const payment = paymentById.get(split.payment_id);
    return [
      csvDate(payment?.occurred_at),
      payment?.merchant_name ?? "",
      csvNumber(payment ? Number(payment.amount) : null),
      personById.get(split.person_id)?.name ?? "",
      csvNumber(Number(split.amount_owed)),
      csvBoolean(split.settled_at !== null),
      csvDate(split.settled_at),
    ];
  });

  const csv = buildCsv(
    [
      "Data spesa",
      "Esercente",
      "Totale spesa",
      "Persona",
      "Quota dovuta",
      "Saldata",
      "Data saldo",
    ],
    rows
  );

  // Quello che ti devono ancora: le quote non saldate. E' l'unico dei quattro
  // che coincide anche con un numero mostrato a schermo, il "Totale da
  // recuperare" di "Mi devono".
  const total = splits
    .filter((s) => s.settled_at === null)
    .reduce((sum, s) => sum + Number(s.amount_owed), 0);

  return {
    csv,
    rows: splits.length,
    total,
    totalColumn: 'Quota dovuta, sulle righe con Saldata = "no"',
  };
}

const BUILDERS: Record<
  ExportKind,
  () => Promise<{ csv: string } & ExportResult>
> = {
  payments: buildPayments,
  incomes: buildIncomes,
  investments: buildInvestments,
  splits: buildSplits,
};

/**
 * Genera il CSV e apre il foglio di condivisione di iOS.
 *
 * Il file va nella cache e non nei documenti: e' un'uscita verso un'altra app,
 * non un archivio da tenere. iOS lo copia dove l'utente sceglie prima che la
 * cache venga ripulita.
 */
export async function exportToCsv(kind: ExportKind): Promise<ExportResult> {
  const { csv, rows, total, totalColumn } = await BUILDERS[kind]();

  if (rows === 0) {
    // Non e' un errore, e chiamarlo cosi' farebbe sospettare un guasto dove
    // non c'e' niente di rotto: e' solo un'entita' ancora vuota.
    throw new NothingToExport("Non c'è ancora niente da esportare qui.");
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new ExportError(
      "La condivisione file non è disponibile su questo dispositivo."
    );
  }

  const file = new File(Paths.cache, filenameFor(kind));
  // Un export precedente dello stesso giorno ha lo stesso nome: senza
  // sovrascrivere, `create` fallirebbe al secondo tentativo.
  file.create({ overwrite: true });
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: `Esporta ${LABEL[kind]}`,
  });

  return { rows, total, totalColumn };
}
