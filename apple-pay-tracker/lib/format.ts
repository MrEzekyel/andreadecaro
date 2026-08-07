const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const decimal = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number) {
  return currency.format(value);
}

/** Separa parte intera e decimali, per comporre il numero grande della Home. */
export function splitAmount(value: number) {
  const [whole, cents] = decimal.format(value).split(",");
  return { whole, cents: `,${cents} €` };
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const MONTHS_SHORT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export function monthName(date: Date) {
  return MONTHS[date.getMonth()];
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Luglio" — il nome del mese come titolo. */
export function monthTitle(date: Date) {
  return capitalize(MONTHS[date.getMonth()]);
}

/** "Lug 2026" — compatto, per le etichette che devono stare in una riga. */
export function monthShort(date: Date) {
  return `${capitalize(MONTHS_SHORT[date.getMonth()])} ${date.getFullYear()}`;
}

/**
 * Data di una spesa come la si legge a colpo d'occhio: "Oggi 11:50",
 * "Ieri 11:50", altrimenti "12 ago 11:50".
 */
export function shortDateTime(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return `Oggi ${time}`;
  if (sameDay(date, yesterday)) return `Ieri ${time}`;

  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${time}`;
}

/**
 * Importo ridotto all'osso per stare sopra una colonna di grafico: niente
 * decimali, e migliaia abbreviate. Sotto la colonna c'e' spazio per 3-4
 * caratteri, non per "1.234,56 €".
 */
export function compactAmount(value: number): string {
  if (value === 0) return "";
  // I risparmi mensili possono essere negativi: il segno va tenuto, ma la
  // scelta di formato si fa sul valore assoluto.
  if (value < 0) return `−${compactAmount(-value)}`;
  if (value >= 1000) {
    const thousands = value / 1000;
    // Si arrotonda prima di decidere quante cifre servono, altrimenti 1999
    // diventerebbe "2,0k" invece che "2k".
    const rounded =
      thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
    return `${rounded.toFixed(Number.isInteger(rounded) ? 0 : 1).replace(".", ",")}k`;
  }
  return String(Math.round(value));
}

/**
 * Variazione percentuale fra due totali. Restituisce null quando il termine
 * di paragone e' zero: "+100%" rispetto a niente speso non informa.
 */
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Etichetta di giorno per i raggruppamenti: "Oggi", "Ieri", o la data. */
export function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Oggi";
  if (sameDay(date, yesterday)) return "Ieri";

  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Chiave di raggruppamento per giorno, indipendente dal fuso di stampa. */
export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Importo in una valuta diversa dall'euro, con il suo simbolo.
 *
 * Serve solo a mostrare l'originale accanto al controvalore: nei totali entra
 * sempre e comunque l'euro.
 */
export function formatForeign(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    // Valuta non riconosciuta da Intl: meglio "12,99 XYZ" che un errore.
    return `${value.toFixed(2).replace(".", ",")} ${currency}`;
  }
}
