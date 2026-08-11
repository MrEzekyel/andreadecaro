# Piano marketing

Piano di lancio e di crescita per i primi 12 mesi, scritto l'11 agosto 2026.
Struttura AARRR (Acquisizione, Attivazione, Retention, Referral, Revenue),
adattata a come stanno davvero le cose: una persona sola, ~100 € di budget,
app non ancora sull'App Store.

Come `PRODOTTO.md`, questo non è un elenco di cose desiderabili: è la
sequenza di mosse che porta da "app finita" a "sconosciuti che pagano",
con i numeri veri e le cose che **non** faremo, dette prima.

---

## 1. Sintesi

**Le tre scommesse:**

1. **Il prodotto si dimostra da solo in 10 secondi.** Paghi col telefono,
   la spesa compare categorizzata. Questo è un video, e i video così li
   distribuiscono gratis TikTok, Reels e Shorts. Il motore di crescita è
   il video breve organico, non la pubblicità a pagamento.
2. **La stampa Apple italiana è il moltiplicatore del lancio.** Un
   developer indie italiano, un trigger di iOS che quasi nessuno conosce
   (Automazione → Transazione), zero credenziali bancarie, 1,99 €. È
   esattamente l'articolo che iPhoneItalia, SaggiamenteApple e HDblog
   scrivono volentieri. Costo: zero. Un articolo vale più dei 100 € in ads.
3. **L'onestà è il posizionamento, non un vincolo.** "Ti dico subito cosa
   non traccia" è l'opposto di ogni fintech, ed è memorabile. La stessa
   scelta fatta nel README diventa la voce di ogni contenuto.

**I 100 €:** non sono il motore, sono l'acceleratore del mese di lancio.
Ripartizione consigliata più sotto (§4): ~15 € dominio, ~60 € Apple Search
Ads, ~25 € di riserva sul miglior video organico. Niente Meta/Instagram
ads: i conti in §8 mostrano perché sarebbero soldi bruciati a questo prezzo.

**Priorità dei primi 90 giorni:** chiudere i prerequisiti (nome, dominio,
Apple Developer Program, TestFlight), fare una beta con 20–50 persone,
lanciare sull'App Store a ottobre con stampa + video + Search Ads tutti
nella stessa settimana.

**Risultato atteso a 12 mesi** (scenari onesti in §10): base 2–4.000
download e 100–200 paganti (~1.500–3.000 €/anno); con un colpo riuscito —
un video che gira o un articolo grosso — 10–15.000 download e 500–800
paganti. A 1,99 €/mese il volume è tutto: nessuno scenario rende ricchi
nel primo anno, e va detto adesso.

---

## 2. Inquadramento strategico

### Il claim

> **Ogni pagamento Apple Pay entra da solo. Il resto in tre secondi con
> Siri.**

Già deciso in `P6`, e vale ovunque: App Store, video, articoli, landing.
Promette meno di quello che l'app fa e regge alla prima settimana d'uso —
che è dove le app concorrenti perdono la fiducia.

Il secondo messaggio, da usare come contrasto competitivo:

> **Niente collegamento bancario. Le tue credenziali non passano di qui.**

In Italia la diffidenza verso "collega il tuo conto" è alta e motivata.
Le app concorrenti (Fleur, Spendee, e chiunque usi Open Banking) chiedono
le credenziali bancarie; questa legge quello che Apple Pay già mostra sul
telefono. È un vantaggio percepibile senza spiegazioni tecniche.

### A chi ci si rivolge (ICP)

Italiano/a, 20–40 anni, iPhone, paga con Apple Pay più volte a settimana,
ha già provato a tracciare le spese (Excel, note, un'altra app) e ha
mollato per la fatica dell'inserimento manuale. Segmento secondario: chi
investe con PAC su Trade Republic o simili — il modulo investimenti
gratuito (XIRR, prezzo intraday reale) è unico a questo prezzo e pesca
esattamente lì.

Chi **non** è il cliente: chi vuole tutte le spese automatiche al 100%
(serve Open Banking, dichiarato non-obiettivo), famiglie che vogliono un
budget condiviso (`P19`), utenti Android.

### La logica economica

- Prezzo: 1,99 €/mese o 15 €/anno. Netto dopo Apple (Small Business
  Program, 15%): **~1,69 €/mese, ~12,75 €/anno**.
- Trial: 2 mesi dalla registrazione. Quindi **i primi incassi arrivano due
  mesi dopo il lancio**: lancio a ottobre → primi paganti a dicembre. Va
  messo in conto per non leggere il novembre a zero euro come un fallimento.
- Solo l'automazione è a pagamento; il resto è gratis per sempre (`P7`,
  `P9`). In marketing questo si dice così: *"L'app è gratis. Paghi solo se
  vuoi che le spese si scrivano da sole."* — che è una frase che converte
  meglio di qualsiasi trial mascherato.

### La voce

La stessa dei documenti di questo repo: diretta, onesta, senza gonfiare.
Niente "rivoluzionario", niente "l'unica app che ti serve". Si dichiara la
copertura reale (40–60%) prima che la scopra l'utente. Nei contenuti
social questa onestà **è il gancio**, non una nota a piè di pagina.

---

## 3. Stato attuale

**Fase di crescita:** pre-revenue, pre-lancio. Prodotto finito nelle parti
difficili (sprint 1–4 chiusi: fiducia, attrito zero, integrità del dato,
sicurezza), fermo sui prerequisiti amministrativi.

**Team:** una persona (Andrea), più questa sessione per l'esecuzione
tecnica e i contenuti scritti. Nessun budget ricorrente, ~100 € una tantum.

**Cosa esiste già e ha valore di marketing:**

- Il comando rapido condivisibile con un tocco (`P5`) — abbatte l'attrito
  del setup, che è l'obiezione n°1.
- La guida in-app passo-passo — idem.
- Il referral interno (5 amici confermati = 2 mesi, `P20`) — già deciso
  che **non si cita mai nelle campagne**: è un beneficio per chi c'è, non
  un gancio. Questo piano lo rispetta.
- Il modulo investimenti gratuito — il differenziatore che nessun
  concorrente a questo prezzo ha.
- L'export CSV vero, la lettura offline, il blocco Face ID — argomenti di
  fiducia spendibili in un articolo.

**Cosa blocca tutto il resto** (da `DA-FARE.md`, qui solo l'impatto
marketing):

| Blocker | Cosa sblocca |
| --- | --- |
| Nome dell'app (vedi §13 — decisione n°1) | App Store, dominio, ASO, ogni contenuto |
| Dominio (~10–15 €) | Privacy policy (`P4`), landing, email professionale per la stampa |
| Apple Developer Program (99 $/anno) | TestFlight, App Store, IAP — l'intero funnel |
| Template email su Supabase (5 min) | Registrazione funzionante per i beta tester |
| Giro di test manuale | Il diritto di far provare l'app ad altri |

Nota: i 99 $ di Apple sono un costo di prodotto, non di marketing — non
escono dai 100 €.

---

## 4. Acquisizione — come gli sconosciuti scoprono l'app

In ordine di rendimento atteso per euro speso (il primo è quello su cui
si costruisce, gli altri si sommano):

### 4.1 Video breve organico (TikTok, Reels, Shorts) — il motore

Il momento "pago → notifica → spesa già categorizzata nell'app" è un
video di 10 secondi che si spiega da solo, in qualunque lingua. Nessun
altro canale ha distribuzione gratuita di questa portata.

**Tre filoni, da alternare:**

1. **Il momento magico.** Ripresa verticale: si paga alla cassa col
   telefono, si apre l'app, la spesa è lì. Hook testuale: *"Pago e si
   scrive da sola"*. Varianti: bar, supermercato, benzina, online.
   È il filone da cui aspettarsi il video che decolla — va rifatto in
   tante varianti, non pubblicato una volta sola.
2. **Finanza personale coi propri numeri.** *"Quanto ho speso davvero a
   agosto"* con gli screenshot dell'app (categorie, andamento, mediana).
   Il money-content in italiano performa e l'app è lo sfondo naturale.
3. **Build in public.** *"Sto costruendo da solo un'app di spese e vi
   dico anche cosa NON traccia."* L'onestà sulla copertura (40–60%) come
   gancio narrativo. Funziona anche su LinkedIn/X in formato testo.

**Cadenza sostenibile per una persona:** 3–4 video/settimana da
settembre, riciclando lo stesso girato sui tre canali (TikTok, Reels,
Shorts — pubblicazione nativa su ciascuno, non repost col watermark).

**I ~25 € di riserva del budget:** quando un video supera nettamente gli
altri, si mette il boost lì (Meta/TikTok promote) per stressarlo — è un
test creativo pagato, non una campagna.

### 4.2 Stampa Apple italiana — il moltiplicatore del lancio

Il pitch, in una riga: *"Developer italiano indie usa il trigger Wallet di
iOS — quello che quasi nessuno conosce — per far scrivere le spese da
sole. Niente Open Banking, 1,99 €, e il tracker investimenti è gratis."*

**Target, in ordine:** iPhoneItalia, SaggiamenteApple, HDblog, SmartWorld,
Melablog; più i canali YouTube italiani che coprono Comandi Rapidi e
produttività iOS. Contatto via email dal dominio nuovo, una settimana
prima del lancio, con: press kit (2 paragrafi, 5 screenshot, video demo
15s, link TestFlight o promo code), embargo suggerito ma non richiesto.

Un solo articolo di iPhoneItalia porta più installazioni di tutto il
budget in ads. Costo: il tempo di scrivere 10 email personalizzate.

### 4.3 ASO (App Store Optimization) — la rendita

- **Titolo**: `<Nome> — Spese in automatico` (30 caratteri, il nome vero
  è la decisione di §13).
- **Sottotitolo**: *"Apple Pay entra da solo. E il resto con Siri"* o
  variante con keyword `spese`, `budget`.
- **Keyword field**: `spese,tracker,budget,soldi,risparmio,portafoglio,
  investimenti,pac,wallet,contanti`.
- **Screenshot**: il primo è il momento magico con la caption del claim;
  poi statistiche, limiti, investimenti, export. Un **App Preview video**
  di 15–20 secondi (il girato del filone 1 riadattato).
- Rating prompt in-app (`SKStoreReviewController`) dopo un momento di
  valore — es. al decimo pagamento automatico registrato — mai all'avvio.

### 4.4 Apple Search Ads — dove vanno i ~60 €

L'unico paid che ha senso a questo prezzo: intercetta chi sta **già
cercando** un tracker di spese sull'App Store italiano, con intento
massimo e CPT basso su keyword italiane poco contese (`tracker spese`,
`spese`, `gestione spese`, `budget app`, nomi dei concorrenti).

Modalità: campagna base, solo Italia, solo mese di lancio, tetto
giornaliero 2–3 €. Obiettivo: dati, non volume — capire quali keyword
convertono per deciderne il futuro. A budget esaurito si spegne e si
valuta col §12.

**Perché non Meta/Instagram/TikTok ads:** i conti stanno in §8, ma in
breve: con un CPI realistico di 1,5–4 € per un'app finanza in Italia e
una conversione install→pagante generosa del 5%, un pagante costa 30–80 €
contro un valore primo anno di ~13 €. Non è "poco efficiente": è
strutturalmente in perdita a questo prezzo, a qualunque scala piccola.

### 4.5 Community — mirato, mai spam

- **r/ItaliaPersonalFinance**: prima si contattano i mod, poi un post
  onesto in stile "ho costruito questo, ecco cosa fa e cosa non fa" — il
  tono del README è esattamente quello giusto per Reddit. Un post, fatto
  bene, al lancio. Mai ripetuto.
- **Forum FinanzaOnline, gruppi Telegram/Facebook di finanza personale**:
  stesso approccio, dosato.
- Il segmento PAC/Trade Republic è particolarmente adatto: il modulo
  investimenti gratuito è la porta d'ingresso lì.

### 4.6 Cosa si salta, e perché

| Canale | Perché no |
| --- | --- |
| Meta/TikTok/Google ads di acquisizione | in perdita strutturale a 1,99 €/mese (§8) |
| Product Hunt | l'app è solo in italiano; rimandato a eventuale localizzazione EN (§13) |
| Influencer a pagamento | 100 € non comprano un post; si fa **seeding gratuito** (promo code + accesso anticipato a micro-creator finanza/tech italiani) e basta |
| Directory, SEO/blog | B2C consumer iOS: tempi lunghi e ritorno basso; la landing resta una pagina sola |
| PR internazionale | dopo l'eventuale localizzazione EN, non prima |

---

## 5. Attivazione — dal download al primo pagamento automatico

**L'evento di attivazione è uno solo: il primo pagamento registrato
dall'automazione.** Non a caso è già la definizione di referral confermato
(`P20`): tutto il sistema converge lì.

Il muro è il setup della Shortcut. Il prodotto ha già fatto la sua parte
(comando pronto con un tocco, guida in-app, progresso salvato); il
marketing deve fare la sua:

- **Dire il costo del setup prima, e venderlo come basso ma reale**: *"2
  minuti di configurazione, una volta sola"*. Chi arriva sapendolo lo
  completa; chi se lo aspetta gratis abbandona e lascia una stella.
- **Il video del setup completo in tempo reale** (60–90s, senza tagli) è
  un contenuto di acquisizione E di attivazione: dimostra che i "2 minuti"
  sono veri. Da linkare anche nella descrizione App Store.
- **Screenshot veri nella guida** (`DA-FARE.md`): da fare durante il giro
  di test, prima della beta.
- Misurare il funnel (già possibile con i dati esistenti su Supabase):
  registrati → token generato → primo pagamento automatico. Il tasso
  registrato→attivato è IL numero della beta: se è sotto il ~40% si
  sistema la guida prima di spendere un euro in acquisizione.

---

## 6. Retention — perché l'app si riapre

La retention qui è guidata dal prodotto (l'automazione scrive da sola,
l'app si apre per guardare), non dalle campagne. Le leve già esistenti
bastano per il primo anno:

- **Realtime**: la spesa compare mentre l'app è aperta — il momento
  "funziona davvero" si ripete a ogni acquisto.
- **Limiti e ritmo di spesa**: il motivo per riaprire a metà mese.
- **Controllo di fine mese** (`month_checks`): riapertura mensile con uno
  scopo.
- **Changelog col pallino** (`P18`): ogni update OTA è un piccolo motivo
  di ritorno.
- **Email**: solo transazionali per ora (conferma, reset). Una sequenza
  di onboarding via email (giorno 1: setup; giorno 7: statistiche; giorno
  50: "il trial sta finendo") ha senso **dopo** il lancio, quando c'è
  volume — rimandata a Q1 2027, con la skill `emails`.
- Le push per i limiti (`P16`) restano decisione di prodotto rimandata;
  quando arriverà la build nativa saranno la leva di retention più forte
  disponibile.

---

## 7. Referral — già deciso, si rispetta

Il programma esiste (`P20`: 5 amici confermati = 2 mesi extra), vive solo
dentro l'app, e **non si cita mai nelle campagne**. L'unico lavoro di
marketing qui è indiretto: rendere l'app abbastanza buona da essere
mostrata al bar — che è esattamente il filone video n°1.

Da monitorare da dicembre: quanti utenti attivi hanno ≥1 referral
confermato. Se il numero è zero spaccato, il posto giusto per parlarne è
la schermata post-attivazione (in-app, non ads) — decisione da prendere
allora, non ora.

---

## 8. Revenue — i conti, senza illusioni

**Unit economics:**

| Voce | Valore |
| --- | --- |
| Annuale netto (dopo 15% Apple) | ~12,75 € |
| Mensile netto | ~1,69 €/mese |
| Valore primo anno di un pagante | ~13–20 € |
| CAC massimo sostenibile (primo anno) | ~4–6 € per **pagante** |
| Conversione install→pagante realistica | 3–6% |
| → spesa massima sostenibile per **install** | ~0,20–0,30 € |

Nessun canale a pagamento in Italia consegna install di qualità a 0,25 €.
Ecco perché il paid è escluso come motore: non è prudenza, è aritmetica.
I canali del §4 (video organico, stampa, ASO) hanno CAC ~0 € e sono gli
unici compatibili con questo prezzo.

**Cosa NON cambiare adesso:** il prezzo è giusto per il lancio. 1,99 €
è sotto la soglia di riflessione, e l'annuale a 15 € (−37%) spinge
correttamente sull'impegno lungo. Eventuali ritocchi si valutano con
dati veri (≥100 trial scaduti), non prima. Il candidato upsell futuro
resta `P17` (obiettivi di risparmio legati al portafoglio) — l'unica
feature che YNAB non può copiare.

---

## 9. Roadmap 90 giorni

Le settimane partono da quando si sblocca il primo prerequisito (nome +
Apple Developer Program). Con partenza immediata: lancio pubblico a
metà ottobre.

**Settimane 1–2 · Sbloccare** — owner: Andrea (+ sessione per i testi)

- [ ] Decidere il **nome** (§13, decisione n°1) e comprare il dominio
- [ ] Iscrizione Apple Developer Program + Small Business Program
- [ ] Template email Supabase (5 min, sblocca la registrazione)
- [ ] Privacy policy scritta (sessione) e pubblicata sul dominio
- [ ] Giro di test manuale completo (checklist in `DA-FARE.md`)
- [ ] Screenshot veri per la guida in-app

**Settimane 3–4 · Fondamenta** — owner: Andrea + sessione

- [ ] RevenueCat + build nativa + TestFlight
- [ ] Beta privata: 20–50 persone (amici, colleghi, segmento PAC).
      Obiettivo: tasso di attivazione ≥40% e primi 5 feedback scritti
      utilizzabili come social proof
- [ ] Listing App Store completo: titolo, sottotitolo, keyword,
      screenshot, App Preview video (skill: `aso`)
- [ ] Landing a una pagina sul dominio (claim, video, link store, privacy)
- [ ] Primi contenuti build-in-public pubblicati (il canale si scalda
      prima del lancio, non il giorno stesso)

**Settimane 5–8 · Lancio** — owner: Andrea + sessione

- [ ] Press kit + 10 email personalizzate alla stampa Apple italiana
      (skill: `public-relations`), una settimana prima
- [ ] Pubblicazione App Store
- [ ] Settimana di lancio concentrata: articoli fuori + 5–7 video del
      filone "momento magico" + post Reddit/community + Apple Search Ads
      accese (~60 €)
- [ ] Rating prompt attivo dal giorno 1 (le prime 20 recensioni pesano
      più di tutto il resto dell'ASO)

**Settimane 9–12 · Ritmo** — owner: Andrea

- [ ] Cadenza video stabile (3–4/settimana), raddoppiando sui format che
      i dati premiano
- [ ] Boost (~25 €) sul miglior video organico
- [ ] Seeding: promo code a 10–20 micro-creator finanza/tech italiani
- [ ] Revisione settimanale dei numeri (§12) — 30 minuti, ogni lunedì
- [ ] Primi paganti attesi a dicembre (trial di 2 mesi): non giudicare
      il revenue prima

---

## 10. Prospettiva 12 mesi

| Trimestre | Obiettivo | Segnale che funziona |
| --- | --- | --- |
| Q4 2026 | Lancio + attivazione | 1.000+ download, attivazione ≥40%, 20+ recensioni ≥4,5★ |
| Q1 2027 | Conversione | trial→pagante ≥8%, primi 100 paganti, churn mensile noto |
| Q2 2027 | Raddoppio del motore | un canale organico chiaramente vincente su cui concentrare tutto; valutazione localizzazione EN |
| Q3 2027 | Espansione | se EN: Product Hunt + stampa internazionale; se IT: `P17` come leva di conversione |

**Scenari a 12 mesi dal lancio** (tutti con spesa ~100 €):

- **Base** (nessun colpo fortunato, solo costanza): 2–4.000 download,
  100–200 paganti, ~1.500–3.000 €/anno di ricavi netti.
- **Buono** (un video sopra le 500k view O un articolo grosso): 10–15.000
  download, 500–800 paganti, ~7–12.000 €/anno.
- **Cosa cambia col budget**: sopra ~500 €/mese di ricavi ricorrenti ha
  senso reinvestire il 30–50% in Search Ads sulle keyword che i primi
  60 € avranno dimostrato redditizie. Prima no.

---

## 11. Stack operativo — chi fa cosa, con quali strumenti

| Fase | Mossa | Skill | Strumenti |
| --- | --- | --- | --- |
| Acquisizione | Script e hook dei video | `social`, `video` | CapCut, girato iPhone |
| Acquisizione | Press kit e pitch stampa | `public-relations`, `copywriting` | email dal dominio |
| Acquisizione | Listing App Store | `aso`, `copywriting` | App Store Connect |
| Acquisizione | Search Ads (60 €) | `ads` | Apple Search Ads |
| Acquisizione | Landing | `cro`, `copywriting` | pagina statica sul dominio |
| Attivazione | Funnel setup + video guida | `onboarding`, `signup` | query Supabase già possibili |
| Attivazione | Analisi feedback beta | `customer-research` | note + interviste brevi |
| Retention | Sequenza email (Q1 2027) | `emails` | da scegliere (Resend è il candidato) |
| Revenue | Revisione prezzo con dati | `pricing`, `paywalls` | RevenueCat dashboard |
| Trasversale | Revisione settimanale | `marketing-loops`, `analytics` | App Store Connect + Supabase |
| Trasversale | Test creativi | `ab-testing`, `ad-creative` | boost sul vincitore |

Le decisioni già prese e chiuse non si riaprono: prezzo (`P10`), paywall
(`P9`), referral fuori dalle ads (`P20`), niente Open Banking, niente
condivisione familiare (`P19`).

---

## 12. Misurazione — il pannello del lunedì

**Metrica stella polare: utenti con automazione viva** = ≥1 pagamento
automatico negli ultimi 7 giorni. Misura insieme attivazione, retention e
la premessa del revenue (si paga solo l'automazione).

Il funnel, leggibile già oggi con query su Supabase + App Store Connect:

```
impression store → download → registrazione → token generato
   → 1° pagamento automatico (ATTIVAZIONE) → vivo a 7gg
   → fine trial → pagante → rinnovo
```

Soglie che fanno scattare un'azione (non numeri da guardare e basta):

- attivazione <40% → si lavora su guida/onboarding, si ferma l'acquisizione
- trial→pagante <5% dopo i primi 100 trial scaduti → si riapre §8
- una keyword Search Ads con CPT <0,30 € e download → merita il budget
  residuo; nessuna → il paid si chiude senza rimpianti
- un filone video con retention/condivisioni doppie degli altri → si
  raddoppia lì e si dimezza altrove

---

## 13. Decisioni aperte

1. **Il nome dell'app** — la più urgente, blocca tutto. "Apple Pay
   Tracker" viola le linee guida sul marchio Apple (un'app con "Apple
   Pay" nel nome non passa la review) e comunque non è un brand. Serve:
   corto, pronunciabile in italiano, dominio libero, ragionevolmente
   libero sull'App Store. Da decidere **prima** del dominio e del
   Developer Program, perché ci si aggancia tutto.
2. **Repo pubblico o privato** (`P15`) — nota nuova: questo piano è nel
   repo. Se resta pubblico, anche la strategia lo è. Un motivo in più per
   chiudere la decisione.
3. **Facce nei video** — Andrea in camera (più conversione, più costo di
   produzione) o faceless (più sostenibile a 3–4/settimana)? Si può
   partire faceless sul filone 1 e decidere col filone 3.
4. **Localizzazione inglese** — sblocca Product Hunt e il mercato
   globale; da valutare in Q2 2027 solo se il motore italiano gira.
5. **Timing Apple Developer Program** — ogni settimana di ritardo sposta
   il lancio di una settimana: è l'unico vero collo di bottiglia del
   calendario.
