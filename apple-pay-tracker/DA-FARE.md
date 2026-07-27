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

Il token viene mostrato **una sola volta**. Copialo e tienilo da parte per il
passo successivo. Se lo perdi non è un dramma: ne generi un altro e revochi il
vecchio.

### 4. Creare l'automazione Shortcuts

Sul telefono, app **Comandi Rapidi → Automazione → Crea automazione personale**:

| Passo | Cosa impostare |
| --- | --- |
| Trigger | **App** → *Wallet* → "Viene ricevuta una notifica" |
| Azione 1 | **Ottieni ultima notifica** → prendi il testo |
| Azione 2 | **Abbina testo** per estrarre importo: `([0-9]+[,.][0-9]{2})` |
| Azione 3 | **Abbina testo** per estrarre esercente: dipende dalla tua banca |
| Azione 4 | **Ottieni contenuto URL** (dettagli sotto) |

Configurazione dell'azione "Ottieni contenuto URL":

- **URL**: lo trovi già pronto da copiare nel tab Impostazioni dell'app
- **Metodo**: `POST`
- **Intestazioni**: `x-ingest-token` → il token del passo 3
- **Corpo richiesta**: JSON
  ```json
  {
    "merchant": "<variabile esercente>",
    "amount": "<variabile importo>",
    "raw_text": "<testo notifica completo>"
  }
  ```

⚠️ **Disattiva "Chiedi prima di eseguire"**, altrimenti dovrai confermare a
mano ogni singolo pagamento e l'automatismo perde senso.

### 5. Mandarmi il testo esatto di una notifica Wallet

Questa è la cosa più utile che puoi farmi avere. Fai un pagamento con Apple
Pay, poi copiami **il testo esatto** della notifica che ricevi (o uno
screenshot).

Serve perché le regex del passo 4 dipendono dal formato della tua banca, e
finché non lo vedo sto tirando a indovinare. Con il testo reale te le scrivo
esatte in 2 minuti.

---

## 🟡 Decisioni che devo sentire da te

### 6. Repository privato?

Ora il codice sta in `MrEzekyel/andreadecaro`, che è **pubblico**. Il codice in
sé non contiene segreti, ma è un'app di finanza personale: normalmente la si
tiene privata.

Opzioni: lasciare così, oppure sposto tutto in un repo dedicato e privato
(consigliato). Dimmi tu — è una cosa che costa poco adesso e molto dopo.

### 7. Notifiche push

Diverse funzionalità che hai chiesto (avviso al superamento di un limite,
"Leonardo non ti ha ancora pagato") hanno bisogno di **notifiche push**.

Problema: le push non funzionano dentro Expo Go, serve una **development
build**. È gratis, la build gira in cloud, ma da quel momento non usi più
Expo Go per testare.

Dimmi se vuoi che le implementi ora (e passiamo alla development build) o se
preferisci rimandare e per adesso mostrare gli avvisi solo dentro l'app.

---

## 🟢 Quando vorrai pubblicare su App Store

### 8. Apple Developer Program

Costa **99$/anno** e deve essere intestato a te — non è automatizzabile.
Iscrizione su [developer.apple.com/programs](https://developer.apple.com/programs/).

Serve **solo** per pubblicare su App Store. Per usare l'app su un tuo
telefono non serve.

### 9. Materiali per la scheda App Store

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

- ✅ Schema del database (4 migration applicate, RLS attiva ovunque)
- ✅ 96 regole di categorizzazione predefinite già caricate
- ✅ Edge Function deployata e attiva
- ✅ Sistema di token (generazione, revoca, hashing)
- ✅ App con login, lista pagamenti, statistiche, impostazioni
