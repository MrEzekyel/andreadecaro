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

### 4. Dirmi cosa ti manda la banca quando paghi

⚠️ **Correzione importante rispetto a quanto scritto prima.** Avevo indicato
come trigger "quando Wallet riceve una notifica". **Quel trigger non esiste**:
iOS non permette a nessuna app né a Comandi Rapidi di leggere le notifiche di
altre app. È una cosa possibile su Android, non su iPhone.

I trigger di comunicazione di Comandi Rapidi coprono **solo email e messaggi**
([documentazione Apple](https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios)).
Quelli app coprono solo apertura e chiusura.

Quindi la domanda che sblocca tutto è: **quando paghi con Apple Pay, cosa ti
arriva?**

- Solo una **notifica push** dell'app della banca → l'automazione non è
  possibile per questa via, si va di Open Banking o inserimento rapido
- Un **SMS** → ✅ funziona, trigger "Messaggio"
- Una **email** → ✅ funziona, trigger "Email"

Molte banche italiane permettono di **attivare gli avvisi via email** nelle
impostazioni, anche se di default mandano solo push. Vale la pena controllare:
è la strada più semplice e gratuita.

Dimmi la banca e cosa ricevi, e ti scrivo l'automazione passo per passo.

### 5. Inserimento rapido con Siri (funziona comunque)

Indipendentemente dalla banca, questo si può fare subito e non dipende da
nulla. Comando Rapido con frase di attivazione, che chiede importo ed
esercente a voce e li manda all'app.

Te lo preparo appena mi confermi il punto 4, così lo imposti una volta sola
insieme all'altro.

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

- ✅ Schema del database (9 migration applicate, RLS attiva ovunque)
- ✅ 96 regole di categorizzazione predefinite già caricate
- ✅ Edge Function deployata e attiva
- ✅ Sistema di token (generazione, revoca, hashing)
- ✅ App: login, Home, elenco spese, statistiche, impostazioni
- ✅ Modifica ed eliminazione spese, aggiunta manuale
- ✅ Categorie personalizzate con colore e icona
- ✅ Limiti settimanali e mensili con avvisi in-app
- ✅ Tema chiaro / scuro / sistema
