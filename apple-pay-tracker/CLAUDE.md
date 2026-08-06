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
- `investment_rules` = i **piani di accumulo** (schermata PAC). Il ciclo è
  interamente automatico e **non richiede mai un import**:
  1. `materialize_investments()` (cron 05:00 UTC) inserisce la rata il giorno
     stabilito come `status='estimated'`, datata **alle 10:00 ora italiana**.
     L'orario è scritto come `at time zone 'Europe/Rome'` e non come un orario
     UTC fisso: altrimenti a ogni cambio di ora legale l'acquisto slitterebbe
     di un'ora, e con un prezzo intraday quello slittamento si vedrebbe.
  2. La Edge Function `settle-instalments` (cron 09:00 e 20:00 UTC) cerca la
     **quotazione intraday di quell'istante** (Yahoo `interval=5m`), calcola
     `quote = importo / prezzo` e porta la rata a `settled`.
  Prende la prima quotazione **da quel momento in poi**, mai una precedente: se
  la rata cade a mercato chiuso il broker compra alla riapertura, e un prezzo
  anteriore sarebbe uno a cui in quel momento non si poteva più comprare. Se
  non c'è ancora nulla la rata resta in attesa e ci si riprova, invece di
  ripiegare su un prezzo che non c'entra — è il caso di `CHPX.MI`, così poco
  scambiato che certi giorni la prima quotazione arriva nel pomeriggio.
  Scarto misurato sulle operazioni vere del 3 agosto: −0,07% ECPI, −0,45% AI
  Semi, −0,52% S&P, −2,78% Solana.
  I fondi private market seguono una strada diversa e più semplice: non
  aspettano nessuna quotazione, entrano `settled` da subito con l'ultimo NAV
  conosciuto in quel momento (vedi sotto). Lasciarli `estimated` — cioè fuori
  da "investito questo mese" e da ogni somma che filtra sugli acquisti — dava
  la sensazione di "500 diventano 450" senza un motivo leggibile.
- L'import dell'estratto conto resta possibile ma **facoltativo**: il trigger
  `drop_superseded_estimates` cancella la rata calcolata di quel mese per quel
  asset appena ne arriva una con `source='import'`. Guarda `source='recurring'`
  e non lo stato, altrimenti lascerebbe doppioni sulle rate già completate.
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
- Tutto ciò che non è `status='settled'` è denaro uscito dal conto e non
  ancora diventato quote: resta solo `estimated` (rata di un piano su un
  asset a prezzo pubblico, in attesa della quotazione intraday) ed è
  transitorio — si risolve entro la giornata. `pending` esiste ancora nello
  schema ma non dovrebbe più comparire in pratica: prima segnava anche i
  fondi private market in attesa dell'esecuzione del broker, ora quelli
  entrano `settled` da subito (vedi sotto). Quel denaro **conta nel valore**
  al suo costo — è uscito dal conto, come fa anche Trade Republic — ma **non
  nel rendimento**, perché il prezzo non si sa ancora e diluirebbe la
  percentuale verso lo zero. Da qui la coppia `investedBasis` (solo le quote)
  / `costBasis` (quote + non eseguito). Nel codice il discriminante è sempre
  `status !== "settled"`, mai un elenco dei due valori.
- **I fondi private market (Apollo, EQT) non aspettano un prezzo del broker**:
  ogni rata entra `settled` da subito, usando l'ultimo NAV noto in quel
  momento (`asset_prices` più recente con `on_date <= data_rata`). Non è
  un'approssimazione a caso: è l'unico dato onesto disponibile finché non ne
  arriva uno più recente, e il valore si muove in avanti da lì. Verificato
  che **nessuna fonte automatica esiste** per questi due ELTIF (Yahoo non li
  conosce, eltif.info non pubblica un NAV nell'HTML, l'unico endpoint
  raggiungibile di FundConnect è un PDF il cui contenuto per questi ISIN è un
  template vuoto — testato scaricando ed estraendo il testo del PDF davvero,
  non per sentito dire). Per questo l'aggiornamento è manuale: dal dettaglio
  dell'asset (bottone "Aggiorna valore") si digita il **valore totale della
  posizione così come lo mostra Trade Republic** — mai un prezzo per quota,
  che TR non mostra per questi fondi — e il codice lo divide per le quote già
  possedute per ricavare il prezzo unitario da salvare in `asset_prices`
  (`source='manual'`). Oltre `MANUAL_PRICE_STALE_DAYS` (35, preso dal ritmo
  reale dei NAV storici ~28-35gg) un promemoria compare sia nel dettaglio
  dell'asset sia in cima a Investimenti.
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
- `portfolio_daily(p_asset, p_group)` e `latest_asset_prices()` sono RPC: la
  serie giornaliera si calcola nel database perché ricostruirla sul telefono
  vorrebbe dire scaricare ~1700 righe di prezzi a ogni apertura. Il filtro per
  gruppo serve ai grafici delle sezioni, che si caricano solo quando la
  sezione viene aperta (`usePortfolioSeries(null)` non interroga niente).
  **Attenzione a `create or replace` quando cambia la firma**: se la nuova
  versione ha parametri diversi da quella vecchia, `create or replace` crea
  un secondo overload invece di sostituirla, e se entrambe sono chiamabili a
  zero argomenti la scelta fra le due è ambigua per PostgREST (va a volte sì
  a volte no, secondo la cache dello schema). Successo con `portfolio_daily`
  fra la 0021 e la 0024: prima di aggiungere un parametro con default a una
  funzione esistente, droppare la firma vecchia nella stessa migrazione.
- `periodPriceGain()` (lib/portfolio.ts) isola il guadagno di prezzo fra due
  punti di una serie, al netto dei versamenti fatti nel mezzo — altrimenti un
  mese in cui è entrata una rata sembrerebbe sempre "in guadagno" anche a
  prezzi fermi. Le sezioni per gruppo la usano per far seguire alla
  percentuale in testa il periodo scelto nel grafico (1M/6M/1A/Tutto, e lo
  scrub) invece di mostrare sempre il totale, che senza il grafico sotto non
  avrebbe più senso.
- La sezione ha tre schermate figlie: `AnalysisScreen` (ripartizione, anello
  grande e lista sotto), `PacScreen` (piani di accumulo) e
  `AssetDetailScreen`. Le sezioni per gruppo sono **chiuse di default**: con
  quattro gruppi aperti la schermata diventa un muro da scorrere, e il saldo
  di ciascuno è già nell'intestazione.
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
