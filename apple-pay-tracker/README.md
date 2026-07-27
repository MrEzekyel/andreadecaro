# Apple Pay Tracker

App mobile (Expo / React Native) che registra automaticamente i pagamenti
Apple Pay e li categorizza in base all'esercente.

> ⚠️ Questo repository è **pubblico**. Non committare mai il file `.env`, la
> `service_role` key o i token di ingestione. `.env` è già in `.gitignore`.

## Come funziona

Apple non espone un'API pubblica per leggere le transazioni Apple Pay/Wallet,
e **iOS non permette a Comandi Rapidi di leggere le notifiche di altre app**
(i trigger di comunicazione coprono solo email e messaggi). L'ingestione
automatica quindi non può partire dalla notifica di Wallet.

Quello che la Edge Function accetta è un pagamento da **qualunque** sorgente
che sappia fare una POST:

```
Sorgente (SMS o email della banca via Comandi Rapidi,
          dettatura Siri, inserimento manuale, Open Banking)
        │  POST JSON + header x-ingest-token
        ▼
Supabase Edge Function "ingest-payment"
        │  risolve l'utente dal token, categorizza, deduplica, salva
        ▼
Tabella payments (Postgres, RLS per utente)
        │  letta in realtime
        ▼
App Apple Pay Tracker → spese, statistiche, limiti
```

Le sorgenti praticabili, in ordine di comodità:

| Sorgente | Automatica | Costo | Requisito |
| --- | --- | --- | --- |
| SMS della banca | ✅ | gratis | la banca deve mandare SMS per ogni pagamento |
| Email della banca | ✅ | gratis | avvisi email attivabili nell'home banking |
| Open Banking | ✅ | dipende | consenso bancario, provider PSD2 |
| Siri / manuale | ❌ | gratis | nessuno |

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

## Collegare una sorgente automatica

### 1. Genera il token

Nell'app, tab **Impostazioni** → *Genera nuovo token*. Il valore viene mostrato
**una sola volta**: copialo subito. Nella stessa schermata trovi anche l'URL da
usare, già pronto da copiare.

### 2. Crea l'automazione

App **Comandi Rapidi → Automazione → Crea automazione personale**, e come
trigger scegli quello che corrisponde a ciò che ti manda la banca:

- **Messaggio** → mittente della banca, eventualmente con "Il messaggio
  contiene" per filtrare i soli avvisi di pagamento
- **Email** → stesso principio, sul mittente degli avvisi

Poi, in entrambi i casi:

1. Estrai importo ed esercente con l'azione **Abbina testo** (espressione
   regolare). Le espressioni dipendono dal formato esatto del messaggio della
   tua banca — per un testo tipo `Pagamento di 23,40 EUR presso ESSELUNGA`:
   - importo: `([0-9]+[.,][0-9]{2})`
   - esercente: `presso (.+?)(?:\.|$)`
2. Azione **Ottieni contenuto URL**:
   - URL: quello copiato dalle Impostazioni dell'app
   - Metodo: **POST**
   - Intestazioni: `x-ingest-token` → il token generato al passo 1
   - Corpo richiesta: **JSON**
     ```json
     {
       "merchant": "<variabile esercente>",
       "amount": "<variabile importo>",
       "raw_text": "<testo completo del messaggio>"
     }
     ```
3. Attiva **"Esegui immediatamente"** e disattiva la richiesta di conferma,
   altrimenti l'automatismo perde senso.

`amount` può essere inviato come stringa: la function gestisce il formato
italiano (`23,40` e `1.234,56`). Manda sempre anche `raw_text`: se il parsing
sbaglia, il testo originale resta salvato e permette di correggere a
posteriori.

### Inserimento a voce con Siri

Un Comando Rapido con frase di attivazione ("Aggiungi spesa") che usa **Chiedi
input** per importo ed esercente e chiama lo stesso URL con
`"source": "siri"`. Non è automatico, ma non dipende da cosa manda la banca.

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

## Limiti noti

- **iOS non permette di leggere le notifiche di altre app**, quindi non esiste
  un modo di intercettare la notifica di Wallet. L'ingestione automatica
  richiede che la banca mandi un SMS o una email, oppure un collegamento Open
  Banking.
- L'automazione dipende dal **formato del messaggio** della tua banca: se
  cambia, vanno aggiornate le regex nella Shortcut. Il campo `raw_text` salva
  il testo originale, utile per correggere il parsing a posteriori.
- Gli avvisi della banca non contengono l'MCC (codice categoria del
  commerciante), quindi la categorizzazione si basa sul nome. Per dati più
  affidabili servirebbe un collegamento Open Banking.
- L'app non registra i pagamenti fatti quando il telefono è offline: la Shortcut
  scatta ma la POST fallisce.
- GoCardless / Nordigen, che offriva un piano gratuito per l'accesso ai propri
  conti, **non accetta più nuove iscrizioni** da metà 2025. Fra le alternative
  self-serve c'è Enable Banking.
