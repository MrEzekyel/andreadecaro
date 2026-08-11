# Apple Pay Tracker — Marketing Plan v1

**Prepared by:** Claude (sessione di sviluppo del prodotto)
**Per:** Andrea, fondatore unico
**Data:** 2026-08-11
**Stato:** Draft v1 — da rivedere con Andrea prima di eseguire

**Nota sul metodo:** questo piano segue la struttura fCMO a 13 sezioni/AARRR, ma è
adattato in modo pesante alla realtà del cliente: **fondatore solo, autofinanziato,
senza round di raccolta, pre-lancio**. Dove il template standard presuppone un
team e capitale di rischio, questo piano lo dice esplicitamente e sostituisce la
logica "cosa sblocca il prossimo round" con "cosa sblocca il primo segnale di
ricavo reale" — è la metrica che conta qui.

**Aggiornamento 11 agosto:** budget del test Meta Ads fissato da Andrea a
**100€, tetto fisso** (esclusi i costi Apple Developer Program). Di conseguenza
la soglia "20-50 utenti" del brief iniziale è stata ricalibrata: con 100€ lo
scenario centrale plausibile è 15-20 automazioni completate, e la metrica di
lettura del test diventa il **costo per automazione**, non un conteggio
assoluto — vedi §4 Move 3 e §13 per i conti e la regola di decisione.

---

## 1. Executive summary

**In una frase:** questo piano ottimizza per una sola cosa nei primi 90 giorni —
scoprire, con la spesa minima possibile, se l'automazione Apple Pay è un gancio
abbastanza forte da convertire sconosciuti in utenti che completano davvero
l'automazione, prima di decidere se e quanto investire in canali a pagamento.

**Le tre scommesse, in ordine di leva:**

1. **La sequenza conta più della creatività.** Il collo di bottiglia oggi non è
   "che video facciamo", è la catena tecnica (Apple Developer Program → RevenueCat →
   build nativa → TestFlight → App Store) che deve chiudersi entro il 10 ottobre
   perché qualunque euro speso in ads prima di allora finirebbe su un funnel rotto
   (installare Expo Go per installare l'app dentro). Ogni settimana di ritardo sul
   primo anello si mangia margine dal lancio, non dal budget ads.
2. **Il test a pagamento deve rispondere a una domanda sola, non a tre.** Il piano
   di Andrea (caroselli Meta Ads → utenti attivi sull'automazione → eventuale
   TikTok organico) è corretto nell'impianto, ma va isolato: creativo unico,
   messaggio unico. Mescolare più varianti nel primo test renderebbe il risultato
   illeggibile — non si saprebbe se un fallimento è colpa del messaggio, del
   prezzo o del pubblico. Con un tetto di **100€** (deciso da Andrea, esclusi i
   costi Apple Developer Program), la lettura giusta non è più "quanti utenti
   totali" ma **quanto costa un'automazione completata** — coi conti fatti in
   §4/§9, 100€ producono realisticamente 5-40 automazioni, non i 20-50 ipotizzati
   inizialmente come riferimento comodo.
3. **La metrica giusta non è il download.** È **l'automazione completata con un
   pagamento vero registrato**. Un download è gratis e non dice niente sul
   prodotto; un'automazione configurata è la prova che qualcuno ha davvero superato
   l'attrito di Comandi Rapidi per un'app che ha appena scoperto — è il segnale che
   vale il prezzo dell'ads.

**Come si presenta lo stato a 12 mesi, plausibilmente:**
- App pubblicata e stabile su App Store, abbonamento reale funzionante via RevenueCat
- Un primo test a pagamento chiuso con un numero (non un'opinione) su quanti
  sconosciuti diventano utenti attivi dell'automazione
- Se il numero regge: passaggio a un mix organico (TikTok) + paid ricalibrato sul
  creativo vincente, con CAC noto invece che stimato
- Se il numero non regge: pivot deliberato su canali organici a costo quasi zero
  (TikTok, community italiane di finanza personale/FIRE, ASO) prima di rimettere
  soldi in ads — non un secondo tentativo alla cieca con lo stesso funnel
- Un primo nucleo di referral organico dagli utenti reali (il programma esiste già
  in-app, mai negli ads)

**Priorità nei primi 90 giorni:**
1. Avviare subito Apple Developer Program + Small Business Program (blocca tutto il resto)
2. Costruire una pagina prodotto minima (non esiste oggi) — serve da bio-link per TikTok/Instagram e da destinazione per i primi click organici, prima ancora dell'App Store
3. Portare a termine RevenueCat, build nativa, TestFlight, submission (catena tecnica, non marketing, ma la precondizione di tutto)
4. Preparare i creativi Meta Ads (caroselli) con Andrea che cura palette/moodboard — pronti *prima* della pubblicazione, non dopo
5. ~~Definire il budget test reale~~ — **fatto: 100€, esclusi i costi Apple Developer Program**
6. Spendere i primi ~20-25€ in 2-3 giorni per leggere il CPI reale prima di impegnare il resto — con un tetto così piccolo, un CPI disastroso letto solo a fine budget non lascerebbe margine per correggere
7. Lanciare il resto del test con la regola costo-per-automazione già scritta in §9/§13, non decisa a posteriori

---

## 2. Strategic frame

*(Distillato da `.agents/product-marketing.md` — quel documento resta la fonte, questo è il riassunto operativo.)*

### Cos'è, in una frase
Il tracker di spese che si scrive da solo quando paghi con Apple Pay — senza
collegare la banca a nessuno.

### La categoria che rivendichiamo
Non una nuova categoria: **tracker di spese personali per iOS**, categoria
affollata (YNAB, Copilot, Spendee). La rivendicazione non è "abbiamo inventato
qualcosa di nuovo", è "abbiamo tolto l'unica cosa che fa fallire questa
categoria" — l'inserimento manuale — senza il compromesso che gli altri fanno per
toglierla (collegare le credenziali bancarie a un aggregatore terzo).

### Per chi (ICP, distillato)
⚠️ Ipotesi, non ancora validata:
- Utenti iPhone in Italia che usano Apple Pay come metodo di pagamento quotidiano, non occasionale
- Hanno già provato e abbandonato un tracker di spesa per la fatica dell'inserimento manuale, oppure pagano già un concorrente internazionale e trovano il prezzo sproporzionato
- Vogliono vedere spese e investimenti nello stesso posto
- Sensibili al tema privacy: l'idea di "collegare la banca" a un'app terza li frena

### La logica del modello di business
Freemium a tempo, non freemium a feature: l'intera app è gratis per sempre tranne
l'automazione, che è anche l'unica parte davvero costosa da mantenere (Edge
Function, conversione valuta, dedup) e l'unica che il concorrente non replica
facilmente senza reinventare l'integrazione Wallet. Il trial di 2 mesi non è
arbitrario: serve un primo confronto mese-su-mese, che con un solo mese di dati
non è mai possibile — meno di 2 mesi avrebbe fatto scadere il trial nel momento
esatto in cui l'app iniziava a essere utile.

### Voce del brand (non negoziabile)
Presa direttamente dal tono già scelto nel prodotto (README, copy in-app):
- **Diretto e onesto anche quando scomodo**: il README dichiara i propri limiti
  (copertura 40-60%) nella prima riga, non in fondo alle FAQ. Ogni copy ads deve
  rispettare la stessa regola — mai promettere "tutte le tue spese, automaticamente".
- **Mai hype, mai superlativi.** Niente "rivoluzionario", niente "intelligenza
  artificiale"/"smart" come gancio (non è il differenziatore del prodotto).
- **Design ispirato ad Anthropic/Claude**: fondo caldo, un solo colore d'accento,
  pesi tipografici bassi. I creativi ads devono restare in questo registro visivo
  — non gamificato, non pieno di badge/coriandoli, coerente con quello che l'utente
  vede aprendo l'app per la prima volta (disallineamento fra ads e prodotto reale è
  il modo più veloce di bruciare la fiducia comprata con l'ads stesso).

---

## 3. Current state

### Team (superficie marketing)

| Persona | Ruolo | Cosa presidia |
|---|---|---|
| Andrea | Fondatore unico | Prodotto, decisioni di business, identità visiva (palette/moodboard in corso), esecuzione operativa (Apple Developer Program, Meta Ads Manager) |
| Claude (questa sessione) | Sviluppo prodotto + supporto strategico marketing | Codice, documentazione di prodotto, questo piano; non esegue azioni che richiedono account/carta di credito di Andrea |

Nessun secondo hire previsto in questo orizzonte di 12 mesi — a questa scala
(fondatore solo, pre-ricavo) sarebbe prematuro. Il primo hire, se il test a
pagamento funziona, andrebbe considerato solo dopo un segnale di ricavo reale
(vedi §11), non prima.

### Budget marketing (oggi)

- **Paid acquisition: 100€, tetto fisso, esclusi i costi Apple Developer Program.**
  Deciso da Andrea l'11 agosto. Cifra piccola per un test app-install: coi
  benchmark indicativi in §4 Move 3, produce realisticamente 5-40 automazioni
  completate, non le 50 ipotizzate come riferimento iniziale — il piano legge il
  risultato sul costo per automazione, non su un conteggio assoluto (§13).
- **Stack tooling:** Supabase (già in uso per il prodotto, non marketing puro),
  nessun tool marketing dedicato ancora (no Mixpanel/Amplitude, no ESP per
  lifecycle email, no tool ASO a pagamento)
- **Retainer/fCMO:** nessuno
- **Headcount marketing dedicato:** zero

Questo mappa a un livello "pre-seed / bootstrapped" nella terminologia standard
fCMO, con una differenza sostanziale: **non c'è un round in arrivo che sblocca il
livello successivo**. Il livello successivo si sblocca solo se il test a
pagamento produce un CAC sostenibile rispetto al prezzo (1,99€/mese, ~1,69€ netti
dopo la quota Apple) — vedi §10 per la logica.

### Fase di crescita
Fase "pre-ricavo, pre-lancio" — prima ancora di $0-10K. Il vincolo dominante non
è la crescita, è **la validazione**: sapere se il prodotto ha un gancio di
acquisizione prima di investire tempo in canali che compongono nel tempo (SEO,
content) che a questa scala non avrebbero ancora nulla su cui compondere.

### Cosa è già fatto (riconoscerlo prima di costruire sopra)

| Asset | Stato | Leva marketing |
|---|---|---|
| App funzionante, sprint 1-4 chiusi (fiducia, attrito zero, integrità del dato, sicurezza) | Fatto | Il prodotto regge la promessa che gli ads farebbero — non stiamo per vendere qualcosa di rotto |
| Guida in-app passo-passo per l'automazione | Fatto | Riduce l'abbandono nel momento più critico (setup della Shortcut), che altrimenti vanificherebbe qualunque click pagato |
| Comando rapido condivisibile «Clinck: Inserisci pagamento», link installabile con un tap | Fatto | Dimezza l'attrito rispetto ai passi manuali — direttamente rilevante per la conversione del test ads |
| Programma referral interno (5 amici confermati = 2 mesi extra) | Fatto, mai promosso negli ads per scelta esplicita | Leva di retention/passaparola organico dopo il lancio, non canale di acquisizione a pagamento |
| Modello di prezzo deciso e implementato lato server | Fatto | Il pulsante "Abbonati" è pronto, manca solo RevenueCat per accettare il pagamento vero |
| README onesto sui limiti di copertura | Fatto | Base di copy per gli ads: la stessa onestà va portata nel creativo, non solo nel prodotto |

### Cosa è in corso (bozzato ma non spedito)

| Elemento | Stato | Blocco |
|---|---|---|
| Identità visiva (palette, moodboard) | In corso, Andrea in prima persona | Nessuno — procede in parallelo |
| Catena Apple Developer Program → RevenueCat → build → TestFlight → App Store | Non ancora avviata | **Il blocco è iniziare** — nessun impedimento tecnico, solo il primo passo (iscrizione) da fare |
| Repo privato dedicato | Deciso, non ancora eseguito | In attesa del comando esplicito di Andrea |

### Cosa è fermo (da sbloccare questo trimestre)

| Problema | Costo dell'inazione | Azione |
|---|---|---|
| Nessuna pagina prodotto/landing page esiste | Senza di essa non c'è un link da mettere in bio su TikTok/Instagram, né una destinazione per il primo traffico organico prima ancora che l'app sia sullo store | Costruirne una minima, vedi §4 Move 1 |
| Budget test Meta Ads non definito | Senza un numero, il piano media resta un'intenzione, non un piano | Andrea fissa una cifra — vedi §13 decisione #1 |
| Nessuna metrica di attivazione instrumentata (quanti utenti completano l'automazione, non solo il download) | Il test da 20-50 utenti non si può misurare senza tracciarlo | Serve un evento tracciato lato prodotto — vedi §5 |

### Rubrica di stato — 17 sezioni

*Punteggio stimato da materiali disponibili (README, PRODOTTO.md, questa sessione), non da un audit formale.*

| # | Sezione | Punteggio | Nota |
|---|---|---|---|
| 1 | Posizionamento | 3/5 | Chiaro nella testa del fondatore e nel prodotto, non ancora testato su un pubblico esterno |
| 2 | Customer research | 0/5 | Zero interviste, zero utenti reali — atteso a questo stadio |
| 3 | Homepage | 0/5 | Non esiste una pagina prodotto |
| 4 | Pagine vendita/prodotto | 0/5 | Idem |
| 5 | Pagine di conversione | 0/5 | Idem |
| 6 | Confronto competitor | 1/5 | Solo interno (`.agents/product-marketing.md`), niente di pubblico |
| 7 | Contenuti/risorse | 0/5 | Nessun contenuto pubblicato |
| 8 | Onboarding | 4/5 | Solido in-app (guida passo-passo, trial banner) — punto di forza reale |
| 9 | Email lifecycle | 1/5 | Solo transazionali (recupero password), zero lifecycle marketing |
| 10 | Materiale vendita | N/A | Non applicabile, B2C self-serve |
| 11 | Messaggio/voce | 3/5 | Documentata in `.agents/product-marketing.md`, mai testata fuori dal prodotto |
| 12 | Prezzo | 4/5 | Deciso, implementato, coerente con il posizionamento — manca solo il canale di incasso reale |
| 13 | CRO | 0/5 | Nessun test ancora possibile, zero traffico |
| 14 | Lanci GTM | 0/5 | Primo lancio non ancora avvenuto |
| 15 | Ads a pagamento | 0/5 | Atteso — nessun budget ancora attivo, non è una debolezza a questo stadio |
| 16 | SEO | 0/5 | Nessun dominio prodotto ancora esistente |
| 17 | Internazionalizzazione | 0/5 | Solo Italia, corretto per questo stadio |

**Totale: 16/85 (19%).** Forma tipica di "prodotto forte, tutto il resto ancora
da costruire": alto solo su Onboarding (8) e Prezzo (12) — cioè le due cose che
il fondatore poteva controllare da solo scrivendo codice. Zero su tutto ciò che
richiede un pubblico esterno (posizionamento testato, contenuti, conversione,
SEO). Questo piano è per forza foundation-heavy: i primi 90 giorni sono bedrock
fix (pagina prodotto, catena App Store), non ottimizzazione.

---

## 4. Acquisition

### Stato attuale
Zero canali attivi. Zero traffico. La domanda non è "quale canale ottimizzare"
ma "quale primo canale testare, e come isolarlo abbastanza da leggere il
risultato".

### Il piano

**Move 1 — Pagina prodotto minima (prima di tutto il resto).**
Non esiste oggi. Serve prima ancora dell'App Store: è il link di bio per i primi
contenuti organici, la destinazione per chi clicca un ads senza scaricare
subito, e la superficie minima per l'ASO involontario (Google indicizza pagine
prodotto, non solo listing App Store). Una pagina sola, non un sito: headline,
2-3 righe di cosa fa, il limite di copertura dichiarato onestamente (coerente
con la voce del brand), link "scarica su App Store". **Skill:** `copywriting`.

**Move 2 — App Store Optimization (ASO).**
Listing, screenshot, parole chiave. Decisivo perché per un'app con zero budget
paid all'inizio, l'ASO è l'unico canale che porta traffico "gratis" — chi cerca
"traccia spese apple pay" o simili la trova. Va preparato **prima** della
submission, non dopo. **Skill:** `aso`.

**Move 3 — Meta Ads (caroselli Instagram), il test principale.**
Come da piano di Andrea: caroselli sponsorizzati dopo la pubblicazione App Store
(mai prima — vedi §1, il funnel Expo Go romperebbe la lettura del test).
Creativo unico e coerente con la voce del brand (onesto sui limiti, niente
hype), obiettivo di installazione app reale (non traffico al link, ora che
l'app store esiste). **Skill:** `ads`, `ad-creative`.

**Budget: 100€, tetto fisso deciso da Andrea (esclusi i costi Apple Developer
Program).** I conti, indicativi e da verificare live in Meta Ads Manager una
volta partita la campagna:

| Voce | Stima bassa | Stima alta |
|---|---|---|
| Costo per installazione (CPI, Italia, categoria finanza/utility) | 0,60 € | 1,80 € |
| Installazioni con 100€ | ~165 | ~55 |
| % che completa l'automazione (attrito reale: Comandi Rapidi, anche con guida e shortcut pronto) | 25% | 10% |
| **Automazioni completate** | **~41** | **~6** |

Scenario centrale plausibile: **15-20 automazioni**, non le 50 del riferimento
iniziale. Non è un fallimento del piano, è la matematica di un budget di 100€:
la metrica che conta a questa cifra è il **costo per automazione completata**,
non il conteggio assoluto — regola di lettura in §13.

**Gestione del rischio con un tetto così piccolo:** spendere ~20-25€ nei primi
2-3 giorni, leggere il CPI reale, e solo a quel punto decidere se impegnare i
restanti 75-80€ sullo stesso creativo o fermarsi prima — con 100€ totali, un
CPI disastroso scoperto solo a budget esaurito non lascerebbe margine per
correggere nulla.

**Move 4 — TikTok organico, canale di riserva/prosecuzione.**
Non "in caso di fallimento" ma "in parallelo, a costo zero, indipendentemente
dall'esito Meta Ads" — ha senso iniziare a pubblicare contenuti organici già
durante il mese di test a pagamento, non aspettare il risultato per iniziare da
zero. L'angolo naturale: il "prima/dopo" — spesa con Apple Pay, appare da sola
nell'app, in tempo reale. È lo stesso hook dei caroselli, riusato in formato
video. **Skill:** `social`, `video`.

**Move 5 — Community italiane di finanza personale (organico, costo zero).**
⚠️ Non ancora mappate nel dettaglio — subreddit italiani di risparmio/FIRE,
gruppi Telegram/Facebook di finanza personale. Coerente con il pubblico target
(chi già si preoccupa di tracciare le spese cerca attivamente questi spazi).
Rischio: la maggior parte di queste community vieta l'autopromozione diretta —
va fatto con partecipazione reale, non un post-e-scappa. **Skill:**
`community-marketing`.

**Move 6 — Paid oltre Meta (tenuto fuori dai primi 90 giorni).**
Google Ads, Apple Search Ads: non nel primo test. Ha senso solo dopo aver letto
un CAC su Meta — aggiungere un secondo canale paid prima di aver interpretato il
primo renderebbe entrambi illeggibili.

### Mosse di acquisizione nei 90 giorni
Vedi §9 per il calendario settimana per settimana — qui la sintesi: settimane
1-6 sono catena tecnica + pagina prodotto + creativi pronti; il canale di
acquisizione vero (Meta Ads) parte solo alla pubblicazione, verso fine del
periodo.

### Prospettiva a 12 mesi
Vedi §10.

### Skill + strumenti
- **Skill:** `ads`, `ad-creative`, `aso`, `social`, `video`, `community-marketing`, `copywriting`
- **MCP/API:** nessuno ancora wired (no GA4, no Ahrefs) — da collegare quando la pagina prodotto esiste, per misurare il traffico organico verso di essa

---

## 5. Activation

### Stato attuale
L'onboarding **in-app** è già solido (guida passo-passo, banner trial, comando
rapido pronto — punteggio 4/5 in §3). Il buco è a monte: non c'è ancora modo di
sapere, fuori dall'app, se qualcuno ha completato l'automazione — nessun evento
tracciato collegabile a una campagna ads.

### Il piano

**Move 1 — Strumentare l'evento di attivazione vero.**
La metrica del test (§1, §9) è "primo pagamento automatico registrato", che
oggi esiste nel database (`ingest-payment` lo sa già distinguere — è la stessa
logica usata per confermare i referral) ma non è collegata a nessuna sorgente
di traffico. Prima del lancio ads serve poter rispondere a "quanti dei nuovi
utenti arrivati da Meta Ads hanno completato l'automazione" — non solo "quanti
utenti totali l'hanno completata". Richiede il collegamento minimo fra
l'attribution di Meta (o anche solo un contatore aggregato, per un primo test
a basso volume non serve un tracking sofisticato) e l'evento server-side.
**Skill:** `analytics`.

**Move 2 — Il funnel di installazione deve reggere il primo minuto.**
Dall'App Store: tap → download → apertura → registrazione → codice email →
guida automazione → prima spesa registrata. Ogni passo in più è un punto di
abbandono per un utente arrivato da un ads, che ha zero pazienza rispetto a
chi arriva da una ricerca organica motivata. Il trial di 2 mesi e il comando
rapido pronto già riducono l'attrito strutturale; resta da verificare **con
occhi esterni** (non Andrea, che conosce già il prodotto) che il percorso non
abbia un punto morto — coerente con il giro di test già pianificato in
`DA-FARE.md`, ma va fatto anche da qualcun altro, non solo dal fondatore.

**Move 3 — App Store listing come primo momento di attivazione, non solo di scoperta.**
Cross-riferimento con §4 Move 2 (ASO): lo screenshot e la descrizione decidono
se chi ha cliccato l'ads davvero scarica, o abbandona sulla pagina store. Va
scritto per confermare la promessa vista nel carosello, non ripeterla in modo
generico.

### Skill + strumenti
`onboarding`, `signup`, `aso`, `analytics`, `ab-testing` (quando c'è traffico
sufficiente per leggere un test — non nei primi 90 giorni)

---

## 6. Retention

### Stato attuale
Nessun programma di retention marketing (email lifecycle, push, re-engagement)
esiste — atteso, perché non c'è ancora nessun utente da trattenere. L'unico
meccanismo di retention oggi è **dentro il prodotto**: changelog in-app, banner
trial, controllo mensile spese.

### Il piano

**Move 1 — Non costruire lifecycle email prima di avere utenti da segmentare.**
Sarebbe lavoro prematuro. La priorità dei primi 90 giorni è acquisizione e
attivazione; la retention si costruisce sui primi 20-50 utenti reali, non prima.

**Move 2 — L'email di scadenza trial è l'unico flow che vale la pena preparare adesso.**
Con 2 mesi di trial, i primi utenti del test Meta Ads inizieranno a scadere
proprio mentre il piano da 90 giorni si chiude — è l'unico momento di retention
che cade dentro l'orizzonte di questo piano. Un'email (o notifica, se preferito
al posto dell'email per restare dentro l'app) "il trial sta per finire" separata
dal banner in-app già esistente, per raggiungere anche chi non apre l'app tutti
i giorni. **Skill:** `emails`, `churn-prevention`.

**Move 3 — Osservare, non ancora ottimizzare, il tasso di conversione trial→abbonamento.**
Con RevenueCat live, il primo dato di retention reale sarà proprio questo:
quanti dei 20-50 (o quanti arriveranno) restano paganti dopo i 2 mesi. Va solo
misurato in questo piano — l'ottimizzazione (dunning, save offer, win-back) è
lavoro del prossimo trimestre, quando il numero di paganti giustifica lo sforzo.

### Skill + strumenti
`emails`, `churn-prevention` (solo Move 2, resto rimandato a dopo il primo dato reale)

---

## 7. Referral

### Stato attuale
**Già costruito e in produzione**, insolito per uno stadio pre-lancio: schema DB,
codice di conferma automatico al primo pagamento riuscito dell'invitato, schermata
dedicata in-app, bonus di 2 mesi dopo 5 conferme. Decisione esplicita di Andrea:
**mai nominato negli ads a pagamento**, resta un beneficio scoperto solo da chi
già usa l'app.

### Il piano

**Move 1 — Nessuna azione di marketing esterno richiesta.**
Il meccanismo vive interamente dentro l'app. L'unica leva marketing è
assicurarsi che i primi utenti reali (dal test Meta Ads) lo scoprano — oggi è
raggiungibile da Impostazioni, il che va bene per uno stadio pre-lancio: non
serve spingerlo attivamente finché non c'è una base di utenti soddisfatti che
lo attivi da sola.

**Move 2 — Il fondatore come primo referrer.**
Andrea può invitare le prime persone che conosce (in linea con "lanciamo,
testiamo, poi scaliamo") usando il proprio codice — genera i primi dati reali
sul meccanismo di conferma prima che arrivi traffico a pagamento, verificando
che funzioni con utenti veri e non solo in test.

**Move 3 — Rimandato: promozione attiva del referral.**
Solo dopo che il numero di utenti attivi lo giustifica (Q2+, coerente con lo
stadio "post-primo-segnale" di §10) — es. un prompt in-app più visibile dopo N
giorni di uso, mai negli ads.

### Skill + strumenti
`referrals` (verifica/rifinitura del meccanismo esistente, non costruzione da zero)

---

## 8. Revenue

### Stato attuale
Prezzo deciso e implementato lato server: 2 mesi trial, poi 1,99€/mese o
15€/anno. Solo l'automazione è a pagamento — il resto dell'app resta gratis per
sempre. **Manca il canale di incasso vero** (RevenueCat + Apple IAP), quindi
oggi nessuno può ancora pagare.

### Il piano

**Move 1 — Chiudere la catena tecnica (priorità assoluta, non è un "move" di marketing puro ma blocca ogni move di revenue).**
Apple Developer Program → Small Business Program (commissione 15% invece di
30%) → RevenueCat (due prodotti configurati) → integrazione nella build nativa.
Dettaglio operativo in `DA-FARE.md`.

**Move 2 — Non toccare il prezzo prima di avere dati.**
1,99€/mese e 15€/anno sono già posizionati bene contro i concorrenti (§2). Non
ha senso testare varianti di prezzo su zero utenti — primo test di pricing
plausibile solo dopo aver visto il tasso di conversione trial→abbonamento reale
del primo gruppo.

**Move 3 — Nessun upsell/bundle nei primi 90 giorni.**
Il modello è già semplice (un solo piano, due cadenze). Aggiungere livelli
(es. "premium" con feature extra) sarebbe complessità prematura prima di sapere
se il piano base converte.

### Unit economics

| Metrica | Valore | Nota |
|---|---|---|
| Prezzo mensile | 1,99 €/mese | Deciso |
| Prezzo annuale | 15 €/anno | Deciso |
| Quota Apple (Small Business Program) | 15% | Scende dal 30% standard, richiede iscrizione |
| Netto mensile | ~1,69 € | Dopo quota Apple |
| Netto annuale | ~12,75 € | Dopo quota Apple |
| ARPC | ⚠️ Sconosciuto | Nessun dato ancora — dipende dal mix mensile/annuale che sceglieranno gli utenti reali |
| CAC | ⚠️ Sconosciuto — **decisione aperta #2 (§13)** | Il primo dato reale arriverà dal test Meta Ads |
| Retention annuale | ⚠️ Sconosciuto | Nessun utente pagante ancora esiste |
| LTV | ⚠️ Non calcolabile ancora | Dipende dai due dati sopra |
| LTV/CAC | ⚠️ Non calcolabile ancora | Il numero che deciderà se scalare Meta Ads dopo il primo mese |

### Skill + strumenti
`pricing`, `paywalls` (verifica della schermata Abbonamento esistente quando RevenueCat è live)

---

## 9. Roadmap 90 giorni

Ancorata alla finestra reale decisa da Andrea: **11 agosto → 10 ottobre 2026
(pubblicazione), lancio a metà ottobre**. A differenza del template standard, il
collo di bottiglia non è marketing — è la catena tecnica. Le settimane sotto
riflettono questo: le prime sei sono in gran parte prerequisiti, non tattiche di
crescita.

### Settimane 1-2 (11-24 agosto) — Sblocco

| Mossa | Fase | Chi |
|---|---|---|
| Avviare iscrizione Apple Developer Program + Small Business Program | Prerequisito | Andrea |
| Acquistare il dominio (sblocca anche email/privacy policy, non solo marketing) | Prerequisito | Andrea |
| ~~Fissare il budget del test Meta Ads~~ — fatto: 100€ | Revenue/Acquisition | Andrea |
| Iniziare bozza pagina prodotto minima | Acquisition | Claude, con contenuti da Andrea |
| Migrazione a repo privato | Prerequisito | Claude, su comando di Andrea |

### Settimane 3-4 (25 agosto - 7 settembre) — Fondamenta

| Mossa | Fase | Chi |
|---|---|---|
| RevenueCat: account + 2 prodotti configurati | Revenue | Claude, appena Developer Program è attivo |
| Prima build nativa EAS + integrazione RevenueCat | Revenue/Activation | Claude |
| Pagina prodotto pubblicata | Acquisition | Claude + Andrea |
| Bozza listing App Store (ASO): titolo, descrizione, parole chiave | Acquisition | Claude |
| Palette/moodboard definitivi | Cross-cutting | Andrea |
| Prime bozze creativi caroselli Meta Ads | Acquisition | Andrea + Claude, sulla base della palette |

### Settimane 5-8 (8 settembre - 5 ottobre) — Velocità

| Mossa | Fase | Chi |
|---|---|---|
| TestFlight, giro di test completo sulla build nativa (checklist `DA-FARE.md`) | Activation | Andrea, idealmente con 1-2 tester esterni |
| Screenshot App Store dalla build reale | Acquisition | Claude |
| Submission App Store | Acquisition | Claude + Andrea |
| Strumentare l'evento "automazione completata" collegabile a una fonte di traffico | Activation | Claude |
| Preparare email/notifica di scadenza trial | Retention | Claude |
| Finalizzare i creativi Meta Ads (versione pronta al lancio) | Acquisition | Andrea |
| Primi contenuti TikTok organici pubblicati (non aspettare il lancio ads) | Acquisition | Andrea |

### Settimane 9-13 (6 ottobre - metà ottobre e oltre) — Composizione

| Mossa | Fase | Chi |
|---|---|---|
| Review Apple (con margine per un ciclo di richiesta chiarimenti) | Prerequisito | Apple |
| **Pubblicazione App Store** | — | — |
| **Lancio campagna Meta Ads** — tranche iniziale ~20-25€, 2-3 giorni, per leggere il CPI reale | Acquisition | Andrea |
| Se il CPI regge: impegnare i restanti 75-80€ sullo stesso creativo | Acquisition | Andrea |
| Andrea come primo referrer (§7 Move 2) | Referral | Andrea |
| Monitoraggio continuo: installazioni vs. automazioni completate vs. spesa residua | Measurement | Claude, dati da Andrea |
| A budget esaurito (100€): lettura del risultato sul costo per automazione completata (regola in §13), decisione scala/pivot | Measurement | Andrea + Claude |

---

## 10. Prospettiva 12 mesi

**Metodo di budget:** nessuno dei due metodi standard (revenue-based, goal-based)
è applicabile oggi — non c'è ARR storico né un obiettivo di ricavo fissato da un
investitore. Il budget del primo test resta una **decisione aperta** (§13 #1);
questa sezione descrive cosa succede *dopo* quel numero, non lo sostituisce.

**Non ci sono round di finanziamento previsti.** La logica standard "cosa
sblocca il prossimo round" viene sostituita da: **cosa sblocca il primo segnale
di ricavo reale** — il tasso di conversione trial→abbonamento osservato dopo il
primo mese di utenti veri.

### Q1 — Mesi 1-3 (ottobre-dicembre 2026): Validazione

**Stato:** pre-ricavo → primo ricavo. Nessun budget aggiuntivo oltre al test iniziale.

**Focus:** leggere il risultato del test Meta Ads, decidere scala/pivot.

**Risultati attesi entro fine Q1:**
- App pubblica e stabile, abbonamento reale funzionante
- Test Meta Ads chiuso con un numero: quanti utenti hanno completato l'automazione, a che costo per utente
- Primo dato di conversione trial→abbonamento (parziale — il trial dura 2 mesi, quindi solo i primissimi utenti del lancio avranno già attraversato l'intero ciclo)
- Decisione esplicita: raddoppiare su Meta Ads, spostarsi su TikTok organico, o entrambi

**Target KPI:** 100€ di spesa totale; 15-20 automazioni completate come scenario centrale plausibile (range realistico 6-41, vedi §4 Move 3); costo per automazione osservato, letto contro le soglie di §13 (≤5€ forte, 5-10€ borderline, >10€ pivot).

**Posizione sulla curva S:** un'unica curva in avvio (paid Meta Ads), nessun'altra ancora attiva.

### Q2 — Mesi 4-6 (gennaio-marzo 2027): Compounding organico

**Stato:** dipende interamente dall'esito di Q1.

**Focus:** se Q1 ha dato un segnale positivo, consolidare il canale vincente e
iniziare a costruire quello che compone nel tempo (contenuti TikTok con cadenza,
prime pagine SEO se la pagina prodotto ha iniziato a ricevere traffico
organico). Se Q1 è stato negativo su Meta Ads, questo trimestre è interamente
organico: TikTok, community, ASO — a costo quasi zero, per dare al prodotto più
tempo prima di rimettere soldi in ads.

**Risultati attesi:** cadenza di pubblicazione TikTok stabilita; primi dati di
retention reali (chi rinnova dopo il trial); eventuale secondo test Meta Ads
ricalibrato sul creativo che ha funzionato meglio nel primo giro.

**KPI target:** ⚠️ da fissare dopo aver visto i numeri di Q1 — impostarli ora sarebbe inventarli.

**Curva S:** se Q1 positivo, la seconda curva (organico) inizia a crescere mentre la prima (paid) continua o si scala; se Q1 negativo, si passa interamente alla seconda.

### Q3 — Mesi 7-9 (aprile-giugno 2027): Primo segnale di scala

**Stato:** dipende dal ricavo mensile accumulato nei due trimestri precedenti — questo, non un round, è ciò che sblocca budget aggiuntivo.

**Focus:** se il ricavo mensile giustifica un secondo canale paid (Google Ads, Apple Search Ads), introdurlo qui — mai prima di aver letto un CAC su Meta.

**Risultati attesi:** un secondo canale di acquisizione testato; primi contenuti SEO se la pagina prodotto ha guadagnato autorità; eventuale prima considerazione di un secondo mercato (⚠️ oggi fuori scope — solo Italia).

**KPI target:** ⚠️ da fissare in base ai dati Q1-Q2.

### Q4 — Mesi 10-12 (luglio-settembre 2027): Consolidamento

**Stato:** dipende dai tre trimestri precedenti.

**Focus:** a questo punto il piano dovrebbe essere ricalibrato con dati reali —
questa sezione a 12 mesi di distanza è necessariamente la meno specifica del
documento (coerente con l'onestà del metodo: meglio dire "da ricalibrare" che
inventare numeri a un anno di distanza da zero utenti).

**Risultati attesi:** revisione completa del piano con un anno di dati reali;
prima valutazione se serve un primo hire (contrattista per contenuti o ads, non
un'assunzione piena — coerente con lo stadio).

---

## 11. Stack operativo di marketing

### La tesi
Un fondatore solo, con la libreria di skill di marketing disponibile in questa
sessione più gli strumenti nativi Apple/Meta, può eseguire il lavoro che
normalmente richiederebbe un piccolo team — copy, creativi, ASO, piano di
misurazione — senza assumere prima di avere un segnale di ricavo che lo
giustifichi. Non sostituisce il giudizio umano su cosa lanciare, sostituisce il
tempo di produzione.

### Skill mappate alle fasi AARRR

| Fase | Skill primarie | Skill di supporto |
|---|---|---|
| Acquisition | `ads`, `ad-creative`, `aso` | `social`, `video`, `community-marketing`, `copywriting` |
| Activation | `onboarding`, `signup` | `aso`, `analytics` |
| Retention | `emails`, `churn-prevention` | `copywriting` |
| Referral | `referrals` | — (già costruito, solo manutenzione) |
| Revenue | `pricing`, `paywalls` | — |
| Cross-cutting | `product-marketing`, `marketing-plan` | `marketing-council` (per decisioni contese, es. su prezzo o posizionamento) |

### Esempio operativo concreto
Questo stesso documento: costruito in una sessione, ancorato a vincoli reali
(finestra di 60 giorni decisa oggi, prezzo già implementato lato codice, stato
del prodotto verificato leggendo `PRODOTTO.md`/`SPRINT.md` invece di essere
generico) — è il tipo di lavoro che altrimenti richiederebbe un fCMO a
contratto per una prima bozza.

### Sblocchi di capacità (non per round, per ricavo)

| Stadio | Team | Tooling | Canali attivi |
|---|---|---|---|
| Oggi (pre-lancio) | Andrea solo | Nessun tool marketing a pagamento | Nessuno |
| Dopo Q1 (primo ricavo osservato) | Andrea solo, eventuale contrattista per creativi se il volume lo giustifica | Tool ASO/analytics se il traffico lo giustifica | Meta Ads + TikTok organico |
| Dopo ricavo mensile stabile (⚠️ soglia da definire quando i numeri esistono) | Primo contrattista part-time su contenuti o ads | ESP per lifecycle email, tool SEO | + secondo canale paid, + SEO |

### Team e agenzie (RACI minimale)

| Funzione | Responsabile strategico | Esecutore |
|---|---|---|
| Piano e strategia | Andrea | Claude (supporto) |
| Prodotto | Andrea | Claude (sviluppo) |
| Creativi ads | Andrea (identità visiva) | Claude (copy, struttura) |
| Esecuzione tecnica (RevenueCat, App Store) | Andrea (account, decisioni) | Claude (implementazione) |
| Gestione campagna Meta Ads | Andrea | Andrea (accesso diretto a Meta Ads Manager necessario) |

A questa scala non ha senso separare oltre — un solo fondatore più supporto
tecnico/strategico. La tabella serve a rendere esplicito che l'esecuzione delle
campagne pubblicitarie (che richiede una carta di credito e un account Meta)
resta sempre di Andrea, non delegabile.

---

## 12. Banca delle idee tattiche

### Nota introduttiva
Le sezioni 4-8 prescrivono cosa **si sta facendo**. Questa sezione mappa cosa
**è possibile**, filtrato per uno stadio pre-lancio, fondatore solo, prodotto
B2C consumer iOS-only in Italia. Molte delle 139 idee del catalogo standard non
si applicano per costruzione (B2B, dev tool, hardware, internazionalizzazione,
sales enablement) — non sono elencate una per una come "skip", sarebbe
riempitivo; sono semplicemente escluse per categoria.

### Legenda stato
- **Ora (mesi 1-3)** — già nel piano 90 giorni
- **Q2** — dopo il primo segnale di ricavo
- **Q3+** — dopo un secondo canale validato
- **Q4+** — lungo termine
- **Skip** — incompatibile con la voce del brand o il modello

### 12.1 Acquisition

| # | Idea | Nota per questo cliente |
|---|---|---|
| 78 | Product Hunt Launch | Q2 — pubblico prevalentemente tech/anglofono, non il target primario italiano, ma costa solo tempo e può portare i primi early adopter tecnici |
| 74 | Press Coverage | Q2 — angolo stampa plausibile: "sviluppatore indie italiano crea tracker Apple Pay senza Open Banking", da testare dopo aver avuto utenti reali da citare |
| 124 | App Store Optimization | Ora — già in §4 Move 2, priorità assoluta |
| 42 | Short Form Video | Ora — coincide con TikTok organico, §4 Move 4 |
| 40 | Instagram Audience | Ora — coincide con i caroselli Meta Ads |
| 35 | Community Marketing | Ora — community italiane finanza personale, §4 Move 5 |
| 129 | Review Sites | Q2 — recensioni App Store reali, solo dopo avere utenti |
| 11 | Competitor Comparison Pages | Q2 — "Apple Pay Tracker vs YNAB/Copilot", ha senso solo quando la pagina prodotto esiste e ha traffico da far atterrare |
| 74 | Article Quotes / HARO-equivalente italiano | Q3+ — richiede relazioni con giornalisti tech italiani, non ancora costruite |
| 25-32 | Ads su altre piattaforme (Google, LinkedIn, Twitter, Reddit) | Skip per ora — vedi §10, mai un secondo paid prima di aver letto Meta |
| 4 | Programmatic SEO | Skip — richiede volume di dati/template che non esiste a questa scala |

### 12.2 Activation

| # | Idea | Nota |
|---|---|---|
| 96 | Onboarding Optimization | Ora — già forte (§3), continuare a rifinire con dati reali |
| 90 | One-Click Registration | Skip — la registrazione richiede email verificata per il recupero password, un compromesso deliberato già discusso e accettato |
| 124 | App Store Optimization | Ora — cross-riferito da §4 |

### 12.3 Retention

| # | Idea | Nota |
|---|---|---|
| 52 | Win-back Emails | Q2 — solo dopo i primi utenti che scadono senza rinnovare |
| 53 | Trial Reactivation | Q1 tardo — coincide con §6 Move 2 |
| 135 | Support as Marketing | Q2 — rispondere bene alle prime richieste di supporto è già marketing a questa scala, nessuna azione dedicata necessaria ora |

### 12.4 Referral

| # | Idea | Nota |
|---|---|---|
| 62 | Affiliate Program | Skip — il referral esistente copre già questo bisogno, un secondo programma affiliati sarebbe ridondante |
| 93 | Viral Loops | Q3+ — il meccanismo di referral esiste già (§7); un loop più aggressivo (es. sblocco funzione condividendo) valutabile solo dopo dati su come si comporta quello attuale |

### 12.5 Revenue

| # | Idea | Nota |
|---|---|---|
| 132 | Price Localization | Skip per ora — solo Italia, nessun bisogno di localizzare prezzo |
| 91 | In-App Upsells | Skip — il modello a un solo piano è deliberatamente semplice, vedi §8 Move 3 |

### 12.6 Cross-cutting

| # | Idea | Nota |
|---|---|---|
| 139 | Customer Language | Ora, ma solo dopo i primi utenti — oggi non esiste ancora lingua reale da catturare (vedi limite in `.agents/product-marketing.md`) |
| 114 | Moneyball Marketing | Ora, implicito — l'intero approccio "test piccolo, soglia numerica, decisione basata su dati" di questo piano è questo principio applicato |

### Riepilogo banca idee
- ~11 idee rilevanti per Acquisition (di cui 4 già "Ora"), il resto Q2+
- 2 per Activation, entrambe già "Ora" o quasi
- 3 per Retention, nessuna prima di Q1 tardo
- 2 per Referral, una skippata perché ridondante col meccanismo esistente
- 2 per Revenue, entrambe skippate per ora (semplicità deliberata del modello)
- 2 cross-cutting

**Cosa dimostra:** il piano copre una frazione piccola del catalogo standard, ed
è corretto che sia così — la maggior parte delle 139 idee presuppone un team, un
budget, o una categoria (B2B, dev tool, hardware) che qui non esistono. La banca
serve come inventario per quando la capacità si sblocca (§11), non come lista di
cose da fare subito.

---

## 13. Misurazione, decisioni aperte, appendice

### Metrica nord

**Proposta:** utenti con automazione attiva e almeno un pagamento reale
registrato — non download, non registrazioni. È la metrica che cattura
davvero la tesi del prodotto (l'automazione è il gancio) e quella già scelta
come soglia del primo test (20-50).

### Indicatori guida per fase

| Fase | Indicatori |
|---|---|
| Acquisition | Download da App Store, costo per installazione (Meta Ads Manager), traffico alla pagina prodotto |
| Activation | % di download che completano la registrazione; % che completano l'automazione (evento da strumentare, §5) |
| Retention | % di trial che convertono in abbonamento dopo 2 mesi; tasso di apertura app nella seconda settimana |
| Referral | Numero di codici referral generati/riscattati; referral confermati |
| Revenue | MRR, mix mensile/annuale, netto dopo quota Apple |

### Cadenza di revisione
- **Settimanale**, durante il mese di campagna Meta Ads: Andrea controlla spesa
  vs. installazioni vs. automazioni completate — se il costo per automazione
  completata esplode molto oltre l'atteso, si può fermare la campagna prima
  della fine del mese invece di aspettare la soglia
- **A fine test (fine mese 1 post-lancio):** decisione formale scala/pivot/stop
- **Trimestrale:** ricalibrazione del piano con i dati reali di quel trimestre

### RACI
Vedi §11 — a questa scala una singola tabella semplice basta, non serve
duplicarla qui.

### Decisioni aperte, per impatto

1. ~~**Budget del test Meta Ads.**~~ **Risolto (11 agosto): 100€, tetto fisso,
   esclusi i costi Apple Developer Program.** Conseguenza diretta: la soglia di
   successo si sposta da "20-50 utenti" a "costo per automazione completata"
   (§4 Move 3, §9, §10) — con questo budget lo scenario centrale plausibile è
   15-20 automazioni, non 50.
2. **Regola di lettura del costo per automazione — proposta, da confermare con
   Andrea prima del lancio:** ≤5€/automazione = segnale forte, si valuta un
   budget più alto in Q2; 5-10€ = borderline, si rifinisce il creativo prima
   di spendere ancora; >10€ = il canale paid non regge a questo budget, si
   passa su TikTok organico come piano B già previsto. Senza questa regola
   scritta *prima* del lancio, il rischio è interpretare il risultato a
   posteriori in modo troppo indulgente.
3. **Chi fa i primi 1-2 tester esterni del giro di test pre-lancio.** Il
   checklist di test in `DA-FARE.md` è pensato per Andrea; un secondo paio
   d'occhi (non tecnico, non il fondatore) troverebbe punti di attrito che
   Andrea, conoscendo già il prodotto, non nota più.
4. **Se e quando promuovere attivamente il referral oltre la scoperta passiva
   in-app** (§7 Move 3) — non urgente, ma da tenere in mente per Q2.
5. **Repository privato**: deciso ma non eseguito — data da fissare.

### Appendice — documenti collegati

**In questo repo:**
- `.agents/product-marketing.md` — posizionamento, ICP, voce del brand (fonte per §2)
- `PRODOTTO.md` — tutti i punti di prodotto (P1-P20) con stato
- `SPRINT.md` — stato di avanzamento per sprint
- `DA-FARE.md` — checklist operativa verso la pubblicazione, incluso il test manuale pre-lancio
- `CLAUDE.md` — stato tecnico del progetto, sezione "Stato del progetto" in cima

---

*Apple Pay Tracker — Marketing Plan v1. Preparato da Claude, 2026-08-11. Per revisione e discussione con Andrea — non ancora eseguito.*
