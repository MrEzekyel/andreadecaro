import { RecurringFrequency } from "./types";

/** Data locale in "YYYY-MM-DD", senza passare da toISOString (che sposta di fuso). */
function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Costruisce una data da anno/mese/giorno limitando il giorno alla lunghezza
 * del mese.
 *
 * `new Date(2026, 8, 31)` non e' il 31 settembre: e' il 1 ottobre. Passando
 * per il giorno voluto senza limitarlo, una regola al 31 salterebbe i mesi
 * corti finendo nel mese sbagliato invece che sull'ultimo giorno utile.
 */
function clampedDate(year: number, month: number, day: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, daysInMonth));
}

/**
 * Prima scadenza a partire da oggi, coerente con frequenza e giorno scelti.
 *
 * Usata sia alla creazione di una regola sia quando se ne cambia la cadenza:
 * senza ricalcolo, `next_run_on` resterebbe quello vecchio e la regola
 * continuerebbe a mostrare (e a generare) la scadenza precedente.
 */
export function nextRunOn(
  frequency: RecurringFrequency,
  day: number,
  weekday: number,
  from = new Date()
) {
  if (frequency === "weekly") {
    const next = new Date(from);
    const current = next.getDay() === 0 ? 7 : next.getDay();
    const delta = (weekday - current + 7) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return isoDate(next);
  }

  const step = frequency === "yearly" ? 12 : 1;
  let candidate = clampedDate(from.getFullYear(), from.getMonth(), day);

  // Il giorno di oggi conta come gia' passato: la generazione notturna per
  // oggi e' o gia' avvenuta o imminente, e anticiparla creerebbe un doppione.
  if (candidate <= from) {
    candidate = clampedDate(
      from.getFullYear(),
      from.getMonth() + step,
      day
    );
  }

  return isoDate(candidate);
}

/**
 * Quanto pesa al mese una regola ricorrente, qualunque sia la sua cadenza.
 *
 * Nata in `PacScreen` per la quota di ogni piano di accumulo sul totale
 * mensile investito; usata anche da `lib/savings.ts` per il vincolo minimo
 * di un obiettivo di risparmio (non puoi risparmiare meno di quanto investi
 * gia' in automatico). Un'unica formula: se ne nascesse una seconda, le due
 * potrebbero divergere silenziosamente sullo stesso numero.
 */
export function monthlyEquivalent(rule: { amount: number; frequency: RecurringFrequency }) {
  const amount = Number(rule.amount);
  if (rule.frequency === "weekly") return (amount * 52) / 12;
  if (rule.frequency === "yearly") return amount / 12;
  return amount;
}

/** Vero se la cadenza e' cambiata e `next_run_on` va ricalcolato. */
export function scheduleChanged(
  rule: {
    frequency: RecurringFrequency;
    day_of_month: number | null;
    weekday: number | null;
  },
  frequency: RecurringFrequency,
  day: number,
  weekday: number
) {
  if (rule.frequency !== frequency) return true;
  if (frequency === "weekly") return (rule.weekday ?? 1) !== weekday;
  return (rule.day_of_month ?? 1) !== day;
}
