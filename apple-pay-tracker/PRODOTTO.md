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

### P5 · File `.shortcut` pronto · **oggi sono dieci passi a mano**

Per attivare la funzione che si paga, oggi bisogna: generare un token, copiare
un URL, uscire dall'app, aprire Comandi Rapidi, creare un'automazione,
aggiungere "Ottieni contenuto URL", impostare POST, aggiungere l'intestazione
`x-ingest-token`, cambiare il corpo in JSON e compilare **sei** coppie
chiave/valore scegliendo la variabile giusta da un selettore in cui — lo dice
`DA-FARE.md` — due voci si chiamano uguale e scambiarle manda l'importo come
nome dell'esercente.

Dal punto di vista del cliente: *gli si chiede di fare lavoro di integrazione
di sistema, e glielo si fa pagare*. Il trial gli si brucia nel setup.

Serve un file `.shortcut` già costruito, distribuito via link iCloud, in cui
l'utente incolla il token in un campo solo. Trenta secondi invece di dieci
minuti.

**È il singolo intervento con il maggior effetto sulla conversione.**

**Verifica**: un utente che non ha mai visto Comandi Rapidi attiva
l'automazione in meno di un minuto senza leggere istruzioni.

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

### P7 · Cosa succede alla scadenza dell'abbonamento · **non definito**

Non è deciso né scritto da nessuna parte. È la domanda che un cliente fa
**prima** di pagare.

Se l'ingestione si ferma, lo storico ha un buco permanente nei mesi non pagati,
e quel buco non si recupera. Va deciso, e va scritto nella schermata di
acquisto — non nei termini di servizio.

### P8 · Durata del trial · **1 mese, tarato al contrario**

Un tracker di spese vale **quando puoi confrontare**: questo mese contro il
precedente, la categoria che scivola, la media a sei mesi. Con un mese di trial
l'utente arriva alla scadenza con un solo mese di dati e zero confronti — il
trial finisce nel momento esatto in cui l'app stava per diventare utile.

Due mesi, o meglio legato ai dati: gratis finché non hai tre mesi di storico.

### P9 · Inversione del paywall · **automazione gratis, portafoglio a pagamento**

L'automazione è la promessa che procura gli utenti: dietro un paywall soffoca
l'acquisizione, ed è per giunta la parte che non controlliamo e che genererà i
reclami.

Il portafoglio è differenziato, affidabile e vale davvero soldi. Si fa pagare
la cosa solida e distintiva, non l'integrazione client-side che dipende da
Apple.

Dipende da `P10`, e insieme richiedono l'Apple Developer Program e gli acquisti
in-app: è una decisione di Andrea, non un'implementazione.

### P10 · Prezzo · **da €15/anno a €24-29/anno**

A €15/anno si è il più economico del mercato di un fattore 2-6× (YNAB ~$109,
Copilot ~$95, Spendee ~€30). Non rassicura: segnala "progetto personale, tra
diciotto mesi non esiste più" — che è esattamente il dubbio del punto `P4`.

A €24-29 si resta metà di chiunque altro e si smette di segnalare hobby. Il
cliente sta comprando anche la probabilità che l'app esista fra due anni.

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

### P13 · Lettura offline · **assente**

Nessuna cache locale. In metropolitana o in ascensore l'app è bianca. Tutti i
concorrenti funzionano offline in lettura.

Si incastra con `P3`: una cache locale trasforma "non riesco a leggere" in
"questi sono i dati di stamattina", che è molto meglio di entrambe le
alternative attuali.

---

## Sicurezza

### P14 · Blocco biometrico · **assente**

L'app apre l'intero storico finanziario a chiunque abbia il telefono sbloccato.
Ce l'hanno tutti i concorrenti. È `expo-local-authentication`, un pomeriggio.

### P15 · Repository privato · **decisione aperta da mesi**

`MrEzekyel/andreadecaro` è pubblico. Il codice non contiene segreti, ma per un
prodotto a pagamento di finanza personale è un segnale strano. `DA-FARE.md` lo
elenca ancora come decisione aperta: va chiusa.

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

### P18 · Changelog in-app · **il ritmo di sviluppo è un punto di forza sprecato**

Gli aggiornamenti sono frequenti e sostanziosi: è il miglior segnale di
affidabilità che l'app abbia. Oggi è visibile solo su GitHub. Una schermata
"cosa è cambiato" comunica "questa cosa è viva" meglio di qualunque claim.

### P19 · Condivisione familiare · **assente — dichiararlo, non subirlo**

Le divisioni esistono ma le persone non sono utenti: due conviventi non possono
tenere un budget comune. Probabilmente giusto tenerla fuori adesso, ma va
dichiarata come scelta esplicita e non lasciata come buco.

---

## La sintesi

L'ingegneria è migliore del prodotto. Ci sono decisioni in questo repository —
la mediana invece della media, `investedBasis` contro `costBasis`, il sync che
si rifiuta di scrivere quando non si fida di sé — più mature di quelle di app
che costano sei volte tanto.

Quello che manca non è capacità tecnica: sono le due o tre cose noiose
(`P1`, `P2`, `P5`) che separano "progetto notevole" da "prodotto che uno
sconosciuto paga senza pensarci".
