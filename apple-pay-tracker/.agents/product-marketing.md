# Product Marketing Context

**Document version:** v3
**Last updated:** 2026-08-11

> ⚠️ Documento redatto sulle informazioni di prodotto disponibili, **senza
> ancora customer research reale** (nessuna intervista, nessun utente
> pagante). Le sezioni marcate ⚠️ sono ipotesi di lavoro, non fatti
> verificati — vanno riviste appena arrivano i primi utenti veri (target
> indicativo: i 20-50 della prima sponsorizzazione, vedi Goals).

## Product Overview

**One-liner:** Il tracker di spese che si scrive da solo quando paghi con Apple Pay — senza collegare la banca a nessuno.

**What it does:** App iOS che registra automaticamente ogni pagamento Apple Pay tramite un'automazione nativa di iOS (trigger Wallet + Comandi Rapidi), lo categorizza per esercente e lo mostra in statistiche, limiti di spesa e andamento mensile. Oltre al tracciamento: spese ricorrenti automatiche, spese divise con altre persone, un modulo investimenti con portafoglio reale (conto titoli, crypto, private market) e piani di accumulo, export CSV completo, lettura offline, blocco Face ID.

**Product category:** Tracker di spese personali / app di finanza personale per iOS. Scaffale in cui si cerca: "app per tracciare le spese", "budget tracker iPhone", "spese Apple Pay automatiche".

**Product type:** App mobile nativa iOS (Expo/React Native + Supabase), consumer B2C, self-serve, nessuna versione web.

**Business model:** Freemium a tempo. 2 mesi di automazione gratis dalla registrazione, poi 1,99 €/mese o 15 €/anno per continuarla. **Solo l'automazione è a pagamento**: storico, statistiche, spese manuali, limiti, export, investimenti restano gratis per sempre, abbonati o no. Referral interno (mai negli ads): 5 amici che confermano il referral — primo pagamento automatico riuscito del loro account, non la sola registrazione — sbloccano 2 mesi extra a chi ha invitato, traguardo unico.

## Target Audience

**Target audience:** ⚠️ Privati in Italia che usano Apple Pay come metodo di pagamento quotidiano/principale (non occasionale) e hanno già provato, o considerato, di tracciare le proprie spese. iPhone-only per costruzione (l'automazione dipende da Comandi Rapidi/Wallet iOS).

**Decision-makers:** N/A — prodotto consumer self-serve, chi decide è chi usa.

**Primary use case:** Sapere dove vanno i propri soldi senza dover inserire ogni spesa a mano — il motivo per cui la maggior parte dei tracker di spesa viene abbandonata entro la prima settimana.

**Jobs to be done:**
- "Voglio vedere dove vanno i miei soldi senza il lavoro di inserire ogni scontrino"
- "Voglio un avviso prima di sforare il budget del mese, non scoprirlo a conto esaurito"
- "Voglio vedere spese quotidiane e investimenti nello stesso posto, non in due app diverse che non si parlano"

**Use cases:**
- Chi vuole un budget mensile/settimanale con avvisi automatici, senza foglio Excel da aggiornare
- Chi convive o esce spesso con qualcuno e vuole dividere spese senza dover chiedere all'altra persona di scaricare un'app
- Chi ha un piccolo portafoglio (PAC, crypto, conto titoli) e vuole vederlo insieme al bilancio mensile, non in un'app a parte

## Personas

Prodotto B2C self-serve: nessuna catena di decisione, una sola persona che scarica, decide e paga.

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Utente finale (unico) | Sapere dove vanno i soldi senza fatica; non regalare le proprie credenziali bancarie a un aggregatore terzo | Ha già abbandonato altri tracker per la noia dell'inserimento manuale, o paga troppo per uno internazionale | Automazione vera, senza collegare la banca, a un decimo del prezzo dei concorrenti |

## Problems & Pain Points

**Core problem:** Tracciare le spese a mano richiede disciplina che quasi nessuno mantiene oltre la prima settimana — è la causa #1 di abbandono nella categoria.

**Why alternatives fall short:**
- Immissione manuale (fogli, app base): richiede lo sforzo quotidiano che fa fallire la categoria
- Open Banking (YNAB, Copilot e simili): automatico, ma richiede di collegare le credenziali bancarie a un servizio terzo — attrito reale per chi non si fida, e comunque nessuno di questi copre gli investimenti nello stesso posto
- Nessun tracking (solo l'app della banca): ⚠️ probabilmente lo status quo della maggioranza — nessuna vista aggregata, nessun limite, nessun avviso

**What it costs them:** Tempo (l'inserimento manuale quotidiano) o denaro (i concorrenti internazionali costano 5-10× di più: YNAB ~$109/anno, Copilot ~$95/anno, Spendee ~€30/anno contro 15€/anno qui).

**Emotional tension:** Ansia da "non so davvero quanto sto spendendo questo mese", frustrazione da abbandono ripetuto ("ho scaricato tre app diverse e le ho mollate tutte dopo pochi giorni").

## Competitive Landscape

**Direct:** YNAB, Copilot, Spendee — tracker di spesa generalisti. Falliscono su tre fronti insieme: prezzo (5-10× più cari), fiducia (richiedono Open Banking, cioè condividere le credenziali bancarie con un servizio terzo), e ampiezza (nessuno integra un vero portafoglio investimenti nello stesso abbonamento).

**Secondary:** Foglio Excel/Google Sheets fatto a mano — gratis, ma richiede la disciplina quotidiana che è esattamente il problema che l'app risolve.

**Indirect:** Non tracciare affatto, guardare solo l'estratto conto della banca — ⚠️ probabilmente lo stato di fatto della maggioranza del pubblico target, non un concorrente ma l'inerzia da vincere.

## Differentiation

**Key differentiators:**
- Automazione via trigger Wallet nativo di iOS: nessuna credenziale bancaria condivisa con nessuno, i dati restano fra il telefono e il proprio account
- Modulo investimenti reale (conto titoli, crypto, private market, piani di accumulo automatici) incluso, non un add-on separato
- Prezzo: 15€/anno contro $95-109/anno dei concorrenti diretti
- Trasparenza dichiarata sui limiti: l'app dice fin dalla prima riga del README cosa NON copre (contanti, bonifici, SDD — 40-60% della spesa reale), invece di promettere "tutte le tue spese" e deludere alla prima bolletta mancante

**How we do it differently:** Automazione locale (Comandi Rapidi + trigger Wallet) invece di Open Banking/aggregazione bancaria di terze parti.

**Why that's better:** Zero credenziali bancarie condivise con un servizio esterno — l'ansia da privacy che frena chi ha già sentito parlare di data breach su aggregatori finanziari semplicemente non si pone. Più economico perché non c'è un costo di integrazione bancaria da scaricare sul prezzo.

**Why customers choose us:** ⚠️ Ipotesi da validare — combinazione di prezzo basso, "niente banca collegata a terzi", e avere spese + investimenti nello stesso posto. Non sappiamo ancora quale di questi tre pesi di più nella decisione reale.

## Objections

| Objection | Response |
|-----------|----------|
| "Copre solo Apple Pay, che senso ha se pago spesso in contanti o bonifico?" | L'app lo dice subito e onestamente: automatizza il 40-60% (i pagamenti con carta), il resto si aggiunge in tre secondi con Siri. Non promette il 100% automatico, promette di eliminare la parte più noiosa — le decine di piccole spese quotidiane. |
| "Perché fidarmi dei miei dati finanziari con un'app di uno sviluppatore indipendente?" | Nessun collegamento bancario reale: l'automazione legge solo il trigger Wallet locale sul telefono, non username/password di nessuna banca. Dati protetti da Row Level Security per singolo utente, mai condivisi con terzi. |
| "1,99€/mese è un abbonamento in più che non mi serve" | 2 mesi gratis per provarlo su spese vere prima di decidere; se non ti convince, il 90% dell'app (storico, statistiche, spese manuali, export, investimenti) resta comunque gratis per sempre, anche senza abbonarsi. |

**Anti-persona:** Chi paga quasi sempre in contanti o bonifico (l'automazione aiuta troppo poco per valerne la pena); chi cerca un budget di coppia/famiglia con sincronizzazione in tempo reale su più account (dichiarato esplicitamente come non-obiettivo nel README — l'app è a utente singolo); chi non ha un iPhone.

## Switching Dynamics

**Push:** ⚠️ Hanno già provato e abbandonato un tracker per la fatica dell'inserimento manuale, oppure pagano già un concorrente internazionale e trovano il prezzo sproporzionato.

**Pull:** Automazione che funziona davvero senza fare nulla ogni giorno; prezzo molto più basso della categoria; investimenti inclusi nello stesso posto.

**Habit:** Abitudine consolidata a guardare solo l'app della banca, senza nessuna vista aggregata o limite impostato.

**Anxiety:** "Funzionerà davvero senza che io debba controllare ogni giorno?"; "e se un pagamento non viene registrato, me ne accorgo?"; "chi vede i miei dati finanziari se l'app è di uno sviluppatore indipendente e non di una banca conosciuta?".

## Customer Language

⚠️ Nessuna intervista reale ancora fatta — questa sezione è la lingua **del prodotto** (dal README, dal tono già scelto), non lingua verificata di clienti veri. Da riscrivere con frasi vere appena arrivano i primi utenti.

**How they describe the problem:** ⚠️ ipotesi — "ho scaricato tre app diverse per tracciare le spese e le ho mollate tutte dopo una settimana"; "non ho idea di quanto spendo davvero al mese".

**How they describe us:** ⚠️ ipotesi — "quella che si aggiorna da sola quando pago con Apple Pay".

**Words to use:** "si scrive da solo", "niente banca collegata", "automatico davvero" (non "intelligente" — non è un prodotto che si vende sull'AI), "due mesi gratis", diretto e senza superlativi.

**Words to avoid:** "rivoluzionario", "tutte le tue spese" (senza il disclaimer subito accanto — è esattamente l'errore che il README evita di proposito), "intelligenza artificiale"/"smart" (non è il gancio del prodotto), gergo bancario/fintech pesante.

**Glossary:**
| Term | Meaning |
|------|---------|
| Automazione | Il meccanismo Comandi Rapidi + trigger Wallet che registra da sola i pagamenti Apple Pay |
| Trial | I 2 mesi gratis di automazione dalla registrazione |
| Abbonamento | 1,99€/mese o 15€/anno per continuare l'automazione dopo il trial |
| Referral | Programma interno: 5 amici confermati = 2 mesi extra, mai negli ads |
| PAC | Piano di accumulo — investimento automatico ricorrente su un asset |

## Brand Voice

**Tone:** Diretto, onesto anche quando la verità è scomoda (il README dichiara i propri limiti nella prima riga, non in fondo alle FAQ). Mai hype, mai superlativi.

**Style:** Essenziale, un po' tecnico quando serve spiegare come funziona qualcosa (il diagramma del flusso nel README), ma sempre in linguaggio chiaro — niente gergo fintech per sembrare più grande di quanto sia.

**Personality:** Onesto, diretto, trasparente, essenziale, poco appariscente (design ispirato ad Anthropic/Claude: fondo caldo, un solo colore d'accento, pesi tipografici bassi — mai "gamificato" o pieno di badge/coriandoli).

## Proof Points

⚠️ Nessuno ancora — prodotto non lanciato pubblicamente, zero utenti paganti, zero testimonianze. Da popolare dopo il primo mese di sponsorizzazione (target indicativo 20-50 utenti attivi sull'automazione).

**Metrics:** — (nessuna ancora)
**Customers:** — (nessuno ancora)
**Testimonials:** — (nessuna ancora)
**Value themes:**
| Theme | Proof |
|-------|-------|
| Automazione vera, senza collegare la banca | Da dimostrare con dati reali di utilizzo — nessuna prova ancora raccolta |
| Prezzo molto più basso della categoria | Confronto pubblico: 15€/anno contro $95-109/anno di YNAB/Copilot |

## Goals

**Business goal:** Validare se l'automazione Apple Pay è un gancio sufficiente a generare conversione trial→abbonamento, prima di investire in canali più costosi. Primo test: sponsorizzazione Meta Ads (caroselli Instagram) dopo la pubblicazione su App Store, **budget fisso di 100€** (esclusi i costi Apple Developer Program) — con questo tetto lo scenario centrale plausibile è 15-20 utenti che completano l'automazione (non solo il download), non le 50 del riferimento iniziale. La lettura del risultato è sul **costo per automazione completata**, non su un conteggio assoluto: dettagli e regola di decisione in `.agents/marketing-plan.md` §4/§13.

**Key conversion action:** Non il download — è **completare l'automazione** (costruire la Shortcut, registrare il primo pagamento vero). È il vero "aha moment": un download senza automazione attiva non dimostra niente sul prodotto.

**Current metrics:** Nessuno — l'app non è ancora pubblicata su App Store. Distribuzione attuale solo via Expo Go, in fase di test interno.

**Data di lancio target:** Pubblicazione App Store entro il **10 ottobre 2026**, lancio (inizio sponsorizzazione) **metà ottobre 2026** — finestra di 60 giorni decisa l'11 agosto 2026. Il piano dettagliato con le dipendenze settimana per settimana è in `.agents/marketing-plan.md`.

## Changelog
*Newest first. One line per revision: what changed and why.*
- v3 (2026-08-11) — Fissato il budget del test Meta Ads a 100€ (tetto deciso da Andrea): ricalibrata la soglia di successo in Goals da "20-50 utenti" a "15-20 scenario centrale, letto sul costo per automazione" — dettaglio in `.agents/marketing-plan.md`.
- v2 (2026-08-11) — Aggiunta la data di lancio target (10 ottobre pubblicazione, metà ottobre lancio) in Goals, decisa da Andrea con finestra di 60 giorni.
- v1 (2026-08-11) — Documento iniziale, redatto da contesto di prodotto (README, PRODOTTO.md, decisioni di business già prese) senza customer research reale: sezioni target, differenziazione, objections e customer language sono ipotesi di lavoro marcate ⚠️, da rivedere con i primi utenti veri.
