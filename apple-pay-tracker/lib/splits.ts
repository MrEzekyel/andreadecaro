import { IncomingSplit, OpenCredit, Person } from "./types";

/**
 * Le divisioni viste per persona, non per direzione.
 *
 * `OwedScreen` legge due fonti separate — `payment_splits` (quote che ho
 * fatto io, "Ti devono") e `incoming_splits()` (quote che mi hanno fatto,
 * "Devi") — perche' sono due tabelle di due account diversi e nessuna delle
 * due basta da sola. Le persone e i grafici, pero', ragionano per persona:
 * "quanto ho diviso con Leonardo in tutto", non "quanto nella tabella A e
 * quanto nella tabella B". Questo modulo le unisce in un'unica lista di
 * eventi, un tipo solo, prima che i grafici e le liste li leggano.
 */

export type SplitDirection = "credit" | "debt";

export type SplitEvent = {
  id: string;
  personId: string;
  personName: string;
  direction: SplitDirection;
  amount: number;
  merchant: string;
  occurredAt: string;
  settled: boolean;
  /** Solo per i crediti: lo stato dell'altro account verso questa quota. */
  status: "local" | "pending" | "accepted" | "declined";
};

/**
 * Un `IncomingSplit` non porta un `person_id` — chi ha pagato non e' un
 * contatto della mia rubrica, e' un altro account. Il collegamento e'
 * `payer_user_id` (migrazione 0041) contro `people.linked_user_id`: da
 * quando una richiesta di amicizia viene accettata, `ensure_linked_person`
 * garantisce che quel contatto esiste gia' su entrambi i lati, quindi il
 * match e' un confronto diretto, non una euristica sul nome che potrebbe
 * sbagliare con un omonimo.
 */
function personForPayer(people: Person[], payerUserId: string): Person | null {
  return people.find((p) => p.linked_user_id === payerUserId) ?? null;
}

/** Unisce crediti e debiti in una sola lista, dal piu' recente. */
export function buildSplitEvents(
  credits: OpenCredit[],
  debts: IncomingSplit[],
  people: Person[]
): SplitEvent[] {
  const events: SplitEvent[] = [];

  for (const credit of credits) {
    events.push({
      id: `credit:${credit.id}`,
      personId: credit.person_id,
      personName: credit.person?.name ?? "—",
      direction: "credit",
      amount: Number(credit.amount_owed),
      merchant: credit.payment?.merchant_name ?? "spesa eliminata",
      occurredAt: credit.payment?.occurred_at ?? credit.created_at,
      settled: credit.settled_at !== null,
      status: credit.status,
    });
  }

  for (const debt of debts) {
    const person = personForPayer(people, debt.payer_user_id);
    // Senza un contatto locale corrispondente l'evento non ha un posto dove
    // stare nell'elenco "per persona": non dovrebbe succedere (vedi sopra),
    // ma se succede si scarta invece di inventare una persona fittizia.
    if (!person) continue;
    events.push({
      id: `debt:${debt.split_id}`,
      personId: person.id,
      personName: person.name,
      direction: "debt",
      amount: Number(debt.amount_owed),
      merchant: debt.merchant,
      occurredAt: debt.occurred_at,
      settled: debt.settled_at !== null,
      status: debt.status,
    });
  }

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export type PersonTotal = {
  personId: string;
  name: string;
  received: number;
  receivedCount: number;
  sent: number;
  sentCount: number;
};

/** Quanto si e' diviso con ciascuna persona, sommando le due direzioni. */
export function personTotals(events: SplitEvent[]): PersonTotal[] {
  const map = new Map<string, PersonTotal>();

  for (const event of events) {
    const current = map.get(event.personId) ?? {
      personId: event.personId,
      name: event.personName,
      received: 0,
      receivedCount: 0,
      sent: 0,
      sentCount: 0,
    };
    if (event.direction === "credit") {
      current.received += event.amount;
      current.receivedCount += 1;
    } else {
      current.sent += event.amount;
      current.sentCount += 1;
    }
    map.set(event.personId, current);
  }

  return Array.from(map.values());
}

const MONTHS_SHORT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export type MonthlySplitBucket = {
  key: string;
  label: string;
  received: number;
  receivedCount: number;
  sent: number;
  sentCount: number;
};

/**
 * Gli ultimi `limit` mesi per una persona, mesi vuoti inclusi.
 *
 * Un mese senza divisioni e' un dato vero ("con lui a marzo non abbiamo
 * diviso niente"), non un buco da saltare: saltarlo comprimerebbe l'asse e
 * farebbe sembrare continuo un andamento che non lo e', lo stesso principio
 * di `bucketize` in lib/aggregate.ts.
 */
export function monthlySplitBuckets(
  events: SplitEvent[],
  limit = 6
): MonthlySplitBucket[] {
  const totals = new Map<string, MonthlySplitBucket>();

  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = totals.get(key) ?? {
      key,
      label: MONTHS_SHORT[date.getMonth()],
      received: 0,
      receivedCount: 0,
      sent: 0,
      sentCount: 0,
    };
    if (event.direction === "credit") {
      current.received += event.amount;
      current.receivedCount += 1;
    } else {
      current.sent += event.amount;
      current.sentCount += 1;
    }
    totals.set(key, current);
  }

  const buckets: MonthlySplitBucket[] = [];
  const cursor = new Date();
  for (let i = 0; i < limit; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    const found = totals.get(key);
    buckets.unshift(
      found ?? {
        key,
        label: MONTHS_SHORT[cursor.getMonth()],
        received: 0,
        receivedCount: 0,
        sent: 0,
        sentCount: 0,
      }
    );
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return buckets;
}

export function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export type MonthGroup = {
  key: string;
  label: string;
  data: SplitEvent[];
};

/** Raggruppa per mese di calendario, dal piu' recente — per gli elenchi. */
export function groupEventsByMonth(events: SplitEvent[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        label: `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`,
        data: [],
      };
      groups.push(group);
    }
    group.data.push(event);
  }
  return groups;
}
