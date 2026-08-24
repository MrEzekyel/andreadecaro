/**
 * Rilevamento dei sospetti su un estratto conto, prima di scriverlo.
 *
 * Nasce dalla pulizia fatta a mano su due estratti veri (Revolut e Trade
 * Republic, gennaio-maggio 2026), dove per sistemare l'import e' servito
 * interrogare il database con query scritte a mano. Un utente non potra' mai
 * farlo, e senza queste tre difese vede numeri falsi che sembrano veri:
 *
 *  - **i giri fra conti propri** gonfiano *sia* le uscite sia le entrate, e
 *    sembrano movimenti normali. Su cinque mesi hanno portato le spese da
 *    4.359 € a 12.662 €: tre volte tanto. Chi vede quel numero o non si fida
 *    dell'app, o — peggio — si fida;
 *  - **i doppioni** di cio' che l'app ha gia' (le rate del piano di accumulo
 *    stanno gia' in `investments`) contano ogni versamento due volte;
 *  - **i movimenti verso persone** sono spese vere, ma la descrizione non dice
 *    mai a cosa si riferiscono: quasi sempre sono divisioni, e Clinck ha gia'
 *    `people` e `payment_splits` per gestirle.
 *
 * Tre vincoli che decidono la forma di questo modulo:
 *
 * 1. **Nessun modello linguistico.** Un sospetto sbagliato qui non e' un
 *    refuso, e' una spesa cancellata o un totale falso. Sono regole
 *    deterministiche su dizionari, come il riconoscimento delle colonne.
 * 2. **Si propone, non si decide.** Nessuna riga viene esclusa da sola:
 *    `escludiProposto` e' una casella preselezionata, e la riga resta visibile
 *    e reversibile. Anche il trasferimento piu' ovvio.
 * 3. **Funzioni pure.** Cio' che esiste gia' nel database arriva come
 *    argomento e non viene letto qui dentro: e' l'unico modo di provare
 *    queste regole sui casi veri senza un database davanti.
 */

import type { Direction, StatementRow } from "./statementImport";

const DAY = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Testo
 * ------------------------------------------------------------------ */

/** Minuscolo, senza accenti, senza punteggiatura: la forma confrontabile. */
export function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function foldWords(value: string) {
  const folded = fold(value);
  return folded ? folded.split(" ") : [];
}

/* ------------------------------------------------------------------ *
 * Tipo di movimento e controparte
 * ------------------------------------------------------------------ */

export type MovementKind =
  | "bonifico_uscita"
  | "bonifico_entrata"
  | "addebito_sepa"
  | "pagamento_a"
  | "pagamento_da"
  | "nessuno";

/**
 * I prefissi tecnici delle banche, in ordine dal piu' lungo al piu' corto.
 *
 * Non sono parte del nome: dicono **che tipo** di movimento e', e lasciati
 * dentro rendono "Outgoing transfer for Mario Rossi" un esercente diverso da
 * "Pagamento a favore di MARIO ROSSI" pur essendo la stessa persona. L'ordine
 * conta: "pagamento da parte di" deve essere provato prima di "pagamento da",
 * altrimenti il piu' corto vince e lascia "parte di" dentro al nome.
 *
 * Cresce come i dizionari di `statementImport`: una banca nuova = una riga.
 */
const PREFIXES: { prefix: string; kind: MovementKind }[] = [
  { prefix: "sepa direct debit transfer to ", kind: "addebito_sepa" },
  { prefix: "sepa credit transfer to ", kind: "bonifico_uscita" },
  { prefix: "incoming transfer from ", kind: "bonifico_entrata" },
  { prefix: "outgoing transfer for ", kind: "bonifico_uscita" },
  { prefix: "outgoing transfer to ", kind: "bonifico_uscita" },
  { prefix: "pagamento da parte di ", kind: "pagamento_da" },
  { prefix: "pagamento a favore di ", kind: "pagamento_a" },
  { prefix: "bonifico a favore di ", kind: "pagamento_a" },
  { prefix: "bonifico da ", kind: "pagamento_da" },
  { prefix: "pagamento da ", kind: "pagamento_da" },
  { prefix: "pagamento a ", kind: "pagamento_a" },
  { prefix: "transfer from ", kind: "bonifico_entrata" },
  { prefix: "transfer to ", kind: "bonifico_uscita" },
  { prefix: "payment from ", kind: "pagamento_da" },
  { prefix: "payment to ", kind: "pagamento_a" },
  { prefix: "from ", kind: "pagamento_da" },
  { prefix: "to ", kind: "pagamento_a" },
];

/** IBAN fra parentesi: va tolto dal nome ma **conservato** altrove. */
const IBAN = /\(\s*([A-Z]{2}\d{2}[A-Z0-9]{8,30})\s*\)/i;

export type Counterparty = {
  kind: MovementKind;
  /** Il nome senza prefisso e senza IBAN. Mai vuoto: ripiega sull'originale. */
  name: string;
  iban: string | null;
};

/**
 * Separa il tipo di movimento, il nome della controparte e l'IBAN.
 *
 * Serve a tutto il resto: il confronto col nome dell'utente, il
 * riconoscimento di una persona e — piu' avanti — la rinomina dell'esercente
 * lavorano tutti sul nome nudo, non sulla riga della banca.
 */
export function readCounterparty(description: string): Counterparty {
  const trimmed = description.trim();
  const lower = trimmed.toLowerCase();

  let kind: MovementKind = "nessuno";
  let rest = trimmed;

  for (const candidate of PREFIXES) {
    if (lower.startsWith(candidate.prefix)) {
      kind = candidate.kind;
      rest = trimmed.slice(candidate.prefix.length).trim();
      break;
    }
  }

  const found = rest.match(IBAN);
  const iban = found ? found[1].toUpperCase() : null;
  if (found) rest = rest.replace(IBAN, " ").replace(/\s+/g, " ").trim();

  // Un nome svuotato dalla pulizia e' peggio del rumore: se resta niente, il
  // prefisso *era* la descrizione.
  return { kind, name: rest || trimmed, iban };
}

/* ------------------------------------------------------------------ *
 * Il nome dell'utente
 * ------------------------------------------------------------------ */

/**
 * Particelle che non contano come "parola del nome".
 *
 * "Andrea De Caro" ha tre parole ma due sono il cognome; "Abdel Rahman El
 * Beltagy" ne ha quattro. Senza toglierle, il conteggio delle parole non
 * distingue una persona da una ragione sociale.
 */
const PARTICLES = new Set([
  "de", "di", "da", "del", "dello", "della", "dei", "degli", "delle",
  "dal", "dalla", "la", "le", "lo", "el", "al", "van", "von", "der",
  "den", "bin", "ibn", "mac", "mc", "st", "ter", "ten", "y", "e",
]);

function significant(words: string[]) {
  return words.filter((w) => w.length > 1 && !PARTICLES.has(w));
}

/**
 * La descrizione contiene il nome dell'utente?
 *
 * Confronto per **insieme di parole**, non per stringa: lo stesso conto
 * compare come "ANDREA DE CARO", "Andrea De Caro" e "DE CARO ANDREA" nello
 * stesso estratto — maiuscole diverse e ordine nome/cognome invertito. Un
 * confronto per stringa ne riconoscerebbe uno su tre, e i due mancati sono
 * proprio quelli che gonfiano i totali.
 *
 * Servono **tutte** le parole del nome, non una: chi si chiama "Marco Rossi"
 * non deve vedersi proporre l'esclusione di "Pasticceria Rossi".
 */
export function containsOwnName(
  description: string,
  displayName: string | null | undefined
): boolean {
  const nome = significant(foldWords(displayName ?? ""));
  // Senza nome in anagrafica questa difesa semplicemente non si applica: non
  // si tira a indovinare su quale conto sia "tuo".
  if (nome.length < 2) return false;

  const dentro = new Set(foldWords(description));
  return nome.every((parola) => dentro.has(parola));
}

/**
 * Il nome dell'utente **insieme** a quello di qualcun altro.
 *
 * "Pagamento a favore di ANDREA DE CARO & LEONARDO BARESE" e' il conto
 * cointestato di un'attivita': c'e' dentro il suo nome, ma non e' un giro
 * interno e non e' una spesa personale. Va chiesto, non deciso — e la
 * risposta andra' ricordata, perche' quel conto torna a ogni import.
 */
export function otherNamesBesideOwn(
  description: string,
  displayName: string | null | undefined
): string[] {
  if (!containsOwnName(description, displayName)) return [];

  const nome = new Set(significant(foldWords(displayName ?? "")));
  const { name } = readCounterparty(description);
  const restanti = significant(foldWords(name)).filter((w) => !nome.has(w));

  // Una parola sola avanzata e' rumore (una citta', un codice); da due in su
  // e' un secondo nome e proprio.
  return restanti.length >= 2 ? restanti : [];
}

/* ------------------------------------------------------------------ *
 * Ricariche fra conti propri
 * ------------------------------------------------------------------ */

/**
 * Un conto che si ricarica da un altro.
 *
 * "Ricarica di Apple Pay con *3350", "Revolut**0519": non hanno dentro nessun
 * nome, quindi `containsOwnName` non li vede, ma sono giri interni a tutti gli
 * effetti — 629,90 € su cinque mesi nell'estratto vero.
 */
const TOPUP_PATTERNS: RegExp[] = [
  /^ricarica\b/i,
  /\bricarica\s+(di|da|con)\b/i,
  /\btop[\s-]?up\b/i,
  /\baccredito\s+carta\b/i,
  /\bbalance\s+migration\b/i,
  // "Revolut**0519", "N26**1234": un nome di conto incollato a un numero di
  // carta e' un travaso, non un acquisto.
  /\*\*\s*\d{3,4}\b/,
];

export function looksLikeTopUp(description: string): boolean {
  return TOPUP_PATTERNS.some((p) => p.test(description));
}

/* ------------------------------------------------------------------ *
 * Persone contro societa'
 * ------------------------------------------------------------------ */

/** Forme societarie: la fine di un nome che non e' di una persona. */
const COMPANY_SUFFIXES = new Set([
  "srl", "srls", "spa", "sapa", "snc", "sas", "sc", "scarl", "scrl", "ss",
  "soc", "coop", "sarl", "sa", "sl", "slu", "sagl",
  "gmbh", "mbh", "ag", "kg", "ohg", "ug", "eg",
  "ltd", "limited", "plc", "llc", "llp", "lp", "inc", "corp", "co",
  "bv", "nv", "cv", "vof",
  "oy", "oyj", "ab", "as", "asa", "aps", "kb", "hb",
  "kft", "zrt", "bt", "uab", "ood", "eood", "ad", "dooel", "doo",
  "sp", "zoo", "spzoo", "pte", "pty", "kk", "gk", "onlus", "ets", "aps",
]);

/**
 * Parole che rendono un nome una ragione sociale anche senza suffisso.
 *
 * Servono perche' il suffisso non c'e' sempre: "Condominio Erzerun" ha due
 * parole alfabetiche e nessuna forma societaria, e senza questa lista
 * verrebbe proposto come persona. Cresce con l'uso, come i dizionari delle
 * colonne — aggiungere una parola qui e' l'intervento previsto.
 */
const COMPANY_WORDS = new Set([
  "bank", "banca", "banco", "credito", "cassa", "poste", "postepay",
  "assicurazioni", "assicurazione", "insurance", "assicurativa",
  "condominio", "immobiliare", "agenzia", "studio", "societa",
  "energia", "energy", "gas", "luce", "acqua", "telecom", "mobile",
  "supermercato", "market", "store", "shop", "boutique", "outlet",
  "hotel", "ristorante", "pizzeria", "bar", "caffe", "trattoria",
  "farmacia", "clinica", "ospedale", "centro", "istituto", "scuola",
  "universita", "comune", "regione", "provincia", "ministero",
  "inps", "inail", "agenziaentrate", "erario", "tesoreria",
  "air", "airlines", "airways", "travel", "tours", "group", "holding",
  "services", "service", "solutions", "consulting", "partners",
  "srl", "spa", "gmbh", "ltd", "inc",
  "autostrade", "distributore", "carburanti", "officina", "garage",
  "editore", "editrice", "media", "digital", "tech", "systems",
  // Circuiti e conti: compaiono nella descrizione al posto dell'esercente
  // vero ("Rimborso da Paypal *ucirecupero") e non sono mai una persona.
  "paypal", "satispay", "sumup", "nexi", "stripe", "klarna", "scalapay",
  "revolut", "n26", "hype", "postepay", "sisalpay", "amazon", "apple",
]);

/**
 * Il nome sembra quello di una persona fisica?
 *
 * Da due a quattro parole significative, tutte alfabetiche, nessuna forma
 * societaria e nessuna parola da ragione sociale. Il limite superiore e'
 * quattro e non tre — come diceva il brief — perche' nell'estratto vero c'e'
 * "ABDEL RAHMAN EL BELTAGY": tre significative piu' una particella, e a tre
 * secchi sarebbe rimasto fuori.
 *
 * Falsi negativi accettabili, falsi positivi no: qui si propone di collegare
 * il movimento a un contatto, e proporlo su "Condominio Erzerun" fa sembrare
 * l'app sciocca proprio dove sta chiedendo fiducia.
 */
export function looksLikePerson(name: string): boolean {
  // Un numero dentro il nome non e' mai una persona: e' un codice, una carta,
  // una filiale.
  if (/\d/.test(name)) return false;
  // L'asterisco e' la firma di un circuito che antepone il proprio codice
  // all'esercente — "INT*Progresso Vend", "Mol*corporate benefits". Chi
  // riceve un bonifico non ha un asterisco nel nome.
  if (name.includes("*")) return false;

  const words = foldWords(name);
  if (words.length === 0) return false;
  if (words.some((w) => COMPANY_SUFFIXES.has(w) || COMPANY_WORDS.has(w))) {
    return false;
  }

  const forti = significant(words);
  return forti.length >= 2 && forti.length <= 4;
}

/* ------------------------------------------------------------------ *
 * Cio' che esiste gia'
 * ------------------------------------------------------------------ */

/** Una riga gia' nel database, nella forma minima che serve al confronto. */
export type ExistingRow = {
  id: string;
  label: string;
  amount: number;
  /**
   * Le date con cui confrontarsi, tutte quelle plausibili.
   *
   * Sono piu' d'una perche' un investimento su fondo private market esce dal
   * conto un giorno e assegna le quote un altro (`occurred_at` contro
   * `settled_on`, anche cinque settimane dopo): l'estratto conto porta la
   * data dell'addebito, e confrontarsi con una sola delle due mancherebbe
   * proprio le righe che vanno riconosciute.
   */
  days: string[];
};

export type ExistingKind = "investimento" | "ricorrente" | "spesa" | "entrata";

export type Riscontro = {
  kind: ExistingKind;
  id: string;
  label: string;
  amount: number;
  day: string;
};

/** Quanto puo' distare la data della banca, per tipo di riscontro. */
const TOLERANCE: Record<ExistingKind, number> = {
  // Un'operazione del broker ha una data precisa: la finestra stretta evita
  // che una rata di marzo si prenda il riscontro di una di aprile.
  investimento: 2,
  ricorrente: 4,
  spesa: 4,
  entrata: 4,
};

/* ------------------------------------------------------------------ *
 * Le regole che si ricordano
 * ------------------------------------------------------------------ */

export type RegolaImport = {
  id: string;
  /** Gia' ripiegato da `chiaveRegola()`. */
  criterio: string;
  confronto: "esatto" | "contiene";
  ignora: boolean;
  rinominaIn: string | null;
  categoriaId: string | null;
  personaId: string | null;
  rimborso: boolean;
};

/**
 * La chiave con cui una riga si confronta con le regole.
 *
 * Si calcola sul **nome della controparte** e non sulla riga intera:
 * "Pagamento a favore di LEONARDO BARESE" e "Pagamento da parte di LEONARDO
 * BARESE" sono la stessa persona in due versi diversi, e una regola che non lo
 * vedesse andrebbe creata due volte — poi tre, quando la banca cambia il
 * prefisso.
 *
 * Parte dalla descrizione **gia' ripulita**, non da quella grezza: e' cosi'
 * che "SUPERMERCATO SGM SRLnull" e "SUPERMERCATO SGM SRL" ricadono sotto la
 * stessa regola invece di essere due esercenti diversi.
 *
 * La stessa funzione serve a creare una regola e a confrontarla: se le due
 * strade divergessero, una regola appena creata non combacerebbe mai piu' con
 * niente, e sarebbe invisibile perche' non da' nessun errore.
 */
export function chiaveRegola(descrizionePulita: string): string {
  return fold(readCounterparty(descrizionePulita).name);
}

/**
 * La regola che vale per questa riga, o `null`.
 *
 * A parita' di applicabilita' vince `esatto` su `contiene`: la piu' specifica
 * e' quella che l'utente ha scritto pensando proprio a quella riga.
 */
export function regolaPerRiga(
  descrizionePulita: string,
  regole: RegolaImport[]
): RegolaImport | null {
  const chiave = chiaveRegola(descrizionePulita);
  if (!chiave) return null;

  const applicabili = regole.filter((r) =>
    r.confronto === "esatto" ? chiave === r.criterio : chiave.includes(r.criterio)
  );
  if (applicabili.length === 0) return null;

  return (
    applicabili.find((r) => r.confronto === "esatto") ??
    // Fra due "contiene" vince il criterio piu' lungo: e' quello che descrive
    // meno righe, quindi quello scritto con piu' intenzione.
    applicabili.sort((a, b) => b.criterio.length - a.criterio.length)[0]
  );
}

/** Cosa dice all'utente una regola che ha fatto qualcosa. */
export function descriviRegola(regola: RegolaImport): string {
  const cosa: string[] = [];
  if (regola.ignora) cosa.push("da escludere");
  if (regola.rinominaIn) cosa.push(`rinominata in «${regola.rinominaIn}»`);
  if (regola.categoriaId) cosa.push("con la categoria che hai scelto");
  if (regola.personaId) cosa.push("collegata al contatto che hai scelto");
  if (regola.rimborso) cosa.push("segnata come rimborso");

  return cosa.length > 0
    ? `una tua regola dice: ${cosa.join(", ")}`
    : "c'è una tua regola su questo nome";
}

export type Contesto = {
  /** Da `profiles.display_name`. `null` = la difesa sui giri interni non si applica. */
  displayName: string | null;
  investimenti: ExistingRow[];
  /** Solo `payments` con `source = 'recurring'`: le righe **vere**. */
  ricorrenti: ExistingRow[];
  spese: ExistingRow[];
  entrate: ExistingRow[];
  regole: RegolaImport[];
};

export const CONTESTO_VUOTO: Contesto = {
  displayName: null,
  investimenti: [],
  ricorrenti: [],
  spese: [],
  entrate: [],
  regole: [],
};

function dayDistance(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;
}

/**
 * Cerca un riscontro fra le righe esistenti e lo **consuma**.
 *
 * Consumarlo e' la parte che conta, ed e' la stessa regola di
 * `statementWriter`: due rate identiche dello stesso piano nello stesso mese
 * sono due operazioni, e devono trovare due riscontri distinti. Senza il
 * consumo la seconda si aggancerebbe di nuovo alla prima e verrebbe proposta
 * per l'esclusione pur essendo nuova.
 */
function consuma(
  pool: ExistingRow[],
  usati: Set<string>,
  kind: ExistingKind,
  amount: number,
  day: string
): Riscontro | null {
  let migliore: { row: ExistingRow; day: string; distanza: number } | null = null;

  for (const row of pool) {
    if (usati.has(row.id)) continue;
    if (Math.abs(row.amount - amount) > 0.005) continue;

    for (const candidato of row.days) {
      const distanza = dayDistance(candidato, day);
      if (distanza > TOLERANCE[kind]) continue;
      if (!migliore || distanza < migliore.distanza) {
        migliore = { row, day: candidato, distanza };
      }
    }
  }

  if (!migliore) return null;
  usati.add(migliore.row.id);
  return {
    kind,
    id: migliore.row.id,
    label: migliore.row.label,
    amount: migliore.row.amount,
    day: migliore.day,
  };
}

/* ------------------------------------------------------------------ *
 * I sospetti
 * ------------------------------------------------------------------ */

export type Sospetto =
  | { tipo: "trasferimento_interno"; motivo: string }
  | { tipo: "conto_condiviso"; motivo: string; altri: string[] }
  | { tipo: "ricarica"; motivo: string }
  | { tipo: "coppia"; motivo: string; conIndice: number }
  | { tipo: "gia_presente"; motivo: string; riscontro: Riscontro }
  | { tipo: "persona"; motivo: string; nome: string }
  | { tipo: "regola"; motivo: string; regola: RegolaImport };

/** Una riga letta, con quello che si e' notato addosso. */
export type RigaRivista = {
  indice: number;
  row: StatementRow;
  fileName: string;
  sospetti: Sospetto[];
  /** La regola che si applica a questa riga, se ce n'e' una. */
  regola: RegolaImport | null;
  /**
   * L'esclusione arriva **preselezionata**, mai gia' applicata.
   *
   * Una regola che agisce da sola e' peggio del problema che risolve: chi non
   * se ne accorge si ritrova con dei movimenti mancanti e nessun modo di
   * sapere quali. La riga resta visibile, contata e reversibile.
   */
  escludiProposto: boolean;
};

export type RigaDaRivedere = { row: StatementRow; fileName: string };

const GIORNI_COPPIA = 3;

/**
 * Il giro interno: uscita e entrata gemelle dentro lo stesso import.
 *
 * Da sola questa somiglianza **non** basta a proporre l'esclusione: uno
 * stipendio e un affitto dello stesso importo a due giorni di distanza si
 * assomigliano quanto un travaso. Serve un secondo segnale sulla stessa riga
 * (il nome dell'utente, o una ricarica) — e allora la coppia smette di essere
 * un indizio e diventa la prova di dove sono finiti quei soldi, che e' la
 * cosa da mostrare affiancata.
 */
function trovaCoppie(righe: RigaRivista[]) {
  const preso = new Set<number>();

  for (const riga of righe) {
    if (riga.row.direction !== "out" || preso.has(riga.indice)) continue;

    for (const altra of righe) {
      if (altra.row.direction !== "in" || preso.has(altra.indice)) continue;
      if (Math.abs(altra.row.amount - riga.row.amount) > 0.005) continue;
      const distanza =
        Math.abs(altra.row.date.getTime() - riga.row.date.getTime()) / DAY;
      if (distanza > GIORNI_COPPIA) continue;

      preso.add(riga.indice);
      preso.add(altra.indice);

      const stessoFile = riga.fileName === altra.fileName;
      const dove = stessoFile ? "nello stesso file" : "fra i due file";
      riga.sospetti.push({
        tipo: "coppia",
        motivo: `stesso importo di un'entrata ${dove}, a ${Math.round(distanza)} ${Math.round(distanza) === 1 ? "giorno" : "giorni"} di distanza`,
        conIndice: altra.indice,
      });
      altra.sospetti.push({
        tipo: "coppia",
        motivo: `stesso importo di un'uscita ${dove}, a ${Math.round(distanza)} ${Math.round(distanza) === 1 ? "giorno" : "giorni"} di distanza`,
        conIndice: riga.indice,
      });
      break;
    }
  }
}

/** "leonardo barese" -> "Leonardo Barese": le parole ripiegate, da mostrare. */
function leggibile(parole: string[]) {
  return parole.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const ETICHETTA: Record<ExistingKind, string> = {
  investimento: "un investimento",
  ricorrente: "una spesa ricorrente",
  spesa: "una spesa",
  entrata: "un'entrata",
};

function giorno(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Passa in rassegna le righe lette e annota cosa c'e' da controllare.
 *
 * Non tocca niente e non decide niente: restituisce le stesse righe con
 * addosso i sospetti trovati e una proposta di esclusione da confermare.
 */
export function rivedi(
  righe: RigaDaRivedere[],
  contesto: Contesto = CONTESTO_VUOTO
): RigaRivista[] {
  const riviste: RigaRivista[] = righe.map((r, indice) => ({
    indice,
    row: r.row,
    fileName: r.fileName,
    sospetti: [],
    regola: null,
    escludiProposto: false,
  }));

  const usati = new Set<string>();

  // In ordine di data, come in `statementWriter`: il confronto per vicinanza
  // deve incontrare prima le righe piu' vecchie, altrimenti una di marzo puo'
  // rubare il riscontro a una di febbraio.
  const ordinate = [...riviste].sort(
    (a, b) => a.row.date.getTime() - b.row.date.getTime()
  );

  for (const riga of ordinate) {
    const { row } = riga;
    const day = row.date.toISOString().slice(0, 10);
    const { name } = readCounterparty(row.rawDescription);

    // --- una regola gia' scritta da chi importa ------------------------
    //
    // Va per prima perche' e' l'unica voce che non e' un'ipotesi dell'app: e'
    // una decisione che l'utente ha gia' preso su questo nome, e le altre
    // segnalazioni le restano accanto invece di sostituirla.
    // `?? []` e non `contesto.regole` secco: un contesto costruito a pezzi
    // (o venuto da una lettura parziale) non deve far saltare tutta la
    // revisione per un campo mancante — si perderebbero anche i sospetti.
    const regola = regolaPerRiga(row.description, contesto.regole ?? []);
    if (regola) {
      riga.regola = regola;
      riga.sospetti.push({
        tipo: "regola",
        motivo: descriviRegola(regola),
        regola,
      });
    }

    // --- giri fra conti propri ---------------------------------------
    const altri = otherNamesBesideOwn(row.rawDescription, contesto.displayName);
    if (altri.length > 0) {
      riga.sospetti.push({
        tipo: "conto_condiviso",
        motivo: `c'è il tuo nome insieme a ${leggibile(altri)}: potrebbe essere un conto cointestato, non un giro fra conti tuoi`,
        altri,
      });
    } else if (containsOwnName(row.rawDescription, contesto.displayName)) {
      riga.sospetti.push({
        tipo: "trasferimento_interno",
        motivo: "la descrizione porta il tuo nome: sembra un giro fra conti tuoi",
      });
    } else if (looksLikeTopUp(row.rawDescription)) {
      riga.sospetti.push({
        tipo: "ricarica",
        motivo: "sembra la ricarica di un conto da un altro conto tuo",
      });
    }

    // --- doppioni di cio' che esiste gia' -----------------------------
    const pool: [ExistingKind, ExistingRow[]][] =
      row.direction === "out"
        ? [
            ["investimento", contesto.investimenti],
            ["ricorrente", contesto.ricorrenti],
            ["spesa", contesto.spese],
          ]
        : [["entrata", contesto.entrate]];

    for (const [kind, righeEsistenti] of pool) {
      const riscontro = consuma(righeEsistenti, usati, kind, row.amount, day);
      if (!riscontro) continue;
      riga.sospetti.push({
        tipo: "gia_presente",
        // Non basta dire "doppione": senza sapere **contro cosa** combacia,
        // chi guarda non ha modo di giudicare se lo sia davvero.
        motivo: `già presente come ${ETICHETTA[kind]} del ${giorno(riscontro.day)} — ${riscontro.label}`,
        riscontro,
      });
      break;
    }

    // --- movimenti verso o da una persona -----------------------------
    // `conto_condiviso` sta in questo elenco insieme ai giri interni: su
    // "ANDREA DE CARO & LEONARDO BARESE" la regola della persona scatta
    // (quattro parole, nessuna forma societaria) e la riga si ritroverebbe due
    // proposte che tirano in direzioni opposte — "dimmi che conto e'" e
    // "collegalo a un contatto". Vince la piu' specifica.
    const interno = riga.sospetti.some(
      (s) =>
        s.tipo === "trasferimento_interno" ||
        s.tipo === "ricarica" ||
        s.tipo === "conto_condiviso"
    );
    // Solo dove la banca ha dichiarato una controparte, cioe' dove c'e' un
    // prefisso di trasferimento. Senza questo cancello la regola si applica
    // anche ai nomi degli esercenti da carta, e "KFC ROMA DA VINCI" e "UCI
    // Cinemas" diventano persone: tre parole alfabetiche, nessuna forma
    // societaria, nessun modo di distinguerle da "LEONARDO BARESE" guardando
    // il solo nome. Quello che le distingue non e' come sono scritte, e' che
    // un acquisto in pizzeria non ha un "Pagamento a favore di" davanti.
    // Provato sui dati veri: senza, tre falsi positivi su dieci societa'.
    const dichiarata = readCounterparty(row.rawDescription).kind !== "nessuno";
    if (!interno && dichiarata && looksLikePerson(name)) {
      riga.sospetti.push({
        tipo: "persona",
        motivo:
          row.direction === "out"
            ? "sembra denaro dato a una persona: puoi collegarlo a un contatto"
            : "sembra un rimborso da una persona, non un introito",
        nome: name,
      });
    }
  }

  trovaCoppie(riviste);

  for (const riga of riviste) {
    const forte = riga.sospetti.some(
      (s) =>
        s.tipo === "trasferimento_interno" ||
        s.tipo === "ricarica" ||
        s.tipo === "gia_presente"
    );
    // La coppia da sola non propone niente: vedi `trovaCoppie`.
    riga.escludiProposto = forte;
  }

  return riviste;
}

/* ------------------------------------------------------------------ *
 * Le decisioni prese in revisione
 * ------------------------------------------------------------------ */

/**
 * Cosa l'utente ha deciso su una riga. I campi non toccati restano
 * `undefined`: cosi' si distingue "non l'ho cambiato" da "l'ho messo a zero".
 */
export type Decisione = {
  esclusa: boolean;
  descrizione?: string;
  data?: Date;
  importo?: number;
  direzione?: Direction;
  /** `undefined` = decide l'esercente, `null` = volutamente senza categoria. */
  categoriaId?: string | null;
  /** Il contatto dall'altra parte del movimento. */
  personaId?: string | null;
  /** Solo sulle entrate: denaro tornato indietro, non guadagnato. */
  rimborso?: boolean;
  /** Ricorda questa scelta per i prossimi import. */
  ricorda?: boolean;
};

/**
 * La proposta di partenza: cio' che i sospetti suggeriscono, piu' cio' che una
 * regola dice gia'.
 *
 * La regola **compila** i campi, non li applica: la riga arriva in revisione
 * con la rinomina gia' scritta e l'esclusione gia' spuntata, ma tutto resta
 * visibile e modificabile. E' la differenza fra "te l'ho preparato" e "l'ho
 * fatto e non te l'ho detto".
 */
export function decisioneIniziale(riga: RigaRivista): Decisione {
  const regola = riga.regola;
  if (!regola) return { esclusa: riga.escludiProposto };

  return {
    esclusa: riga.escludiProposto || regola.ignora,
    descrizione: regola.rinominaIn ?? undefined,
    categoriaId: regola.categoriaId ?? undefined,
    personaId: regola.personaId ?? undefined,
    rimborso: regola.rimborso || undefined,
  };
}

/**
 * La riga come verra' scritta, con le correzioni applicate.
 *
 * `dedupKey` resta **quello del file**, mai ricalcolato: identifica "questa
 * riga di questo file", non cio' che l'utente ne ha fatto. Rigenerarlo dopo
 * una rinomina spezzerebbe la difesa che rende innocuo reimportare lo stesso
 * estratto — al secondo giro il file produrrebbe la chiave originale, non la
 * troverebbe fra quelle registrate, e riscriverebbe tutto da capo.
 */
export function applicaDecisione(
  riga: RigaRivista,
  decisione: Decisione
): StatementRow & {
  categoryId?: string | null;
  personId?: string | null;
  isReimbursement?: boolean;
} {
  const row = riga.row;
  const direction = decisione.direzione ?? row.direction;
  return {
    ...row,
    description: decisione.descrizione ?? row.description,
    date: decisione.data ?? row.date,
    amount: decisione.importo ?? row.amount,
    direction,
    ...(decisione.categoriaId !== undefined
      ? { categoryId: decisione.categoriaId }
      : {}),
    personId: decisione.personaId ?? null,
    // Solo un'entrata puo' essere un rimborso: il flag vive su `incomes`, e
    // portarselo dietro su un'uscita lo renderebbe un dato che non ha dove
    // andare a finire — silenziosamente perso, che e' il modo peggiore.
    isReimbursement: direction === "in" ? (decisione.rimborso ?? false) : false,
  };
}

/**
 * Sposta una data di N mesi tenendo il giorno, o l'ultimo disponibile.
 *
 * `setMonth` da solo trabocca: il 31 gennaio meno un mese diventa il 3 marzo,
 * perche' il 31 febbraio non esiste e JavaScript lo fa scivolare avanti. Su
 * uno stipendio spostato in blocco vorrebbe dire mandarlo nel mese
 * *sbagliato*, che e' esattamente il problema che lo spostamento esiste per
 * risolvere.
 */
export function spostaMesi(data: Date, mesi: number): Date {
  const giorno = data.getDate();
  const spostata = new Date(data.getTime());
  spostata.setDate(1);
  spostata.setMonth(spostata.getMonth() + mesi);

  const ultimoDelMese = new Date(
    spostata.getFullYear(),
    spostata.getMonth() + 1,
    0
  ).getDate();
  spostata.setDate(Math.min(giorno, ultimoDelMese));
  return spostata;
}

/** Un mese dell'import, con quante righe ci finiscono e per quanto. */
export type MeseImport = {
  /** `2026-03`, per confrontare e ordinare. */
  chiave: string;
  inizio: Date;
  righe: number;
  totale: number;
};

/**
 * Come si distribuiscono per mese le righe che entreranno.
 *
 * Serve prima di spostare un blocco di date: lo stipendio arriva il 27 ma e'
 * lo stipendio del mese dopo, e senza vedere la distribuzione si sposta alla
 * cieca — un mese resta con due stipendi e un altro con nessuno, che e'
 * proprio come si era ridotto l'import fatto a mano.
 *
 * Conta solo le righe che entrano: quelle escluse non finiranno in nessun
 * mese, e mostrarle qui gonfierebbe l'anteprima di movimenti che non
 * arriveranno. Un mese con pochissime righe rispetto agli altri si vede da
 * solo, ed e' come si riconosce il "dicembre da una riga" di un estratto che
 * in realta' comincia a gennaio.
 */
export function distribuzionePerMese(
  righe: RigaRivista[],
  decisioni: Decisione[]
): MeseImport[] {
  const mesi = new Map<string, MeseImport>();

  righe.forEach((riga, i) => {
    const decisione = decisioni[i] ?? decisioneIniziale(riga);
    if (decisione.esclusa) return;

    const finale = applicaDecisione(riga, decisione);
    const data = finale.date;
    const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

    const esistente = mesi.get(chiave);
    if (esistente) {
      esistente.righe += 1;
      esistente.totale += finale.amount;
    } else {
      mesi.set(chiave, {
        chiave,
        inizio: new Date(data.getFullYear(), data.getMonth(), 1),
        righe: 1,
        totale: finale.amount,
      });
    }
  });

  return [...mesi.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
}

/** Una regola da scrivere, come esce dalle scelte fatte su una riga. */
export type NuovaRegola = {
  criterio: string;
  confronto: "esatto" | "contiene";
  ignora: boolean;
  rinominaIn: string | null;
  categoriaId: string | null;
  personaId: string | null;
  rimborso: boolean;
};

/**
 * La regola che nasce da cio' che si e' deciso su una riga.
 *
 * Il criterio si calcola sul nome **originale**, non su quello riscritto: una
 * regola che dice «quando trovi McDonald's, chiamalo McDonald's» non
 * combacerebbe mai piu' con "MC DONALD S", cioe' proprio con le righe per cui
 * e' stata creata. E' l'errore che rende una regola invisibile invece che
 * sbagliata, perche' non da' nessun errore: semplicemente non succede niente,
 * import dopo import.
 *
 * `null` quando non c'e' niente da ricordare: una riga toccata e poi rimessa
 * com'era non deve lasciare dietro di se' una regola che non fa nulla.
 */
export function regolaDaDecisione(
  riga: RigaRivista,
  decisione: Decisione
): NuovaRegola | null {
  const criterio = chiaveRegola(riga.row.description);
  if (!criterio) return null;

  const rinominaIn =
    decisione.descrizione && decisione.descrizione !== riga.row.description
      ? decisione.descrizione
      : null;

  const regola: NuovaRegola = {
    criterio,
    confronto: "esatto",
    ignora: decisione.esclusa,
    rinominaIn,
    categoriaId: decisione.categoriaId ?? null,
    personaId: decisione.personaId ?? null,
    rimborso: decisione.rimborso ?? false,
  };

  const dicequalcosa =
    regola.ignora ||
    regola.rinominaIn !== null ||
    regola.categoriaId !== null ||
    regola.personaId !== null ||
    regola.rimborso;

  return dicequalcosa ? regola : null;
}

/**
 * Il conto che deve tornare sempre: lette = quelle che entrano + escluse.
 *
 * Si calcola sulle **decisioni**, non sulle proposte: la testata si aggiorna
 * a ogni modifica, e un totale fermo alla proposta iniziale sarebbe un numero
 * vero riferito a uno stato che non esiste piu'.
 */
export function conteggia(righe: RigaRivista[], decisioni: Decisione[]) {
  let uscite = 0;
  let entrate = 0;
  let totaleUscite = 0;
  let totaleEntrate = 0;
  let escluse = 0;
  let daControllare = 0;
  let giaPresenti = 0;

  righe.forEach((riga, i) => {
    const decisione = decisioni[i] ?? decisioneIniziale(riga);
    if (riga.sospetti.length > 0) daControllare += 1;

    if (decisione.esclusa) {
      escluse += 1;
      if (riga.sospetti.some((s) => s.tipo === "gia_presente")) giaPresenti += 1;
      return;
    }

    const finale = applicaDecisione(riga, decisione);
    if (finale.direction === "out") {
      uscite += 1;
      totaleUscite += finale.amount;
    } else {
      entrate += 1;
      totaleEntrate += finale.amount;
    }
  });

  return {
    uscite,
    entrate,
    totaleUscite,
    totaleEntrate,
    escluse,
    giaPresenti,
    daControllare,
  };
}
