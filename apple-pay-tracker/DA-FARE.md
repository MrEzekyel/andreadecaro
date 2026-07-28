# Cose che devi fare tu

Elenco di tutto ciò che richiede le tue mani, il tuo telefono o un tuo account.
Tutto il resto (schema DB, Edge Function, codice app) è già fatto o lo faccio io.

---

## 🔴 Bloccanti — senza questi l'app non parte

### 1. Creare il file `.env`

Nella cartella `apple-pay-tracker/`, crea un file chiamato `.env` con dentro:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Entrambi i valori li trovi su **Supabase → Project Settings → API** (la chiave
è quella `publishable` / `anon`, **non** la `service_role`). Te li ho anche
scritti in chat.

> Il file è già in `.gitignore`: non finirà mai su GitHub. **Non committarlo
> mai a mano** — il repository `andreadecaro` è pubblico, e per lo stesso
> motivo qui sopra trovi dei segnaposto invece dei valori veri.

### 2. Avviare l'app e registrarti

```bash
cd apple-pay-tracker
npm install
npx expo start
```

Installa **Expo Go** dall'App Store sul tuo iPhone, inquadra il QR code che
compare nel terminale, e nell'app registrati con email + password.

Questo crea il tuo utente. Da quel momento i dati sono tuoi e solo tuoi (la
Row Level Security del database lo garantisce a livello di Postgres).

> Se Supabase ti chiede la conferma via email e la mail non arriva: vai su
> Supabase → Authentication → Providers → Email e disattiva
> *"Confirm email"*. È un progetto personale, puoi permettertelo.

### 3. Generare il token di ingestione

Nell'app: tab **Impostazioni** → *Genera nuovo token*.

Il token viene mostrato **una sola volta**. Copialo e tienilo da parte: serve
in qualunque automazione decideremo di usare. Se lo perdi non è un dramma: ne
generi un altro e revochi il vecchio.

### 4. Creare l'automazione Wallet

iOS ha un trigger dedicato alle transazioni Wallet: riceve la transazione come
input **gia' strutturata**, quindi non serve nessuna espressione regolare.

> Nota storica: in una versione precedente di questo documento avevo scritto
> prima "quando Wallet riceve una notifica" (trigger inesistente) e poi che
> l'automazione non fosse possibile. Sbagliato in entrambi i casi: il trigger
> giusto e' **Transazione**, rinominato **Wallet** da iOS 26.

**Comandi Rapidi → Automazione → Nuova automazione → Transazione** (o Wallet).

1. Seleziona la **carta** o le carte che usi con Apple Pay
2. Attiva **Esegui immediatamente** — senza questo devi confermare ogni
   pagamento a mano e l'automatismo perde senso
3. La prima azione e' gia' **Ricevi transazione come input**
4. Aggiungi l'azione **Ottieni contenuto URL** e configurala cosi':

| Campo | Valore |
| --- | --- |
| URL | quello che trovi in **Impostazioni** dell'app, pronto da copiare |
| Metodo | `POST` |
| Intestazioni | `x-ingest-token` → il token del passo 3 |
| Corpo richiesta | **JSON** |

Campi del corpo JSON (il valore e' la **variabile** della transazione, non
testo scritto a mano — la scegli dal selettore variabili):

| Chiave | Tipo | Valore | |
| --- | --- | --- | --- |
| `merchant` | Testo | variabile **Esercente** | obbligatorio |
| `amount` | Testo | variabile **Importo** | obbligatorio |
| `source` | Testo | `shortcut` | consigliato |
| `card` | Testo | variabile **Carta o biglietto** | facoltativo |
| `name` | Testo | variabile **Nome** | facoltativo |
| `city` | Testo | variabile **Città** | facoltativo |

I tre facoltativi vengono salvati e mostrati nel dettaglio della spesa. La
città serve anche per la mappa dei luoghi in cui hai speso — se per una
transazione non è disponibile, il campo resta vuoto e non succede nulla.

Non serve mandare la data: la function usa l'istante in cui riceve la
chiamata, che per un trigger in tempo reale e' corretto.

`Importo` arriva come "12,99 €" o simile: la function pulisce il simbolo di
valuta e gestisce la virgola decimale italiana, quindi va bene cosi'.

**Ordine dei passi**: prima `.env` → app → registrazione → token, poi
l'automazione. Senza token la chiamata risponde 401.

### 5. Comando Siri per l'inserimento a voce

Serve per quello che Apple Pay non vede: contanti, bonifici, carta fisica.
Non e' un'automazione ma un **comando rapido** che lanci a voce.

**Comandi Rapidi → + (nuovo comando) →** aggiungi in ordine:

1. **Chiedi input** → Tipo: **Numero** → Richiesta: `Quanto hai speso?`
2. **Chiedi input** → Tipo: **Testo** → Richiesta: `Dove?`
3. **Ottieni contenuto URL** — stessa configurazione del punto 4, con il
   corpo JSON:

| Chiave | Tipo | Valore |
| --- | --- | --- |
| `merchant` | Testo | risultato della **seconda** Chiedi input |
| `amount` | Testo | risultato della **prima** Chiedi input |
| `source` | Testo | `siri` |

⚠️ Attenzione all'ordine: nel selettore variabili le due "Chiedi input" si
chiamano uguale, e scambiarle manda l'importo come esercente.

4. Rinomina il comando **Aggiungi spesa** (il nome e' la frase che dirai)
5. Dettagli comando → attiva **Mostra in Siri**

Poi ti basta dire *"Ehi Siri, aggiungi spesa"*.

---

## 🟡 Decisioni che devo sentire da te

### 6. Repository privato?

Ora il codice sta in `MrEzekyel/andreadecaro`, che è **pubblico**. Il codice in
sé non contiene segreti, ma è un'app di finanza personale: normalmente la si
tiene privata.

Opzioni: lasciare così, oppure sposto tutto in un repo dedicato e privato
(consigliato). Dimmi tu — è una cosa che costa poco adesso e molto dopo.

### 7. Notifiche push — ✅ deciso: rimandate

Deciso di rimandarle. I limiti di spesa funzionano già con **avvisi dentro
l'app**: la Home mostra un riquadro quando superi la soglia di preavviso o il
limite stesso.

Quando vorrai le push servirà passare a una **development build** (gratis, la
build gira in cloud, ma da quel momento non si usa più Expo Go per testare).
Il lavoro residuo è solo il canale di consegna: soglie, periodi e stato dei
limiti sono già nel database.

---

## 🟢 Aprire l'app senza tunnel/PC — gratis, resta dentro Expo Go

Giusto rimandare i 99$/anno finché non sai se l'app avrà altri utenti: non
servono per questo. La app non usa nessun modulo nativo custom (solo cose già
incluse in Expo Go), quindi si può **pubblicare il bundle JS sui server di
Expo** (gratis, account Expo senza carta di credito) e continuare ad aprirla
da **Expo Go** — la stessa app che hai già installato — con un link fisso,
senza nessun PC o tunnel acceso. Esattamente l'idea del server cloud che
proponevi, solo che il "server" te lo offre gratis Expo stesso.

Ho già aggiunto la dipendenza `expo-updates` al progetto e pushato. Da un
Codespace (serve solo una volta per collegare il progetto):

```
cd apple-pay-tracker
npx eas-cli login                # account Expo, gratuito
npx eas-cli update:configure      # collega il progetto, aggiorna app.json da solo
npx eas-cli update --branch production --message "prima pubblicazione"
```

Alla fine il comando stampa un link (tipo `https://expo.dev/@tuo-account/apple-pay-tracker`
o un QR): apri quel link e trovi un pulsante "Apri in Expo Go" / QR dedicato.
Da lì in poi apri sempre l'app così, anche da iPhone/iPad, senza bisogno del
mio sandbox né del tuo PC acceso.

**Limite**: resti dentro Expo Go, quindi niente notifiche push né moduli
nativi extra (comunque già rimandati). Quando fai una modifica al codice,
rifaccio `eas update` e la prossima apertura dell'app prende la versione
nuova — non serve ricompilare né reinstallare nulla.

Quando in futuro deciderai come monetizzare (e se vale la pena investire i
99$/anno), il passaggio a TestFlight è descritto qui sotto: resta tutto
pronto, lo attiviamo quando vuoi.

### 8. Apple Developer Program — solo quando deciderai di investire

Costa **99$/anno** e deve essere intestato a te — non è automatizzabile.
Iscrizione su [developer.apple.com/programs](https://developer.apple.com/programs/).
L'approvazione richiede di solito poche ore, a volte fino a un giorno.

Ti serve anche un account **Expo** gratuito su [expo.dev](https://expo.dev)
per usare EAS Build (le build girano nel loro cloud, non serve un Mac).

### 8bis. Build e installazione via TestFlight (consigliato)

Una volta iscritto, da un Codespace (o dal PC quando lo riavrai):

```
cd apple-pay-tracker
npx eas-cli login              # account Expo
npx eas-cli build:configure    # collega il progetto al tuo account Expo
npx eas-cli build --platform ios --profile production
```

La prima volta EAS chiede le credenziali Apple e genera da solo certificato
e provisioning profile — non serve toccare Xcode. A build finita:

```
npx eas-cli submit --platform ios
```

La carica su App Store Connect. Poi su
[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → TestFlight →
aggiungiti come **tester interno** (il tuo stesso Apple ID) — nessuna review
richiesta per i tester interni, è quasi immediato. Installi l'app **TestFlight**
dall'App Store e da lì l'app vera, senza più Expo Go né tunnel.

Gli aggiornamenti successivi sono lo stesso comando `build` + `submit`; se
cambi solo JS (non moduli nativi) puoi anche usare `eas update` per spingere
l'aggiornamento senza ricompilare.

> Per l'Android che vorrai in futuro non serve nessun account a pagamento:
> `npx eas-cli build --platform android --profile preview` genera un APK
> scaricabile e installabile direttamente, gratis. Ha senso farlo solo
> quando avrai davvero un telefono Android da testare.

### 9. Se vorrai pubblicarla davvero sull'App Store (pubblico)

Quando ci arriveremo ti servirà preparare:

- Icona 1024×1024
- Screenshot dell'app (li genero io dalla build)
- Descrizione e parole chiave
- **Privacy policy pubblicata a un URL** — obbligatoria, l'app tratta dati
  finanziari. Te la scrivo io, ma serve un posto dove ospitarla (il tuo sito
  personale va benissimo)
- Compilazione del questionario privacy ("App Privacy") su App Store Connect

> Nota: un'app che traccia spese personali passa la review senza problemi.
> L'unica cosa a cui Apple guarda con attenzione è la privacy policy e la
> dichiarazione su quali dati raccogli.

---

## Riferimento rapido

| Cosa | Dove |
| --- | --- |
| Project ref e chiavi | Supabase → Project Settings → API |
| URL ingestione | tab **Impostazioni** dell'app (pronto da copiare) |
| Header token | `x-ingest-token` |

> Project ref, URL e chiave non sono scritti in questo file di proposito: il
> repository è pubblico.

---

## Cosa NON devi fare

Solo per chiarezza, questi sono già fatti e non richiedono niente da te:

- ✅ Schema del database (15 migration applicate, RLS attiva ovunque)
- ✅ 206 regole di categorizzazione predefinite già caricate
- ✅ Edge Function deployata e attiva
- ✅ Sistema di token (generazione, revoca, hashing)
- ✅ App: login, Home, elenco spese, statistiche, impostazioni
- ✅ Modifica ed eliminazione spese, aggiunta manuale
- ✅ Categorie personalizzate con colore e icona
- ✅ Limiti settimanali e mensili con avvisi in-app
- ✅ Tema chiaro / scuro / sistema
- ✅ Spese ricorrenti generate ogni notte (mutuo, rata auto)
- ✅ Spese divise, con schermata "Mi devono" e crediti in ritardo
- ✅ Statistiche per settimana / mese / anno
- ✅ Dettaglio per esercente e per categoria
