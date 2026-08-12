/**
 * Uscite/Entrate: lo stesso segmented control compare in Home e in
 * Movimenti, e il tasto centrale della tabbar deve sapere quale delle due si
 * sta guardando in ciascuna, per decidere se aggiunge una spesa o un
 * introito. Tipo condiviso invece che dichiarato due volte, cosi' le due
 * schermate non possono derivare.
 */
export type MoneyMode = "uscite" | "entrate";
