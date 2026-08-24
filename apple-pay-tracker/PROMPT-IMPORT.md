# Prompt per la sessione locale — revisione dell'import

Da incollare in Claude Code sul Mac. Nasce dalla pulizia manuale fatta a mano
sul database il 23 agosto 2026 su due estratti conto veri (Revolut gen–mag
2026, Trade Republic gen–mag 2026): ogni casistica qui sotto è successa
davvero, con i numeri veri.

---

## Contesto

Ho appena importato in Clinck due estratti conto veri e ho dovuto sistemare il
risultato **interrogando un'AI collegata al database**, con query SQL scritte a
mano. Un utente non potrà mai fare questo. Oggi `screens/ImportScreen.tsx`
mostra cosa ha capito del file e poi scrive: fra la lettura e la scrittura non
c'è nessun momento in cui l'utente possa correggere qualcosa.

Voglio che quel momento esista: una **schermata di revisione**, fra l'anteprima
e la scrittura, in cui si sistema l'import prima di approvarlo.

Prima di scrivere codice leggi `CLAUDE.md` (sezione "Import da estratto conto"
e "Design system"), `screens/ImportScreen.tsx`, `lib/statementImport.ts`,
`lib/statementWriter.ts`. Le convenzioni del design system valgono tutte: fogli
dal basso con "Indietro", niente riquadri decorativi, uno stato vuoto non deve
mai poter significare "non ho letto", un foglio aperto da un foglio va
renderizzato dentro di lui.

**Il vincolo che non si tocca**: all'utente non si chiede di mappare le
colonne. Il riconoscimento resta deterministico e nessun modello linguistico
tocca i numeri. Quello che aggiungiamo è **correzione dopo il riconoscimento**,
non un riconoscimento diverso.

---

## Le casistiche vere da coprire

### 1. Trasferimenti fra conti propri — i più dannosi

Sono la cosa peggiore che può succedere a un import, perché gonfiano **sia** le
spese sia le entrate e sembrano movimenti normali.

Esempi reali, su un solo utente in cinque mesi:

| Descrizione | Righe | Totale | Verso |
| --- | --- | --- | --- |
| `To Andrea De Caro` | 10 | 7.940,00 € | uscita |
| `Pagamento da ANDREA DE CARO` | 14 | 1.074,00 € | entrata |
| `Outgoing transfer for Andrea De Caro (IT80X03669…)` | 7 | 528,00 € | uscita |
| `Outgoing transfer for DE CARO ANDREA (IT33F03015…)` | 3 | 202,00 € | uscita |
| `Incoming transfer from Andrea De Caro (IT80X03669…)` | 6 | 7.120,00 € | entrata |
| `Balance migration to another region or legal entity` | 2 | 726,14 € | entrambi |
| `Ricarica di Apple Pay con *3350` | 4 | 329,90 € | entrata |
| `Revolut**0519` | 3 | 300,00 € | uscita |

Senza toglierli, le spese di gennaio–maggio risultavano **12.662 € invece di
4.359 €**: tre volte tanto. Un utente che vede quel numero o non si fida
dell'app, o peggio si fida.

Cosa deve fare l'app: **proporre** (mai decidere) di escludere le righe che
contengono il nome dell'utente. Il nome ce l'abbiamo già in
`profiles.display_name`, e va confrontato in modo tollerante — il file scrive
`ANDREA DE CARO`, `Andrea De Caro`, `DE CARO ANDREA`: maiuscole diverse,
ordine nome/cognome invertito, accenti. Confronto per insieme di parole dopo
`fold()`, non per stringa.

Aiuta anche riconoscere **le coppie**: un'uscita e un'entrata dello stesso
importo a pochi giorni di distanza fra due file diversi dello stesso import è
quasi certamente un giro interno. Segnalarle affiancate.

E le ricariche: `Ricarica di Apple Pay con *3350`, `Revolut**0519` — un conto
che si ricarica da un altro. Non hanno il nome dentro, quindi servono come
categoria a parte: "sembra un trasferimento fra tuoi conti".

### 2. Duplicati di cose che l'app ha già

Qui la trappola è che **non tutti i duplicati sono duplicati**, e sbagliare
verso cancella dati veri.

**Sono duplicati davvero** — gli acquisti di investimenti, già in `investments`:

- `Savings plan execution IE00B5BMR087 iShares VII plc - iShares Core S&P 500 UCITS ETF USD (Acc), quantity: 0.301513` — 18 righe, 2.001,67 €
- `Private Markets pre-payment for buy order: 13d9d843-…` — 10 righe, 500,00 €
- `Cash Dividend for ISIN IE0007UPSEA3` — 1 riga, 34,39 € (già come `investments.kind='dividend'`)

Verificati uno per uno contro `investments`: c'erano tutti, stesse date, stessi
importi. Lasciarli avrebbe contato due volte ogni rata del piano di accumulo.

**NON erano duplicati, anche se sembravano** — gli abbonamenti ricorrenti:

`Sepa Direct Debit transfer to SANTANDER CONSUMER BANK SPA (IT71C0319…)`,
5 righe, 1.911,90 €. Esiste una `recurring_rules` con lo stesso nome e lo
stesso importo (382,38 €/mese), quindi a colpo d'occhio sono duplicati. Ma
quella regola ha `start_on = 2026-07-29`: genera spese **solo da agosto**,
mentre l'estratto copre **gennaio–maggio**. Nessuna sovrapposizione.
Cancellarle avrebbe tolto 1.911,90 € di costi fissi veri.

Da qui la regola: **il confronto si fa sulle righe che esistono davvero, per
data e importo — mai sul nome di una regola.** Una `recurring_rule` non è una
spesa: è una promessa di spese future.

Cosa deve fare l'app: prima della revisione, confrontare ogni riga letta con
- `investments` (stesso giorno ±2, stesso importo)
- `payments` con `source='recurring'` (stesso giorno ±4, stesso importo)
- `payments` già esistenti (il confronto ±4 giorni che `statementWriter` già fa)

e **marcare** le corrispondenze mostrando *contro cosa* combaciano ("già
presente come investimento del 2 aprile"). Non basta dire "duplicato": senza
sapere contro cosa, l'utente non può giudicare.

### 3. Soldi a e da altre persone

Sono spese vere, ma la descrizione non dice mai a cosa si riferiscono:

- `Pagamento a favore di DOMENICO ALIBERTI`, `… ALINA VOYCHAK`, `… MARGHERITA PALAZZOLO`, `… LEONARDO BARESE`, `… ALESSANDRO ROMANO` — 14 righe, 369,45 €
- `Outgoing transfer for ABDEL RAHMAN EL BELTAGY (BG48INTF…)` — 300,00 €
- in entrata: `Pagamento da parte di ROSA PADUANO` (14 righe, 664,95 €), `… DOMENICO ALIBERTI`, `… ALINA VOYCHAK` (17 righe), e altri otto nomi

Sono quasi sempre spese divise: qualcuno mi ha ridato la sua parte, o io ho
dato la mia. Clinck **ha già** un sistema per questo — `people`,
`payment_splits`, `OwedScreen`, i Clinck Tag — e l'import lo ignora
completamente.

Cosa deve fare l'app: riconoscere il pattern "movimento verso/da una persona"
(nome proprio di 2-3 parole, nessun suffisso societario tipo SRL/SPA/GMBH) e
offrire, nella revisione, di **collegarlo a un contatto di `people`** — creando
il contatto al volo se non c'è, come già fanno i selettori altrove. In entrata,
proporre di registrarlo come rimborso invece che come introito generico: un
introito falso gonfia lo stipendio medio e sballa il "Risparmiato".

Se l'utente non vuole collegare niente, la riga entra senza categoria. Non
inventarne una.

### 4. Conti cointestati e altri conti "non personali"

`Pagamento a favore di ANDREA DE CARO & LEONARDO BARESE` — 9 righe, 581,00 €.
C'è dentro il mio nome, ma anche quello di un altro: è il conto cointestato
della nostra attività. Non è un giro interno e non è una spesa personale.

Cosa deve fare l'app: quando trova il nome dell'utente **insieme** a un altro
nome, non trattarlo come trasferimento interno automatico — chiederlo. E
soprattutto: la risposta va **ricordata**, perché quel conto tornerà in ogni
import futuro.

### 5. Nomi da ripulire e da unificare

Il caso peggiore incontrato, tutti dallo stesso import:

- **`null` attaccato in fondo** a 39 nomi su 125: `SUPERMERCATO SGM SRLnull`,
  `HOTEL EURAnull`, `MCDONALD Snull`. Questo è un **bug vero da trovare e
  correggere in `lib/statementImport.ts`**, non da lasciare alla revisione
  manuale: sembra una concatenazione di una colonna vuota letta come stringa
  `"null"`. Cercalo e sistemalo alla radice, poi tieni comunque una
  normalizzazione difensiva.
- **La stessa insegna in quattro grafie**: `McDonald's`, `MCDONALD S`,
  `MC DONALD S`, `Mcdonald'S Dragona`, `Mcdonalds San Paolo`. Il sistema
  `merchants.parent_id` esiste già e le raggrupperebbe, ma solo se i nomi
  arrivano abbastanza puliti da farlo scattare.
- **IBAN dentro il nome**: `Sepa Direct Debit transfer to SANTANDER CONSUMER
  BANK SPA (IT71C0319101000000000000404)`. Il codice va tolto dal nome
  visualizzato ma **conservato** in `raw_notification_text`.
- **Prefissi tecnici**: `Outgoing transfer for `, `Incoming transfer from `,
  `Sepa Direct Debit transfer to `, `Pagamento a favore di `, `Pagamento da
  parte di `. Sono metadati sul *tipo* di movimento, non parte del nome:
  vanno estratti come tipo e tolti dal nome.
- **Dati di cambio finiti nel nome**: `SSP EGYPT SHARM, 13,62 $, exchange
  rate: 0,8553598, ECB rate: 0,8599931201, markup: -0,53876246 %`. Qui c'è
  perfino la valuta originale e il tasso, che l'app saprebbe usare
  (`original_amount`/`original_currency`/`fx_rate`) e invece butta in un nome
  lungo cento caratteri.
- **Quantità nel nome**: `Savings plan execution … quantity: 0.301513`.

Cosa deve fare l'app: estendere `cleanDescription()` con questi pattern, e —
questa è la parte che manca del tutto — permettere di **rinominare un esercente
nella revisione**, con l'opzione "applica a tutte le righe con questo nome" e
"ricorda per i prossimi import".

### 6. Date da spostare

Lo stipendio arriva il 27/28/29 del mese ma è lo stipendio del mese
**successivo**. Cinque righe da spostare avanti di un mese, tutte insieme.
Senza, ogni mese risulta con lo stipendio sbagliato e maggio ne aveva due.

Non è un caso mio: è come funzionano quasi tutti gli stipendi italiani.

Cosa deve fare l'app: nella revisione, poter **cambiare la data di una riga**,
e poter **spostare in blocco** un gruppo di righe di ±1 mese. Con l'anteprima
di come cambia la distribuzione per mese prima di confermare.

### 7. Righe fuori periodo che creano mesi fantasma

Una riga sola datata 31 dicembre 2025 in un estratto gennaio–maggio: crea nel
grafico dei mesi un "dicembre" da 6,56 €, che sembra un mese in cui non ho
speso niente. `importFloor()` taglia solo l'anno precedente, non i bordi.

Cosa deve fare l'app: segnalare i mesi con **pochissime righe rispetto agli
altri** ("dicembre 2025: 1 movimento — l'estratto sembra iniziare a gennaio")
e proporre di escluderli o spostarli.

### 8. Etichette diverse per la stessa cosa

Lo stipendio importato si chiamava `Pagamento da ALMAVIVA THE ITALIAN
INNOVATION COMPANY S P A`, quello inserito a mano `Stipendio`. Nella scheda
Entrate le fonti si dividono per etichetta: lo stesso stipendio compariva come
due fonti verdi diverse.

Cosa deve fare l'app: in revisione, mostrare le etichette in entrata già
esistenti in `incomes` e proporre di riusarle invece di crearne una nuova
quasi uguale.

### 9. Non si può disfare un import

Questa è la cosa che mi ha fatto più paura lavorando a mano. Il database aveva
due import diversi, entrambi con `source='import'` e `card_name = null`: li ho
potuti distinguere **solo** guardando `created_at` (11:45 del 22 agosto contro
12:02 del 23). Un utente non ha nessun modo di farlo, e non ha nessun modo di
annullare un import andato male.

Cosa deve fare l'app:
- un **identificativo di lotto** su ogni riga importata (nuova colonna, es.
  `import_batch_id`, su `payments` e `incomes`)
- da cui deriva **"Annulla questo import"**, che toglie esattamente le righe di
  quel lotto e niente altro
- e una schermata, anche minima, che elenca gli import fatti con data, file e
  numero di righe

Senza questo, tutto il resto è meno importante: un utente che sbaglia un import
e non può tornare indietro perde fiducia nell'app in un colpo solo.

---

## Cosa costruire

### La schermata di revisione

Fra l'anteprima attuale e la scrittura. Deve mostrare **tutte** le righe, non
cinque, raggruppate in sezioni che rendono l'elenco affrontabile:

1. **Da controllare** — le righe con un sospetto: trasferimenti interni,
   duplicati, movimenti verso persone. In cima, perché sono quelle che
   cambiano i totali.
2. **Per esercente** — le righe normali raggruppate per nome, con il totale di
   gruppo. Toccare il gruppo apre le azioni sull'intero gruppo.
3. **Escluse** — quelle già tolte, sempre visibili e sempre reversibili. Mai
   sparire in silenzio.

In cima, sempre visibile: **quante righe entreranno, per quanto**, distinto fra
uscite ed entrate, che si aggiorna a ogni modifica. Il conto deve tornare
sempre — righe lette = importate + escluse + già presenti.

### Le azioni su una riga

Esercente (con "applica a tutte quelle con questo nome"), categoria, data,
importo, direzione uscita/entrata, escludi/includi, collega a una persona.

La direzione va inclusa perché sbagliarla è possibile e devastante: un'uscita
letta come entrata inventa denaro.

### Le azioni su un gruppo

Escludi tutte, rinomina tutte, assegna categoria a tutte, sposta le date di
±1 mese, collega tutte a una persona.

### Le regole che si ricordano

Una tabella nuova, sul modello delle migration esistenti (commento in italiano
che spiega il perché, RLS con policy separate per select/insert/update/delete,
`to authenticated using (auth.uid() = user_id)`).

Deve tenere: un criterio sulla descrizione, e cosa farne — ignora sempre,
rinomina in X, categoria Y, è la persona Z. Applicata ai prossimi import
**come proposta già selezionata**, non come azione silenziosa: una regola
sbagliata che agisce senza dirlo è peggio del problema che risolve.

### Cosa NON fare

- Non far decidere niente a un modello linguistico. I sospetti si calcolano con
  regole deterministiche, e l'utente conferma.
- Non escludere niente in automatico. Anche il trasferimento più ovvio si
  presenta pre-selezionato ma visibile, mai già tolto.
- Non chiedere di mappare le colonne. Resta il vincolo di partenza.
- Non aggiungere un secondo posto da cui si importa: tutto dentro
  `ImportScreen`.

---

## Ordine di lavoro suggerito

1. Il bug del `null` in coda ai nomi — è un difetto vero, va chiuso subito.
2. `import_batch_id` + "Annulla questo import" — la rete di sicurezza, prima
   di dare all'utente più modi di sbagliare.
3. Il rilevamento dei sospetti (interni, duplicati, persone) senza interfaccia,
   come funzioni pure testabili in `lib/`.
4. La schermata di revisione con esclusione e modifica riga per riga.
5. Le azioni di gruppo.
6. Le regole memorizzate.

Fermati dopo il punto 2 e fammi vedere, prima di andare avanti.

`npx tsc --noEmit` pulito prima di ogni commit. Prova ogni schermata nel
simulatore prima di considerarla chiusa — il typecheck non dice se si capisce.
