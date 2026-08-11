/**
 * La guida per collegare l'automazione, passo per passo.
 *
 * Sta qui come dati e non dentro la schermata perche' i passi cambiano
 * quando cambia iOS o la ricetta, e non deve servire toccare il layout per
 * correggere una parola.
 *
 * Il senso di questa guida: senza, il valore dell'app resta chiuso dietro
 * dei passaggi di Comandi Rapidi che nessuno indovina da solo. E' il punto
 * in cui si perde la maggior parte delle persone, e non per colpa loro.
 */

/** Una riga dentro la riproduzione di un'azione: campo e valore. */
export type ActionField = {
  label: string;
  value: string;
  /** Il valore e' una variabile scelta dal selettore, non testo digitato. */
  variable?: boolean;
};

/** La riproduzione schematica di un'azione dei Comandi Rapidi. */
export type ActionBlock = {
  /** Nome esatto dell'azione da cercare, come lo scrive iOS. */
  action: string;
  fields?: ActionField[];
  /** Blocchi annidati, per il contenuto di un "Se"/"Altrimenti". */
  nested?: ActionBlock[];
};

export type GuideStep = {
  id: string;
  title: string;
  body: string;
  /** Azione richiesta all'utente dentro l'app: copiare un dato che serve ora,
   * o aprire il link di installazione del comando. */
  action?: "open-install" | "copy-token";
  blocks?: ActionBlock[];
  /** Avvertenza sul passo: il punto in cui ci si sbaglia. */
  warning?: string;
};

export type GuideChapter = {
  id: string;
  title: string;
  subtitle: string;
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
    subtitle:
      "È il pezzo pronto che parla con l'app. Si installa e si collega alla tua chiave una volta sola.",
    steps: [
      {
        id: "installa",
        title: "Installa il comando pronto",
        body: "Tocca il pulsante qui sotto: iOS mostra «Clinck: Inserisci pagamento», già impostato con l'indirizzo giusto e i dati della spesa collegati. Tocca «Aggiungi comando rapido» — non c'è nient'altro da configurare in questo passo.",
        action: "open-install",
      },
      {
        id: "chiave",
        title: "Genera e copia la tua chiave",
        body: "È la password che dice al server che quella spesa è tua. Si vede una volta sola: generala adesso e copiala — ti serve nel passo successivo.",
        action: "copy-token",
        warning:
          "Se la perdi non è un dramma: ne generi un'altra e revochi la vecchia da Impostazioni → Automazioni.",
      },
      {
        id: "apri",
        title: "Apri il comando in modifica",
        body: "Vai su Comandi Rapidi → Libreria, cerca «Clinck: Inserisci pagamento», tocca i tre puntini sulla card (o tienila premuta) e scegli «Modifica». Poi scorri fino all'azione «Ottieni contenuti di» e tocca la freccia accanto all'indirizzo per aprirne i dettagli.",
      },
      {
        id: "incolla",
        title: "Incolla la tua chiave",
        body: "In «Intestazioni» trova il campo «x-ingest-token»: contiene il testo segnaposto INCOLLA TOKEN. Selezionalo e sostituiscilo con la chiave copiata al passo precedente. Il resto — indirizzo, importo, esercente, carta — è già collegato, non toccarlo.",
        blocks: [
          {
            action: "Ottieni contenuti di URL",
            fields: [
              { label: "Metodo", value: "POST" },
              { label: "Intestazioni · x-ingest-token", value: "INCOLLA TOKEN → la tua chiave" },
              { label: "amount", value: "Importo", variable: true },
              { label: "merchant", value: "Esercente", variable: true },
              { label: "card", value: "Carta o biglietto", variable: true },
              { label: "source", value: "shortcut" },
            ],
          },
        ],
        warning:
          "È l'unico campo di tutto il comando che va toccato. Se lo lasci com'è, ogni chiamata al server viene rifiutata e la spesa non entra mai in app.",
      },
    ],
  },
  {
    id: "automazione",
    title: "L'automazione",
    subtitle:
      "Fa partire da sola il comando appena configurato a ogni pagamento Apple Pay.",
    steps: [
      {
        id: "cerca",
        title: "Crea l'automazione",
        body: "Vai su Automazioni → + e cerca «Wallet» nella casella di ricerca in basso. Compare un solo risultato: toccalo.",
      },
      {
        id: "seleziona-tutto",
        title: "Lascia tutto selezionato",
        body: "La schermata mostra le tue carte e le categorie di spesa, già tutte spuntate: è quello che serve, l'automazione deve vedere ogni pagamento Apple Pay. Tocca «Avanti» senza togliere nessuna spunta.",
      },
      {
        id: "scegli-comando",
        title: "Scegli il comando da eseguire",
        body: "Cerca «Inserisci pagamento» tra i comandi rapidi suggeriti e selezionalo: è il comando che hai appena installato e configurato.",
      },
      {
        id: "immediato",
        title: "Falla partire da sola",
        body: "In alto tocca «Automazioni» — si apre un menu con tre opzioni. Scegli «Esegui immediatamente» al posto di «Esegui dopo la conferma», di default, poi tocca «Fine».",
        warning:
          "Senza «Esegui immediatamente» dovresti confermare ogni pagamento a mano, e l'automatismo perderebbe senso.",
      },
      {
        id: "prova",
        title: "Provala",
        body: "Fai un pagamento vero con Apple Pay, anche piccolo. Entro pochi secondi deve comparire in Home.",
        warning:
          "L'automazione vede solo Apple Pay: contanti, bonifici, addebiti diretti e carte fisiche fuori da Wallet restano da aggiungere a mano o con Siri.",
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
