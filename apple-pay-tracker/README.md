# Apple Pay Tracker

App mobile (Expo / React Native) che registra automaticamente i pagamenti
Apple Pay e li categorizza in base all'esercente.

## Come funziona

Apple non espone un'API pubblica per leggere le transazioni Apple Pay/Wallet,
quindi l'ingestione avviene così:

```
Notifica Wallet (banca) sul telefono
        │  attiva
        ▼
Automazione Shortcuts (estrae importo + esercente dalla notifica)
        │  POST JSON + secret
        ▼
Supabase Edge Function "ingest-payment"
        │  categorizza (regole utente > regole predefinite) e salva
        ▼
Tabella payments (Postgres, RLS per utente)
        │  letta in realtime
        ▼
App Apple Pay Tracker (questa app) → lista pagamenti + statistiche
```

## 1. Crea il tuo progetto Supabase personale

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto (piano Free).
2. In **Project Settings → API** copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key (segreta, non finisce mai nell'app)
3. Applica lo schema: apri **SQL Editor** e incolla il contenuto di
   `supabase/migrations/0001_init.sql`, poi esegui.
   In alternativa, con la CLI:
   ```bash
   npm install -g supabase
   supabase login
   cd apple-pay-tracker
   supabase link --project-ref <il-tuo-project-ref>
   supabase db push
   ```
4. Nell'app, registra il tuo account (vedi punto 3) così da avere un utente in
   **Authentication → Users**. Copia il suo `UID`: ti servirà per la Edge Function.

## 2. Deploy della Edge Function

```bash
cd apple-pay-tracker
supabase functions deploy ingest-payment

# Segreti della function (sostituisci con i tuoi valori)
supabase secrets set INGEST_SECRET="una-stringa-lunga-a-caso"
supabase secrets set TARGET_USER_ID="uuid-del-tuo-utente-auth"
```

L'URL della function sarà:
`https://<project-ref>.supabase.co/functions/v1/ingest-payment`

Test rapido:
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest-payment" \
  -H "content-type: application/json" \
  -H "x-ingest-secret: una-stringa-lunga-a-caso" \
  -d '{"merchant": "Esselunga", "amount": 23.40}'
```

## 3. Configura ed esegui l'app

```bash
cd apple-pay-tracker
cp .env.example .env
# modifica .env con EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Apri l'app con **Expo Go** sul telefono (scan del QR code) oppure `npm run ios`
se hai un Mac con Xcode. Al primo avvio registrati con email + password: è il
tuo account personale (nessun altro potrà vedere i tuoi dati grazie alla RLS).

## 4. Automazione Shortcuts (lato iPhone)

App **Comandi Rapidi (Shortcuts) → Automazione → Crea automazione personale**:

1. Trigger: **App** → seleziona *Wallet* → **Viene ricevuta una notifica**
2. Azione **Ottieni ultima notifica** → **Testo notifica**
3. Azioni di testo per estrarre importo ed esercente dal testo della notifica
   (il formato dipende dalla tua banca — usa "Abbina testo" con un'espressione
   regolare, es. `€\s?([0-9]+[,.][0-9]{2})` per l'importo). Esempio di notifica
   tipica: `"Pagamento di 23,40 € - Esselunga"`.
4. Azione **Ottieni contenuto URL**:
   - URL: `https://<project-ref>.supabase.co/functions/v1/ingest-payment`
   - Metodo: POST
   - Intestazioni: `x-ingest-secret` → il tuo `INGEST_SECRET`
   - Corpo (JSON):
     ```json
     { "merchant": "Esselunga", "amount": 23.40, "raw_text": "Pagamento di 23,40 € - Esselunga" }
     ```
     (usa le variabili estratte al passo 3 al posto dei valori fissi)
5. **Importante**: disattiva "Chiedi prima di eseguire" nelle impostazioni
   dell'automazione, altrimenti dovrai confermare ogni volta manualmente.

Le prime volte controlla che l'esercente venga categorizzato correttamente;
se una categoria manca, aggiungi una riga nella tabella `merchant_categories`
(via SQL Editor o una futura schermata "Impostazioni" nell'app) con la parola
chiave del tuo esercente.

## 5. Pubblicazione su App Store (quando sei pronto)

Serve un account **Apple Developer Program** (99$/anno, personale) — non è
qualcosa che si può automatizzare da qui. Una volta ottenuto:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # build in cloud, non serve un Mac
eas submit --platform ios     # invio alla App Store Connect
```

## Struttura del progetto

```
apple-pay-tracker/
├── App.tsx                     # entrypoint, gestione sessione + tab
├── screens/
│   ├── AuthScreen.tsx           # login / registrazione
│   ├── PaymentsScreen.tsx       # lista pagamenti (realtime)
│   └── StatsScreen.tsx          # totale mensile + breakdown per categoria
├── lib/
│   ├── supabase.ts              # client Supabase
│   └── types.ts
└── supabase/
    ├── migrations/0001_init.sql # schema + RLS
    ├── config.toml
    └── functions/ingest-payment/index.ts
```
