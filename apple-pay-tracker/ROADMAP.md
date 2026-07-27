# Roadmap funzionalità

Traduzione delle funzionalità richieste in modello dati e fasi di sviluppo.

---

## Modello dati: cosa cambia

Lo schema attuale regge la registrazione automatica, ma non basta per quello
che hai chiesto. Tre cambiamenti strutturali:

### 1. `category` da testo libero a tabella

Oggi `payments.category` è una stringa. Serve una tabella vera, perché vuoi
poter **creare categorie tue** e perché il design Revolut ha bisogno di un
**colore e un'icona per categoria**.

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
4. fallback `Da categorizzare`

### 3. Import: separare "quanto ho pagato" da "quanto mi compete"

Per le spese divise servono due importi distinti su ogni transazione:
`amount` (quanto è uscito dal conto) e `my_share` (quanto compete a te). Le
statistiche useranno `my_share`, non `amount` — altrimenti una cena divisa in
4 ti gonfia il mese.

---

## Fase 1 — Fondamenta + editing transazioni

> Sblocca tutto il resto. Da fare per prima.

- [ ] Tabella `categories` + categorie di default per utente alla registrazione
- [ ] Tabella `merchants` + collegamento da `payments`
- [ ] Migrazione `payments.category` (testo) → `category_id`
- [ ] **Modifica transazione**: categoria, importo, data, esercente, note
- [ ] **Elimina transazione**
- [ ] **Aggiunta manuale** di una transazione
- [ ] **Categorie personalizzate**: crea, rinomina, colore, icona, elimina
- [ ] Al cambio categoria, chiedere:
  - *"Applicare anche alle altre N transazioni di «Esselunga»?"* → update massivo
  - *"Ricordare per i pagamenti futuri?"* → scrive `merchants.category_id`

Le due domande sono indipendenti (posso volere una e non l'altra), quindi due
checkbox in un unico foglio modale, non due alert in fila.

## Fase 2 — Design Revolut + statistiche

> Da fare subito dopo la Fase 1, prima di aggiungere altre schermate: rifare
> il design dopo costa il triplo.

- [ ] Design system: palette, tipografia, card, spaziature (vedi sezione Design)
- [ ] **Vista mensile**: un mese per schermata, swipe per cambiare mese, con
      tutte le spese e le statistiche di quel mese soltanto
- [ ] **Line chart** andamento spese (giornaliero nel mese, mensile nell'anno)
- [ ] **Donut chart** ripartizione per categoria, con percentuali
- [ ] **Dettaglio categoria**: tutte le transazioni di quella categoria
- [ ] **Dettaglio esercente**: totale speso, numero transazioni, storico,
      andamento nel tempo
- [ ] Toggle settimana / mese / anno

## Fase 3 — Limiti di spesa

- [ ] Tabella `spending_limits` (periodo, importo, categoria opzionale,
      soglia di preavviso in %)
- [ ] Limite **totale** e limite **per categoria**, settimanale o mensile
- [ ] Linea di riferimento nei grafici (grigia, semi-trasparente)
- [ ] Barra di avanzamento "speso / limite" che cambia colore avvicinandosi
- [ ] Notifica alla soglia di preavviso (es. 80%) e al 100%
- [ ] Anti-spam: una sola notifica per soglia per periodo (tabella
      `limit_notifications`)

> ⚠️ Le notifiche push richiedono una **development build** — vedi punto 7 di
> `DA-FARE.md`. Se preferisci rimandare, in Fase 3 mostro gli avvisi solo
> dentro l'app e le push le agganciamo dopo.

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

Minimal ma colorato, riferimento Revolut. In concreto significa:

- **Sfondo neutro**, quasi bianco (o quasi nero in dark mode). Il colore non
  sta mai nello sfondo.
- **Il colore arriva dalle categorie**: ogni categoria ha un suo colore, che
  compare nel pallino dell'icona, negli archi del donut, nelle barre. È lì che
  l'app diventa colorata.
- **Numeri grandi e grassi**: il totale del mese è l'elemento dominante della
  schermata, tipograficamente enorme.
- **Card con angoli molto arrotondati** (16–20px), ombre appena accennate.
- **Nessun bordo dove basta lo spazio bianco.**
- **Icona circolare colorata** a sinistra di ogni transazione, importo a destra
  allineato, esercente in grassetto e categoria in grigio sotto.
- **Grafici puliti**: niente griglie pesanti, assi ridotti al minimo, line chart
  con riempimento a gradiente sotto la curva.

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
- **Spese** — elenco completo, ricercabile e filtrabile, raggruppato per giorno
- **( + )** — aggiunta manuale rapida
- **Statistiche** — grafici, confronto tra mesi, dettagli per categoria e
  esercente
- **Impostazioni** — categorie, limiti, ricorrenti, persone, token

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
