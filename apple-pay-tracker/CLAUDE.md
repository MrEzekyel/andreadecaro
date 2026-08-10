# Apple Pay Tracker

Tracker di spese personale per iOS. App Expo/React Native + backend Supabase.
Distribuzione oggi via EAS Update dentro Expo Go; con il modello di business
deciso (vedi "Abbonamento e referral" sotto) l'Apple Developer Program e il
passaggio a una build nativa non sono più rimandabili — vedi `DA-FARE.md`.

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
- **Uno stato vuoto non deve mai poter significare "non ho letto".** Il modo
  naturale di scrivere una lettura da Supabase (`if (data) setX(data)`) tratta
  l'errore come un elenco vuoto, e in un'app di spese questo non produce una
  schermata vuota ma una frase falsa sui soldi: "Nessuna spesa in questo mese"
  quando la verità è che non siamo riusciti a chiedere. Si usano
  `firstError()` (lib/loadError.ts) e `<LoadError>`, **al posto** del
  contenuto e mai accanto — un totale a 0,00 con sopra un avviso resta un
  totale a 0,00, e l'occhio legge prima il numero. Dove i dati precedenti
  esistono ancora si tengono e l'avviso va sopra (`variant="inline"`): sono
  vecchi, non falsi. Dove non c'è mai stato niente, l'errore prende tutta la
  schermata. **Il numero grande sparisce**: nascondere un totale è onesto,
  affermare `0,00 €` no.
- La regola vale anche **in scrittura**, ed è lì che costa di più: una lettura
  fallita non deve poter diventare la base di un `update`/`delete`. In
  `EditPaymentSheet` le quote non lette bloccano la riscrittura della
  divisione (`splitUnknown` → `riscriviQuote`), perché altrimenti salvare
  anche solo una nota cancellerebbe le quote vere, riportando
  `effective_amount` all'intero pagato: una cena da 80 € divisa in quattro
  rientrerebbe nel mese per 80 invece che per 20. È l'unico caso in cui il
  difetto **aumenta** le spese in silenzio.
- Un dato calcolato su un periodo va nascosto, non sostituito col totale di
  sempre: `usePortfolioSeries` restituisce `{ series, failed }` proprio perché
  una percentuale vera ma riferita a un altro arco di tempo è più insidiosa di
  uno zero — è plausibile.
- I **grafici su un periodo in corso** (andamento mensile in Home e in
  Statistiche) disegnano l'asse su **tutto** il periodo — 28/30/31 giorni
  secondo il mese — e la linea si interrompe dov'è oggi. `TrendPoint.value`
  vale `null` per i periodi non ancora arrivati, e vanno passati lo stesso:
  sono loro a dare al grafico la larghezza vera. Senza, i giorni trascorsi si
  stiracchiano su tutta la larghezza e il 7 del mese sembra già la fine.
  Quando c'è un limite, `TrendChart` disegna anche una **retta di ritmo**
  (punteggiata, dal primo giorno all'ultimo al limite): è il riferimento
  "spendendo lo stesso ogni giorno arriveresti qui", fisso su tutto il
  periodo e non solo sui giorni già trascorsi. Parte da `baseline` e non
  sempre da zero: quando la linea vera include i costi fissi fin dal primo
  giorno (Home sempre, Statistiche col toggle spento), anche il ritmo deve
  partire da lì — confrontare un ritmo che parte da zero con una linea che
  parte già più in alto farebbe sembrare l'utente sempre indietro rispetto a
  un riferimento che non descrive la sua situazione vera.
- Quando più numeri sono legati fra loro, mostrare la **relazione** invece
  dell'elenco: `ValueSplit` disegna valore = capitale + guadagno come una
  barra composta, perché tre righe di testo lasciano al lettore il lavoro di
  capire che il primo è la somma degli altri due. `StatTiles` affianca i
  numeri secondari in riquadri: un elenco verticale di coppie
  etichetta-valore si legge tutto o niente e nessun numero emerge.

## Concetti chiave del dominio

- `payments` = spese. `card_name` = metodo di pagamento (nome carta o
  "Contanti"), non necessariamente collegato a una vera integrazione Wallet.
- **`payments.amount` è sempre in euro.** È la scelta portante della
  multi-valuta: `original_amount`/`original_currency`/`fx_rate` sono
  informazione *in più*, mai un sostituto. Se `amount` diventasse polimorfo
  ogni somma dell'app — totali, limiti, classifiche, risparmi, export —
  mescolerebbe valute diverse restituendo numeri plausibili e falsi, la stessa
  classe di errore già vista su `CBU8.DE`.
- `ingest-payment` riconosce la valuta dalla stringa formattata che manda la
  Shortcut (`detectCurrency`) e converte al **cambio del giorno della spesa**,
  non a quello di adesso: altrimenti una spesa di sei mesi fa cambierebbe
  valore a ogni apertura e il totale di un mese chiuso non starebbe fermo. Un
  codice ISO esplicito vince sempre sul simbolo, perché `$` vale per dollaro
  USA, canadese, australiano e altri — sbagliare paese è comunque molto meno
  grave che fingere che fossero euro.
- Se frankfurter non risponde al momento dell'ingestione la spesa **entra
  lo stesso** con `fx_rate` nullo: perderla sarebbe peggio. `sync-prices` le
  ripesca ogni notte (`convertiSpeseInSospeso`) leggendo da `original_amount`
  e non da `amount`, altrimenti una seconda passata convertirebbe due volte.
- `excluded_from_stats` (su `payments` e `merchants`) esclude dalle
  **classifiche** ("dove spendo di più") ma mai dai **totali** — mutuo e
  rate sono spese vere. Il toggle "escludi costi fissi" in Statistiche
  rende questa esclusione una scelta invece che un comportamento fisso.
  Nell'**andamento cumulato** (Statistiche e Home) i costi fissi non si
  sommano il giorno in cui sono stati registrati come una spesa qualunque:
  sono un impegno certo fin dall'inizio del periodo, quindi la linea parte
  già dal loro totale (`fixedCostsTotal`) e accumula solo la parte
  variabile giorno per giorno. Home non ha il toggle e li include sempre;
  in Statistiche la baseline sparisce quando il toggle è acceso — e con lei
  deve restringersi anche il **tetto** disegnato: `effectiveLimit` sottrae
  `fixedCostsTotal` dal limite quando il toggle è acceso, altrimenti il
  grafico mostrerebbe un margine per la spesa variabile che in realtà è già
  stato impegnato dai costi fissi (1200 di limite e 400 di mutuo non lasciano
  1200 di margine, ne lasciano 800). Vale solo per il limite mensile
  complessivo disegnato su questo grafico, l'unico presente: se in futuro se
  ne disegnasse più di uno sulla stessa linea, servirebbe una regola unica
  invece di decidere caso per caso.
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
- **I prezzi si aggiornano a ogni apertura**, non solo col cron serale: la
  Edge Function `refresh-quotes` chiede la quotazione del momento e riscrive
  la riga di oggi in `asset_prices`. Serve perché il broker mostra il prezzo
  live e un valore fermo alla chiusura precedente produce scarti che sembrano
  errori di calcolo — verificato: su AI Semiconductor l'app diceva +7,99% e TR
  +7,16%, stessa formula (`53,99/50 − 1` contro `53,58/50 − 1`), prezzi presi
  in momenti diversi. `usePortfolio` disegna prima con i prezzi in cache e
  ridisegna dopo il refresh: aspettare la rete per aprire la schermata
  costerebbe un secondo a ogni apertura per frazioni di punto percentuale.
  `refresh-quotes` non tocca mai una riga di oggi che venga da `fill` o
  `manual` — un'esecuzione reale vale più di una quotazione di mercato.
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
- La sezione ha quattro schermate figlie: `AnalysisScreen` (ripartizione del
  portafoglio, anello grande e lista sotto), `GroupDetailScreen` (una per
  gruppo), `PacScreen` (piani di accumulo) e `AssetDetailScreen`. Le sezioni
  per gruppo nell'elenco sono **chiuse di default** e, aperte, mostrano
  **solo i titoli**: grafico, ripartizione, versamenti e rendimento vivono in
  `GroupDetailScreen`, dove hanno spazio per essere letti invece di stare
  compressi dentro a un elenco.
- `DistributionBar` è un **fratello** di `ShareBar`, non una sua variante:
  `ShareBar` risponde a "quanto pesa QUESTO" e tiene apposta gli altri in
  grigio, `DistributionBar` colora tutte le fette perché contano tutte. Un
  parametro che ne ribaltasse il senso avrebbe reso illeggibili entrambe. Su
  pochi elementi si preferisce alla ciambella: le fette si confrontano lungo
  una retta invece che per angoli.
- Sul grafico dei versamenti mensili la linea di riferimento è la **mediana**,
  non la media: un mese fuori scala (ottobre 2025, quando è rientrato tutto
  insieme il disinvestimento del monetario) sposta la media sopra ogni mese
  normale, e una riga che nessun mese tocca non descrive niente.
- I nomi delle icone Lucide vanno **verificati sui file** in
  `node_modules/lucide-react-native/dist/cjs/icons/` prima di usarli:
  `components/Icon.tsx` ripiega in silenzio su `CircleHelp` quando il nome non
  esiste, quindi un nome sbagliato non rompe la build né dà errori — si vede
  solo guardando l'app. Già successo con `alert-circle`, che in questa
  versione si chiama `circle-alert`.
- Lo storico viene dall'**esportazione operazioni di Trade Republic** (CSV con
  data, ISIN, quote, prezzo). `investments.external_id` tiene l'id operazione
  del broker, così si può riesportare e reimportare senza duplicare.
### Export dei dati

- `screens/ExportScreen.tsx` (Impostazioni → Esporta i dati) produce **un CSV
  per entità** — spese, introiti, investimenti, divisioni — e non un file
  unico: un CSV con più sezioni ha colonne diverse per ognuna e non si apre
  pulito in nessun foglio di calcolo.
- `lib/csv.ts` tiene le tre scelte che decidono se il file è davvero leggibile
  in Italia: separatore `;` (Excel italiano con `,` mette tutta la riga in una
  cella), decimali con la virgola e **senza** separatore di migliaia, e BOM
  UTF-8 in testa (senza, Excel legge Windows-1252 e "Caffè" diventa "CaffÃ¨").
- Sulle spese escono **due** colonne di importo, `amount` e `effective_amount`,
  e l'intestazione della seconda dice esplicitamente che è quella a fare i
  totali: su una cena divisa in quattro le due differiscono, e chi apre il file
  non avrebbe modo di saperlo.
- `exportToCsv` restituisce righe e totale, e la schermata li mostra invitando
  a confrontarli con l'app. È così che la promessa dell'export resta
  verificabile invece di essere una dichiarazione.
- Un export che fallisce a metà **non** scrive un file parziale: un CSV con tre
  mesi su due anni è peggio di nessun CSV, perché sembra completo. Per lo
  stesso motivo `readAll` **pagina sempre** con `.range()`: PostgREST tronca a
  1000 righe *senza restituire un errore*, quindi il controllo sull'errore
  esplicito non intercetta il troncamento. L'ordinamento secondario su `id`
  serve perché `occurred_at` ha duplicati (le rate di un piano cadono tutte
  alle 10:00) e un ordinamento ambiguo farebbe comparire la stessa riga in due
  pagine saltandone un'altra.
- Il totale riportato a fine export **non** è "il totale che mostra l'app":
  tranne che per le divisioni quel numero a schermo non esiste (Home e
  Statistiche sono sempre per periodo) o risponde a un'altra domanda —
  "Capitale versato" è al netto dei disinvestimenti e solo sugli asset non
  archiviati, mentre il file contiene ogni operazione. È invece la somma di una
  **colonna precisa del file**, che l'utente può rifare nel foglio di calcolo:
  è un controllo eseguibile davvero, ed è anche il modo più diretto di
  accorgersi di un troncamento.

### Accesso

- **Nessun flusso di autenticazione usa una pagina web.** Né la conferma
  dell'indirizzo alla registrazione (`signUp` → `verifyOtp` con
  `type: "signup"`) né il recupero password: entrambi vanno a codice a sei
  cifre. Servono `{{ .Token }}` in **entrambi** i template Supabase, e il link
  va tolto — lasciandolo accanto al codice l'utente clicca quello, e finisce
  sul `Site URL` del progetto (`http://localhost:3000` se non impostato).
  Nessuna *Redirect URL* da autorizzare, di conseguenza.
- La conferma dell'indirizzo non è un dettaglio burocratico: **il recupero
  password vale solo quanto l'email è verificata**. Chi si registra con un
  indirizzo sbagliato si costruisce anni di storico su un account che non
  potrà mai recuperare — lo stesso difetto di `P1`, rientrato da un'altra
  porta.
- `signUp` non assume nessuna configurazione: se torna una sessione, "Confirm
  email" è disattivata e si è gia dentro; se non torna, si chiede il codice.
  Cambiare quell'impostazione sulla dashboard non deve rompere l'app.
- Il recupero password va **a codice a sei cifre** (`resetPasswordForEmail` →
  `verifyOtp` → `updateUser`), non a link: in Expo Go l'URL dell'app cambia a
  ogni sessione e un deep link si romperebbe proprio quando l'utente è già in
  difficoltà. Richiede `{{ .Token }}` nel template "Reset Password" su
  Supabase (vedi `DA-FARE.md`).
- `verifyOtp` **apre una sessione vera** prima che la password nuova sia
  scritta: senza il segnale `onRecoveringChange`, `App.tsx` entrerebbe nell'app
  proprio in quel momento, e se `updateUser` fallisse l'utente si ritroverebbe
  dentro con la vecchia password senza che nessuno glielo dica.
- Quella sessione viene anche **persistita su AsyncStorage**, quindi lo stato
  in memoria non basta: chiudendo l'app fra `verifyOtp` e `updateUser`, al
  rilancio `getSession()` troverebbe una sessione valida e si entrerebbe con la
  vecchia password credendo di averla cambiata. Il marcatore `RECOVERY_FLAG`
  sopravvive al rilancio e fa chiudere la sessione a metà all'avvio.

### Lettura offline

- **Per l'identità dell'utente si usa `getSession()`, mai `getUser()`**:
  il secondo interroga il server per validare il JWT, quindi offline fallisce.
  Con `getUser` la cache non veniva consultata proprio quando serve — la
  lettura offline non funzionava offline.
- Al cambio mese `payments` e `previous` si azzerano se non c'è una copia
  locale di *quel* mese, e `previous` si azzera comunque quando si serve dalla
  cache: non è cachato, e tenerlo farebbe calcolare il delta di settembre sui
  dati di luglio sotto l'etichetta "su agosto". La regola "sono vecchi, non
  falsi" regge finché l'etichetta del periodo non cambia.
- `StaleNote` riceve anche il motivo tecnico: progetto in pausa o errore RLS
  falliscono a rete perfettamente funzionante, e dire "senza connessione"
  manderebbe l'utente a controllare il proprio telefono per un problema che
  non è suo.
- `lib/cache.ts` tiene una copia locale dell'ultima lettura riuscita, per
  utente. Non è una cache di correttezza — i numeri veri restano quelli del
  database — ma serve al **terzo stato** fra dato fresco ed errore: "questi
  sono i dati di stamattina" è meglio sia di una schermata bianca sia di un
  errore, e resta vero.
- Copertura: `usePayments`, `useLimits`, `usePortfolio`, `useSubscription` —
  cioè tutte le letture che reggono una schermata intera. Si salvano **i dati
  grezzi**, non il risultato calcolato: `usePortfolio` ricostruisce posizioni
  e totali con `buildPositions`/`sumPositions`, che sono funzioni pure, così
  una modifica al modo di contare le quote non resta congelata dentro una
  copia salvata ieri.
- **Un dato che vale solo dentro un periodo va datato al periodo, non
  all'istante.** `useLimits` salva anche `weekStart`/`monthStart` e scarta la
  copia quando non combaciano con quelli di adesso: `evaluateLimit` ricalcola
  sempre l'inizio del periodo, quindi una copia di lunedì scorso riletta oggi
  non darebbe un numero vecchio ma "0,00 € spesi, 0% del budget" — un via
  libera inventato, proprio nel punto dell'app che esiste per fermare
  qualcuno. La regola "sono vecchi, non falsi" regge finché la domanda a cui
  quei numeri rispondono è ancora la stessa.
- `StaleNote` va scritto piccolo e senza colori d'allarme: un riquadro rosso
  sopra a dati corretti farebbe dubitare di numeri giusti, mentre non dire
  niente li spaccerebbe per aggiornati. L'ordine di precedenza è: dato fresco →
  dato in cache con l'età dichiarata → `LoadError`. La cache si consulta
  **solo dopo** che la lettura è fallita, mai al posto di una lettura riuscita.

- `DetailTarget.month` (screens/DetailScreen.tsx) porta il mese da cui si
  apre il dettaglio di categoria/esercente, cosi' il grafico si posiziona li'
  invece che sull'ultimo mese: ogni nuovo punto d'ingresso a `openDetail`
  dovrebbe passarlo, quando un mese di riferimento esiste davvero.
- **La copertura dell'automazione va detta, non lasciata scoprire.** Il trigger
  Wallet vede solo Apple Pay: restano fuori contanti, bonifici, addebiti
  diretti SDD (in Italia quasi tutte le utenze), carte fisiche non in Wallet e
  acquisti online fuori da Apple Pay — realisticamente il 40-60% della spesa di
  un utente italiano non entra da sola. La promessa è *"ogni pagamento Apple
  Pay entra da solo, il resto in tre secondi con Siri"*, e compare nel
  `README.md`, nel testo vuoto della Home e in cima ad Automazioni. Un'app che
  promette "tutte le tue spese" e non registra la bolletta della luce non ha un
  problema di funzionalità ma di fiducia, e si scopre nella prima settimana.
- `month_checks` + `components/MonthCheck.tsx` sono la rete contro le **perdite
  silenziose**: Shortcuts non ritenta mai, quindi una spesa fatta con il
  telefono offline non arriva e nessuno se ne accorge — il totale resta
  sbagliato in difetto e sembra corretto. Non esistendo una sorgente di verità
  contro cui riconciliare in automatico (l'app non parla con la banca), l'unica
  cosa onesta è chiederlo a chi l'estratto conto ce l'ha, **una volta**, a mese
  chiuso. Deve restare un aiuto e non un lavoro: un tocco per rispondere, e si
  spegne per sempre dalla scheda stessa. Se la lettura del totale fallisce la
  scheda non compare — chiedere "corrisponde?" mostrando un totale non letto
  sarebbe la stessa bugia che il controllo esiste per scoprire.
- **Un'automazione iOS non si può condividere**: il pulsante Condividi esiste
  solo sui comandi rapidi normali, quindi un `.shortcut` dell'automazione non è
  generabile. Da qui la struttura: la logica sta in un comando rapido
  condivisibile («Registra spesa») e l'automazione lo chiama in due azioni. È
  anche il motivo per cui `P5` si può chiudere davvero — il pezzo complicato si
  distribuisce con un link iCloud.
- Il ramo di fallimento del comando rapido scrive la spesa in
  `spese-non-inviate.txt`, **una riga JSON per spesa**, identica al corpo che
  avrebbe mandato in rete. `lib/recoverPayments.ts` la rilegge da
  Impostazioni → Automazioni. `amount` resta la **stringa formattata** di
  Wallet e non un numero: è lì dentro che c'è la valuta, e normalizzarla
  troppo presto riaprirebbe il difetto che la multi-valuta ha chiuso.
- Il recupero riapplica la stessa finestra anti-doppione di cinque minuti
  della Edge Function — **solo all'indietro**, come lì: lo stesso file si può
  reimportare quante volte si vuole. Le righe inserite nel giro corrente sono
  escluse dal confronto (`inseriteOra`), altrimenti due caffè uguali nello
  stesso bar a due minuti di distanza diventerebbero uno solo: un doppione
  *dentro* al file richiede che l'automazione sia scattata due volte e fallita
  due volte, mentre due acquisti identici ravvicinati sono normali.
- Il recupero conserva `original_currency`/`original_amount` e lascia `fx_rate`
  nullo, così il recupero cambi notturno la ripesca. Normalizzare l'importo a
  numero e basta scriverebbe 12,99 sterline come 12,99 € — e senza
  `original_currency` quella riga non verrebbe **mai** ripescata: l'errore
  diventerebbe permanente invece che transitorio.
- Ogni riga del file deve finire in **uno** dei contatori (`importate`,
  `duplicate`, `illeggibili`, `fallite`) e il foglio mostra anche `lette`: il
  conto che torna è l'unico modo perché l'utente veda cosa si è perso. Senza
  denominatore, "7 importate" su un file di 9 righe sembra un successo.
- **`%` e `_` vanno sempre sottratti a `ilike`**: un esercente "Sconto 100%
  Store" passato grezzo diventa un pattern che combacia con qualunque nome
  inizi per "Sconto 100", e scarta spese vere come doppioni.
- **`Se Contenuti URL presenta qualsiasi valore` non è un test di successo**:
  `ingest-payment` risponde con un JSON anche sugli errori, quindi quella
  condizione è sempre vera e il ramo di fallimento non scatta mai. Va usato
  *contiene* `"ok":true`.
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

### Guida alla configurazione

- `lib/guide.ts` (i passi come **dati**), `components/ActionPreview.tsx` (la
  riproduzione di un'azione), `screens/GuideScreen.tsx`. Si arriva da
  Automazioni e dallo stato vuoto della Home — cioè dai due punti in cui si
  trova chi non ha ancora configurato niente.
- Le azioni sono **riprodotte schematicamente, non fotografate**: uno
  screenshot di iOS invecchia al primo aggiornamento che sposta un campo, e
  chi lo guarda non capisce più se sta sbagliando lui o se è la guida a
  essere vecchia. Quello che non cambia — e che quindi conta — è il **nome
  esatto** dell'azione da cercare e i campi da riempire.
- I valori che vanno presi dal **selettore variabili** sono evidenziati in
  accento: confonderli con testo digitato è l'errore più comune, e dirlo solo
  a parole non basta.
- `lib/guideImages.ts` accoglie gli screenshot veri quando ci saranno, uno per
  `id` di passo. Si affiancano allo schema invece di sostituirlo. I `require`
  devono restare **letterali**: Metro risolve le immagini a compilazione, un
  percorso costruito a runtime non finisce nel bundle. Vanno ritagliati sulla
  singola azione e ridimensionati (~750px): a piena risoluzione finirebbero
  interi dentro l'aggiornamento che ogni utente scarica.
- Il progresso è salvato: questa procedura si fa passando avanti e indietro
  fra due app, e ricominciare da capo a ogni ritorno è il modo più rapido per
  farla abbandonare.

### Novità in-app

- `lib/changelog.ts` tiene le voci in un **file del bundle**, non su Supabase:
  cambiano esattamente quando cambia il codice, quindi arrivano con lo stesso
  `eas update` che porta le novità che descrivono. Leggerle dalla rete
  vorrebbe dire poter annunciare cose non ancora installate.
- **Ogni voce nuova va aggiunta in cima con un `id` nuovo** (la data basta):
  è l'`id` della prima voce che decide se il pallino compare. Scritte per chi
  usa l'app, non per chi la scrive — "la retta di ritmo parte dalla base
  vera" è un messaggio di commit, non una novità.
- Il pallino sull'icona delle impostazioni in Home è la parte che conta: una
  schermata raggiungibile solo entrando in Impostazioni non la apre nessuno,
  ed è proprio il punto di avere aggiornamenti frequenti e non farlo sapere.
  Chi apre l'app per la prima volta non ha "novità" (`seen === null` →
  si segna letto), altrimenti si verrebbe accolti da un pallino da smaltire.

### Blocco dell'app

- `lib/AppLockContext.tsx` + `components/LockScreen.tsx`: Face ID / Touch ID
  davanti all'app, opzionale, spento di default. Usa
  `expo-local-authentication`, che è nell'SDK 54 e quindi **dentro Expo Go** —
  nessuna build nativa.
- È un **context, non un hook usato due volte**: il gate che copre l'app e
  l'interruttore in Impostazioni devono condividere lo stato, altrimenti
  attivarlo non avrebbe effetto fino al riavvio — chi lo accende esce,
  rientra, e trova l'app aperta come prima.
- Protegge da chi ha in mano il telefono già sbloccato, non i dati sul
  server: quelli stanno dietro alla RLS di Postgres e non cambiano di una
  virgola con questo interruttore.
- **L'autenticazione non va chiesta prima che l'app sia `active`.** All'avvio
  a freddo iOS passa da `inactive`, e in quella finestra il riconoscimento
  non si può presentare: il sistema ripiega sul codice del telefono e
  `authenticateAsync` risponde comunque "riuscito", quindi dal codice non si
  distingue da un Face ID andato a buon fine. `LockScreen` aspetta `active` e
  un istante in più prima di provare — senza, il blocco all'avvio chiede
  sempre il codice anche con Face ID perfettamente configurato.
- **Dentro Expo Go il permesso Face ID è di Expo Go, non nostro.** Se è stato
  negato, iOS passa al codice del telefono senza restituire niente di
  distinguibile: `authenticateAsync` risponde `success: true` come se il
  riconoscimento fosse andato. Non è rilevabile dal codice — si risolve da
  Impostazioni iOS › Face ID e codice › Altre app › Expo Go. Con una build
  propria il permesso torna a essere dell'app e la domanda la fa lei.
- L'etichetta in Impostazioni segue `supportedAuthenticationTypesAsync()`:
  chiamarlo "Face ID" su un telefono con Touch ID sarebbe sbagliato, e su uno
  senza biometria prometterebbe una cosa che non arriverà mai.
- Tre scelte che decidono se è usabile invece che solo sicuro:
  `disableDeviceFallback: false` (Face ID sbaglia — buio, occhiali da sole —
  e il codice del telefono resta una via valida); soglia di 30 secondi in
  background prima di richiedere il volto, perché il giro normale
  dell'automazione è proprio uscire dall'app e rientrare; e il pulsante
  **"Esci e accedi con la password"** sulla schermata di blocco, senza il
  quale un guasto del riconoscimento renderebbe i propri dati irraggiungibili
  se non reinstallando l'app.
- Si attiva solo dopo una prova riuscita (`enable()` autentica *prima* di
  salvare la preferenza): accenderlo su un telefono che non riconosce il
  volto chiuderebbe l'utente fuori al prossimo avvio.
- Finché la preferenza non è stata letta da disco `LockGate` non disegna
  niente: stampare l'app e coprirla un istante dopo l'avrebbe comunque
  mostrata, ed è esattamente il fotogramma che il blocco esiste per negare.
  Per lo stesso motivo `LockCover` copre su `inactive` e non solo su
  `background` — è lì che iOS scatta l'anteprima per il selettore app.

### Abbonamento e referral

- Modello deciso da Andrea: 2 mesi di automazione gratis dalla registrazione
  (`profiles.trial_ends_at`), poi 1,99 €/mese o 15 €/anno. **Solo
  l'automazione si blocca** — Wallet, Siri, la Shortcut condivisibile —
  mai il resto dell'app: storico, statistiche, spese manuali ed export
  restano sempre accessibili, abbonati o no. Dettagli e motivazione in
  `PRODOTTO.md` (`P7`-`P10`, `P20`).
- `public.profiles` non è scrivibile dal client (nessuna policy `insert`/
  `update` per `authenticated`): un utente che potesse scrivere
  `subscription_status` da solo si auto-assegnerebbe un abbonamento senza
  pagare. La riga nasce dal trigger `handle_new_user` (security definer,
  bypassa RLS); `subscription_status`/`current_period_end` cambiano solo da
  un servizio con la `service_role` key — oggi `ingest-payment` per il
  bonus referral, in futuro il webhook di RevenueCat.
- L'enforcement vive in `ingest-payment`, non nell'app: **ogni chiamata a
  quella function è automazione** (l'app non la chiama mai per
  l'inserimento manuale), quindi basta un controllo per utente all'inizio,
  senza distinguere per `source`. Risponde `403 subscription_required`
  quando il trial è scaduto e non c'è un abbonamento attivo — un profilo
  mancante fa passare la richiesta invece di bloccarla, perché un profilo
  mancante è un difetto di integrità, non una decisione sull'abbonamento
  (stessa logica delle letture fallite: un errore non deve diventare la
  base per negare un servizio).
- `lib/useSubscription.ts` è lo stesso schema rete→cache→errore di
  `usePayments`, ma per una riga sola: serve a mostrare il banner del trial
  in Home *prima* che l'utente lo scopra da una notifica di errore della
  Shortcut, che nessuno apre per capire perché l'automazione si è fermata.
- Referral: ogni utente ha un `referral_code` (8 esadecimali, generato dal
  trigger). `redeem_referral_code(code)` è un'RPC e non un insert diretto
  dal client — altrimenti chi si registra potrebbe assegnarsi un referrer
  qualsiasi modificando la chiamata. Il referral si conferma in
  `ingest-payment`, non alla registrazione: solo al **primo pagamento
  automatico riuscito** dell'amico invitato, la prova che ha impostato
  l'automazione e non solo scaricato l'app. Dopo 5 referral confermati
  totali chi ha invitato sblocca 2 mesi extra — `bonus_months_granted`
  rende il traguardo unico e non ripetibile.
- L'acquisto vero richiede **In-App Purchase Apple** (regola App Store
  3.1.1, un abbonamento consumato dentro l'app non può passare da uno
  checkout esterno) tramite RevenueCat, che serve una build nativa — non
  funziona dentro Expo Go. Fino a quel momento il pulsante "Abbonati" in
  `SubscriptionScreen` resta disattivato di proposito: lo schema e
  l'enforcement sono pronti, manca solo il pagamento.

### Canali realtime e schermate che cadono

- **Il nome di un canale Supabase va reso univoco per istanza**
  (`` `payments-live:${useId()}` ``). Due componenti che montano lo stesso
  hook contemporaneamente aprivano due canali sullo stesso topic e la seconda
  `subscribe()` sollevava: è successo con `useSubscription`, che Impostazioni
  tiene montato mentre mostra Abbonamento o Invita un amico — quelle due
  schermate si aprivano vuote.
- **Nel bundle di produzione un errore di render non apre nessuna schermata
  rossa**: React smonta l'albero e resta il fondo vuoto, senza motivo e senza
  via d'uscita. È il motivo per cui una pagina bianca su Expo Go dopo un
  `eas update` va letta come "qualcosa è andato in eccezione", non come "non
  ha caricato". `components/ScreenBoundary.tsx` avvolge le sottopagine di
  Impostazioni e mostra il messaggio dell'errore, selezionabile, con
  "Riprova" e "Indietro".
- Nessuna tabella è oggi nella publication `supabase_realtime`, quindi questi
  canali si iscrivono e non ricevono mai niente: la spesa registrata dalla
  Shortcut mentre l'app è aperta **non** compare da sola, serve il
  tira-per-aggiornare. Va abilitata la publication su `payments` perché
  quella promessa diventi vera.

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
