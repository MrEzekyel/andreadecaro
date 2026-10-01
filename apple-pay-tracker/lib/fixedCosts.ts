import type { RecurringRule } from "./types";

export type FixedCostRule = Pick<
  RecurringRule,
  "amount" | "frequency" | "day_of_month" | "weekday" | "start_on" | "end_on" | "next_run_on"
>;

/** "2026-10-15" come data locale a mezzanotte, senza passare dal fuso UTC. */
function parseDay(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * La stessa regola di `public.next_occurrence()` nel database: se divergono,
 * qui si conterebbero rate in giorni in cui il cron non le crea.
 */
export function nextOccurrence(from: Date, rule: FixedCostRule): Date {
  if (rule.frequency === "weekly") {
    // isodow: 1 = lunedi' ... 7 = domenica.
    const target = rule.weekday ?? 1;
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    while (((next.getDay() + 6) % 7) + 1 !== target) next.setDate(next.getDate() + 1);
    return next;
  }
  const step = rule.frequency === "monthly" ? 1 : 12;
  const year = from.getFullYear();
  const month = from.getMonth() + step;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(rule.day_of_month ?? 1, daysInMonth));
}

/**
 * Le rate ricorrenti che devono ancora diventare spese nel mese di `now`.
 *
 * Il cron le crea solo il giorno in cui scadono: il primo del mese la rata
 * del 15 non esiste ancora fra le spese, ma e' gia' un impegno certo. Si
 * parte da `next_run_on`, che e' sempre la prima scadenza non ancora creata,
 * quindi nessuna rata viene contata due volte.
 */
export function upcomingRecurringTotal(rules: FixedCostRule[], now: Date): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let total = 0;
  for (const rule of rules) {
    const start = parseDay(rule.start_on);
    const end = rule.end_on ? parseDay(rule.end_on) : null;
    let date = parseDay(rule.next_run_on);
    for (let i = 0; i < 400 && date <= monthEnd; i++) {
      if (end && date > end) break;
      if (date >= monthStart && date >= start) total += Number(rule.amount);
      date = nextOccurrence(date, rule);
    }
  }
  return total;
}
