export type PeriodKind = "week" | "month" | "year";

export type Period = {
  kind: PeriodKind;
  start: Date;
  /** Esclusivo: la prima istante fuori dal periodo. */
  end: Date;
  label: string;
};

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** Lunedi' della settimana che contiene `date`. */
function weekStart(date: Date) {
  const start = new Date(date);
  const weekday = start.getDay() === 0 ? 7 : start.getDay();
  start.setDate(start.getDate() - (weekday - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Costruisce il periodo spostato di `offset` unita' rispetto a oggi.
 * offset 0 = periodo corrente, -1 = precedente.
 */
export function buildPeriod(kind: PeriodKind, offset: number): Period {
  const today = new Date();

  if (kind === "week") {
    const start = weekStart(today);
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const last = new Date(end);
    last.setDate(last.getDate() - 1);

    return {
      kind,
      start,
      end,
      label:
        offset === 0
          ? "Questa settimana"
          : `${start.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`,
    };
  }

  if (kind === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      kind,
      start,
      end,
      label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    };
  }

  const start = new Date(today.getFullYear() + offset, 0, 1);
  const end = new Date(start.getFullYear() + 1, 0, 1);
  return { kind, start, end, label: String(start.getFullYear()) };
}

/**
 * Numero di intervalli in cui suddividere il periodo per il grafico:
 * giorni per settimana e mese, mesi per anno.
 */
export function bucketCount(period: Period) {
  if (period.kind === "week") return 7;
  if (period.kind === "month") {
    return new Date(
      period.start.getFullYear(),
      period.start.getMonth() + 1,
      0
    ).getDate();
  }
  return 12;
}

/** Indice dell'intervallo a cui appartiene una data, 0-based. */
export function bucketOf(period: Period, iso: string) {
  const date = new Date(iso);
  if (period.kind === "year") return date.getMonth();
  const days = Math.floor(
    (date.getTime() - period.start.getTime()) / 86_400_000
  );
  return Math.max(0, Math.min(days, bucketCount(period) - 1));
}

/** Fino a quale intervallo ha senso disegnare: oggi, se il periodo è corrente. */
export function bucketsElapsed(period: Period) {
  const now = new Date();
  if (now >= period.end) return bucketCount(period);
  if (now < period.start) return 0;
  return bucketOf(period, now.toISOString()) + 1;
}
