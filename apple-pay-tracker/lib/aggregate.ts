import { Payment } from "./types";

export type Grain = "week" | "month";

/**
 * Larghezza di una colonna settimanale nei grafici a barre.
 *
 * Era 68, cioe' quanto serviva all'etichetta col range di date
 * ("29/07 - 04/08"): colonne larghe il doppio di quelle mensili, bocciate da
 * Andrea («le colonne dovevano rimanere strette, tagliale del 50%»). Dimezzarla
 * ha richiesto di accorciare prima l'etichetta (vedi `weekStartLabel`), non il
 * contrario: e' l'etichetta a decidere quanto stretta puo' essere la colonna.
 *
 * `BarChart` la legge come `minColumnWidth` e la usa in due modi, che vanno
 * pensati insieme: quando i bucket non ci stanno il grafico scorre con colonne
 * larghe esattamente cosi', e quando ci stanno tutti resta questo il **tetto**
 * della colonna — lo spazio in piu' diventa aria fra una colonna e l'altra
 * invece di barre piu' grasse. Senza il tetto, su iPad dieci settimane in una
 * scheda larga si spalmavano comunque su tutta la larghezza, che e' proprio
 * cio' che Andrea guardava quando ha chiesto di stringerle.
 */
export const WEEK_BAR_MIN_COLUMN_WIDTH = 34;

/**
 * Quante colonne settimanali mostrare, secondo la larghezza dello schermo.
 *
 * Sta qui e non nelle schermate perche' era gia' scritta in due posti
 * (Statistiche e i dettagli di categoria/insegna) con due forme diverse:
 * correggerne una sola lascia l'altra a scorrere, in una schermata che poi
 * nessuno ricontrolla perche' "il fix e' stato fatto".
 *
 * Quattordici e non diciotto: su un iPad da 11" in orizzontale la colonna
 * destra lascia al grafico ~566 px una volta tolti rail, margini, la colonna
 * fissa di sinistra e il riquadro del carosello. A 34 px l'una, diciotto
 * colonne ne chiedono 638 e il grafico ricomincia a scorrere **dentro** il
 * carosello — cioe' il gesto che si e' appena finito di togliere. Quattordici
 * ne chiedono 502 e ci stanno anche li'.
 */
export function weekBarLimit(wide: boolean) {
  return wide ? 14 : 10;
}

export type Bucket = {
  key: string;
  label: string;
  total: number;
  count: number;
  /** Inizio dell'intervallo: serve per tornare al mese da una colonna. */
  start: Date;
};

const MONTHS_SHORT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

/** Lunedi' della settimana che contiene `date`. */
function startOfWeek(date: Date) {
  const start = new Date(date);
  const weekday = start.getDay() === 0 ? 7 : start.getDay();
  start.setDate(start.getDate() - (weekday - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Chiave dell'intervallo, composta dalle parti LOCALI della data.
 *
 * Con `toISOString()` un primo del mese a mezzanotte locale finisce nel mese
 * precedente per ogni fuso a est di Greenwich: la chiave resterebbe coerente
 * come identificatore, ma rileggerla per tornare al mese darebbe il mese
 * sbagliato — ed e' esattamente quello che serve quando si tocca una colonna.
 */
/** Esportata per costruire la chiave di un bucket da fuori, es. per aprire
 *  il dettaglio gia' posizionato su un mese preciso invece che sull'ultimo. */
export function keyOf(date: Date, grain: Grain) {
  const anchor = grain === "week" ? startOfWeek(date) : startOfMonth(date);
  const month = String(anchor.getMonth() + 1).padStart(2, "0");
  const day = String(anchor.getDate()).padStart(2, "0");
  return `${anchor.getFullYear()}-${month}-${day}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * "29/07": il lunedi' della settimana, con giorno E mese.
 *
 * Prima era il range intero ("29/07 - 04/08") perche' il solo nome del mese non
 * basta a una settimana — puo' cominciare in un mese e finire nel successivo —
 * e il vecchio "29 lug" lasciava indovinare dove finisse. Quel range pero'
 * costava 68 px di colonna, il doppio di una mensile: Andrea ha chiesto colonne
 * strette, e fra le due cose l'etichetta e' quella che si puo' accorciare senza
 * perdere l'informazione portante.
 *
 * Una data di lunedi' **identifica la settimana da sola**: quel che si perde e'
 * il giorno di chiusura, che sono sempre i sei giorni seguenti. Resta giorno e
 * mese (non "29 lug" abbreviato) proprio perche' due settimane a cavallo di due
 * mesi non si confondano. Il riepilogo sotto il grafico continua a dire la
 * settimana per esteso ("Settimana del 29/07", `DetailScreen`), che con questa
 * etichetta si legge anche meglio di prima.
 */
function weekStartLabel(monday: Date) {
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
}

function labelOf(date: Date, grain: Grain) {
  if (grain === "week") return weekStartLabel(startOfWeek(date));
  return MONTHS_SHORT[date.getMonth()];
}

/**
 * Raggruppa le spese per settimana o mese, includendo gli intervalli VUOTI.
 *
 * Saltare i periodi senza spese comprimerebbe l'asse e farebbe sembrare
 * continuo un andamento che ha dei buchi: una colonna assente e una colonna
 * a zero raccontano cose diverse.
 */
export function bucketize(
  payments: Payment[],
  grain: Grain,
  limit = 12
): Bucket[] {
  const totals = new Map<string, { total: number; count: number; date: Date }>();

  for (const payment of payments) {
    const date = new Date(payment.occurred_at);
    const key = keyOf(date, grain);
    const current = totals.get(key);
    totals.set(key, {
      total: (current?.total ?? 0) + Number(payment.effective_amount),
      count: (current?.count ?? 0) + 1,
      date: current?.date ?? date,
    });
  }

  // Serie continua a ritroso da oggi, cosi' gli intervalli vuoti restano.
  const buckets: Bucket[] = [];
  const cursor = new Date();

  for (let i = 0; i < limit; i++) {
    const key = keyOf(cursor, grain);
    const found = totals.get(key);
    buckets.unshift({
      key,
      label: labelOf(cursor, grain),
      total: found?.total ?? 0,
      count: found?.count ?? 0,
      start: grain === "week" ? startOfWeek(cursor) : startOfMonth(cursor),
    });

    if (grain === "week") {
      cursor.setDate(cursor.getDate() - 7);
    } else {
      // Prima al giorno 1, poi indietro di un mese: sottrarre un mese da un
      // giorno 29-31 trabocca nel mese successivo (il 31 luglio diventa "31
      // giugno", che JavaScript normalizza a 1 luglio), duplicando un bucket
      // e facendone sparire un altro dalla finestra.
      cursor.setDate(1);
      cursor.setMonth(cursor.getMonth() - 1);
    }
  }

  return buckets;
}

/**
 * Media per intervallo, contando solo da dove i dati iniziano davvero.
 *
 * `bucketize` restituisce sempre una finestra di lunghezza fissa (8-10),
 * riempita con bucket a zero per i mesi precedenti al primo movimento: se
 * quel merchant esiste da due mesi e la finestra ne guarda indietro otto,
 * dividere per la lunghezza intera schiaccerebbe la media verso il basso.
 * I mesi vuoti DOPO il primo movimento restano nel conto: un mese senza
 * spese in quell'esercente e' un dato vero, non un buco della finestra.
 */
export function bucketAverage(buckets: Bucket[], metric: "total" | "count") {
  const start = buckets.findIndex((b) => b.total > 0 || b.count > 0);
  if (start === -1) return 0;

  const active = buckets.slice(start);
  const sum = active.reduce((total, b) => total + b[metric], 0);
  return sum / active.length;
}

/** Estremi dell'intervallo coperto da un bucket; la fine e' esclusiva. */
export function bucketRange(bucket: Bucket, grain: Grain) {
  const start = new Date(bucket.start);
  const end = new Date(start);
  if (grain === "week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/** Le spese che cadono dentro un bucket. */
export function paymentsIn(payments: Payment[], bucket: Bucket, grain: Grain) {
  const { start, end } = bucketRange(bucket, grain);
  return payments.filter((payment) => {
    const at = new Date(payment.occurred_at);
    return at >= start && at < end;
  });
}

export function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Mesi consecutivi dal primo al secondo, estremi inclusi.
 *
 * Usata per le ghiere di selezione mese: elencare solo i mesi che hanno
 * dati lascerebbe fuori il mese corrente quando non c'e' ancora stata una
 * spesa, e la ghiera aprirebbe su un mese passato invece che su "adesso".
 */
export function monthsBetween(earliest: Date, latest: Date) {
  const months: Date[] = [];
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(latest.getFullYear(), latest.getMonth(), 1);

  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/** Raggruppa per mese di calendario, dal piu' recente. Per gli elenchi. */
export function groupByMonth(payments: Payment[]) {
  const groups: { key: string; label: string; total: number; data: Payment[] }[] =
    [];

  for (const payment of payments) {
    const date = new Date(payment.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        label: `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`,
        total: 0,
        data: [],
      };
      groups.push(group);
    }

    group.data.push(payment);
    group.total += Number(payment.effective_amount);
  }

  return groups;
}
