# Da fare prima di pubblicare

Elenco aggiornato di tutto ciò che manca prima che l'app sia pronta per un
pubblico vero — solo cose che richiedono le tue mani, il tuo account o una tua
decisione. Il resto (schema DB, Edge Function, codice app) è già fatto o lo
faccio io.

Ordine consigliato: prima le azioni sul database (🔴, cinque minuti l'una),
poi l'automazione, poi le decisioni aperte, poi il giro di test — e in
parallelo, quando hai tempo, il percorso verso l'App Store: con il prezzo
deciso non è più rimandabile, è quello che sblocca l'abbonamento vero.

---

## 🔴 Azioni sul database — le devi fare tu, dalla dashboard Supabase

Non sono automatizzabili da qui: richiedono di essere loggato come titolare
del progetto.

### 1. Incollare i due template email

Due file HTML pronti, nello stile dell'app (fondo caldo, accento argilla):

- `supabase/templates/confirm-signup.html`
- `supabase/templates/reset-password.html`

L'app non usa **nessuna pagina web** per confermare l'email o recuperare la
password — entrambe vanno a **codice a otto cifre**, verificato dentro l'app.
È una scelta voluta: in Expo Go l'URL dell'app cambia a ogni sessione, quindi
un link di ritorno sarebbe fragile proprio quando l'utente è già in difficoltà.

Su **Supabase → Authentication → Emails**, per **entrambi** i template
(*Confirm signup* e *Reset Password*):

1. Copia il contenuto del file HTML corrispondente nel campo *Message body*.
2. Assicurati che il corpo contenga `{{ .Token }}` (è già nei file pronti).
3. **Togli il link** `{{ .ConfirmationURL }}` se presente — altrimenti l'utente
   clicca il link invece di digitare il codice, e il link porta a una pagina
   morta.

**Finché non lo fai**: le email arrivano senza codice, quindi sia la
registrazione sia il recupero password restano bloccati sulla schermata del
codice. Questo è anche l'unico motivo per cui `P1` (recupero password) in
`SPRINT.md` risulta ancora aperto — il codice è pronto, manca solo questo.

> Non serve impostare `Site URL` né le *Redirect URLs*: senza link non c'è
> nessun redirect da autorizzare.

### 2. Eliminare due Edge Function di debug rimaste attive

`price-probe` e `nav-probe` erano funzioni temporanee usate per verificare i
prezzi degli asset durante lo sviluppo. Sono disarmate (non fanno danni) ma
sono ancora **attive** sul progetto, e non esiste uno strumento che le possa
cancellare da qui — solo dalla dashboard.

**Supabase → Edge Functions** → apri `price-probe` → elimina. Ripeti per
`nav-probe`.

Non è bloccante per l'uso dell'app, ma prima di pubblicare è pulizia dovuta:
sono endpoint pubblici (`verify_jwt: true`, quindi non chiamabili senza un
token valido) ma non hanno ragione di esistere ancora.

---

## 📸 Screenshot per la guida — quando costruisci la Shortcut

L'app ha ora una **guida passo per passo** (Impostazioni → Automazioni →
Guida, e dallo stato vuoto della Home). Ogni passo è uno screenshot vero
(idealmente con una freccia rossa che indica dove toccare, come quelli che
hai già mandato) più una riga di didascalia — non testo da leggere.

**Fatti**: `apri`, `espandi`, `incolla`, `cerca`, `scegli-comando`,
`immediato`. `installa` non serve, è una schermata della nostra app.
`seleziona-tutto` resta **solo descritta** a testo, per tua scelta
esplicita. `chiave` non ha più il pulsante — si è spostato sul passo
`incolla` — quindi resta anche lei solo testo. Il passo `consenti` (il
permesso che iOS può chiedere all'automazione) non ha uno screenshot: ho
disegnato un alert simulato al posto della foto, visto che non ne hai uno.
Se in futuro ti capita di vedere quel permesso davvero, uno screenshot
vero lo sostituirebbe volentieri.

**Manca ancora** solo questo, facoltativo:

| File da salvare in `assets/guida/` | Cosa deve mostrare |
| --- | --- |
| `prova.jpg` | La spesa comparsa in Home dopo un pagamento vero |

Ridimensiona a circa 750px di larghezza prima di mandarmelo — uno
screenshot a piena risoluzione pesa qualche megabyte e finirebbe intero
dentro l'aggiornamento che ogni utente scarica. Se preferisci mandarmelo a
piena risoluzione ci penso io, come ho fatto con gli altri sei.

---

## ✅ Automazione iOS — comando rapido pronto e agganciato

Il comando rapido condivisibile **«Clinck: Inserisci pagamento»** è online e
agganciato in Automazioni e nella guida in-app, con un pulsante "Installa il
comando pronto" — chiuso `P5`. Nessun token dentro: il campo
dell'intestazione contiene solo il segnaposto `INCOLLA TOKEN`, quindi il
link resta sicuro da tenere pubblico dentro l'app — ognuno lo sostituisce
con la propria chiave sulla propria copia locale, dopo averlo installato.

Resta comunque da costruire **l'automazione** che lo richiama, su ogni
telefono che vuole usarla: Apple non permette di condividerla in nessun
modo (solo i comandi rapidi normali hanno il pulsante Condividi). È una
ricerca ("Wallet") più la scelta del comando da eseguire, e la guida
in-app la copre nel secondo capitolo.

---

## 🟡 Decisioni aperte

### Repository privato — ✅ deciso, migrazione ancora da fare

`MrEzekyel/andreadecaro` è oggi **pubblico** e ospita anche il tuo sito
personale (CNAME, file del sito), non solo l'app: renderlo privato così
com'è spegnerebbe anche quello se è pubblicato via GitHub Pages.

La migrazione vera è creare un repo **nuovo e dedicato**, spostarci
`apple-pay-tracker/`, e da lì ripuntare il tuo `.git remote` locale.
Nessun impatto su Supabase o EAS. La faccio quando mi dai il via libera
esplicito — dimmelo quando vuoi partire.

### Prezzo e paywall — ✅ deciso

2 mesi di automazione gratis dalla registrazione, poi 1,99 €/mese o 15
€/anno per continuarla. Solo l'automazione si blocca: il resto dell'app
resta gratis per sempre. Più un referral interno (5 amici confermati = 2
mesi extra, dettagli in `PRODOTTO.md` → `P20`).

Schema DB ed enforcement lato server sono già in produzione. Manca solo il
pagamento vero — vedi "RevenueCat e Apple In-App Purchase" più sotto,
sezione App Store: è l'unico pezzo che serve davvero lasciare Expo Go.

### Notifiche push — ✅ già deciso: rimandate

I limiti di spesa avvisano già dentro l'app (riquadro in Home quando superi
soglia o limite). Le push richiederebbero uscire da Expo Go con una
development build — lavoro rimandato finché non serve davvero.

---

## 🧪 Test prima di pubblicare

Hai ragione: prima di far usare l'app a qualcun altro serve un giro di test
vero, non solo "sembra funzionare". Aree da coprire, con quello che è più a
rischio in ognuna:

- **Automazione Wallet end-to-end**: un pagamento reale in Apple Pay deve
  comparire nell'app entro pochi secondi, con esercente e importo corretti.
  Fallo sia con una carta in euro sia — se capita un'occasione — con una spesa
  all'estero, per verificare davvero la conversione valuta appena deployata.
- **Recupero password**: dopo il punto 1 sopra, prova per intero il flusso
  "password dimenticata" con un'email vera, dal codice ricevuto fino al
  login con la password nuova.
- **Export dati**: genera l'export da Impostazioni e apri i quattro file in
  un foglio di calcolo — controlla che gli accenti siano leggibili e che i
  totali corrispondano a quelli mostrati nell'app.
- **Modalità offline**: apri l'app con la rete attiva (così salva la copia
  locale), poi mettila in modalità aereo e riapri. Home, Limiti e
  Investimenti devono mostrare i dati dell'ultima volta con la riga
  "Senza connessione · aggiornato alle…", mai un valore finto come se fosse
  vero (zero spese, limite non raggiunto). Su una schermata mai aperta prima
  deve invece comparire l'errore con "Riprova".
- **Blocco con Face ID**: attivalo da Impostazioni, chiudi l'app, aspetta
  più di mezzo minuto e riaprila — deve chiedere il volto. Prova anche a
  negare Face ID e verificare che il codice del telefono funzioni come
  ripiego, e che "Esci e accedi con la password" ti faccia uscire davvero.
- **Limiti e spese ricorrenti**: verifica che gli avvisi di soglia/limite
  scattino quando devono, e che una spesa ricorrente (mutuo, rata) compaia
  da sola al momento giusto.
- **Spese divise**: dividi una spesa con una persona, verifica che "quanto mi
  devono" e i grafici usino la tua quota (`my_share`) e non l'importo intero.
- **Investimenti**: se hai comprato o venduto qualcosa nel frattempo,
  registra il movimento e controlla che il grafico del portafoglio si
  aggiorni in modo credibile.
- **Cambio tema**: chiaro / scuro / sistema, su almeno due schermate diverse.

Non serve un piano di test formale scritto da qualche parte — basta che tu
percorra questa lista una volta con calma prima di far provare l'app a
qualcun altro, e mi segnali qualunque cosa sembri storta (come hai già fatto
con i grafici — continua così, è il modo giusto).

---

## 🔴 Percorso verso l'App Store — ora serve davvero, non è più rimandabile

**Obiettivo: pubblicazione entro il 10 ottobre 2026, lancio a metà ottobre**
(deciso l'11 agosto, finestra di 60 giorni). Il collo di bottiglia è il primo
anello: se l'iscrizione ad Apple Developer Program parte questa settimana la
finestra è comoda, ogni settimana di ritardo su quel primo passo si mangia
il margine. Il piano settimana per settimana, con quello che può andare
storto, è in `.agents/marketing-plan.md`.

Con il prezzo deciso (2 mesi gratis, poi 1,99 €/mese o 15 €/anno) questo
percorso smette di essere "quando vorrai investire" e diventa un
prerequisito: **un abbonamento consumato dentro un'app iOS deve passare da
In-App Purchase Apple** (regola 3.1.1 dell'App Store, non aggirabile con
Stripe o un checkout esterno). Finché non lo fai, nessuno può davvero
pagare — il pulsante "Abbonati" nella nuova schermata Abbonamento resta
disattivato apposta.

Oggi l'app gira su **Expo Go** con aggiornamenti via `eas update` (OTA,
gratis) — questo resta il canale per ogni modifica al codice finché non
serve il pagamento vero.

> Nota operativa: la pipeline automatica di pubblicazione ("Workflow") ha
> esaurito la quota gratuita fino al 1° settembre 2026. Il comando manuale
> `npx eas-cli update --branch production --message "..."` resta comunque
> disponibile e funziona — è un canale separato dalla quota esaurita.

### 1. Apple Developer Program — 99$/anno

Intestato a te, non automatizzabile. Iscrizione su
[developer.apple.com/programs](https://developer.apple.com/programs/).

Una volta dentro, iscriviti anche al **App Store Small Business Program**
(gratuito, automatico se il fatturato resta sotto 1M$/anno): la commissione
Apple scende dal 30% al 15% su ogni abbonamento — la differenza fra ~1,39 €
e ~1,69 € netti sul piano mensile.

### 2. RevenueCat — prima della build

Account gratuito su [revenuecat.com](https://www.revenuecat.com) (resta
gratis fino a 2.500$/mese di fatturato tracciato). Si occupa di validare le
ricevute Apple e tenere sincronizzato lo stato abbonamento con
`profiles.subscription_status` — costruirlo a mano da zero non ha senso a
questo volume. Dentro RevenueCat vanno creati i due prodotti (mensile 1,99
€, annuale 15 €) collegati ad App Store Connect: serve quindi fare il primo
punto (Developer Program) prima di questo.

### 3. Build e TestFlight

```
cd apple-pay-tracker
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

Poi su [appstoreconnect.apple.com](https://appstoreconnect.apple.com) →
TestFlight → aggiungiti come tester interno (il tuo Apple ID, nessuna review
richiesta). Da lì in poi l'app vera, senza più Expo Go — è anche il momento
in cui l'SDK di RevenueCat entra nel codice (richiede una build nativa, non
funziona dentro Expo Go).

### 4. Pubblicazione pubblica sull'App Store

Serviranno: icona 1024×1024, screenshot (li genero io dalla build),
descrizione e parole chiave, **privacy policy pubblicata a un URL**
(obbligatoria — trattando dati finanziari — te la scrivo io, serve solo un
posto dove ospitarla), e il questionario "App Privacy" su App Store Connect.

Un'app che traccia spese personali passa la review senza problemi; l'unica
cosa a cui Apple guarda con attenzione è la privacy policy.

---

## Riferimento rapido

| Cosa | Dove |
| --- | --- |
| Project ref e chiavi | Supabase → Project Settings → API |
| URL ingestione | tab **Impostazioni** dell'app (pronto da copiare) |
| Header token | `x-ingest-token` |
| Template email | Supabase → Authentication → Emails |
| Edge Function da eliminare | Supabase → Edge Functions → `price-probe`, `nav-probe` |

> Project ref, URL e chiave non sono scritti in questo file di proposito: il
> repository è pubblico.

---

## Già fatto — non richiede niente da te

- ✅ Schema del database, RLS attiva ovunque
- ✅ Edge Function `ingest-payment` e `sync-prices` deployate con supporto
  multi-valuta (conversione automatica al cambio del giorno)
- ✅ Sistema di token (generazione, revoca, hashing)
- ✅ App completa: login, Home, spese, statistiche, impostazioni,
  investimenti, introiti, spese divise, spese ricorrenti
- ✅ Categorie personalizzate, limiti con avvisi in-app, tema chiaro/scuro
- ✅ Automazione Wallet e comando Siri per l'inserimento a voce
- ✅ Trial di 2 mesi, blocco automazione a scadenza, referral (schema,
  `ingest-payment`, schermate Abbonamento e Invita un amico, banner in
  Home) — manca solo l'acquisto vero via RevenueCat, vedi sopra
