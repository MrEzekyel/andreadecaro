/**
 * Costruzione di CSV che si aprono con un doppio clic in Excel italiano.
 *
 * Le tre scelte qui sotto non sono cosmetiche: sbagliandone una il file si
 * apre lo stesso ma illeggibile, ed e' il tipo di difetto che si scopre solo
 * dopo averlo mandato a qualcuno.
 */

/**
 * Separatore punto e virgola, non virgola.
 *
 * Excel decide il separatore dalle impostazioni locali del sistema: in Italia
 * si aspetta `;`, e con `,` mette l'intera riga in una cella sola.
 */
const SEPARATOR = ";";

/**
 * Byte order mark UTF-8.
 *
 * Senza, Excel legge il file come Windows-1252 e "Caffè" diventa "CaffÃ¨".
 * Numbers e i fogli di Google lo ignorano, quindi non costa niente averlo.
 */
const BOM = "﻿";

/** Racchiude fra virgolette solo quando serve, raddoppiando quelle interne. */
function cell(value: string) {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Numero con la virgola decimale e senza separatore di migliaia.
 *
 * Il separatore di migliaia romperebbe la colonna: contiene un punto o uno
 * spazio che Excel interpreta prima di guardare il numero.
 */
export function csvNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(2).replace(".", ",");
}

/** Come `csvNumber` ma per le quantita', dove i decimali contano davvero. */
export function csvQuantity(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value).replace(".", ",");
}

/** Data in formato italiano, quello che Excel riconosce come data qui. */
export function csvDate(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Ora e minuti, in una colonna separata dalla data. */
export function csvTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function csvBoolean(value: boolean) {
  return value ? "sì" : "no";
}

/** Assembla intestazioni e righe in un CSV completo, BOM incluso. */
export function buildCsv(headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((row) =>
    row.map((value) => cell(value ?? "")).join(SEPARATOR)
  );
  // Terminatori CRLF: e' quello che si aspettano i fogli di calcolo su
  // Windows, e su Mac vengono letti comunque.
  return BOM + lines.join("\r\n") + "\r\n";
}
