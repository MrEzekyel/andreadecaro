import { Payment } from "./types";

export type Grain = "week" | "month";

export type Bucket = {
  key: string;
  label: string;
  total: number;
  count: number;
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

function keyOf(date: Date, grain: Grain) {
  const anchor = grain === "week" ? startOfWeek(date) : startOfMonth(date);
  return anchor.toISOString().slice(0, 10);
}

function labelOf(date: Date, grain: Grain) {
  if (grain === "week") {
    const start = startOfWeek(date);
    return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
  }
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
    });

    if (grain === "week") {
      cursor.setDate(cursor.getDate() - 7);
    } else {
      cursor.setMonth(cursor.getMonth() - 1);
    }
  }

  return buckets;
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
