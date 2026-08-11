# Clinck

App mobile (Expo / React Native). **Ogni pagamento Apple Pay entra da solo e
si categorizza in base all'esercente. Il resto lo aggiungi in tre secondi con
Siri.**

Quel "il resto" non è una postilla: il trigger Wallet di iOS vede soltanto i
pagamenti Apple Pay. Restano fuori contanti, bonifici, **addebiti diretti SDD**
— cioè quasi tutte le utenze in Italia — carte fisiche non aggiunte a Wallet e
acquisti online fuori da Apple Pay. Su un utente italiano medio l'automazione
copre realisticamente il 40-60% della spesa reale.

È scritto qui in cima di proposito. Un'app che promette "tutte le tue spese,
automaticamente" e poi non registra la bolletta della luce non ha un problema
di funzionalità: ha un problema di fiducia, e si scopre nella prima settimana.

> ⚠️ Questo repository è **pubblico**. Non committare mai il file `.env`, la
> `service_role` key o i token di ingestione. `.env` è già in `.gitignore`.

## Come funziona

iOS espone un trigger dedicato alle transazioni Wallet: **Comandi Rapidi →
Automazione → Transazione** (rinominato **Wallet** da iOS 26). L'automazione
riceve la transazione come input gia' strutturata — esercente e importo sono
variabili tipizzate, non testo da interpretare.

```
Pagamento con Apple Pay
        │  trigger "Transazione" (Comandi Rapidi)
        ▼
Automazione: Ricevi transazione come input
        │  POST JSON (Esercente, Importo) + header x-ingest-token
        ▼
Supabase Edge Function "ingest-payment"
        │  risolve l'utente dal token, categorizza, deduplica, salva
        ▼
Tabella payments (Postgres, RLS per utente)
        │  letta in realtime
        ▼
App Clinck → spese, statistiche, limiti
```

La function accetta un pagamento da qualunque sorgente sappia fare una POST,
quindi la stessa pipeline serve anche l'inserimento a voce con Siri e il
Comando Rapido lanciato a mano per gli acquisti in-app e online, che il
trigger Wallet non vede. Il campo `source` tiene distinte le provenienze.

L'autenticazione usa un **token per utente**: la function ne calcola l'hash
SHA-256 e lo cerca in `ingest_tokens` per risalire all'utente. In tabella non
finisce mai il token in chiaro.

## Stato del backend

Lo schema e la Edge Function sono **già deployati** sul progetto Supabase
personale. Le migration in `supabase/migrations/` sono l'esatta copia di ciò
che è stato applicato, e servono per ricreare l'ambiente da zero.

Il modello dati completo è più sotto.

## Configurazione dell'app

```bash
cd apple-pay-tracker
cp .env.example .env
# inserisci EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
# (Supabase → Project Settings → API)
npm install
npx expo start
```

Apri l'app con **Expo Go** sul telefono (scan del QR code). Al primo avvio
registrati con email + password: è il tuo account personale, e la RLS fa sì che
nessun altro possa vedere i tuoi dati.

## Collegare l'automazione

### 1. Genera il token

Nell'app, tab **Impostazioni** → *Genera nuovo token*. Il valore viene mostrato
**una sola volta**: copialo subito. Nella stessa schermata trovi anche l'URL da
usare, gia' pronto da copiare.

### 2. Crea l'automazione

**Comandi Rapidi → Automazione → Nuova automazione → Transazione**:

1. Scegli la **carta** (o le carte) che usi con Apple Pay
2. Attiva **Esegui immediatamente**, altrimenti ogni pagamento richiede una
   conferma manuale
3. La prima azione e' gia' **Ricevi transazione come input**
4. Aggiungi **Ottieni contenuto URL**:
   - URL: quello copiato dalle Impostazioni dell'app
   - Metodo: **POST**
   - Intestazioni: `x-ingest-token` → il token del passo 1
   - Corpo richiesta: **JSON**

| Chiave | Tipo | Valore |
| --- | --- | --- |
| `merchant` | Testo | variabile **Esercente** |
| `amount` | Testo | variabile **Importo** |
| `source` | Testo | `Apple Pay` |

I valori sono le **variabili** della transazione, scelte dal selettore
variabili — non testo digitato.

`Importo` arriva come stringa con simbolo di valuta ("12,99 €"): la function
la ripulisce e gestisce il formato italiano, virgola decimale inclusa. La data
non serve inviarla: per un trigger in tempo reale l'istante della chiamata e'
corretto.

### Tutti i campi accettati

Solo `merchant` e `amount` sono obbligatori. Gli altri si mandano quando
servono: quelli lasciati vuoti finiscono a NULL, non a stringa vuota, quindi
mandare una chiave con dentro niente equivale a non mandarla.

| Chiave | Cosa ci va | Se manca |
| --- | --- | --- |
| `merchant` | nome esercente — guida categoria e raggruppamento | errore 400 |
| `amount` | importo, anche "12,99 €" | errore 400 |
| `card` | metodo di pagamento (`Revolut Visa`, `Contanti`, …) | resta vuoto |
| `source` | provenienza, vedi tabella sotto | `shortcut` |
| `city` | citta' del pagamento | resta vuoto |
| `name` | descrizione diversa dal nome esercente | resta vuoto |
| `country` | paese del pagamento | resta vuoto |
| `occurred_at` | data/ora ISO, per registrare una spesa di ieri | adesso |

`city` ha senso solo per i pagamenti fisici, dove il trigger Wallet la
fornisce. Per gli acquisti in-app e online **va lasciata fuori**: scriverci
dentro la citta' di residenza direbbe una cosa falsa, e la citta' e' un dato
che serve a ricordare *dove* si e' speso.

### Provenienza (`source`)

Distingue com'e' entrata la spesa, ed e' quello che la ripartizione per
provenienza mostra in Statistiche.

| Valore da mandare | Come compare nell'app | Quando |
| --- | --- | --- |
| `Apple Pay` | Apple Pay | automazione Wallet, scatta da sola |
| `Apple Pay manuale` | Apple Pay, a mano | Comando Rapido lanciato a mano: acquisti in-app e online che il trigger Wallet non vede |
| `Inserito manualmente` | Inserita a mano | come se fosse stata scritta dentro l'app |
| `Siri` | Dettata a Siri | inserimento a voce |

La function accetta sia queste etichette sia i valori tecnici
(`shortcut`, `shortcut_manual`, `manual`, `siri`), senza distinzione fra
maiuscole e minuscole. Le etichette esistono per poter mettere direttamente
il risultato di un **Scegli da elenco** dentro il JSON, senza tradurlo con un
blocco "Se". Un valore non riconosciuto non fa fallire la chiamata: ricade su
`shortcut`, perche' una provenienza sbagliata si corregge dall'app mentre una
spesa persa no.

### Comando Rapido per l'inserimento rapido

Per i pagamenti che il trigger Wallet non intercetta — dentro le app, online,
o su carte non aggiunte a Wallet. Comando Rapido normale (non automazione),
da tenere in Home o nel Centro di Controllo:

1. **Chiedi input** → *Numero*, "Quanto?"
2. **Chiedi input** → *Testo*, "Dove?"
3. **Elenco** con le voci delle carte: `Revolut Visa`, `Contanti`, …
4. **Scegli dall'elenco** → *Richiesta*: "Quale carta?"
5. **Imposta variabile** → nome `Carta`, valore l'esito del passo 4
6. **Elenco** con `Apple Pay manuale` e `Inserito manualmente`
7. **Scegli dall'elenco** → *Richiesta*: "Come l'hai pagata?"
8. **Imposta variabile** → nome `Provenienza`, valore l'esito del passo 7
9. **Ottieni contenuto URL**, POST, stesso URL e stesso header
   `x-ingest-token` dell'automazione, corpo JSON:

| Chiave | Valore |
| --- | --- |
| `merchant` | esito del passo 2 |
| `amount` | esito del passo 1 |
| `card` | variabile `Carta` |
| `source` | variabile `Provenienza` |

Le azioni si aggiungono dalla barra di ricerca in fondo (*Cerca app e
azioni*), cercando `elenco`. Il menu che compare toccando un **campo**
("Chiedi ogni volta", "Seleziona variabile", …) e' un'altra cosa: serve al
passo 9 per infilare le variabili dentro il JSON, non ad aggiungere azioni.

**Scegli dall'elenco** non contiene le voci, le riceve: da qui l'azione
**Elenco** che la precede. Le voci non devono per forza esistere gia'
nell'app — un metodo di pagamento nuovo compare da solo nei selettori dopo
la prima spesa che lo usa.

I passi 5 e 8 servono a non ritrovarsi due variabili chiamate entrambe
*Elemento scelto*, indistinguibili nel campo JSON. Con un nome proprio il
corpo della richiesta resta leggibile a distanza di mesi.

Esiste anche **Scegli dal menu**, che le voci le contiene davvero e fa a
meno dell'Elenco. Costa piu' di quanto rende: apre un ramo per ogni voce, e
la chiamata POST va ripetuta identica dentro ciascuno — con due menu
diventano quattro copie da tenere allineate a mano.

Per non farsi chiedere due volte la stessa cosa: se il Comando Rapido serve
solo agli acquisti online, si tolgono i passi 6-8 e si scrive
`Apple Pay manuale` come testo fisso nel campo `source`.

### Inserimento a voce con Siri

Un Comando Rapido con frase di attivazione ("Aggiungi spesa") che usa **Chiedi
input** per importo ed esercente e chiama lo stesso URL con
`"source": "Siri"`. Utile per contanti e pagamenti non Apple Pay.

### Doppio invio

Due spese con **stesso importo e stesso esercente entro 5 minuti** sono
considerate un doppio scatto e la seconda viene ignorata (risposta
`{"skipped":"duplicate"}`). Per registrarne davvero due identiche a distanza
di pochi minuti, basta mandare una `dedup_key` diversa per ciascuna.

### 3. Verifica

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest-payment" \
  -H "content-type: application/json" \
  -H "x-ingest-token: <il-tuo-token>" \
  -d '{"merchant": "Esselunga", "amount": "23,40"}'
```

Risposta attesa: `201` con il pagamento creato e il `category_id` della
categoria Spesa già assegnato. Rilanciando lo stesso comando entro 5 minuti
ottieni `{"skipped":"duplicate"}`: è la protezione contro il doppio scatto
della Shortcut.

## Categorie

Il riconoscimento è per sottostringa case-insensitive sul nome esercente
(l'ordine di priorità è nella sezione *Modello dati*).

Il modo normale di correggere una categoria è **dall'app**: apri la spesa,
cambia categoria, e il foglio ti chiede se applicare la correzione anche alle
altre spese dello stesso esercente e se ricordarla per il futuro. La seconda
opzione scrive `merchants.category_id`, quindi da quel momento l'esercente è
mappato e non viene più indovinato.

Le categorie si creano e si modificano in **Impostazioni → Categorie**, dove
scegli nome, colore e icona.

## Riprodurre il backend da zero

```bash
npm install -g supabase
supabase login
cd apple-pay-tracker
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy ingest-payment --no-verify-jwt
```

`--no-verify-jwt` è necessario: la Shortcut non può produrre un JWT Supabase,
quindi la function implementa la propria autenticazione tramite token.

## Pubblicazione su App Store

Serve un account **Apple Developer Program** (99$/anno, personale). Una volta
ottenuto:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # build in cloud, non serve un Mac
eas submit --platform ios
```

## Struttura

```
apple-pay-tracker/
├── App.tsx                         # sessione, tab bar, provider
├── components/
│   ├── Icon.tsx                     # icone Lucide risolte per nome
│   ├── PaymentRow.tsx
│   ├── CategoryPicker.tsx
│   ├── AddPaymentSheet.tsx          # inserimento manuale
│   └── EditPaymentSheet.tsx         # modifica, elimina, "applica a tutte"
├── screens/
│   ├── AuthScreen.tsx
│   ├── HomeScreen.tsx               # mese corrente + ripartizione
│   ├── PaymentsScreen.tsx           # elenco per giorno
│   ├── StatsScreen.tsx              # andamento cumulato + categorie
│   ├── CategoriesScreen.tsx         # crea, modifica, elimina categorie
│   └── SettingsScreen.tsx           # tema, categorie, token
├── lib/
│   ├── theme.ts                     # design system (colori, scala, raggi)
│   ├── ThemeContext.tsx             # chiaro / scuro / sistema
│   ├── DataContext.tsx              # cache categorie
│   ├── usePayments.ts               # spese del mese + realtime
│   ├── format.ts                    # importi e date in italiano
│   ├── supabase.ts
│   └── types.ts
├── design/mockup.html               # direzione di design navigabile
└── supabase/
    ├── migrations/                  # 0001–0008
    └── functions/ingest-payment/index.ts
```

## Modello dati

| tabella | contenuto |
| --- | --- |
| `payments` | le spese registrate |
| `categories` | categorie dell'utente, con colore e icona |
| `category_templates` | modello copiato a ogni nuovo utente |
| `merchants` | esercenti; `category_id` è il "ricorda la scelta" |
| `merchant_categories` | regole keyword personali |
| `default_merchant_categories` | 96 regole keyword predefinite |
| `ingest_tokens` | token delle Shortcut (solo hash SHA-256) |

Tutte con RLS attiva e policy limitate a `auth.uid()`.

Ordine con cui la Edge Function assegna la categoria:

1. `merchants.category_id` — esercente già mappato → certo
2. `merchant_categories` — le tue regole keyword
3. `default_merchant_categories` — le regole predefinite
4. `NULL` — resta da categorizzare

## Cosa non fa, per scelta

Diverso dai limiti qui sotto: non sono cose non ancora arrivate, sono cose
che non sono in programma. Dirlo prima evita a qualcuno di adottare l'app
aspettando che arrivino.

- **Nessuna condivisione familiare o account condiviso.** Un conto in comune,
  la spesa divisa col partner che compare in tempo reale su due telefoni, un
  budget di coppia: non ci sono e non sono previsti. Il modello dati è
  costruito attorno a un utente singolo — ogni tabella si aggancia a
  `auth.users` e la RLS taglia su `auth.uid()` — e cambiarlo non sarebbe una
  feature ma un'app diversa, con inviti, permessi, e la domanda "chi può
  vedere/modificare cosa" su ogni singola riga.
  Per dividere una spesa con qualcuno c'è **Mi devono**: registra la quota
  altrui e tiene il conto dei crediti, senza che l'altra persona debba avere
  l'app.
- **Nessun collegamento bancario (Open Banking / PSD2).** L'automazione legge
  quello che Apple Pay già mostra sul telefono, e nessuna credenziale
  bancaria passa da qui. È anche il motivo per cui la copertura si ferma dove
  si ferma — vedi in cima.

## Limiti noti

- Il trigger Transazione ha avuto **problemi di timeout** segnalati su alcune
  versioni di iOS ([forum sviluppatori Apple](https://developer.apple.com/forums/thread/765516)).
  Se qualche pagamento non venisse registrato, e' la prima cosa da guardare.
- Il nome esercente e' quello che passa il circuito di pagamento, che a volte
  e' criptico (`PAYPAL *STEAM`). Per questo esiste la correzione con "ricorda
  per il futuro": si sistema una volta e vale per sempre.
- La transazione Wallet non espone l'MCC (codice categoria del commerciante),
  quindi la categorizzazione si basa sul nome. Per dati più affidabili
  servirebbe un collegamento Open Banking.
- Un pagamento fatto col telefono offline non arriva subito: la Shortcut
  scatta ma la POST fallisce. Non si perde — il ramo di errore lo scrive in
  `spese-non-inviate.txt` su iCloud Drive, e da **Impostazioni → Automazioni
  → Recupera spese non inviate** rientra senza doppioni. Resta un passaggio
  manuale, perché Shortcuts non ritenta da solo.
