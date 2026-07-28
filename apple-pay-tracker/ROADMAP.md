# Roadmap funzionalità

Traduzione delle funzionalità richieste in modello dati e fasi di sviluppo.

---

## Modello dati: cosa cambia

Lo schema attuale regge la registrazione automatica, ma non basta per quello
che hai chiesto. Tre cambiamenti strutturali:

### 1. `category` da testo libero a tabella

Oggi `payments.category` è una stringa. Serve una tabella vera, perché vuoi
poter **creare categorie tue** e perché il design ha bisogno di un **colore e
un'icona per categoria**.

```sql
categories (
  id, user_id, name, color, icon, is_system, sort_order
)
payments.category_id → categories.id
```

Alla registrazione ogni utente riceve una copia delle categorie predefinite,
che può poi rinominare, ricolorare o eliminare. Migrazione indolore: ci sono
0 pagamenti a oggi.

### 2. Nuova tabella `merchants`

Serve per due tue richieste: *"vedere il totale speso e tutte le transazioni
di un singolo esercente"* e *"ricordare la scelta in futuro"*.

```sql
merchants (
  id, user_id, normalized_name, display_name, category_id
)
payments.merchant_id → merchants.id
```

`merchants.category_id` **è** il meccanismo di "ricorda la scelta": quando
correggi la categoria di una transazione e scegli "ricorda", scrivo lì. Da
quel momento la Edge Function trova l'esercente già mappato e non deve più
indovinare.

Ordine di risoluzione della categoria diventa:

1. `merchants.category_id` — l'esercente è già noto → **certo**
2. `merchant_categories` — le tue regole keyword → **quasi certo**
3. `default_merchant_categories` — le 96 regole predefinite → **ipotesi**
4. `NULL` — resta da categorizzare

"Da categorizzare" non è una categoria vera ma l'assenza di categoria, quindi è
rappresentata da `NULL` e non da una riga: due rappresentazioni della stessa
cosa si sarebbero disallineate al primo rinomina.

### 3. Import: separare "quanto ho pagato" da "quanto mi compete"

Per le spese divise servono due importi distinti su ogni transazione:
`amount` (quanto è uscito dal conto) e `my_share` (quanto compete a te). Le
statistiche useranno `my_share`, non `amount` — altrimenti una cena divisa in
4 ti gonfia il mese.

---

## Fase 1 — Fondamenta + editing transazioni ✅

> Completata. Migrazioni 0005–0008 applicate, Edge Function v3, app aggiornata.

- [x] Tabella `categories` + categorie di default per utente alla registrazione
- [x] Tabella `merchants` + collegamento da `payments`
- [x] Migrazione `payments.category` (testo) → `category_id`
- [x] **Modifica transazione**: categoria, importo, data, esercente, note
- [x] **Elimina transazione**
- [x] **Aggiunta manuale** di una transazione
- [x] **Categorie personalizzate**: crea, rinomina, colore, icona, elimina
- [x] Al cambio categoria, chiedere:
  - *"Applicare anche alle altre N transazioni di «Esselunga»?"* → update massivo
  - *"Ricordare per i pagamenti futuri?"* → scrive `merchants.category_id`

Le due domande sono indipendenti (posso volere una e non l'altra), quindi due
checkbox in un unico foglio modale, non due alert in fila.

## Fase 2 — Statistiche complete

> Il design system è già applicato a tutte le schermate esistenti (Fase 1).
> Qui restano le viste analitiche.

- [x] Design system: palette, tipografia, card, spaziature (vedi sezione Design)
- [x] Line chart andamento cumulato del mese
- [x] Ripartizione per categoria con percentuali
- [ ] **Vista mensile**: un mese per schermata, swipe per cambiare mese, con
      tutte le spese e le statistiche di quel mese soltanto
- [ ] **Donut chart** al posto delle barre nella ripartizione
- [ ] **Confronto tra mesi** a barre, con media
- [ ] **Dettaglio categoria**: tutte le transazioni di quella categoria
- [ ] **Dettaglio esercente**: totale speso, numero transazioni, storico,
      andamento nel tempo
- [ ] Toggle settimana / mese / anno

## Fase 3 — Limiti di spesa ✅ (avvisi in-app)

> Completata nella parte in-app. Le notifiche push restano da agganciare:
> i limiti e le soglie sono già lì, serve solo il canale di consegna.

- [x] Tabella `spending_limits` (periodo, importo, categoria opzionale,
      soglia di preavviso in %)
- [x] Limite **totale** e limite **per categoria**, settimanale o mensile
- [x] Linea di riferimento nel grafico (grigia tratteggiata, semi-trasparente)
- [x] Barra di avanzamento "speso / limite" che cambia colore avvicinandosi
- [x] Avviso in-app alla soglia di preavviso e al superamento
- [ ] **Notifiche push** alla soglia e al 100% *(rimandate)*
- [ ] Anti-spam: una sola notifica per soglia per periodo (tabella
      `limit_notifications`) — serve solo con le push

Note di implementazione:

- La settimana comincia **lunedì**, non domenica.
- I limiti si valutano sempre sul **periodo corrente**: sfogliando un mese
  passato la Home non li mostra, perché sarebbe un confronto privo di senso.
- La scala verticale del grafico include il limite, così la sua linea non
  finisce mai fuori dall'area disegnata anche quando hai speso molto meno.
- Verde / ambra / rosso sono riservati all'avanzamento sui limiti e non
  vengono mai riusati come colore di una categoria.

> ⚠️ Le notifiche push richiedono una **development build** — vedi punto 7 di
> `DA-FARE.md`.

## Fase 4 — Transazioni ricorrenti + Siri

- [ ] Tabella `recurring_rules` (etichetta, importo, categoria, frequenza,
      giorno, data inizio/fine, prossima esecuzione)
- [ ] Job schedulato (pg_cron) che materializza le transazioni dovute
- [ ] Schermata gestione ricorrenti: crea, sospendi, modifica, elimina
- [ ] Le ricorrenti generate sono marcate `source = 'recurring'` e restano
      modificabili come le altre
- [ ] **Shortcut Siri** "Aggiungi spesa": chiede importo ed esercente a voce e
      chiama la stessa Edge Function con `source = 'siri'`

Sul punto Siri: non serve integrazione nativa. Un Comando Rapido con "Chiedi
input" e frase di attivazione personalizzata ("Ehi Siri, aggiungi spesa") fa
esattamente la stessa cosa senza codice iOS nativo. Se poi vorremo la
trascrizione libera ("ho speso 12 euro dal fruttivendolo"), aggiungiamo un
parser sul server.

Con il trigger Transazione che copre Apple Pay, l'inserimento a voce serve per
quello che Apple Pay non vede: contanti, bonifici, pagamenti con carta fisica.

## Nota sull'ingestione automatica

L'assunto iniziale era "una Shortcut si attiva sulla **notifica** di Wallet".
Quel trigger non esiste — iOS non consente di leggere le notifiche di altre
app. Ma esiste qualcosa di meglio: il trigger **Transazione** (rinominato
**Wallet** da iOS 26), che riceve la transazione come input **gia'
strutturata**.

Conseguenza pratica: **niente espressioni regolari**. `Esercente` e `Importo`
arrivano come variabili tipizzate, quindi non c'e' nessun formato di notifica
da interpretare e nessuna fragilita' legata alla banca.

Resta un limite: la transazione Wallet non espone l'**MCC** (il codice
categoria del commerciante), quindi la categorizzazione continua a basarsi sul
nome esercente. Per avere l'MCC servirebbe un collegamento Open Banking.

Da tenere d'occhio: il trigger ha avuto
[problemi di timeout](https://developer.apple.com/forums/thread/765516)
segnalati su alcune versioni di iOS.

## Fase 5 — Spese divise

- [ ] Tabella `people` (i tuoi contatti ricorrenti: Leonardo, Marco, …)
- [ ] Tabella `payment_splits` (persona, tipo quota, valore, importo dovuto,
      saldato sì/no, data saldo)
- [ ] Tre modalità di divisione: **equa** (n persone), **percentuale**,
      **importo esatto**
- [ ] Calcolo automatico di `my_share` sulla transazione
- [ ] Schermata "Mi devono": elenco crediti aperti per persona
- [ ] Segna come saldato (totale o parziale)
- [ ] Promemoria automatico dopo N giorni: *"Leonardo non ti ha ancora pagato
      12,50 € per Ristorante Da Mario"*
- [ ] Statistiche calcolate su `my_share`, non su `amount`

---

## Design

### Direzione

Design system ripreso da quello di **Anthropic / Claude**, con la palette delle
categorie a portare il colore.

I caratteri originali sono **Styrene B** (sans) e **Tiempos Text** (serif),
entrambi commerciali e su licenza Anthropic: non sono ridistribuibili dentro
l'app. Gli stack tipografici li dichiarano per primi, quindi se un giorno
vengono licenziati e caricati con `expo-font` subentrano da soli senza toccare
il codice. Nel frattempo si usano ripieghi di sistema dalle proporzioni simili.

Il tratto distintivo del sistema, però, non sono i font — è la **misura**:

- **Pesi bassi anche a corpo grande.** Il totale del mese è 42px di peso 500,
  non 800. La scala fa il lavoro, non il grassetto. Nessun testo supera il 600.
- **Fondo caldo, mai bianco puro.** Crema `#F0EEE6` in chiaro, nero caldo
  `#141413` in scuro.
- **Un solo accento**, argilla (`#C2613F` chiaro / `#D97757` scuro), riservato
  agli elementi interattivi. Non compare mai come colore di un dato.
- **Raggi contenuti**: 14px le card, 10px campi e pulsanti. Il sistema Anthropic
  non è morbido.
- **Crenatura quasi neutra**, mai le spaziature strette da titolo pubblicitario.
- **Il colore arriva dalle categorie**: pallino dell'icona, barre, archi. È lì
  che l'app diventa colorata senza diventare chiassosa.

### Icone

**Lucide** (licenza MIT, `lucide-react-native`): ~1500 icone su griglia 24px.
Scelta per lo **spessore del tratto regolabile**, impostato a 1,75 per restare
coerente con i pesi tipografici — con una libreria a spessore fisso le icone
avrebbero pesato più del testo accanto.

Le icone si risolvono per nome a runtime (`categories.icon` contiene lo slug),
quindi una categoria creata da te può scegliere la propria icona senza che
serva ricompilare nulla.

### Palette categorie

| Categoria | Colore |
| --- | --- |
| Spesa | verde |
| Trasporti | blu |
| Ristorazione | arancione |
| Viaggi | ciano |
| Shopping | magenta |
| Salute | rosso |
| Casa | viola |
| Utenze | ambra |
| Abbonamenti | indaco |
| Cultura | teal |
| Sport | lime |
| Da categorizzare | grigio |

I valori esatti sono nel mockup. Sono scelti per restare distinguibili anche
per chi ha difficoltà a percepire alcuni colori, e per funzionare sia su sfondo
chiaro che scuro.

### Struttura di navigazione

Passiamo da 3 a 4 tab, con il pulsante di aggiunta al centro:

```
[ Home ]  [ Spese ]  ( + )  [ Statistiche ]  [ Impostazioni ]
```

- **Home** — mese corrente: totale grande, avanzamento sul limite, ultime
  transazioni, ripartizione rapida
- **Spese** — elenco completo raggruppato per giorno, con totale giornaliero
- **( + )** — aggiunta manuale rapida
- **Statistiche** — grafici, confronto tra mesi, dettagli per categoria e
  esercente
- **Impostazioni** — tema, categorie, limiti, ricorrenti, persone, token

Il **tema** si sceglie qui: chiaro, scuro o Sistema (predefinito, segue il
telefono). La preferenza è salvata sul dispositivo.

---

## Ordine consigliato

L'ordine sopra non è casuale:

1. **Fase 1 prima di tutto** perché ogni altra funzionalità tocca categorie o
   esercenti. Farla dopo significa rifare le migrazioni.
2. **Fase 2 subito dopo** perché ridisegnare schermate già scritte costa più
   che scriverle bene la prima volta.
3. **Fase 3 prima della 5** perché i limiti sono semplici e ti danno subito
   valore quotidiano, mentre le spese divise sono la parte più complessa
   (modello dati, promemoria, saldi parziali).
