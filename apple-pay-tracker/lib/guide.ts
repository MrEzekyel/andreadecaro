/**
 * La guida per collegare l'automazione, passo per passo.
 *
 * Sta qui come dati e non dentro la schermata perche' i passi cambiano
 * quando cambia iOS o la ricetta, e non deve servire toccare il layout per
 * correggere una parola.
 *
 * Ogni passo e' pensato per stare su una schermata sola, con lo screenshot
 * vero al centro e una riga di didascalia sotto — non un paragrafo da
 * leggere. E' la lezione della prima versione, troppo testuale: chi segue
 * una procedura tecnica sul telefono guarda l'immagine, non legge un pezzo
 * di prosa mentre tiene in mano Comandi Rapidi con l'altra mano.
 */

export type GuideStep = {
  id: string;
  title: string;
  /** Didascalia breve: una riga, non un paragrafo. Lo screenshot spiega. */
  caption: string;
  /** Azione richiesta all'utente dentro l'app: copiare un dato che serve ora,
   * o aprire il link di installazione del comando. */
  action?: "open-install" | "copy-token";
  /** Punto in cui ci si sbaglia, se c'e'. Anche questo, breve. */
  warning?: string;
};

export type GuideChapter = {
  id: string;
  title: string;
  steps: GuideStep[];
};

/**
 * Il comando rapido «Clinck: Inserisci pagamento» già pronto, condivisibile
 * via iCloud: prende l'esercente, l'importo e la carta direttamente dalla
 * transazione di Wallet e li manda al server. Non c'è nulla da costruire.
 *
 * Il campo dell'intestazione `x-ingest-token` dentro «Ottieni contenuti di
 * URL» contiene il testo segnaposto `INCOLLA TOKEN`, non un token vero: è
 * per questo che si può pubblicare il link senza rischi. Chi lo installa
 * riceve la propria copia locale del comando — modificarla (sostituire il
 * segnaposto con la propria chiave) non tocca in nessun modo l'originale
 * condiviso, quindi non c'è mai una chiave di qualcun altro in giro.
 */
export const SHORTCUT_INSTALL_URL =
  "https://www.icloud.com/shortcuts/0814f81a51ea4b7e911247f79ace29b2";

export const GUIDE: GuideChapter[] = [
  {
    id: "comando",
    title: "Il comando rapido",
    steps: [
      {
        id: "installa",
        title: "Installa il comando pronto",
        caption: "Tocca il pulsante, poi «Aggiungi comando rapido». Basta così.",
        action: "open-install",
      },
      {
        id: "chiave",
        title: "Genera e copia la tua chiave",
        caption: "Si vede una volta sola: copiala, ti serve tra due passi.",
        action: "copy-token",
        warning: "Se la perdi, ne generi un'altra da Impostazioni → Automazioni.",
      },
      {
        id: "apri",
        title: "Apri il comando in modifica",
        caption: "Libreria → tre puntini sulla card → «Modifica».",
      },
      {
        id: "espandi",
        title: "Apri i dettagli della richiesta",
        caption: "Scorri fino a «Ottieni contenuti di» e tocca la freccia.",
      },
      {
        id: "incolla",
        title: "Incolla la tua chiave",
        caption: "In «Intestazioni», sostituisci INCOLLA TOKEN con la chiave copiata.",
        warning:
          "L'unico campo da toccare. Lasciato com'è, ogni spesa viene rifiutata.",
      },
    ],
  },
  {
    id: "automazione",
    title: "L'automazione",
    steps: [
      {
        id: "cerca",
        title: "Crea l'automazione",
        caption: "Automazioni → + → cerca «Wallet» → tocca l'unico risultato.",
      },
      {
        id: "seleziona-tutto",
        title: "Lascia tutto selezionato",
        caption: "Carte e categorie sono già tutte spuntate: tocca «Avanti».",
      },
      {
        id: "scegli-comando",
        title: "Scegli il comando da eseguire",
        caption: "In «I miei comandi rapidi», tocca «Clinck: Inserisci Pagamento».",
      },
      {
        id: "immediato",
        title: "Falla partire da sola",
        caption: "Tocca «Automazioni» in alto, scegli «Esegui immediatamente» e lascia spenta la notifica.",
        warning: "Senza, dovresti confermare ogni pagamento a mano.",
      },
      {
        id: "prova",
        title: "Provala",
        caption: "Un pagamento vero con Apple Pay: entro pochi secondi è in Home.",
        warning:
          "Vede solo Apple Pay: contanti, bonifici e carte fuori da Wallet restano manuali.",
      },
    ],
  },
];

/** Numero totale di passi, per l'indicatore di avanzamento. */
export const GUIDE_STEPS = GUIDE.reduce(
  (total, chapter) => total + chapter.steps.length,
  0
);

/** I passi in fila, con il capitolo di appartenenza. */
export const GUIDE_FLAT = GUIDE.flatMap((chapter) =>
  chapter.steps.map((step) => ({ chapter, step }))
);
