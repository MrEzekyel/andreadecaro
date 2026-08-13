# Clinck

Tracker di spese personale per iOS. App Expo/React Native + backend Supabase.
Distribuzione oggi via EAS Update dentro Expo Go; con il modello di business
deciso (vedi "Abbonamento e referral" sotto) l'Apple Developer Program e il
passaggio a una build nativa non sono più rimandabili — vedi `DA-FARE.md`.

## Stato del progetto — leggere prima di ripartire

Punto di ripresa pensato per una sessione senza la cronologia della chat.
Per il dettaglio punto per punto: `PRODOTTO.md` (i problemi, `P1`-`P20`),
`SPRINT.md` (l'ordine di lavoro e cosa è chiuso), `DA-FARE.md` (le azioni
che restano ad Andrea).

**Modello di business — deciso, non più da discutere:**
2 mesi di automazione gratis dalla registrazione, poi 1,99 €/mese o 15
€/anno per continuarla. Si blocca **solo l'automazione**: il resto dell'app
(storico, statistiche, spese manuali, export, investimenti) resta gratis
per sempre. Referral interno: 5 amici che confermano il referral (primo
pagamento automatico riuscito, non la sola registrazione) sbloccano 2 mesi
extra a chi ha invitato — traguardo unico, non ripetibile, mai citato nelle
campagne ads. Dettagli tecnici in "Abbonamento e referral" più sotto.

**Cosa è già costruito e pushato**, sprint 1-4 di `SPRINT.md` chiusi:
fiducia (recupero password, export, errori onesti), attrito zero
sull'automazione (guida passo-passo, comando rapido «Clinck: Inserisci
pagamento» già pronto e condiviso via link — vedi "Guida alla
configurazione" sotto),
integrità del dato (multi-valuta, lettura offline ovunque), sicurezza e
trasparenza (blocco Face ID, changelog in-app, non-obiettivi dichiarati nel
README). Schema, enforcement e schermate del modello di business sono in
produzione.

**Cosa manca, e di chi è la mossa:**

- **Dominio: `clinck.it`**, già registrato — con SMTP custom collegato a
  Supabase, dato che il codice email di primo accesso arriva regolarmente.
  Il recupero password (`P1`) invece a volte non arriva: da verificare se è
  un problema del template "Reset Password" specifico (serve `{{ .Token }}`
  anche lì, non solo nel template di conferma registrazione — vedi "Accesso"
  più sotto) o un caso isolato. *Andrea* sta ripetendo il test.
- *Qui* — privacy policy da scrivere e pubblicare su `clinck.it` (`P4`), ora
  che il dominio c'è.
- *Andrea* — **Apple Developer Program (99$/anno) + Small Business Program**
  (commissione 15% invece di 30%): apre la catena RevenueCat → build nativa
  EAS → TestFlight. Finché non parte, il modello di business non incassa
  davvero — il pulsante "Abbonati" in `SubscriptionScreen` resta disattivato
  apposta.
- *Andrea* — **7 screenshot veri** per la guida alla Shortcut, elenco
  preciso in `DA-FARE.md`. I posti sono già predisposti in
  `lib/guideImages.ts`.
- *Andrea* — **giro di test manuale** prima di far provare l'app ad altri
  (checklist in `DA-FARE.md`), in particolare un pagamento vero con
  l'automazione e il recupero password per intero.
- *Andrea* — **decisione aperta**: repository pubblico o privato (`P15`).
- *Qui* — integrazione RevenueCat quando la build nativa esiste; **piano
  marketing**, prossimo argomento, non ancora affrontato — dipende da
  quando la catena Apple Developer Program → RevenueCat sarà avviata, perché
  senza IAP live non c'è un funnel trial→pagamento da promuovere davvero.

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
- **`components/MonthWheel.tsx` usa `Animated.ScrollView`, non
  `Animated.FlatList`.** Era un `FlatList` fino a che, dentro il dettaglio di
  un esercente (terza pagina del carosello "Peso nella categoria"), non ha
  fatto scattare l'avviso di React Native "VirtualizedLists should never be
  nested inside plain ScrollViews with the same orientation": la ghiera è
  orizzontale e vive dentro `ChartCarousel`, anch'esso uno scorrimento
  orizzontale — stessa orientazione, l'esatto caso che l'avviso segnala.
  La ghiera copre al più qualche decina di mesi, non ha bisogno di
  virtualizzazione: `ScrollView` con gli elementi mappati a mano risolve
  senza perdere l'animazione (opacità/scala/traslazione interpolate su
  `scrollX`) né il posizionamento esatto al primo render.
- Schede in basso: Home, Movimenti, Statistiche, Investimenti. **Impostazioni
  non è una scheda**: ci si arriva dall'ingranaggio in alto a destra, uguale
  su tutte e quattro (`components/ScreenHeader.tsx`, `useNav().openSettings`)
  — Home lo disegna a mano perché porta anche il pallino delle novità, le
  altre tre usano il componente condiviso. Mai sulle pagine di dettaglio
  (dentro Movimenti, Statistiche, Investimenti): quelle hanno già un tasto
  Indietro, e un secondo modo di uscire accanto confonderebbe quale dei due
  riporta dove.
- **`screens/SettingsScreen.tsx` è organizzata per argomento, non per ordine
  di aggiunta.** *Profilo* sta da sola in cima, in una card propria: è
  l'unica riga che parla di te invece che di una funzione dell'app, e
  mescolata con le altre si perde. Poi Aspetto e Blocco (preferenze del
  dispositivo), *Spese* (Categorie, Limiti, Spese ricorrenti, Dividi spese —
  tutto ciò che riguarda come si registra e si divide una spesa), *Account*
  (Abbonamento, Invita un amico, Automazioni — tutto ciò che riguarda il
  rapporto con Clinck stesso), infine Esporta i dati e Novità. La pagina
  dietro "Profilo" (`screens/FriendsScreen.tsx`, chiave di navigazione
  `"profile"`) mostra prima il proprio tag e nome, poi la ricerca amici e le
  richieste: non si chiama "Amici" perché la prima cosa che fa è parlare di
  te, non di loro.

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
- **Un foglio aperto da un altro foglio va renderizzato DENTRO di lui**, fra i
  suoi `children` — non come fratello nello stesso `<>`. Due `<Modal>` fratelli
  su iOS non possono stare aperti insieme: il secondo viene presentato da una
  vista già coperta dal primo e **non compare mai**, senza errori né avvisi.
  È così che "Nuovo asset" dentro "Nuovo investimento" è rimasto un pulsante
  morto. Il foglio annidato passa anche `dim` (velo scuro dietro il pannello),
  altrimenti si vedono due intestazioni impilate e non si capisce quale
  comanda; sui fogli di primo livello `dim` resta spento, il fondo caldo
  dietro una modale è parte di come è fatta l'app.
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
- **«Uscite» ed «Entrate» sono lo stesso interruttore in Home e in
  Movimenti**, non due copie: `lib/moneyMode.ts` esporta il tipo `MoneyMode`,
  e lo stato vive sollevato in `App.tsx` (non locale a nessuna delle due
  schermate) perché il tasto centrale della tabbar deve poterlo leggere da
  qualunque delle due schede si stia guardando, per decidere se aggiunge una
  spesa o un introito — vedi "Il tasto centrale" più sotto. Cambiarlo in Home
  cambia anche quello che si trova aprendo Movimenti, e viceversa. Il mese
  scelto invece resta locale a ciascuna schermata: sono due elenchi, non la
  stessa vista.
- **Gli introiti non vivono più dentro Impostazioni.** Prima erano una
  sottopagina (`IncomeScreen`, raggiunta da "Introiti → Gestisci"); ora sono
  la metà «Entrate» della scheda Movimenti (`screens/MovementsScreen.tsx`,
  sezione `IncomeList`), sullo stesso piano delle spese. Da lì si modifica o
  elimina un introito toccando la sua riga (foglio locale, dentro
  `MovementsScreen.tsx`); l'aggiunta invece è `components/AddIncomeSheet.tsx`,
  gemello di `AddPaymentSheet` ma per gli introiti, aperto dal tasto centrale
  della tabbar — mai una pagina propria, perché un elenco ha un solo gesto
  primario e prima l'aggiunta e la navigazione se lo contendevano.
- **Il tasto centrale della tabbar segue Uscite/Entrate.** Su Home o
  Movimenti, se `moneyMode` è `"entrate"` il tasto è verde e apre
  `AddIncomeSheet`; altrimenti è arancione (`palette.accent`) e apre
  `AddPaymentSheet` — anche su Statistiche e Investimenti, dove non c'è un
  Uscite/Entrate da seguire e il comportamento resta quello di sempre.
  `useNav().openAddIncome` apre lo stesso foglio da qualsiasi punto
  dell'app (es. lo stato vuoto di Entrate in Home), senza dover navigare.
- **`components/SemiGauge.tsx` — il semicerchio, non l'anello.** Prima
  versione: anello a 270°, bocciata da Andrea («é gigantesco»). Un
  semicerchio dice le stesse tre cose (quanto, su quanto, se sei in
  anticipo grazie alla tacca del ritmo) in metà dell'altezza, e lo spazio
  liberato accanto porta i numeri che prima non c'erano: spesa media al
  giorno, proiezione di fine mese, giorni rimasti. Regge più segmenti per
  arco perché in «Entrate» l'arco esterno è diviso per fonte di introito.
  - La traccia di fondo (il "su quanto" non ancora riempito) usa
    `palette.hairline` e non `surface2`: in tema chiaro quest'ultimo sta a un
    soffio dal fondo pagina e la parte non spesa spariva, lasciando l'arco
    sempre pieno.
  - `markRatio`/`markColor`/`endLabel` sono generici — il chiamante decide
    cosa segnano — perché una tacca senza nome viene letta a caso: in Home è
    già successo che una tacca del ritmo (dove saresti se spendessi lo
    stesso ogni giorno) venisse scambiata per i costi fissi, per pura
    coincidenza numerica. Oggi in Home la tacca segna davvero i costi fissi
    (`fixedCostsTotal / gauge.limit`) ed è etichettata in una piccola
    legenda sotto l'arco; `endLabel` scrive il fondo scala (il limite) sotto
    la punta destra, perché un arco che dice quanto si è riempito ma mai su
    quanto lascia la frazione indovinata.
  - **Più segmenti con le punte tonde**, non più squadrate: ogni segmento
    successivo *rientra* sotto il precedente di quasi uno spessore e viene
    disegnato *prima* di lui, cosicché il primo finisce sopra e la sua punta
    tonda chiude il confine invece di tagliarlo. Prima, con più di un
    segmento, si passava tutti a `strokeLinecap="butt"` per evitare che le
    punte tonde si mangiassero il confine — soluzione scartata perché
    lasciava uno spicchio di fondo scoperto fra un segmento e l'altro.
- **La proiezione di fine mese non moltiplica i costi fissi.** Sono già
  interi dentro `fixedCostsTotal` dal primo giorno: proiettarli
  moltiplicherebbe il mutuo per trenta. Si proietta solo la parte
  variabile (`fixedCostsTotal + variabile / giorniTrascorsi * giorniMese`).
  Per lo stesso motivo "Al giorno" in Home mostra **due** valori: la spesa
  media di sempre e quella al netto dei costi fissi (`statSub` sotto il
  valore principale) — solo la seconda è quella su cui si può agire.
- **`components/FlowCompare.tsx` — introiti contro uscite su una scala
  sola, a barre dritte.** Idea di Andrea, e risolve un difetto vero del
  diagramma di flusso classico: con rami che partono uguali e finiscono
  tutti allineati, il divario fra quanto entra e quanto esce non si vede
  affatto. Qui la barra più lunga è quella che vince (introiti se il mese
  chiude in positivo, uscite se in rosso) e l'altra si misura contro di lei
  sullo stesso fondo scala; l'investito (`palette.invest`, azzurro) riparte
  da dove finisce lo speso, quindi **la distanza fra le due punte è quello
  che avanza** — uno spazio da guardare, non un numero da leggere. Ha
  sostituito `SavingsSummary`, che diceva la stessa cosa come sottrazione
  scritta a parole.
  - Sono state provate e scartate due varianti più decorative: un vero
    Sankey a nastri (lì la grandezza sta nello *spessore*, non nella
    lunghezza — il confronto che il componente esiste per mostrare
    spariva) e un nastro con la piega verso una colonna sorgente (bello ma
    la curva concentrata in un tratto fisso rendeva il disegno rigido, e
    distribuita su tutta la lunghezza curvava diversamente due barre di
    lunghezza diversa raccontando una differenza che non c'era). Restano
    barre dritte con riempimento traslucido e una punta piena in fondo.
- **`components/MonthBars.tsx`** risponde a «sto spendendo tanto?», che il
  totale del mese da solo non può: solo il confronto coi mesi già vissuti
  lo dice. I mesi passati restano spenti (`palette.hairline`, non
  `surface2` — stesso motivo della traccia di `SemiGauge`, altrimenti
  sparivano su fondo chiaro), solo quello corrente prende il colore pieno.
  Ogni barra porta il proprio valore scritto sopra (`compactAmount`); la
  riga tratteggiata sulla media è stata tolta — nessun mese la toccava mai,
  e rubava lo spazio ai valori veri — e la media, quando serve, si scrive
  accanto al titolo (`monthBarsAverage`) invece che sul grafico.
- **`components/BalanceChart.tsx` — l'andamento delle spese rovesciato.**
  Nella scheda Entrate: parte da zero, sale a ogni introito (gradino verde
  etichettato con l'importo) e scende a ogni spesa **e a ogni investimento**
  (gradino azzurro, `−importo`) — gli investimenti erano stati dimenticati
  in una prima versione, e la linea diceva che restava più denaro
  disponibile di quanto ce ne fosse davvero, l'unico verso pericoloso di
  sbagliare qui. È l'unico grafico che risponde a «quanto mi resta» senza
  far fare sottrazioni: la linea **è** quello che resta. L'asse scende
  sotto zero solo se il saldo ci è andato davvero, e porta tre riferimenti
  di scala (fondo, metà, cima) scritti a sinistra — prima non ne aveva
  nessuno.
- **Le fonti di introito usano gradazioni di verde** (`INCOME_SHADES` in
  `HomeScreen.tsx`), non i colori delle categorie di spesa: devono restare
  leggibili come «entrata» a colpo d'occhio, e un rosa o un blu accanto al
  verde romperebbe quella lettura prima ancora di dire quale fonte è.
- **`palette.invest` (azzurro) è il terzo colore del denaro**, dopo
  `accent` (speso) e `good` (entrato/introiti): segna gli investimenti
  ovunque compaiano accanto agli altri due — semicerchio Uscite ed Entrate
  in Home, `FlowCompare`, `BalanceChart`. Mai riusato per altro, altrimenti
  smetterebbe di leggersi come "investito" a colpo d'occhio.
- Il semicerchio delle Uscite mostra **"restano X €"** dentro l'arco (o
  "oltre di X €" in rosso): è il numero con cui si decide ("posso
  permettermi questa cena?"), non un derivato da calcolare a mente. È il
  "Free to Spend" di Copilot Money, il riferimento del settore — confermato
  guardando la concorrenza su richiesta di Andrea. Sostituisce del tutto la
  vecchia barra `LimitCard` in Home (che resta usata in `LimitsScreen`).
- **"Prossimi addebiti" invece del peso percentuale dei ricorrenti**: la
  vecchia barra ("6 pagamenti ricorrenti · 56%") era un numero che non
  chiedeva niente a nessuno; le prossime 2-3 rate con la data relativa
  ("fra 3 giorni") sono informazione su cui si agisce. Sezione propria in
  Home (solo mese corrente — "fra 3 giorni" non significa niente
  sfogliando marzo), non più annidata dentro Ripartizione dove spariva se
  il mese non aveva spese. Il totale "al mese" resta calcolato sulle sole
  rate mensili anche se l'elenco include settimanali e annuali.
- **Una schermata di configurazione ha un solo gesto primario.** In
  Automazioni c'erano tre pulsanti che si contendevano l'occhio (installa
  il comando, guida, genera token) e Andrea l'ha bocciata: "non si capisce
  dove si deve cliccare". Ora l'unico pulsante pieno è "Configura
  l'automazione" (apre la guida, che contiene installazione + chiave +
  automazione); generare una chiave è un'azione di manutenzione, bordata e
  non piena; l'URL del server sta in fondo, piccolo, etichettato "Se fai
  da te" — serve solo a chi si costruisce il comando da zero.

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
- **`merchants.parent_id` = l'insegna.** "McDonald's Dragona" e "McDonald's
  Infernetto" erano due righe scollegate: due voci in "dove spendo di più",
  due categorie da correggere, e nessuna schermata lo segnalava perché ogni
  riga presa da sola sembrava giusta. Ora la seconda punta alla prima tramite
  un livello **solo** di raggruppamento (trigger `merchants_keep_flat`): un
  brand di un brand renderebbe ogni somma dipendente da quante volte si
  risale, e la prima query che dimenticasse un livello darebbe un totale
  plausibile e sbagliato.
  - La regola sta in `merchant_common_prefix()`: prefisso di **parole
    intere** (su caratteri, "Conad" e "Conforama" condividerebbero "Con"),
    e una parola sola vale come insegna solo se è lunga almeno 4 lettere,
    non è un numero e non è un nome di categoria merceologica
    (`merchant_generic_word`). Quest'ultima lista è la parte che conta: il
    pericolo non è mancare un raggruppamento, è **unire cose diverse** —
    "Farmacia Rossi" e "Farmacia Verdi" condividono un prefisso di otto
    lettere e non sono la stessa farmacia. Verificato sui 97 esercenti reali:
    due raggruppamenti, entrambi giusti, zero falsi positivi; i tre `Bar ...`
    restano separati e `UCI Cinemas` non finisce con `Uci Recupero`.
  - **`resolve_merchant()` è l'unico posto in cui un esercente nasce.** Prima
    la stessa logica stava in tre copie (foglio "Nuova spesa", recupero da
    file, Edge Function di ingestione): tre copie di una regola di
    raggruppamento non possono che divergere, e una divergenza qui non dà
    errori — crea gruppi diversi a seconda di *da dove* è entrata la spesa,
    e ci si accorge del problema mesi dopo guardando le classifiche.
  - **Il brand non si scrive in `payments.merchant_name`**: quel campo resta
    il nome com'è arrivato quel giorno. L'insegna si risolve a schermo
    (`useData().brandLabel`), altrimenti il giorno in cui un raggruppamento
    cambia le spese vecchie mostrerebbero il nome di un gruppo che non esiste
    più. In elenco si legge l'insegna, nel dettaglio della singola spesa il
    punto vendita preciso, e dentro il dettaglio di un'insegna le righe
    tornano al nome preciso (`PaymentRow exactName`) — lì è l'unica cosa che
    distingue una riga dall'altra.
  - Categoria ed esclusione dalle classifiche si leggono con
    `coalesce(punto vendita, insegna)`, e "ricorda per i prossimi pagamenti"
    scrive **sull'insegna**: così vale anche per i negozi dello stesso gruppo
    in cui non si è ancora mai stati.
- `recurring_rules` → `materialize_recurring()` genera le spese ricorrenti
  ogni notte via pg_cron (mutuo, abbonamenti).
- `monthly_totals(p_months)` (migration `0035`) aggrega spese, introiti e
  investito **per mese, nel database**, per i due grafici a barre della
  Home. Stessa ragione di `portfolio_daily`: sommare lato app vorrebbe dire
  scaricare un anno di pagamenti a ogni apertura, e PostgREST tronca a 1000
  righe *senza dare errore* — un mese vecchio comparirebbe più basso del
  vero senza che niente lo segnali. È `security invoker` e non `definer`:
  qui la RLS serve, non va aggirata, e ogni utente vede i propri totali
  perché le policy sulle tabelle sottostanti si applicano a lui.
  Il client (`HomeScreen.loadHistory`) aveva lo stesso difetto già chiuso
  una volta per Flusso (vedi commit "Flusso che spariva in silenzio"): un
  errore di rete su questa RPC faceva sparire "Sui mesi" ed "Entrate mese
  per mese" senza dire perché, indistinguibile da un bug del grafico.
  `historyError` copre ora entrambi, con lo stesso avviso "tira giù per
  aggiornare".
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

### Spese divise fra due account (Clinck Tag)

Fino alla migrazione 0037 l'app era a utente singolo: **ogni** policy diceva
`auth.uid() = user_id`, senza eccezioni. Da qui in poi un utente legge righe
che non sono sue, ed è la superficie più delicata dell'app.

- **Tutto quello che attraversa il confine passa da una RPC `security
  definer` con l'elenco delle colonne scritto a mano** (`lib/social.ts` →
  `incoming_splits`, `find_profile_by_handle`, `list_connections`), mai da
  una policy larga. Una policy su `payments` abbastanza permissiva da far
  leggere all'amico la spesa che lo riguarda gli aprirebbe anche nota,
  carta, categoria e `my_share` di chi ha pagato.
- **La ricerca è per tag esatto, mai a prefisso.** Una ricerca "che inizia
  per" su una tabella di profili è un modo per farsi enumerare l'utenza sei
  cifre alla volta. Il tag si condivide, non si indovina. Verificato:
  cercare `prova` non trova `prova_b`.
- **Il tag non si sceglie: lo assegna il database alla creazione
  dell'account** (migrazione 0039). Formato `CLI-######`, sei cifre
  casuali generate da `generate_clinck_tag()` — stesso schema di
  `generate_referral_code()`: si riprova finché non se ne trova uno libero.
  Prima era un nome scelto a mano (`@andrea`): con più di un utente i nomi
  buoni finiscono subito, e inventarsi un identificativo è un passo in più
  proprio nel momento in cui si vuole solo entrare nell'app. Con sei cifre
  (un milione di combinazioni) restano collisioni teoriche solo fra due
  registrazioni nello stesso istante che estraggono lo stesso numero — lo
  stesso rischio, mai chiuso con un lock, che il codice referral aveva già
  da prima. `set_handle` non esiste più: solo `set_display_name` resta
  modificabile.
- **`screens/WelcomeScreen.tsx` compare una volta sola**, subito dopo che il
  codice email è stato verificato: chiede il nome e consegna il tag già
  pronto, con Copia e Condividi. Il discriminante è `profiles.display_name`
  nullo (`App.tsx` → `FirstRunGate`), non un flag salvato sul telefono — un
  flag locale si perderebbe cambiando dispositivo e rifarebbe comparire il
  benvenuto a chi ha già finito.
- **`people.linked_user_id` è il perno di tutto il disegno.** Le quote
  restano attaccate al contatto della rubrica e il contatto punta
  all'account: un amico che scarica Clinck dopo mesi di cene divise si porta
  dietro tutto lo storico scrivendo un uuid in una colonna (`link_person`,
  il tasto "Associa"). Nessuna migrazione di dati, mai.
- **Accettare una quota crea una spesa vera** nell'account di chi accetta
  (`source='shared'`, `payment_splits.mirror_payment_id`). Senza, l'amico
  accetterebbe un debito che nei suoi numeri non compare da nessuna parte.
  L'esercente si risolve nella **sua** rubrica, non in quella di chi ha
  pagato.
- **Rifiutare non tocca la spesa di chi ha pagato.** Riportargli la quota a
  carico suo cambierebbe da solo un mese che lui aveva già chiuso, in
  silenzio: è la stessa classe di errore per cui `splitUnknown` blocca la
  riscrittura delle quote non lette. Gli arriva l'avviso, decide lui.
- **Correggere l'importo aggiorna la copia, non la riporta "da accettare"**
  (`payment_splits_sync_mirror`): togliere di colpo una spesa già registrata
  dal mese dell'amico è il verso pericoloso di sbagliare — il suo totale
  calerebbe da solo.
- **Il saldo lo conferma chi ha pagato**, sempre. Il debitore può dichiarare
  "ho pagato" (`settle_requested_at`), ma Clinck non muove denaro: dare per
  chiuso un credito sulla parola del debitore sarebbe l'unica bugia che
  quella schermata può raccontare.
- **`EditPaymentSheet` non può più cancellare e reinserire le quote.**
  Funzionava finché una quota era un promemoria privato; ora la
  cancellazione porta via anche la spesa che l'amico ha già nei suoi conti
  (`payment_splits_drop_mirror`) e la riga reinserita riparte da "da
  accettare" — salvare una nota cambierebbe il mese di un'altra persona.
  Si fa `upsert` su `(payment_id, person_id)` e si cancellano solo le
  persone tolte davvero.
- Il giro completo è stato **provato end-to-end sui due account veri** prima
  di scrivere una riga di interfaccia: tag, amicizia, contatti creati su
  entrambe le rubriche, quota `pending`, accettazione, correzione
  dell'importo che si propaga, cancellazione che porta via la copia.
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

### Creare asset e investimenti a mano

Fino a qui `assets` si popolava solo scrivendo direttamente sul database:
nessuna schermata creava un asset, e `investments` nasceva solo da un piano
di accumulo o da un import backend. `AddAssetSheet` e `AddInvestmentSheet`
chiudono quel buco.

- **La ricerca dello strumento è ibrida e per nome, mai per ISIN** — la
  maggior parte di chi investe non sa dove trovarlo. `instruments`
  (migrazione 0040) è una lista curata di ~22 strumenti comuni fra chi
  investe da un broker italiano, letta direttamente dal client (piccola,
  nessuna RPC). Quando non trova niente, `InstrumentPicker` passa a Yahoo
  Finance (`search-instruments?q=`, Edge Function). Se nemmeno quello basta,
  l'utente inserisce nome e simbolo a mano.
- **Nessun ISIN è scritto in `instruments`.** Ogni riga è stata verificata
  dal vivo contro il ticker Yahoo prima di scrivere la migrazione (Bash era
  bloccato da un 429 di Yahoo sull'IP del sandbox — la verifica è passata da
  una Edge Function scratch, stessa uscita di rete dell'app in produzione).
  Un ISIN scritto a memoria sarebbe un dato finanziario falso con l'aria di
  essere vero: peggio di non averlo. La ricerca è quindi solo su nome e
  simbolo.
- **Un asset non si salva mai senza una verifica dal vivo del simbolo**
  (`search-instruments?probe=`, in `lib/instruments.ts` →
  `probeInstrument`), anche per un risultato della lista curata: un ticker
  giusto ieri può essere delistato oggi, e un asset creato sulla fiducia
  smetterebbe di aggiornarsi in silenzio — visibile solo mesi dopo come "il
  grafico è fermo". Per i fondi private market non c'è ricerca né probe:
  nessuna fonte automatica esiste per un ELTIF (vedi sopra), quindi nascono
  già a valorizzazione manuale.
- **`sync-prices` accetta `?asset_id=` oltre alla chiamata senza parametri
  del cron.** Un asset appena creato non ha ancora nessuna riga in
  `asset_prices` (il cron notturno non è ancora passato), e senza uno
  storico non c'è un prezzo a cui agganciare il primo investimento manuale
  nella stessa sessione in cui è nato l'asset. `AddAssetSheet` chiama questo
  endpoint scoped subito dopo l'insert, prima di restituire l'asset a chi
  l'ha creato. Verificato che la chiamata senza parametri (il cron) continua
  a processare tutti gli asset come prima.
- **Un acquisto o una vendita manuali non si salvano mai senza un prezzo.**
  `buildPositions()` somma l'importo di un'operazione `settled` alle quote
  possedute solo se porta `quantity`: senza, l'importo finirebbe comunque nel
  capitale versato ma le quote resterebbero a zero, e `closed = quantity <
  1e-9` farebbe apparire la posizione **chiusa** nonostante il denaro sia
  uscito — una perdita del 100% inventata, il verso più pericoloso di
  sbagliare qui. Per questo `AddInvestmentSheet` cerca sempre un prezzo alla
  data scelta (`asset_prices`, il più recente non successivo) prima di
  salvare un buy/sell, e blocca il salvataggio se non lo trova, invece di
  inventare quote da un prezzo che non conosce. I dividendi non hanno questo
  vincolo: non toccano `quantity`.
- **Il tasto centrale della tabbar, su Investimenti, è azzurro
  (`palette.invest`) e apre "Nuovo investimento"**, non più "Nuova spesa":
  prima seguiva il comportamento di sempre anche lì, ed era un errore
  categoriale aprire un foglio di spesa dalla scheda Investimenti, non solo
  un default poco specifico. Il foglio vive dentro `PortfolioScreen`
  (l'unico posto che ha già gli asset caricati via `usePortfolio`), aperto
  da `App.tsx` tramite un contatore (`investmentNonce`, stesso schema di
  `settingsNonce`) e non da un booleano, così il tasto lo riapre anche da
  una sotto-pagina (dettaglio asset, PAC) senza dover tornare alla radice.
- **La sezione Investimenti è blu, non arancione.** `palette.invest` è
  l'accento di tutta la sezione — grafici (`ScrubChart`), chip di periodo,
  chip di selezione, pulsanti di salvataggio, tasto centrale della tabbar —
  al posto di `palette.accent`, che resta l'accento del resto dell'app. Serve
  a rendere impossibile lo scambio: investire e spendere sono due versi
  diversi del denaro, e finché condividevano il colore il tasto "+" sembrava
  lo stesso tasto.
- **I guadagni negli investimenti usano `palette.investUp`, non
  `palette.good`.** Il verde brillante delle entrate accostato al blu di
  `invest` stona (due colori accesi di temperatura opposta a pochi millimetri
  l'uno dall'altro): `investUp` è lo stesso verde più cupo. Le perdite
  restano `palette.over` (arancione), scelta esplicita di Andrea. Vale anche
  per `StatTiles` e `ValueSplit`, che sono usati **solo** dentro gli
  investimenti — se un giorno servissero altrove, il colore va parametrizzato
  invece di cambiato.

### Import da estratto conto

`screens/ImportScreen.tsx` (Movimenti → "Importa", accanto alla ricerca) è
**l'unico posto da cui entrano movimenti da un file**, e ne contiene due:
l'estratto conto della banca e il recupero delle spese che la Shortcut non è
riuscita a mandare (`RecoverSheet`, che prima stava fra le Automazioni — chi
ha una spesa mancante la nota guardando l'elenco, non aprendo le impostazioni
di un comando rapido).

- **All'utente non si chiede mai di mappare le colonne.** È il vincolo che
  decide tutto il resto: un foglio "quale colonna è la data?" è il punto in cui
  abbandona chi non ha mai aperto un CSV — cioè proprio chi ne trarrebbe di
  più. `lib/statementImport.ts` riconosce da solo separatore, riga
  d'intestazione, ruolo di ogni colonna, formato di data e di numero.
- **Nessun modello linguistico tocca questi numeri.** Il riconoscimento è
  dizionari di nomi comuni (`DATE_NAMES`, `DEBIT_NAMES`, …) **più una verifica
  sul contenuto**: una colonna intestata "Data" che sotto ha testo libero non è
  una colonna di date. Aggiungere una banca nuova = aggiungere un nome al
  dizionario, ed è per questo che stanno in un elenco e non sparsi nel codice.
- **La riga d'intestazione non è la prima**: le banche ci mettono sopra
  intestatario, IBAN, saldo, righe vuote. Si prova ogni riga delle prime trenta
  e si tiene la prima che regge la verifica sul contenuto.
- **Giorno-prima o mese-prima si decide guardando tutta la colonna**, non la
  singola riga: `03/04/2025` da solo è indecidibile e sbagliare sposta le spese
  di mesi interi senza dare errore. Basta un valore che superi 12 in una delle
  due posizioni; senza nessuno, si sceglie il formato italiano.
- **Il rischio vero non è leggere male il file, è contare due volte.**
  L'estratto conto contiene le stesse operazioni già arrivate da Apple Pay, con
  un'altra data (la banca contabilizza uno o due giorni dopo) e un'altra
  descrizione. Le difese sono due, diverse apposta:
  1. `payments.dedup_key` (`stmt:giorno|importo|descrizione|progressivo`) con
     l'indice unico parziale `payments_user_dedup_key_idx`: rende **innocuo**
     reimportare lo stesso file, e regge nel database anche se il controllo
     applicativo sfugge.
  2. Confronto per importo uguale entro ±4 giorni contro ciò che già esiste,
     che è l'unico modo di riconoscere una spesa entrata da Apple Pay con
     un'altra chiave. La corrispondenza trovata viene **consumata**: due caffè
     identici lo stesso giorno sono due spese e devono trovare due
     corrispondenze distinte, altrimenti la seconda andrebbe persa.
- Il progressivo nella `dedup_key` esiste per lo stesso motivo: senza, il
  secondo caffè identico dello stesso giorno avrebbe la chiave del primo e
  sparirebbe — il conto non tornerebbe, in meno, per sempre.
- **La lettura di ciò che esiste già pagina sempre** (`readAll` in
  `lib/statementWriter.ts`) e un suo errore **interrompe l'import**: PostgREST
  tronca a 1000 righe senza errore, e ciò che non vede lo reimporterebbe come
  nuovo. Un confronto fallito non può diventare "non c'era niente".
- **Si mostra cosa si è capito PRIMA di scrivere**: quali colonne, quante righe
  riconosciute, quante scartate e perché, più l'anteprima delle prime cinque.
  È l'unico modo perché un riconoscimento sbagliato si veda finché è ancora
  annullabile. Nessun import parte da solo.
- Limite temporale: **da gennaio dell'anno precedente** (`importFloor()`). Le
  righe più vecchie si contano e si dichiarano, non spariscono in silenzio.
- Più file insieme, anche di banche diverse: ognuno ha la sua mappatura, i
  movimenti confluiscono in un unico inserimento.
- Encoding: si leggono i **byte** e si decodifica UTF-8, con ripiego su
  Windows-1252 se non è valido. Mezza Italia esporta ancora in 1252, e letto
  come UTF-8 "Caffè" si rompe: l'esercente non combacerebbe più con quello già
  in archivio, creando due gruppi per lo stesso bar. `TextDecoder` non è
  garantito su Hermes, quindi il decoder è scritto a mano.
- `cleanDescription()` toglie il contorno bancario ("PAGAMENTO POS 12/03 ORE
  14:32 CARTA \*1234 ESSELUNGA SPA MILANO" → "Esselunga Spa Milano"): senza,
  la data dentro la stringa renderebbe ogni spesa un esercente nuovo. Toglie
  solo pezzi riconoscibili con certezza, non svuota mai il campo, e la riga
  originale resta comunque in `payments.raw_notification_text`.
- Le spese passano da `resolve_merchant()` come tutte le altre (una chiamata
  per **nome distinto**, non per riga), quindi un esercente già noto porta con
  sé categoria e insegna. Le entrate finiscono in `incomes`, che non ha
  `dedup_key` né colonne per la valuta: lì la difesa è solo il confronto
  ravvicinato, e una valuta diversa dall'euro si dichiara nella nota.

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
  `type: "signup"`) né il recupero password: entrambi vanno a codice a otto
  cifre — è la lunghezza scelta lato Supabase per l'OTP email, non un valore
  a piacere: se cambia lì, `maxLength` in `AuthScreen.tsx` va allineato o
  diventa impossibile digitare il codice intero. Servono `{{ .Token }}` in
  **entrambi** i template Supabase, e il link
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
- Il recupero password va **a codice a otto cifre** (`resetPasswordForEmail` →
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
  condivisibile («Clinck: Inserisci pagamento», che legge esercente, importo
  e carta direttamente dalle proprietà della Transazione ricevuta come
  input — nessuna estrazione manuale, nessun Dizionario intermedio) e
  l'automazione si limita a scegliere quel comando come azione da eseguire
  quando scatta il trigger Wallet. È anche il motivo per cui `P5` si può
  chiudere davvero — il pezzo complicato si distribuisce con un link iCloud.
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

- `lib/guide.ts` (i passi come **dati**), `lib/guideImages.ts` (gli
  screenshot veri), `screens/GuideScreen.tsx`. Si arriva da Automazioni e
  dallo stato vuoto della Home — cioè dai due punti in cui si trova chi non
  ha ancora configurato niente.
- **Il comando rapido «Clinck: Inserisci pagamento» è già pronto e
  condiviso** via link iCloud (`SHORTCUT_INSTALL_URL` in `lib/guide.ts`,
  `P5` in `PRODOTTO.md`). Legge esercente, importo e carta **direttamente
  dalle proprietà della Transazione** passata in input (`Esercente`,
  `Importo`, `Carta o biglietto` nel selettore variabili) — verificato via
  registrazione schermo di Andrea: il tipo Transazione sopravvive benissimo
  al passaggio come input di un altro comando rapido quando è l'automazione
  stessa a passarlo di default, non serve nessun'azione «Ottieni valore
  dizionario» né un «Dizionario» intermedio per ricostruirlo.
- Sicuro da tenere pubblico dentro l'app perché il campo dell'intestazione
  `x-ingest-token` (dentro «Ottieni contenuti di URL») contiene solo il
  testo segnaposto **`INCOLLA TOKEN`**, non un token vero. Installare il
  link crea una **copia locale** del comando: modificare quella copia (per
  incollarci la propria chiave) non tocca in nessun modo l'originale
  condiviso su iCloud, quindi non c'è mai una chiave vera dentro un link
  pubblicato.
- Installare il link **non basta**: bisogna comunque incollare la propria
  chiave al posto del segnaposto (Libreria → tre puntini sul comando →
  Modifica → «Ottieni contenuti di» → intestazioni), e costruire
  **l'automazione** che lo richiama — non condivisibile in nessun modo
  (Apple non dà il pulsante Condividi alle automazioni, solo ai comandi
  rapidi normali): cercare «Wallet», lasciare tutto selezionato e scegliere
  questo comando come azione. Il primo capitolo della guida copre
  l'installazione e la chiave, il secondo l'automazione. `GuideScreen`
  offre, solo dentro il capitolo del comando, un modo di saltare
  direttamente al capitolo dell'automazione (`automazioneIndex` in
  `GuideScreen.tsx`) per chi ha già installato e configurato il link.
- **Screenshot veri, non riproduzioni schematiche**: prima versione della
  guida (`components/ActionPreview.tsx`, ora rimosso) ricostruiva ogni
  azione a blocchetti di testo, pensando che uno screenshot invecchiasse
  peggio di una descrizione. Andrea l'ha bocciata guardandola: "troppo
  testuale, la gente si perde". Uno screenshot reale con una freccia che
  indica dove toccare si legge in un secondo; un paragrafo che descrive la
  stessa azione va letto mentre si tiene in mano Comandi Rapidi con l'altra
  mano, ed è lì che si abbandona. Il costo (uno screenshot invecchia
  quando iOS sposta un campo) è minore del beneficio.
- Ogni `GuideStep` ha una `caption` di **una riga sola**, non un paragrafo:
  lo screenshot in `lib/guideImages.ts` (uno per `id` di passo, spesso
  fornito da Andrea già con una freccia rossa disegnata sopra) è il
  contenuto vero del passo, la didascalia è solo il verbo e l'oggetto
  ("Libreria → tre puntini → Modifica"). I `require` in `guideImages.ts`
  devono restare **letterali**: Metro risolve le immagini a compilazione,
  un percorso costruito a runtime non finisce nel bundle. Vanno
  ridimensionati a ~750px di larghezza prima di salvarli in
  `assets/guida/`: a piena risoluzione finirebbero interi dentro
  l'aggiornamento che ogni utente scarica.
- Non tutti i passi hanno uno screenshot: `installa` è una schermata della
  nostra app (non serve fotografarla), `seleziona-tutto` resta solo
  descritta per scelta di Andrea, `prova` non ne ha ancora uno. `chiave`
  **non ha più** il pulsante "genera e copia" — quello si è spostato sul
  passo `incolla`, l'unico posto in cui serve davvero: si genera la chiave
  e la si incolla sulla stessa schermata, invece di doverla portare in
  memoria per tre passi. `chiave` mostra solo un avviso che anticipa cosa
  succederà. `GuideScreen` non mostra niente al posto dell'immagine
  mancante — solo la didascalia — invece di un placeholder vuoto.
- **L'altezza della foto segue il suo rapporto reale**, non un'altezza
  fissa: le prime foto caricate avevano proporzioni diverse fra loro (una
  carta orizzontale contro schermate intere verticali), e un riquadro
  fisso lasciava una cornice vuota enorme intorno a quelle più larghe che
  alte — quello che Andrea ha visto come "il quadrato" da togliere. Niente
  più bordo né sfondo intorno alla foto: è la foto stessa, non una cornice
  che la contiene.
- **La foto ha `width`/`height` numerici espliciti, misurati con
  `onLayout`** — non `width: "100%"` né `aspectRatio`. Due tentativi prima
  di questo si sono rivelati sbagliati: il rapporto calcolato a runtime con
  `Image.resolveAssetSource` (primo tentativo) e poi il rapporto scritto a
  mano in `GuideImage.ratio` (secondo tentativo, vedi `guideImages.ts`) —
  in entrambi i casi `Image` ignorava il vincolo di larghezza e mostrava la
  foto alla sua dimensione nativa (750px, molto più larga dello schermo),
  tagliata a destra. Il numero scritto a mano in `guideImages.ts` non era
  il problema: lo era passarlo a `Image` come `aspectRatio` invece che come
  `height` già calcolato. Ora un `View` senza dimensioni proprie (si
  allarga di default dentro il flex-column dello ScrollView) misura la sua
  larghezza vera con `onLayout`, e quella larghezza — un numero, non una
  percentuale — diventa `width` e `width / ratio` diventa `height` sulla
  `Image`. Se in futuro la foto torna a sballarsi, il sospetto numero uno è
  di nuovo `width: "%"` o `aspectRatio` su un `Image`, non il dato in
  `guideImages.ts`.
- **La didascalia viene prima della foto, non dopo**, e la foto è al 65%
  di larghezza allineata a sinistra invece che a piena larghezza: sui passi
  con uno screenshot di una schermata intera (alta quanto lo schermo)
  leggere la didascalia sotto costringeva a scorrere per arrivarci, e la
  foto a piena larghezza da sola occupava già tutto lo spazio visibile.
  Piccola e a sinistra lascia vedere titolo, didascalia e un pezzo di foto
  senza scorrere, su ogni passo — non solo quelli con lo screenshot più
  alto.
- **Il permesso di iOS per l'automazione non ha uno screenshot vero**
  (Andrea non ce l'ha): il passo `consenti` disegna un alert **simulato**
  in codice (`step.action === "consent-illustration"` in
  `GuideScreen.tsx`), con il blu di sistema di iOS invece dell'accento
  dell'app — apposta, per far capire che non è una schermata nostra ma un
  esempio di cosa potrebbe chiedere iOS.
- Il progresso è salvato: questa procedura si fa passando avanti e indietro
  fra due app, e ricominciare da capo a ogni ritorno è il modo più rapido per
  farla abbandonare.
- **La guida era stata riscritta una prima volta sulla base di un'architettura
  sbagliata** (un Dizionario intermedio con `token`/`merchant`/`amount`
  costruito dall'automazione), inventata per analogia senza aver mai visto il
  comando vero funzionare. Andrea l'ha corretta mandando una registrazione
  schermo della procedura reale: **nessun Dizionario, nessuna estrazione
  manuale** — il comando pronto legge le proprietà della Transazione
  direttamente, e l'unico passo davvero manuale è sostituire il segnaposto
  `INCOLLA TOKEN` nell'intestazione con la propria chiave. Lezione per la
  prossima volta: quando la ricostruzione di un flusso Comandi Rapidi non è
  verificata su un dispositivo vero, dirlo esplicitamente invece di
  presentarla come confermata — qui è stata scritta due volte prima di
  essere giusta.

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
- `payments` è nella publication `supabase_realtime` (migration `0034`): la
  spesa registrata dalla Shortcut compare da sola in Home ad app aperta,
  senza tira-per-aggiornare. Solo `payments` e non le altre tabelle: è
  l'unica che cambia per mano di qualcosa che non è l'app stessa (la Edge
  Function chiamata dalla Shortcut) — tutto il resto lo scrive l'utente da
  dentro, che sa già cosa ha appena fatto e ricarica da sé.

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
- **`app.json` → `slug` non è cosmetico**: il progetto EAS è registrato
  lato server con `extra.eas.projectId` **e** lo slug associato a quel
  progetto in quel momento — cambiare solo `slug` in locale (es. per far
  seguire il rebranding "Clinck") rompe `eas update` con "Slug ... does
  not match" (`expo.fyi/eas-project-id`), scoperto da Andrea lanciando
  l'update. `name` (il nome visibile sotto l'icona) è indipendente e si
  può cambiare liberamente; `slug` resta `apple-pay-tracker` finché
  qualcuno non rinomina il progetto anche lato Expo (dashboard o
  `eas project:info`), un passo volontario, non una conseguenza del
  rebranding.

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

## Xcode / Simulatore iOS

Andrea sviluppa ora da una sessione **locale** di Claude Code sul suo Mac,
puntata al clone locale del repo (non più la sessione cloud che ha scritto
gran parte di questo file) — è lì che Xcode e il simulatore servono
davvero, e sono installati e funzionanti.

- Xcode va installato per intero (Mac App Store, o `.xip` da
  developer.apple.com se l'App Store non lo trova) — i soli Command Line
  Tools non bastano, non includono il Simulator.app né i runtime iOS.
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` dopo
  l'installazione, poi aprire Xcode una volta per far scaricare la
  piattaforma iOS da **Settings → Components** (o **Platforms** nelle
  versioni più vecchie): `xcrun simctl list runtimes` vuoto è il segno che
  manca quel passo.
- `npx expo start --offline` e non il semplice `npx expo start`: il
  progetto ha `extra.eas.projectId`/`updates.url` in `app.json`, quindi
  senza essere loggati (`npx expo login`) il dev server prova un controllo
  che chiede conferma interattiva e fallisce in background con
  `CommandError: Input is required, but 'npx expo' is in non-interactive
  mode` — il processo muore del tutto, non resta semplicemente in errore.
  `--offline` salta quel controllo; in locale non serve comunque, EAS
  Update è per la distribuzione, non per lo sviluppo.
- Il primo avvio di un simulatore appena creato (dopo aver installato il
  runtime) impiega uno o due minuti reali per il boot — non è bloccato,
  mostra prima lo spinner poi il logo Apple con la barra di progresso.
  Va aperto anche `Expo Go` la prima volta (`xcrun simctl openurl <udid>
  "exp://127.0.0.1:8081"` lo scarica e installa da solo se manca).
- Se Metro va in uno stato inconsistente dopo aver rinominato o rimosso un
  file importato altrove (es. `Unable to resolve module` persistente anche
  dopo aver corretto l'import), la cache di Metro resta sporca: riavviare
  con `npx expo start --offline --clear` invece di limitarsi a un reload.
- Lavorando in locale non serve **mai** `eas update` per vedere una
  modifica: il dev server dà hot reload istantaneo via rete locale. Quel
  comando (vedi "Il messaggio da dare ad Andrea a fine turno" sopra) resta
  utile solo per portare una modifica sul telefono fisico da un'altra
  sessione, non per lo sviluppo quotidiano sul Mac.
