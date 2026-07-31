# Apple Pay Tracker

Tracker di spese personale per iOS. App Expo/React Native + backend Supabase.
Uso privato di Andrea, niente App Store per ora — si distribuisce con EAS
Update dentro Expo Go (vedi sotto), niente Apple Developer Program.

## Stack

- **Expo SDK 54**, React Native, TypeScript, nessun modulo nativo custom
  (deve restare compatibile con Expo Go)
- **Supabase**: Postgres + Row Level Security + Edge Function + pg_cron
  - project ref: `wcmxwhmiexhhbqvadbig`
- `react-native-svg` per tutti i grafici (BarChart, TrendChart, CategoryDonut),
  nessuna libreria di charting esterna
- `lucide-react-native` per le icone
- Niente `react-native-gesture-handler`/`reanimated`: drag & drop e gesti
  (riordino categorie, swipe mese in Home, ghiera mesi) sono fatti a mano con
  `PanResponder` + `Animated` di React Native core, per restare dentro ai
  moduli già inclusi in Expo Go

## Design system

Ispirato al design system di Anthropic/Claude: fondo caldo, un solo colore
d'accento, pesi tipografici bassi (mai oltre 600). Convenzioni imposte
esplicitamente da Andrea, da rispettare in ogni nuova schermata:

- **Niente riquadri/bordi decorativi** per informazioni semplici (righe di
  dettaglio, statistiche). I bordi si usano solo dove delimitano davvero
  qualcosa di interattivo o un elenco lungo.
- Le **modali** (`components/Sheet.tsx`) partono dal basso, salgono sopra la
  tastiera (`KeyboardAvoidingView`), e hanno sempre un tasto "Indietro" —
  mai solo "tocca fuori per chiudere".
- Categorie, persone e metodi di pagamento si possono **creare al volo**
  da qualunque selettore (chip "+"), non solo dalle rispettive schermate in
  Impostazioni.
- I grafici mostrano sempre valori di riferimento sugli assi, non solo le
  barre/linee nude.

## Concetti chiave del dominio

- `payments` = spese. `card_name` = metodo di pagamento (nome carta o
  "Contanti"), non necessariamente collegato a una vera integrazione Wallet.
- `excluded_from_stats` (su `payments` e `merchants`) esclude dalle
  **classifiche** ("dove spendo di più") ma mai dai **totali** — mutuo e
  rate sono spese vere. Il toggle "escludi costi fissi" in Statistiche
  rende questa esclusione una scelta invece che un comportamento fisso.
- `recurring_rules` → `materialize_recurring()` genera le spese ricorrenti
  ogni notte via pg_cron (mutuo, abbonamenti).
- `investment_rules` → `materialize_investments()`, stessa logica, stesso
  cron, ma per gli investimenti (piani di accumulo).
- `incomes` è **sempre manuale**: stipendio e ricavi variano ogni volta,
  una regola ricorrente darebbe quasi sempre il numero sbagliato.
- "Risparmiato" (Home → Bilancio del mese) = Introiti − Spese − Investimenti:
  quello che resta sul conto senza essere né speso né investito.
- L'ingestione da Apple Pay passa da una **Shortcut iOS** (trigger
  "Wallet"/"Transazione") che chiama l'Edge Function `ingest-payment` con un
  token per-utente (Impostazioni → Automazioni). Scatta sia per pagamenti
  fisici NFC sia per acquisti online con Apple Pay, non per bonifici/addebiti
  diretti su carte non aggiunte a Wallet.
- `payments.source` = come è entrata la spesa: `shortcut` (automazione
  Wallet), `shortcut_manual` (Comando Rapido lanciato a mano per acquisti
  in-app/online che il trigger Wallet non vede), `siri`, `manual`,
  `recurring`. La Edge Function accetta anche le etichette leggibili
  ("Apple Pay manuale", "Inserito manualmente") così il Comando Rapido può
  passare direttamente la voce di uno *Scegli da elenco*. Ogni valore nuovo
  va aggiunto in tre punti: `ALLOWED_SOURCES` nella function, e i
  `SOURCE_LABEL`/`SOURCE_ICON` di StatsScreen e TransactionDetailScreen.

## Git e pubblicazione

- Repo: `MrEzekyel/andreadecaro`, branch di lavoro:
  `claude/apple-pay-payment-tracker-6o1dxc`
- Prima di ogni commit: `git fetch origin claude/apple-pay-payment-tracker-6o1dxc`
  e controllare se il branch remoto è avanti (Andrea a volte pusha lui
  stesso da PC/Mac — se càpita un conflitto, allinearsi con un merge invece
  di sovrascrivere).
- Dopo ogni modifica: `npx tsc --noEmit` deve passare pulito prima del commit.
- Non serve mai chiedere conferma per commit/push su questo branch: fa
  parte del flusso normale di lavoro qui.

### Il messaggio da dare ad Andrea a fine turno

Andrea lavora da un PC/Mac separato da questa sessione: il codice non arriva
sul suo dispositivo finché non fa lui `git pull` + `eas update`. **Ogni
volta** che si pusha una modifica visibile nell'app, chiudere la risposta
con:

```bash
git pull origin claude/apple-pay-payment-tracker-6o1dxc
npx eas-cli update --branch production --message "<breve descrizione della modifica>"
```

seguito da: "Poi chiudi e riapri Expo Go."

Se il `git pull` desse conflitti (è già successo: Andrea a volte modifica
`app.json` o altri file in locale), guidarlo a controllare `git status` e
eventualmente scartare le modifiche locali superate invece di lasciare i
marcatori di conflitto (`<<<<<<<`) nel file — è già successo che
finissero committati per sbaglio.

## Xcode / Simulatore iOS (in corso)

Andrea ha Xcode in installazione sul Mac per usare la beta di Claude Code
desktop (build + simulatore iOS in sessione, solo macOS). Questa sessione
remota non è quella: il simulatore si usa da una sessione locale di Claude
Code sul suo Mac, puntata al clone locale del repo.
