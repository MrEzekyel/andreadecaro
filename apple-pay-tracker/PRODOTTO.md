# Cosa manca perché qualcuno paghi

Elenco dei punti emersi dall'analisi del 7 agosto 2026, fatta guardando l'app
con gli occhi di un cliente esigente che sta valutando l'abbonamento.

Non è una lista di feature desiderabili. È la lista di **cosa oggi impedisce a
uno sconosciuto di pagare senza pensarci**, in ordine di quanto costa non
farlo.

Ogni punto ha un identificativo (`P1`, `P2`, …) usato dal piano in
`SPRINT.md` e dall'agente di verifica (`.claude/agents/revisore-prodotto.md`).

---

## Il problema di fondo

**Si fa pagare la parte più fragile e si regala quella più forte.**

L'automazione Apple Pay gira su iOS Shortcuts: nessun retry, nessuna coda,
un trigger con [timeout documentati](https://developer.apple.com/forums/thread/765516),
e non la controlliamo noi. È la cosa che sta dietro il paywall.

Il portafoglio investimenti gira su cron nostri, è affidabile, e fa cose che i
concorrenti a 95$/anno non fanno (XIRR, rendimento di prezzo separato dal
totale, esecuzione al prezzo intraday reale). È gratis.

Quasi tutti i punti qui sotto discendono da questa inversione.

---

## Fiducia — senza questi, un estraneo non affida due anni di storico

### P1 · Recupero password · **non esiste**

Nessun flusso di reset, da nessuna parte (`AuthScreen.tsx` ha solo signin e
signup). Chi dimentica la password perde l'accesso a tutto il suo storico
finanziario, in modo definitivo.

Per un utente pagante è una richiesta di rimborso e una recensione a una
stella. È una chiamata: `supabase.auth.resetPasswordForEmail()` più una
schermata di reinserimento raggiunta da deep link.

**Verifica**: da utente registrato, tocca "Password dimenticata", ricevi la
mail, imposti una password nuova, entri. Senza passare dalla dashboard
Supabase.

### P2 · Export dei dati · **non esiste**

Nessun export, in nessun formato, nemmeno CSV. Su un'app finanziaria questo è
squalificante per un'intera categoria di utenti.

È anche l'unica risposta concreta alla domanda "cosa succede ai miei dati se
l'app chiude" (vedi `P4`): senza export, ogni rassicurazione è a parole.

Deve coprire spese, introiti, investimenti e divisioni — non solo le spese —
e uscire da `expo-sharing` come file vero, condivisibile.

**Verifica**: il file esportato si apre in Numeri/Excel, contiene tutte le
righe del periodo scelto, e gli importi sommano al totale che l'app mostra a
schermo.

### P3 · Stato di errore distinto dallo stato vuoto · **oggi mente**

In `lib/usePayments.ts`: `if (!current.error && current.data) setPayments(…)`.
Quando la query fallisce — rete giù, sessione scaduta, progetto Supabase in
pausa — lo stato resta vuoto e l'utente legge **"Nessuna spesa in questo
mese."**

Quella non è una schermata di errore: è una **frase affermativa sbagliata sui
soldi di qualcuno**. Non dice "non ho i dati", dice "non hai speso niente".

Serve uno stato di errore separato, con un messaggio che dica cosa è successo
e un pulsante per riprovare, ovunque si legga dal database — non solo nelle
spese.

**Verifica**: con la rete disattivata, nessuna schermata dell'app afferma un
fatto sui soldi. Tutte dicono che non sono riuscite a leggere.

### P4 · Continuità dei dati dichiarata · **non dichiarata**

Manca la privacy policy (obbligatoria per Apple, e la prima cosa che un
cliente esigente controlla su un'app finanziaria) e manca qualunque
affermazione su cosa succede se il servizio chiude. Oggi la risposta vera è:
i dati spariscono.

Serve la policy pubblicata a un URL, più una riga leggibile dentro l'app:
*"I tuoi dati sono esportabili in CSV in qualsiasi momento. Se il servizio
dovesse chiudere, riceverai 90 giorni di preavviso."*

Ha senso solo dopo `P2`: prometterlo senza un export funzionante è una bugia.

---

## Vendita — senza questi la conversione non parte

### P5 · Comando rapido pronto · **fatto**

Il comando rapido «Registra spesa» è costruito e condiviso via link iCloud
(`lib/guide.ts` → `SHORTCUT_INSTALL_URL`), raggiungibile con un tocco da
Impostazioni → Automazioni. Nessun token dentro: il campo dell'intestazione
`x-ingest-token` è una variabile presa dall'input, non un valore scritto —
chi lo installa usa comunque la propria automazione con la propria chiave.

Non elimina tutto il lavoro manuale: Apple non permette di condividere
un'**automazione** in nessun modo (solo i comandi rapidi normali hanno il
pulsante Condividi), quindi resta da costruire quella — due azioni, contro
i quindici passi originari del comando stesso. La guida in-app
(`screens/GuideScreen.tsx`) copre entrambi i pezzi e, nel capitolo del
comando, offre di saltare direttamente al capitolo dell'automazione per chi
ha già installato il link.

**Verifica**: un utente che non ha mai visto Comandi Rapidi installa il
comando con un tocco e completa l'automazione in pochi minuti seguendo la
guida, senza uscire dall'app per cercare istruzioni altrove.

### P6 · Claim onesto sulla copertura · **oggi lascia intendere il 100%**

L'ingestione automatica vede **solo Apple Pay via Wallet**. Restano fuori
contanti, bonifici, addebiti diretti SDD (in Italia: quasi tutte le utenze),
carte fisiche non in Wallet e acquisti online fuori da Apple Pay.
Realisticamente si copre il **40-60%** della spesa di un utente italiano.

Un cliente esigente lo scopre nella prima settimana, vede che manca la bolletta
della luce, e si sente ingannato.

Non si risolve con codice ma con il posizionamento: *"Ogni pagamento Apple Pay
entra da solo. Il resto in tre secondi con Siri."* Prometti meno di quello che
fai e vinci.

Vale ovunque compaia la promessa: schermata di acquisto, `README.md`, App
Store, e il testo vuoto della Home.

### P7 · Cosa succede alla scadenza dell'abbonamento · **deciso: si ferma solo l'automazione**

Senza abbonamento attivo Wallet, Siri e la Shortcut smettono di registrare
spese da sole — `ingest-payment` rifiuta con `subscription_required`. Storico,
statistiche, spese manuali, categorie, limiti ed export **restano sempre
accessibili**, abbonati o no: non è mai un sequestro dei dati, solo la
sospensione della parte che ha un costo ricorrente per farla funzionare.

Il segnale arriva dall'app (banner in Home, sezione Abbonamento in
Impostazioni), non dalla notifica di errore della Shortcut — nessuno apre le
notifiche dell'automazione per capire perché ha smesso di funzionare.

### P8 · Durata del trial · **deciso: 2 mesi dalla registrazione**

Due mesi di automazione gratis dal momento dell'iscrizione (`profiles.trial_ends_at`,
scritto dal trigger `handle_new_user`). Abbastanza per un primo confronto
mese-su-mese, che con un solo mese di dati non è mai possibile.

### P9 · Paywall · **deciso: si paga l'automazione, non il portafoglio**

Decisione opposta a quella sketchata in precedenza in questo stesso punto:
l'automazione stessa — non il modulo investimenti — è dietro il paywall dopo
il trial. Tutto il resto dell'app resta gratuito per sempre, `P7`.

Richiede l'Apple Developer Program e gli acquisti in-app (Apple impone
StoreKit per un abbonamento consumato dentro l'app, regola 3.1.1 — niente
Stripe/checkout web). Implementazione in corso: schema e enforcement lato
server sono già in produzione; l'acquisto vero e proprio arriva con
l'integrazione RevenueCat, che richiede di lasciare Expo Go per una build
nativa (vedi `DA-FARE.md`).

### P10 · Prezzo · **deciso: 1,99 €/mese o 15 €/anno**

Prezzo basso e diretto in-app tramite Apple: nessun checkout esterno, nessuna
frizione oltre al foglio di acquisto nativo con Face ID/Touch ID. Netto reale
dopo la quota Apple (15% con Small Business Program): ~1,69 €/mese, ~12,75
€/anno.

### P20 · Referral · **deciso: 5 amici confermati = 2 mesi extra**

Ogni utente ha un codice personale (`profiles.referral_code`). Un amico che si
registra con quel codice conferma il referral al **suo primo pagamento
registrato con successo dall'automazione** — non alla semplice registrazione,
non a un suo eventuale abbonamento: è la prova che ha impostato tutto
correttamente, non solo che ha scaricato l'app. Dopo 5 referral confermati
totali, chi ha invitato sblocca 2 mesi extra di automazione — traguardo unico,
non ripetibile. L'amico invitato non riceve nulla oltre ai 2 mesi standard.

Vive **solo dentro l'app**, in una sezione dedicata (Impostazioni → Invita un
amico): mai citato in campagne pubblicitarie a pagamento — è un beneficio per
chi già usa l'app, non un gancio di marketing.

---

## Integrità del dato

### P11 · Multi-valuta · **assente, e silenziosamente sbagliata**

`lib/format.ts` ha `EUR` cablato dentro, senza impostazione. Una spesa a Londra
viene registrata come se fossero euro: il numero resta plausibile ma è
sbagliato del 15%.

Non è una feature mancante, è **un dato corrotto senza avviso** — la stessa
classe di problema già intercettata su `CBU8.DE` con i prezzi degli asset.

Minimo: salvare la valuta originale sulla transazione e convertire al cambio
della data (l'infrastruttura c'è già, `sync-prices` usa frankfurter.app).

**Verifica**: una spesa in sterline mostra l'importo originale, il
controvalore in euro e il cambio usato. Il totale del mese non cambia se si
riapre l'app in un giorno con un cambio diverso.

### P12 · Perdite silenziose dell'ingestione · **oggi invisibili**

La deduplicazione è fatta bene (`dedup_key` + vincolo unico + gestione del
23505). Ma **protegge dai doppioni, non dalle perdite**.

Shortcuts non ritenta mai. Telefono in aereo, segnale scarso alla cassa, cold
start di Supabase oltre il timeout → la transazione è persa per sempre, in
silenzio. Il totale del mese è sbagliato in difetto e sembra corretto.

Su un'app gratuita è un difetto. Sulla feature che si fa pagare è **il**
difetto.

Mitigazioni, in ordine di costo:
1. La Shortcut, in caso di errore, scrive la transazione in un file locale; un
   pulsante "Sincronizza" nell'app riprova.
2. Un controllo mensile in-app: *"il totale di ottobre corrisponde
   all'estratto conto?"* con aggiunta rapida. Non elegante, ma trasforma un
   errore silenzioso in una domanda esplicita.
3. Riconciliazione da import estratto conto — l'infrastruttura esiste già per
   gli investimenti.

### P13 · Lettura offline · **fatto**

`lib/cache.ts` tiene una copia locale dell'ultima lettura riuscita per tutte
e quattro le letture che reggono una schermata intera: spese, limiti,
portafoglio, abbonamento. Senza rete l'app mostra i dati dell'ultima volta
dichiarando quando risalgono (`StaleNote`), invece di una schermata bianca o
di un errore.

Come previsto si incastra con `P3`: "non riesco a leggere" è diventato
"questi sono i dati di stamattina", che è vero e utile invece che solo vero.

Un caso ha richiesto una regola in più: sui limiti la copia porta con sé il
periodo a cui si riferisce e viene scartata se non è quello corrente —
altrimenti una copia della settimana scorsa, filtrata su questa, direbbe
"0% del budget" proprio nella schermata che esiste per fermare qualcuno.

---

## Sicurezza

### P14 · Blocco biometrico · **fatto**

Face ID / Touch ID davanti all'app, opzionale e spento di default
(Impostazioni → Blocco con Face ID). Dentro Expo Go, nessuna build nativa.

Le tre scelte che lo rendono usabile e non solo sicuro: il codice del
telefono resta un ripiego valido quando il volto non viene riconosciuto;
mezzo minuto di tolleranza prima di richiederlo, perché uscire dall'app e
rientrare è il giro normale di chi configura l'automazione; e un "Esci e
accedi con la password" sulla schermata di blocco, senza il quale un guasto
del riconoscimento renderebbe i propri dati irraggiungibili se non
reinstallando l'app.

### P15 · Repository privato · **deciso: sì, migrazione da eseguire**

`MrEzekyel/andreadecaro` è pubblico. Il codice non contiene segreti, ma per un
prodotto a pagamento di finanza personale è un segnale strano.

Non è un semplice cambio di visibilità: quel repo ospita anche il sito
personale di Andrea (CNAME, file ASP.NET, foto), quindi renderlo privato
spegnerebbe anche quello se pubblicato via GitHub Pages. La migrazione vera
è creare un repo dedicato e spostarci `apple-pay-tracker/`, poi ripuntare il
remote locale — nessun impatto su Supabase o EAS. Da eseguire su comando
esplicito di Andrea, non di iniziativa.

---

## Funzionalità vs bisogno reale

### P16 · Push per i limiti · **rinviate, e senza di loro i limiti sono mezza feature**

I limiti di spesa esistono e sono ben fatti, ma l'avviso compare solo aprendo
l'app. Un limite che dice che hai sforato **quando apri l'app per controllare
se hai sforato** non serve a niente.

Richiede di uscire da Expo Go (development build): è una decisione strutturale,
non un pomeriggio.

### P17 · Obiettivi di risparmio · **assenti, e sono il vantaggio competitivo**

C'è "Risparmiato" come numero calcolato, ma nessun obiettivo e nessun
avanzamento.

Qui c'è un vantaggio che nessun concorrente può copiare: **il portafoglio
investimenti è già dentro l'app**. "Obiettivo: 10.000€ di fondo emergenza"
collegato al valore reale del portafoglio è qualcosa che YNAB non può fare,
perché non sa quanto vale il tuo ETF.

È il miglior candidato a feature premium dopo l'inversione del paywall (`P9`).

### P18 · Changelog in-app · **fatto**

Impostazioni → Novità (`lib/changelog.ts`, `screens/ChangelogScreen.tsx`).
Le voci stanno in un file del bundle e non su Supabase: cambiano esattamente
quando cambia il codice, quindi arrivano con lo stesso aggiornamento che
porta le novità che descrivono.

Il pezzo che lo rende utile non è la schermata ma il **pallino**: sull'icona
delle impostazioni in Home quando c'è qualcosa di non letto. Un changelog
raggiungibile solo entrando in Impostazioni non lo apre nessuno, ed è
esattamente il punto di avere aggiornamenti frequenti e non farlo sapere.
Chi apre l'app per la prima volta non ha "novità" — ha l'app: il primo avvio
segna tutto come già visto invece di accogliere con un pallino da smaltire.

### P19 · Condivisione familiare · **dichiarata come non-obiettivo**

`README.md` ha ora una sezione **"Cosa non fa, per scelta"**, separata dai
limiti noti: quelli sono cose non ancora arrivate, questa è una cosa che non
è in programma, e la differenza conta per chi sta decidendo se adottare
l'app.

Il motivo scritto lì è che il modello dati è costruito attorno a un utente
singolo — ogni tabella si aggancia a `auth.users`, la RLS taglia su
`auth.uid()` — e cambiarlo non sarebbe una feature ma un'app diversa, con
inviti, permessi e la domanda "chi può vedere cosa" su ogni riga. Chi deve
dividere una spesa ha **Mi devono**, che non richiede che l'altra persona
abbia l'app.

---

## La sintesi

L'ingegneria è migliore del prodotto. Ci sono decisioni in questo repository —
la mediana invece della media, `investedBasis` contro `costBasis`, il sync che
si rifiuta di scrivere quando non si fida di sé — più mature di quelle di app
che costano sei volte tanto.

Quello che manca non è capacità tecnica: sono le due o tre cose noiose
(`P1`, `P2`, `P5`) che separano "progetto notevole" da "prodotto che uno
sconosciuto paga senza pensarci".
