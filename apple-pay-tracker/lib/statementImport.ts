/**
 * Lettura degli estratti conto in CSV.
 *
 * Il vincolo che decide quasi tutto: **all'utente non si chiede di mappare le
 * colonne**. Un foglio "quale colonna contiene la data?" sembra innocuo a chi
 * lo scrive e' e' invece il punto in cui la maggior parte delle persone
 * abbandona l'import — proprio quelle a cui servirebbe di piu', perche' non
 * hanno mai aperto un CSV in vita loro. Quindi qui si riconosce tutto da soli:
 * separatore, riga d'intestazione, ruolo di ogni colonna, formato di data e
 * di numero. Quando non ci si riesce si dichiara, non si tira a indovinare.
 *
 * Il riconoscimento e' **deterministico**: dizionari di nomi comuni piu' una
 * verifica sul contenuto. Nessun modello linguistico tocca questi numeri: un
 * importo allucinato non e' un refuso, e' un saldo sbagliato che nessuno
 * ricontrolla.
 */

import { File } from "expo-file-system";

export type Direction = "out" | "in";

export type StatementRow = {
  date: Date;
  /** Ripulita dal rumore bancario, e' quella che diventa l'esercente. */
  description: string;
  /** La riga com'era: si conserva sempre, non si butta via una fonte. */
  rawDescription: string;
  /** Sempre positivo: il verso sta in `direction`. */
  amount: number;
  direction: Direction;
  /** `null` quando e' euro, come nel resto dell'app. */
  currency: string | null;
  dedupKey: string;
};

export type ColumnMapping = {
  date: string;
  description: string | null;
  amount:
    | { kind: "signed"; header: string }
    | { kind: "split"; debitHeader: string; creditHeader: string };
  currency: string | null;
};

export type StatementParse = {
  fileName: string;
  mapping: ColumnMapping | null;
  /** Perche' il file non si e' capito. `null` quando e' andata bene. */
  problem: string | null;
  rows: StatementRow[];
  /** Righe con data o importo illeggibili: non si inventano. */
  unreadable: number;
  /** Piu' vecchie del limite: scartate di proposito, non un guasto. */
  outOfRange: number;
  /** Importo zero — saldi, righe di intestazione, riepiloghi. */
  ignored: number;
};

/* ------------------------------------------------------------------ *
 * Testo
 * ------------------------------------------------------------------ */

const WINDOWS_1252_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

/**
 * UTF-8 se il file e' valido, Windows-1252 altrimenti.
 *
 * Meta' delle banche italiane esporta ancora in Windows-1252: letto come
 * UTF-8, "Caffè" diventa "Caff?" e l'esercente non combacia piu' con quello
 * gia' in archivio — due gruppi distinti per lo stesso bar, e ci si accorge
 * del problema mesi dopo. Si decodifica a mano invece di usare `TextDecoder`
 * perche' su Hermes non e' garantito, e comunque servirebbe il ripiego.
 */
export function decodeBytes(bytes: Uint8Array): string {
  const utf8 = tryDecodeUtf8(bytes);
  if (utf8 !== null) return utf8;

  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += String.fromCharCode(b >= 0x80 && b <= 0x9f ? WINDOWS_1252_HIGH[b] ?? b : b);
  }
  return stripBom(out);
}

function tryDecodeUtf8(bytes: Uint8Array): string | null {
  let out = "";
  let i = 0;
  // Il BOM UTF-8, se c'e', non e' un carattere: lo scrivono Excel e mezza
  // Europa in testa ai CSV.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;

  while (i < bytes.length) {
    const b = bytes[i];
    let point: number;
    let extra: number;

    if (b < 0x80) {
      point = b;
      extra = 0;
    } else if ((b & 0xe0) === 0xc0) {
      point = b & 0x1f;
      extra = 1;
    } else if ((b & 0xf0) === 0xe0) {
      point = b & 0x0f;
      extra = 2;
    } else if ((b & 0xf8) === 0xf0) {
      point = b & 0x07;
      extra = 3;
    } else {
      return null;
    }

    if (i + extra >= bytes.length) return null;
    for (let k = 1; k <= extra; k += 1) {
      const cont = bytes[i + k];
      if ((cont & 0xc0) !== 0x80) return null;
      point = (point << 6) | (cont & 0x3f);
    }

    if (point > 0x10ffff) return null;
    if (point > 0xffff) {
      const v = point - 0x10000;
      out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      out += String.fromCharCode(point);
    }
    i += extra + 1;
  }

  return out;
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

const DELIMITERS = [";", ",", "\t", "|"];

/** Scanner con le virgolette: i nomi degli esercenti contengono separatori. */
export function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.map((r) => r.map((v) => v.trim()));
}

/**
 * Il separatore e' quello che produce la griglia piu' regolare.
 *
 * Non "quello piu' frequente": una descrizione tipo "MILANO, VIA ROMA" e'
 * piena di virgole e vincerebbe su un file che usa il punto e virgola,
 * spezzando ogni riga in un punto diverso. La regolarita' del numero di
 * colonne, invece, e' proprio cio' che distingue il separatore vero.
 */
export function detectDelimiter(text: string): string {
  let best = ";";
  let bestScore = 0;

  for (const delimiter of DELIMITERS) {
    const rows = splitRows(text, delimiter).filter((r) => r.some((c) => c !== ""));
    if (rows.length === 0) continue;

    const counts = new Map<number, number>();
    for (const row of rows.slice(0, 40)) {
      counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
    }

    let width = 0;
    let matches = 0;
    for (const [size, howMany] of counts) {
      if (size < 2) continue;
      if (howMany > matches || (howMany === matches && size > width)) {
        width = size;
        matches = howMany;
      }
    }

    const score = width * matches;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

/* ------------------------------------------------------------------ *
 * Riconoscimento delle colonne
 * ------------------------------------------------------------------ */

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Nomi comuni, in ordine di preferenza dentro ogni ruolo.
 *
 * Sono raccolti dagli export delle banche italiane piu' diffuse piu' i nomi
 * inglesi delle carte estere (Revolut, N26, Wise). L'elenco cresce: aggiungere
 * un nome qui e' l'unico intervento che serve per una banca nuova, ed e' il
 * motivo per cui il riconoscimento sta in un dizionario e non sparso nel
 * codice.
 */
const DATE_NAMES = [
  "data contabile",
  "data operazione",
  "data movimento",
  "data registrazione",
  "data transazione",
  "data contabilizzazione",
  "booking date",
  "transaction date",
  "completed date",
  "started date",
  "data",
  "date",
  "data valuta",
  "value date",
];

const DESCRIPTION_NAMES = [
  "descrizione operazione",
  "descrizione estesa",
  "descrizione",
  "causale",
  "causale abi",
  "dettagli",
  "esercente",
  "beneficiario",
  "controparte",
  "operazione",
  "description",
  "merchant",
  "payee",
  "details",
  "reference",
  "memo",
  "note",
];

const SIGNED_NAMES = [
  "importo in euro",
  "importo euro",
  "importo eur",
  "importo operazione",
  "importo",
  "amount",
  "ammontare",
  "valore",
];

const DEBIT_NAMES = [
  "importo dare",
  "uscite",
  "uscita",
  "addebiti",
  "addebito",
  "dare",
  "debito",
  "debit",
  "paid out",
  "withdrawal",
];

const CREDIT_NAMES = [
  "importo avere",
  "entrate",
  "entrata",
  "accrediti",
  "accredito",
  "avere",
  "credito",
  "credit",
  "paid in",
  "deposit",
];

const CURRENCY_NAMES = ["divisa", "currency", "valuta"];

/** Posizione nel dizionario, o -1: piccolo = piu' desiderabile. */
function rank(header: string, names: string[]) {
  const folded = fold(header);
  if (!folded) return -1;
  const exact = names.findIndex((n) => n === folded);
  if (exact > -1) return exact;
  // Un contenimento vale meno di un nome esatto, ma va tenuto: "Data
  // contabile operazione" non e' in elenco e vuol dire la stessa cosa.
  const loose = names.findIndex((n) => folded.includes(n));
  return loose > -1 ? loose + names.length : -1;
}

function pickColumn(headers: string[], names: string[], taken: Set<number>) {
  let best = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  headers.forEach((header, index) => {
    if (taken.has(index)) return;
    const r = rank(header, names);
    if (r > -1 && r < bestRank) {
      bestRank = r;
      best = index;
    }
  });
  return best;
}

/* ------------------------------------------------------------------ *
 * Date e importi
 * ------------------------------------------------------------------ */

type DateParts = { year: number; month: number; day: number };

/** Le tre cifre di una data, senza ancora decidere chi e' il giorno. */
function dateParts(value: string): [number, number, number] | null {
  const cleaned = value.trim();

  const iso = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3])];

  const local = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!local) return null;

  let year = Number(local[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  return [Number(local[1]), Number(local[2]), year];
}

export function looksLikeDate(value: string) {
  return dateParts(value) !== null;
}

/**
 * Giorno prima o mese prima, deciso guardando **tutta** la colonna.
 *
 * Su una riga sola "03/04/2025" e' indecidibile, e sbagliare sposta le spese
 * di mesi interi senza dare errore. Con l'intera colonna basta un valore che
 * superi 12 in una delle due posizioni per chiudere la questione; se non ce
 * n'e' nessuno (un file di soli primi dodici giorni del mese) si sceglie il
 * giorno prima, che e' il formato italiano.
 */
export function detectDayFirst(values: string[]): boolean {
  for (const value of values) {
    const parts = dateParts(value);
    if (!parts) continue;
    // Una data ISO non pone la domanda.
    if (/^\d{4}/.test(value.trim())) continue;
    if (parts[0] > 12) return true;
    if (parts[1] > 12) return false;
  }
  return true;
}

export function parseStatementDate(value: string, dayFirst: boolean): Date | null {
  const parts = dateParts(value);
  if (!parts) return null;

  let fields: DateParts;
  if (/^\d{4}/.test(value.trim())) {
    fields = { year: parts[0], month: parts[1], day: parts[2] };
  } else {
    fields = dayFirst
      ? { year: parts[2], month: parts[1], day: parts[0] }
      : { year: parts[2], month: parts[0], day: parts[1] };
  }

  if (fields.month < 1 || fields.month > 12) return null;
  if (fields.day < 1 || fields.day > 31) return null;

  // Mezzogiorno e non mezzanotte: l'estratto conto da' il giorno ma non l'ora,
  // e una mezzanotte locale convertita in UTC puo' scivolare al giorno prima,
  // spostando una spesa da un mese all'altro.
  const date = new Date(fields.year, fields.month - 1, fields.day, 12, 0, 0);
  if (date.getMonth() !== fields.month - 1 || date.getDate() !== fields.day) {
    return null;
  }
  return date;
}

/**
 * Importo con segno, nei formati che girano davvero.
 *
 * Oltre al meno davanti: meno in coda ("123,45-", i tracciati piu' vecchi) e
 * parentesi ("(123,45)", gli export in stile anglosassone). Entrambi indicano
 * un'uscita, e letti male diventerebbero entrate — un'entrata inventata e'
 * peggio di una spesa mancante, perche' gonfia il saldo.
 */
export function parseSignedAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parenthesised = /^\(.*\)$/.test(trimmed);
  const trailingMinus = /-\s*$/.test(trimmed);

  const cleaned = trimmed.replace(/[^0-9.,-]/g, "").replace(/-/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // Vince l'ultimo: e' il decimale, l'altro separa le migliaia.
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
    // "1.234" e' milleduecentotrentaquattro, "1.23" e' un euro e ventitre.
    normalized =
      cleaned.length - lastDot - 1 === 3 ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const negative = trimmed.startsWith("-") || trailingMinus || parenthesised;
  return negative ? -Math.abs(parsed) : parsed;
}

export function looksLikeAmount(value: string) {
  return parseSignedAmount(value) !== null;
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

function looksLikeCurrency(value: string) {
  const trimmed = value.trim().toUpperCase();
  return CURRENCY_CODE.test(trimmed) || trimmed === "€" || trimmed === "EUR";
}

/* ------------------------------------------------------------------ *
 * Descrizione
 * ------------------------------------------------------------------ */

/**
 * Toglie il contorno bancario, lasciando il nome del negozio.
 *
 * "PAGAMENTO POS 12/03 ORE 14:32 CARTA *1234 ESSELUNGA SPA MILANO" deve
 * diventare "Esselunga Spa Milano", altrimenti ogni spesa e' un esercente
 * nuovo — la data e' dentro la stringa, quindi due caffe' nello stesso bar in
 * giorni diversi non combacerebbero mai. Si tolgono solo pezzi riconoscibili
 * con certezza e l'originale resta comunque salvato: una pulizia troppo
 * aggressiva che cancella il nome e' peggio di una descrizione lunga.
 */
export function cleanDescription(raw: string): string {
  let text = ` ${raw} `;

  // La stringa "null" attaccata in coda al nome.
  //
  // Non la produce Clinck: arriva gia' cosi' dalla cella del CSV. E' l'export
  // di una banca che concatena il nome dell'esercente con un campo vuoto e
  // scrive il `null` di un linguaggio invece di lasciare la cella vuota —
  // "SUPERMERCATO SGM SRLnull", "MC DONALD'Snull". Verificato sul database:
  // 39 righe su un import di 125, tutte con la coda a fine stringa e mai in
  // mezzo, tutte dallo stesso file; il file Revolut dello stesso periodo non
  // ne ha nessuna.
  //
  // Va tolta **qui e prima di tutto il resto**, non lasciata alla revisione
  // manuale, perche' fa due danni e il secondo e' invisibile:
  //
  //  1. sporca il nome dell'esercente, e quindi ne crea uno nuovo per ogni
  //     insegna gia' conosciuta;
  //  2. rompe il controllo "tutto maiuscolo" qui sotto — "ALICAM SRLnull"
  //     non e' uguale al suo `toUpperCase()` per via delle minuscole di
  //     "null", quindi il nome resta URLATO mentre lo stesso negozio letto da
  //     un altro file diventa "Alicam Srl". E' cosi' che la stessa insegna
  //     finisce in quattro grafie diverse e `merchants.parent_id` non la
  //     raggruppa piu'.
  //
  // Si toglie **solo quando e' incollata** a una parola, che e' come si
  // presenta in tutti e 39 i casi osservati. Un "null" staccato potrebbe
  // essere un nome vero — Null e' un cognome tedesco — e sarebbe l'app a
  // rovinare il dato invece che a ripararlo: "Bar Null" deve restare
  // "Bar Null". Basta un carattere non-spazio davanti, non una lettera:
  // "PERUGIA CLUB S.R.L.null" ha un punto, ed e' un caso reale. Il gruppo di
  // cattura ricuce cio' che precede, perche' qui non si puo' sostituire con
  // uno spazio come per il resto del rumore.
  text = text.replace(/(\S)null(?=\s*$)/i, "$1");

  const noise = [
    /\bpagamento\s+pos\b/gi,
    /\bpag\.?\s*pos\b/gi,
    /\bacquisto\s+pos\b/gi,
    /\boperazione\s+pos\b/gi,
    /\bpos\s+estero\b/gi,
    /\bpagobancomat\b/gi,
    /\bcarta\s*n?\.?\s*\*?\d[\d*]*\b/gi,
    /\bcart[ae]\s+di\s+(credito|debito)\b/gi,
    /\bcontabile\s*n?\.?\s*\d+\b/gi,
    /\baut\.?\s*\d+\b/gi,
    /\bcod\.?\s*(op|operazione|aut)?\.?\s*[\dA-Z]{4,}\b/gi,
    /\bore\s+\d{1,2}[:.]\d{2}\b/gi,
    /\bdel\s+\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?\b/gi,
    /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g,
    /\b\d{1,2}[\/.-]\d{1,2}\b(?=\s)/g,
    /\bidentificativo\b/gi,
    /\bdivisa\s+[a-z]{3}\b/gi,
  ];
  for (const pattern of noise) text = text.replace(pattern, " ");

  text = text.replace(/\s+/g, " ").replace(/^[\s\-*.,;:/]+|[\s\-*.,;:/]+$/g, "");

  // Se la pulizia ha mangiato tutto, il rumore *era* la descrizione: meglio
  // l'originale di una spesa senza nome.
  if (text.length < 3) return raw.trim();

  // Tutto maiuscolo e' come lo scrive il circuito, non come si legge.
  if (text === text.toUpperCase()) {
    text = text
      .toLowerCase()
      .replace(/(^|[\s'"(/-])([a-zà-ÿ])/g, (_m, before, letter) => before + letter.toUpperCase());
  }

  return text;
}

/* ------------------------------------------------------------------ *
 * Lettura completa
 * ------------------------------------------------------------------ */

/** Da gennaio dell'anno scorso: prima di li' non serve a nessuna statistica. */
export function importFloor(today = new Date()): Date {
  return new Date(today.getFullYear() - 1, 0, 1, 0, 0, 0);
}

type Detected = {
  headerIndex: number;
  headers: string[];
  date: number;
  description: number;
  signed: number;
  debit: number;
  credit: number;
  currency: number;
};

/**
 * Trova la riga d'intestazione e il ruolo di ogni colonna.
 *
 * L'intestazione non e' quasi mai la prima riga: le banche ci mettono sopra
 * intestatario, IBAN, saldo e righe vuote. Si prova ogni riga dei primi trenta
 * e si tiene la prima che regge la **verifica sul contenuto**: un'intestazione
 * chiamata "Data" che sotto ha testo libero non e' una colonna di date, e
 * fidarsi del solo nome e' come si importano mille righe sbagliate.
 */
function detect(rows: string[][]): Detected | null {
  const limit = Math.min(rows.length, 30);

  for (let index = 0; index < limit; index += 1) {
    const headers = rows[index];
    if (headers.filter((h) => h !== "").length < 2) continue;

    const body = rows.slice(index + 1, index + 1 + 25).filter((r) => r.length >= headers.length - 1);
    if (body.length === 0) continue;

    const taken = new Set<number>();

    const date = pickColumn(headers, DATE_NAMES, taken);
    if (date === -1 || !columnHolds(body, date, looksLikeDate)) continue;
    taken.add(date);

    const currency = pickColumn(headers, CURRENCY_NAMES, taken);
    // "Valuta" da solo, in un estratto conto italiano, e' quasi sempre la data
    // valuta e non la divisa: decide il contenuto, non il nome.
    const currencyOk = currency > -1 && columnHolds(body, currency, looksLikeCurrency);
    if (currencyOk) taken.add(currency);

    const debit = pickColumn(headers, DEBIT_NAMES, taken);
    const credit = pickColumn(headers, CREDIT_NAMES, taken);
    const hasSplit =
      debit > -1 &&
      credit > -1 &&
      debit !== credit &&
      columnHolds(body, debit, looksLikeAmount, 0.3) &&
      columnHolds(body, credit, looksLikeAmount, 0.3);

    if (hasSplit) {
      taken.add(debit);
      taken.add(credit);
    }

    let signed = -1;
    if (!hasSplit) {
      signed = pickColumn(headers, SIGNED_NAMES, taken);
      if (signed === -1 || !columnHolds(body, signed, looksLikeAmount)) continue;
      taken.add(signed);
    }

    const description = pickColumn(headers, DESCRIPTION_NAMES, taken);

    return {
      headerIndex: index,
      headers,
      date,
      description,
      signed,
      debit: hasSplit ? debit : -1,
      credit: hasSplit ? credit : -1,
      currency: currencyOk ? currency : -1,
    };
  }

  return null;
}

/** Quota di celle non vuote che devono superare il controllo. */
function columnHolds(
  body: string[][],
  index: number,
  test: (value: string) => boolean,
  threshold = 0.6
) {
  let filled = 0;
  let ok = 0;
  for (const row of body) {
    const value = (row[index] ?? "").trim();
    if (!value) continue;
    filled += 1;
    if (test(value)) ok += 1;
  }
  if (filled === 0) return false;
  return ok / filled >= threshold;
}

export function parseStatement(
  text: string,
  fileName: string,
  floor = importFloor()
): StatementParse {
  const empty: StatementParse = {
    fileName,
    mapping: null,
    problem: null,
    rows: [],
    unreadable: 0,
    outOfRange: 0,
    ignored: 0,
  };

  const delimiter = detectDelimiter(text);
  const grid = splitRows(text, delimiter).filter((r) => r.some((c) => c !== ""));
  if (grid.length < 2) {
    return { ...empty, problem: "Il file sembra vuoto." };
  }

  const found = detect(grid);
  if (!found) {
    return {
      ...empty,
      problem:
        "Non ho riconosciuto le colonne: servono almeno una data e un importo. Esporta di nuovo l'estratto conto in CSV, senza modificarlo.",
    };
  }

  const body = grid.slice(found.headerIndex + 1);
  const dayFirst = detectDayFirst(body.map((r) => r[found.date] ?? ""));

  const mapping: ColumnMapping = {
    date: found.headers[found.date] || "colonna " + (found.date + 1),
    description:
      found.description > -1 ? found.headers[found.description] || null : null,
    amount:
      found.signed > -1
        ? { kind: "signed", header: found.headers[found.signed] }
        : {
            kind: "split",
            debitHeader: found.headers[found.debit],
            creditHeader: found.headers[found.credit],
          },
    currency: found.currency > -1 ? found.headers[found.currency] : null,
  };

  const rows: StatementRow[] = [];
  let unreadable = 0;
  let outOfRange = 0;
  let ignored = 0;
  const seen = new Map<string, number>();

  for (const raw of body) {
    const dateText = (raw[found.date] ?? "").trim();
    if (!dateText) {
      // Riga di riepilogo o coda del file: non e' un movimento mancato.
      ignored += 1;
      continue;
    }

    const date = parseStatementDate(dateText, dayFirst);
    if (!date) {
      unreadable += 1;
      continue;
    }

    let signedAmount: number | null = null;
    if (found.signed > -1) {
      signedAmount = parseSignedAmount(raw[found.signed] ?? "");
    } else {
      const debit = parseSignedAmount(raw[found.debit] ?? "");
      const credit = parseSignedAmount(raw[found.credit] ?? "");
      // In due colonne il segno lo da' la colonna, non il numero: molti export
      // scrivono le uscite gia' positive sotto "Uscite".
      if (debit !== null && debit !== 0) signedAmount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) signedAmount = Math.abs(credit);
    }

    if (signedAmount === null) {
      unreadable += 1;
      continue;
    }
    if (signedAmount === 0) {
      ignored += 1;
      continue;
    }

    if (date.getTime() < floor.getTime()) {
      outOfRange += 1;
      continue;
    }

    const rawDescription = (
      found.description > -1 ? raw[found.description] ?? "" : ""
    ).trim();
    const description = rawDescription
      ? cleanDescription(rawDescription)
      : signedAmount < 0
        ? "Movimento"
        : "Accredito";

    const currencyCell =
      found.currency > -1 ? (raw[found.currency] ?? "").trim().toUpperCase() : "";
    const currency =
      currencyCell && currencyCell !== "EUR" && currencyCell !== "€"
        ? currencyCell
        : null;

    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const base = `${day}|${Math.abs(signedAmount).toFixed(2)}|${fold(description)}`;
    // Due caffe' identici lo stesso giorno nello stesso bar esistono, e sono
    // due spese. Senza il progressivo la seconda avrebbe la stessa chiave
    // della prima e verrebbe scartata come doppione: il conto non tornerebbe,
    // in meno, per sempre.
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    rows.push({
      date,
      description,
      rawDescription: rawDescription || description,
      amount: Math.abs(signedAmount),
      direction: signedAmount < 0 ? "out" : "in",
      currency,
      dedupKey: `stmt:${base}|${occurrence}`,
    });
  }

  return { fileName, mapping, problem: null, rows, unreadable, outOfRange, ignored };
}

/** Legge il file dal disco e lo interpreta. */
export async function parseStatementFile(
  uri: string,
  fileName: string,
  floor = importFloor()
): Promise<StatementParse> {
  const bytes = await new File(uri).bytes();
  return parseStatement(decodeBytes(bytes), fileName, floor);
}
