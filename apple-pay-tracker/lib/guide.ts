/**
 * La guida per costruire l'automazione, passo per passo.
 *
 * Sta qui come dati e non dentro la schermata perche' i passi cambiano
 * quando cambia iOS o la ricetta, e non deve servire toccare il layout per
 * correggere una parola.
 *
 * Il senso di questa guida: senza, il valore dell'app resta chiuso dietro
 * dieci minuti di Comandi Rapidi che nessuno indovina da solo. E' il punto
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
  /** Azione richiesta all'utente dentro l'app: copiare un dato che serve ora. */
  action?: "copy-url" | "copy-token";
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
 * Il comando rapido «Registra spesa» già pronto, condivisibile via iCloud.
 *
 * Non contiene nessun token: il campo dell'intestazione `x-ingest-token` è
 * una variabile presa dall'input, non un valore scritto dentro — chi lo
 * installa userà comunque la propria automazione con la propria chiave, mai
 * quella di chi l'ha condiviso. È il motivo per cui questo link si può
 * pubblicare qui senza rischi.
 *
 * Installandolo si salta per intero il capitolo "Il comando rapido": resta
 * solo da costruire l'automazione, che Apple non permette di condividere in
 * nessun modo — quella tocca farla a ognuno.
 */
export const SHORTCUT_INSTALL_URL =
  "https://www.icloud.com/shortcuts/ad8b80ff1c3b4ed28f5c50e493e37f9d";

export const GUIDE: GuideChapter[] = [
  {
    id: "comando",
    title: "Il comando rapido",
    subtitle:
      "È il pezzo che parla con l'app. Si costruisce una volta e poi non si tocca più.",
    steps: [
      {
        id: "nuovo",
        title: "Crea un comando rapido nuovo",
        body: "Apri Comandi Rapidi, tocca + in alto a destra e chiamalo «Registra spesa». Il nome conta: è quello che sceglierai più avanti dall'automazione.",
      },
      {
        id: "input",
        title: "Accetta qualsiasi tipo di input",
        body: "Nelle informazioni del comando (l'icona ⓘ in basso), attiva «Mostra nel foglio di condivisione» e imposta il tipo di input su «Qualsiasi». Senza, l'automazione non riuscirà a passargli i dati della transazione.",
      },
      {
        id: "merchant",
        title: "Estrai il nome dell'esercente",
        body: "Aggiungi l'azione «Ottieni valore dizionario». Come dizionario scegli la variabile «Input Comando rapido», e come chiave scrivi merchant.",
        blocks: [
          {
            action: "Ottieni valore dizionario",
            fields: [
              { label: "Ottieni", value: "Valore" },
              { label: "Chiave", value: "merchant" },
              { label: "In", value: "Input Comando rapido", variable: true },
            ],
          },
        ],
      },
      {
        id: "amount",
        title: "Estrai l'importo",
        body: "Aggiungi una seconda «Ottieni valore dizionario», identica alla prima ma con chiave amount.",
        blocks: [
          {
            action: "Ottieni valore dizionario",
            fields: [
              { label: "Ottieni", value: "Valore" },
              { label: "Chiave", value: "amount" },
              { label: "In", value: "Input Comando rapido", variable: true },
            ],
          },
        ],
      },
      {
        id: "url",
        title: "Copia l'indirizzo a cui mandare la spesa",
        body: "Serve nel passo successivo. Toccalo qui sotto per copiarlo: è personale del tuo account, non condividerlo insieme al comando.",
        action: "copy-url",
      },
      {
        id: "token",
        title: "Genera la tua chiave",
        body: "È la password che dice al server che quella spesa è tua. Si vede una volta sola: generala adesso, copiala, e incollala subito nel passo seguente.",
        action: "copy-token",
        warning:
          "Se la perdi non è un dramma: ne generi un'altra e revochi la vecchia da Impostazioni → Automazioni.",
      },
      {
        id: "richiesta",
        title: "Aggiungi la chiamata al server",
        body: "Aggiungi «Ottieni contenuti di URL» e incolla l'indirizzo copiato. Apri «Mostra altro» per trovare metodo, intestazioni e corpo della richiesta. I valori di merchant e amount sono le variabili dei due passi precedenti, non testo scritto a mano.",
        blocks: [
          {
            action: "Ottieni contenuti di URL",
            fields: [
              { label: "URL", value: "l'indirizzo copiato" },
              { label: "Metodo", value: "POST" },
              { label: "Intestazione", value: "x-ingest-token = la tua chiave" },
              { label: "Corpo richiesta", value: "JSON" },
              { label: "merchant", value: "Valore dizionario (1º)", variable: true },
              { label: "amount", value: "Valore dizionario (2º)", variable: true },
              { label: "source", value: "shortcut" },
            ],
          },
        ],
      },
      {
        id: "se",
        title: "Controlla se è andata a buon fine",
        body: "Aggiungi un blocco «Se» sul risultato di «Contenuti URL». La condizione deve essere «contiene» con valore \"ok\":true — virgolette comprese.",
        blocks: [
          {
            action: "Se",
            fields: [
              { label: "Input", value: "Contenuti URL", variable: true },
              { label: "Condizione", value: "contiene" },
              { label: "Testo", value: '"ok":true' },
            ],
          },
        ],
        warning:
          "Non usare «presenta qualsiasi valore»: il server risponde con un testo anche quando fallisce, quindi quella condizione sarebbe sempre vera e non ti accorgeresti mai di una spesa persa.",
      },
      {
        id: "salvataggio",
        title: "Salva le spese che non partono",
        body: "Dentro «Altrimenti» aggiungi un'azione «Testo» con il contenuto qui sotto, e poi «Aggiungi a file» su un file chiamato spese-non-inviate.txt in iCloud Drive. Attiva «Aggiungi nuova riga».",
        blocks: [
          {
            action: "Altrimenti",
            nested: [
              {
                action: "Testo",
                fields: [
                  {
                    label: "Contenuto",
                    value:
                      '{"merchant":"‹esercente›","amount":"‹importo›","occurred_at":"‹data ISO 8601›"}',
                    variable: true,
                  },
                ],
              },
              {
                action: "Aggiungi a file",
                fields: [
                  { label: "File", value: "spese-non-inviate.txt" },
                  { label: "Percorso", value: "iCloud Drive / Comandi Rapidi" },
                  { label: "Aggiungi nuova riga", value: "attivo" },
                ],
              },
            ],
          },
        ],
        warning:
          "L'importo va inserito come variabile, non riscritto a mano: dentro quel testo c'è anche la valuta, ed è da lì che l'app capisce che una spesa era in sterline invece che in euro.",
      },
      {
        id: "avviso",
        title: "Fatti avvisare quando qualcosa non va",
        body: "Sempre dentro «Altrimenti», dopo il salvataggio, aggiungi «Mostra notifica» con un testo tipo: Spesa non registrata, recuperala dall'app. Poi chiudi il blocco.",
        warning:
          "Le spese finite nel file si reimportano da Impostazioni → Automazioni → Recupera spese non inviate. I doppioni vengono riconosciuti, quindi puoi reimportare lo stesso file quante volte vuoi.",
      },
    ],
  },
  {
    id: "automazione",
    title: "L'automazione",
    subtitle:
      "Due azioni soltanto: prende la transazione da Apple Pay e la passa al comando che hai appena creato.",
    steps: [
      {
        id: "trigger",
        title: "Crea l'automazione",
        body: "In Comandi Rapidi vai su Automazione → + → cerca «Transazione» (su iOS 26 si chiama «Wallet»). Scegli la carta o le carte che usi con Apple Pay.",
      },
      {
        id: "immediato",
        title: "Falla partire da sola",
        body: "Attiva «Esegui immediatamente» e lascia spenta la notifica di esecuzione. Senza «Esegui immediatamente» dovresti confermare ogni pagamento a mano, e l'automatismo perderebbe senso.",
      },
      {
        id: "dizionario",
        title: "Prepara i dati da passare",
        body: "Aggiungi un'azione «Dizionario» con due voci, prendendo i valori dal selettore variabili della transazione.",
        blocks: [
          {
            action: "Dizionario",
            fields: [
              { label: "merchant", value: "Esercente", variable: true },
              { label: "amount", value: "Importo", variable: true },
            ],
          },
        ],
        warning:
          "Questo passo sembra superfluo ma non lo è: il tipo «Transazione» non sopravvive al passaggio verso un altro comando rapido, arriva dall'altra parte svuotato. Ricostruire un dizionario con chiavi tue è l'unico modo perché i dati arrivino interi.",
      },
      {
        id: "esegui",
        title: "Chiama il comando rapido",
        body: "Aggiungi «Esegui comando rapido», scegli «Registra spesa» e come input passa il Dizionario del passo precedente. Salva: da adesso ogni pagamento Apple Pay finisce nell'app da solo.",
        blocks: [
          {
            action: "Esegui comando rapido",
            fields: [
              { label: "Comando", value: "Registra spesa" },
              { label: "Input", value: "Dizionario", variable: true },
            ],
          },
        ],
      },
      {
        id: "prova",
        title: "Provala",
        body: "Fai un pagamento vero con Apple Pay, anche piccolo. Entro pochi secondi deve comparire in Home. Se non arriva, apri Comandi Rapidi → Automazione e controlla che «Esegui immediatamente» sia attivo.",
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
