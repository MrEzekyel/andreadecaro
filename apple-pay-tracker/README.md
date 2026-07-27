# Apple Pay Tracker

App mobile (Expo / React Native) che registra automaticamente i pagamenti
Apple Pay e li categorizza in base all'esercente.

> ⚠️ Questo repository è **pubblico**. Non committare mai il file `.env`, la
> `service_role` key o i token di ingestione. `.env` è già in `.gitignore`.

## Come funziona

Apple non espone un'API pubblica per leggere le transazioni Apple Pay/Wallet,
quindi l'ingestione avviene così:

```
Notifica Wallet (banca) sul telefono
        │  attiva
        ▼
Automazione Shortcuts (estrae importo + esercente dalla notifica)
        │  POST JSON + header x-ingest-token
        ▼
Supabase Edge Function "ingest-payment"
        │  risolve l'utente dal token, categorizza, deduplica, salva
        ▼
Tabella payments (Postgres, RLS per utente)
        │  letta in realtime
        ▼
App Apple Pay Tracker → lista pagamenti + statistiche
```

L'autenticazione della Shortcut usa un **token per utente**: la function ne
calcola l'hash SHA-256 e lo cerca in `ingest_tokens` per risalire all'utente.
In tabella non finisce mai il token in chiaro, e non c'è nessun segreto da
configurare a mano nella function.

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

## Collegare la Shortcut

### 1. Genera il token

Nell'app, tab **Impostazioni** → *Genera nuovo token*. Il valore viene mostrato
**una sola volta**: copialo subito. Nella stessa schermata trovi anche l'URL da
usare, già pronto da copiare.

### 2. Crea l'automazione

App **Comandi Rapidi → Automazione → Crea automazione personale**:

1. Trigger: **App** → *Wallet* → **Viene ricevuta una notifica**
2. Azione **Ottieni ultima notifica** → prendi il **testo** della notifica
3. Estrai importo ed esercente con l'azione **Abbina testo** (espressione
   regolare). Il formato dipende dalla tua banca — per una notifica tipo
   `Pagamento di 23,40 € presso Esselunga`:
   - importo: `([0-9]+[,.][0-9]{2})`
   - esercente: `presso (.+)$`
4. Azione **Ottieni contenuto URL**:
   - URL: quello copiato dalle Impostazioni dell'app
   - Metodo: **POST**
   - Intestazioni: `x-ingest-token` → il token generato al passo 1
   - Corpo richiesta: **JSON**
     ```json
     {
       "merchant": "<variabile esercente>",
       "amount": "<variabile importo>",
       "raw_text": "<testo notifica>"
     }
     ```
5. Disattiva **"Chiedi prima di eseguire"**, altrimenti dovrai confermare
   manualmente ogni pagamento.

`amount` può essere inviato come stringa: la function gestisce il formato
italiano (`23,40` e `1.234,56`).

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

- L'automazione dipende dal **formato della notifica** della tua banca: se
  cambia, vanno aggiornate le regex nella Shortcut. Il campo `raw_text` salva
  il testo originale, utile per correggere il parsing a posteriori.
- Le notifiche Wallet non contengono l'MCC (codice categoria del commerciante),
  quindi la categorizzazione si basa sul nome. Per dati più affidabili servirebbe
  un collegamento Open Banking (Plaid / TrueLayer / Nordigen).
- L'app non registra i pagamenti fatti quando il telefono è offline: la Shortcut
  scatta ma la POST fallisce.
