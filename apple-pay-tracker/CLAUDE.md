# Apple Pay Tracker

Tracker di spese personale per iOS. App Expo/React Native + backend Supabase.
Uso privato di Andrea, niente App Store per ora — si distribuisce con EAS
Update dentro Expo Go (vedi sotto), niente Apple Developer Program.

## Stack

- **Expo SDK 54**, React Native, TypeScript, nessun modulo nativo custom
  (deve restare compatibile con Expo Go)
- **Supabase**: Postgres + Row Level Security + Edge Function + pg_cron
  - project ref: `wcmxwhmiexhhbqvadbig`
- `react-native-svg` per tutti i grafici (BarChart, TrendChart, CategoryDonut,
  ScrubChart), nessuna libreria di charting esterna
- `lucide-react-native` per le icone
- Niente `react-native-gesture-handler`/`reanimated`: drag & drop e gesti
  (riordino categorie, swipe periodo in Statistiche, ghiera mesi, lettura al
  tocco del grafico investimenti) sono fatti a mano con `PanResponder` +
  `Animated` di React Native core, per restare dentro ai moduli già inclusi in
  Expo Go. Il mese in Home si cambia con un selettore a foglio
  (`MonthYearPicker`, apertura al tocco), non più a swipe; in Statistiche il
  periodo si cambia sia con le frecce sia con lo swipe
- Schede in basso: Home, Spese, Statistiche, Investimenti. **Impostazioni non
  è una scheda**: ci si arriva dall'ingranaggio in alto a destra in Home
  (`useNav().openSettings`), perché le schede sono destinazioni che si
  guardano, non si configurano

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
  cron. **Disattivate**: da quando lo storico investimenti arriva
  dall'estratto conto di Trade Republic, una regola che genera la rata
  stimata duplicherebbe l'operazione vera del prossimo import.
- `incomes` è **sempre manuale**: stipendio e ricavi variano ogni volta,
  una regola ricorrente darebbe quasi sempre il numero sbagliato.
- "Risparmiato" (Home → Bilancio del mese) = Introiti − Spese − Investimenti:
  quello che resta sul conto senza essere né speso né investito.
### Portafoglio investimenti

- `assets` = cosa si possiede (nome, gruppo `conto_titoli`/`crypto`/
  `private_market`, ISIN, come recuperarne il prezzo). Prima l'asset era testo
  libero nel campo `investments.label` e si era gia' rotto da solo: gli
  acquisti manuali dicevano "Apollo PM", le regole "Apollo", e per il database
  erano due cose diverse.
- `investments` è un **registro di operazioni**, non solo di versamenti:
  `kind` vale `buy`/`sell`/`dividend` e porta la direzione del denaro, mentre
  `amount` resta sempre positivo. Ogni query che voglia dire "quanto ho
  investito" deve filtrare `kind='buy' and status='settled'` — succede in
  Home (Risparmiato) e in Statistiche.
- `status='pending'` = ordine addebitato ma non ancora eseguito. Sui fondi
  private market fra addebito e assegnazione delle quote passano ~2 settimane.
  Quel denaro **conta nel valore** (al suo costo: è uscito dal conto, come fa
  anche Trade Republic) ma **non nel rendimento**, perché non si è ancora
  mosso e diluirebbe la percentuale verso lo zero. Da qui la coppia
  `investedBasis` (solo le quote) / `costBasis` (quote + in esecuzione).
- Due rendimenti, entrambi corretti e non intercambiabili: `priceGainPct` è
  il solo movimento del prezzo, lo stesso numero che mostra il broker, ed è
  quello negli elenchi perché è ciò che Andrea confronta; `gainPct` include i
  dividendi incassati e compare nel dettaglio. Su un titolo che distribuisce
  divergono parecchio (l'iBonds fa −0,27% di prezzo e +3,4% di totale).
- `asset_prices.close_eur` è **sempre in euro**, già convertito a monte.
  Mescolare valute qui sarebbe un errore silenzioso: i numeri resterebbero
  plausibili ma sbagliati del 15%.
- La Edge Function `sync-prices` (pg_cron ogni sera) riempie `asset_prices` da
  Yahoo Finance, convertendo con i cambi storici di frankfurter.app quando la
  quotazione non è in euro. **Si valida da sola**: confronta i prezzi scaricati
  con quelli delle esecuzioni reali (`source='fill'`) e, se lo scarto mediano
  supera la soglia, non scrive niente. Serve davvero — esistono quotazioni che
  dichiarano una valuta e ne servono un'altra (`CBU8.DE` dice EUR e restituisce
  storico in USD). Si guarda la *mediana* e non il massimo perché un ordine
  eseguito a metà giornata su un asset volatile può distare parecchio dalla
  chiusura senza che nulla sia rotto.
- Per i private market il NAV arriva **gratis dalle proprie esecuzioni**: il
  prezzo a cui il fondo esegue l'ordine mensile è il suo valore di quel giorno
  (`asset_prices.source='fill'`). Fra un'esecuzione e l'altra il grafico resta
  fermo invece di interpolare.
- `portfolio_daily(p_asset)` e `latest_asset_prices()` sono RPC: la serie
  giornaliera si calcola nel database perché ricostruirla sul telefono
  vorrebbe dire scaricare ~1700 righe di prezzi a ogni apertura.
- Lo storico viene dall'**esportazione operazioni di Trade Republic** (CSV con
  data, ISIN, quote, prezzo). `investments.external_id` tiene l'id operazione
  del broker, così si può riesportare e reimportare senza duplicare.
- `DetailTarget.month` (screens/DetailScreen.tsx) porta il mese da cui si
  apre il dettaglio di categoria/esercente, cosi' il grafico si posiziona li'
  invece che sull'ultimo mese: ogni nuovo punto d'ingresso a `openDetail`
  dovrebbe passarlo, quando un mese di riferimento esiste davvero.
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
