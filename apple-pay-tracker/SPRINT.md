# Piano di implementazione

Piano di lavoro sui punti di `PRODOTTO.md`. Questo file è il riferimento
operativo: si consulta prima di iniziare uno sprint e si aggiorna alla fine.

Ogni punto si considera chiuso solo dopo che l'agente `revisore-prodotto` lo
ha verificato (`.claude/agents/revisore-prodotto.md`). Il verdetto dell'agente
si riporta nella tabella di stato.

---

## Stato

| Sprint | Punti | Stato | Verifica |
| --- | --- | --- | --- |
| 1 · Fiducia | P1, P2, P3 | P2 e P3 chiusi · P1 in attesa di Andrea | 10 rilievi, tutti corretti (`bb2e466`) |
| 2 · Attrito zero | P5, P6, P12 | P6 e P12 chiusi · P5 in attesa di Andrea | 7 rilievi, tutti corretti |
| 3 · Integrità del dato | P11, P13 | P11 deployato e live · P13 da fare | — |
| 4 · Sicurezza e trasparenza | P14, P4, P18 | da fare | — |
| 5 · Pricing | P9, P10, P7, P8, P20 | decisione presa · schema e `ingest-payment` in produzione · manca RevenueCat/IAP (richiede uscire da Expo Go) | — |
| 6 · Differenziazione | P17, P16 | bloccato — richiede development build | — |
| Fuori sprint | P15, P19 | decisioni, non implementazioni | — |

---

## Criteri di ordinamento

Tre regole hanno deciso l'ordine, in questa priorità:

1. **Prima ciò che non dipende da nessuno.** Gli sprint 1-4 girano interamente
   dentro Expo Go e non richiedono né l'Apple Developer Program né decisioni di
   Andrea. Si possono fare adesso, tutti.
2. **Prima ciò che protegge i dati, poi ciò che porta clienti.** Un utente che
   perde l'accesso o non può esportare è un danno permanente; una conversione
   mancata si recupera.
3. **Il pricing per ultimo fra le cose che contano.** Cambiare il paywall
   (`P9`) prima di aver sistemato export e recupero password significa far
   pagare un prodotto di cui non ti puoi ancora fidare.

---

## Sprint 1 · Fiducia

**Perché per primo**: sono le tre cose che oggi impediscono a uno sconosciuto
di affidare due anni di storico finanziario. Nessuna delle tre dipende da terzi,
tutte e tre stanno dentro Expo Go.

> **Esito.** La revisione ha prodotto dieci rilievi, tutti corretti in
> `bb2e466`. Il più grave non era in lettura ma in **scrittura**: una lettura
> fallita delle quote diventava una cancellazione, e il difetto *aumentava* le
> spese del mese in silenzio. Da lì la regola aggiunta a `CLAUDE.md`: una
> lettura fallita non deve mai poter diventare la base di un `update`/`delete`.
>
> `P1` resta aperto per una configurazione, non per il codice: finché il
> template Supabase non contiene `{{ .Token }}` l'email arriva senza codice.

### P1 · Recupero password

Flusso **a codice, non a link**. Supabase manda per default un link che
riporta a un `redirectTo`, e in Expo Go l'URL dell'app cambia a ogni sessione:
un deep link sarebbe fragile proprio nel momento in cui l'utente è già in
difficoltà.

Con il codice a sei cifre tutto resta dentro l'app:

1. `resetPasswordForEmail(email)` manda il codice
2. `verifyOtp({ email, token, type: "recovery" })` apre la sessione
3. `updateUser({ password })` la sostituisce

**Dipendenza**: il template email "Reset Password" su Supabase deve contenere
`{{ .Token }}`. È un campo da cambiare a mano nella dashboard — va scritto in
`DA-FARE.md`.

### P2 · Export dei dati

Schermata dedicata in Impostazioni, un export per entità: spese, introiti,
investimenti, divisioni. Quattro file separati e non uno solo, perché un CSV
con più sezioni non si apre pulito in nessun foglio di calcolo.

Dettagli che decidono se funziona davvero:

- separatore `;` e decimali con la virgola — è quello che Excel italiano apre
  con un doppio clic
- BOM UTF-8 in testa, altrimenti Excel mangia gli accenti
- sulle spese servono **sia** `amount` sia `effective_amount`, con
  l'intestazione che dice quale delle due usano le statistiche: è la
  differenza fra una cena divisa in quattro e quello che ti compete

**Soglia**: gli importi del file devono sommare al totale che l'app mostra a
schermo. Va confrontata la formula, non l'occhio.

### P3 · Stato di errore distinto dallo stato vuoto

Il difetto è in `lib/usePayments.ts:60` e nella stessa forma altrove: quando la
lettura fallisce lo stato resta vuoto e l'utente legge una frase affermativa
falsa sui suoi soldi.

Serve un modo condiviso di dire "non ho letto", così che applicarlo ovunque sia
meccanico e non una decisione da ripetere: un componente di errore con
"Riprova" e i hook che espongono l'errore invece di ingoiarlo.

**Copertura**: tutte le superfici che leggono dal database, non solo le spese.
Home, Spese, Statistiche, Investimenti, e le schermate di Impostazioni che
caricano dati.

**Soglia**: con la rete disattivata nessuna schermata afferma un fatto sui
soldi. Tutte dicono che non sono riuscite a leggere, e offrono di riprovare.

---

## Sprint 2 · Attrito zero sull'automazione

**Perché qui**: `P5` è il singolo intervento con il maggior effetto sulla
conversione, ma ha senso solo dopo che l'app di cui si attiva l'automazione è
affidabile.

- **P5** file `.shortcut` pronto, con il token in un campo solo
- **P6** claim onesto sulla copertura, ovunque compaia la promessa
- **P12** mitigazione delle perdite silenziose — si parte dal controllo mensile
  in-app, che è il più economico e trasforma un errore invisibile in una
  domanda esplicita

`P5` richiede di costruire e ospitare un file `.shortcut`: parte del lavoro è
di Andrea (creare il comando su iPhone ed esportarlo su iCloud), parte è di
qui (la schermata che genera il token e il link precompilato). La ricetta, con
il passo di gestione errore che oggi manca, è in `DA-FARE.md` sezione 5ter.

> **Esito.** Sette rilievi, tutti corretti. Il più grave era di nuovo in
> scrittura e di nuovo silenzioso: il controllo mensile non registrava niente
> (`user_id` mancante nell'insert) e chiudeva comunque la scheda, quindi la
> domanda sarebbe tornata per sempre — il controllo contro le perdite
> silenziose era diventato lui stesso una perdita silenziosa.

---

## Sprint 3 · Integrità del dato

> **Esito P11.** `ingest-payment` (v7) e `sync-prices` (v3) sono stati
> deployati passando il contenuto vero dei file, mai ricostruito a pezzi.
> Verificato via `get_edge_function` che la versione live contiene
> `detectCurrency`/`toEur` e scrive `original_amount`/`original_currency`/
> `fx_rate` sull'insert — non solo che il deploy sia andato a buon fine, ma
> che sia proprio questo codice a girare ora.

- **P11** multi-valuta: salvare la valuta originale sulla transazione e
  convertire al cambio della data. Migrazione + `ingest-payment` +
  visualizzazione. L'infrastruttura dei cambi esiste già in `sync-prices`.
  **Chiuso** — resta da verificare con un pagamento reale in valuta estera
  (vedi `DA-FARE.md`, sezione test).
- **P13** cache locale per la lettura offline — ancora da fare

Vanno insieme: entrambi toccano il modo in cui i dati arrivano a schermo, e
`P13` completa `P3` — "questi sono i dati di stamattina" è meglio sia di una
schermata bianca sia di un errore.

---

## Sprint 4 · Sicurezza e trasparenza

- **P14** blocco biometrico (`expo-local-authentication`, dentro Expo Go)
- **P4** privacy policy pubblicata + la riga sulla continuità dei dati.
  Ha senso solo dopo `P2`: prometterlo senza export è una bugia
- **P18** changelog in-app

---

## Sprint 5 · Pricing — decisione presa, implementazione in corso

Andrea ha deciso: 2 mesi di automazione gratis dalla registrazione (`P8`),
poi 1,99 €/mese o 15 €/anno per continuare a usarla (`P10`) — solo
l'automazione si blocca, tutto il resto resta gratis per sempre (`P7`,
`P9`). Più un programma referral (`P20`): 5 amici confermati (primo
pagamento automatico riuscito, non solo registrazione) sbloccano 2 mesi
extra, traguardo unico.

**Fatto**: migration `0033_subscriptions_referrals.sql` (tabelle `profiles`
e `referrals`, RPC `redeem_referral_code`, trigger esteso su
`handle_new_user`), enforcement in `ingest-payment` (v8, in produzione) con
conferma referral e bonus automatico, `lib/useSubscription.ts`,
`screens/SubscriptionScreen.tsx`, `screens/ReferralScreen.tsx`, campo
codice invito in `AuthScreen.tsx`, banner trial in `HomeScreen.tsx`.

**Manca**: l'acquisto vero. Serve RevenueCat + Apple In-App Purchase, che
richiede lasciare Expo Go per una build nativa (EAS Build → TestFlight) —
vedi `DA-FARE.md` per la sequenza. Fino ad allora il pulsante "Abbonati" in
`SubscriptionScreen` resta disabilitato.

---

## Sprint 6 · Differenziazione — bloccato

- **P17** obiettivi di risparmio collegati al portafoglio reale: fattibile
  subito, ma ha più valore dopo `P9` perché è il candidato naturale a feature
  premium
- **P16** push per i limiti: richiede di uscire da Expo Go (development build).
  Decisione strutturale.

---

## Fuori sprint

- **P15** repository privato — decisione di Andrea, cinque minuti
- **P19** condivisione familiare — va dichiarata come non-obiettivo in
  `README.md`, non implementata
