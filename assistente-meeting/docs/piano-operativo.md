# Assistente Meeting — Piano operativo

6 ottobre 2026 · Andrea De Caro

Il piano traduce il [documento di contesto](./contesto.md) in passi concreti. L'ordine di lavoro concordato è:

1. **Requisiti**: Andrea manda l'elenco completo delle funzionalità.
2. **Design**: si disegnano le pagine di app Mac e app smartphone.
3. **Costruzione**: si sviluppa per fasi, a partire dalla pipeline audio.

In parallelo ai punti 1 e 2 conviene fare lo **spike audio (fase 0)**. Non dipende dalla UI e decide lo stack dell'app Mac, che a sua volta cambia come si disegnano e costruiscono le pagine: SwiftUI nativo da una parte, UI web in Tauri/Electron dall'altra.

---

## Step A — Raccolta requisiti

**Input atteso da Andrea:** l'elenco delle funzionalità, anche grezzo. Per ognuna è utile sapere:

| Campo | Esempio |
| --- | --- |
| Funzione | Assegnare un nome a ogni interlocutore |
| Dove | Mac / telefono / entrambi |
| Priorità | Must / Should / Could |
| Note | "Voglio sentire 5 secondi di audio prima di scegliere il nome" |

**Cosa ne esce:**
- `docs/requisiti.md`: elenco consolidato e numerato (F-01, F-02…), con la fase di appartenenza.
- Confronto con la tabella "Funzionalità e app" del contesto: le funzioni nuove, quelle spostate di fase e quelle tolte.
- Domande aperte, se ce ne sono, raccolte in un solo giro.

**Fatto quando:** Andrea approva `requisiti.md`.

## Step B — Design delle pagine

**Cosa si produce:**
1. **Mappa delle schermate** (`docs/design/mappa.md`): elenco delle pagine e navigazione tra loro, per Mac e per telefono.
2. **Wireframe** delle pagine principali, come artifact HTML navigabili da rivedere nel browser:
   - Mac: elenco meeting, dettaglio meeting (transcript + player audio), assegnazione interlocutori, rubrica persone, progetti, task, stato di registrazione e barra dei menu.
   - Telefono: elenco meeting, transcript, riassunto, task (sola lettura).
3. **Design system minimo:** colori, tipografia, spaziature e componenti base (badge di stato, riga di transcript, card meeting), "più pulito di Notion".
4. **Mockup ad alta fedeltà** delle 3–4 schermate chiave, dopo l'approvazione dei wireframe.

**Fatto quando:** Andrea approva mappa e mockup. Ogni schermata ha i dati che mostra mappati sulle tabelle del modello dati.

## Step C — Costruzione

Le fasi seguono il documento di contesto. Ognuna si chiude con un criterio verificabile.

### Fase 0 — Spike audio (in parallelo ad A e B)

| # | Attività | Esito |
| --- | --- | --- |
| 0.1 | Verificare la versione di macOS del MacBook (serve la 13+) | Versione annotata |
| 0.2 | Prototipo Swift a riga di comando: ScreenCaptureKit (audio di sistema) + AVAudioEngine (microfono) → due file M4A | Due file da una call Teams reale con AirPods |
| 0.3 | Controllo qualità: tracce pulite, nessuna eco della propria voce nella traccia system, sincronia tra le tracce | Note in `spikes/audio-capture/RISULTATI.md` |
| 0.4 | Permesso "Registrazione schermo e audio di sistema": prima concessione e comportamento dopo il riavvio | Procedura documentata |
| 0.5 | Decisione sullo stack dell'app Mac | Decisione registrata in `docs/decisioni.md` |

**Nota tecnica:** lo spike va eseguito sul Mac di Andrea, perché ScreenCaptureKit non gira in questo ambiente cloud. Il codice dello spike si prepara qui, la prova si fa in locale.

**Raccomandazione preliminare:** Swift/SwiftUI nativo. Cattura audio, barra dei menu e permessi sono tutti nativi, e con Tauri/Electron servirebbe comunque un modulo Swift per l'audio. Decide lo spike.

### Fase 0b — Confronto provider di trascrizione

| # | Attività | Esito |
| --- | --- | --- |
| 0b.1 | Con le tracce dello spike, trascrivere lo stesso audio con AssemblyAI (UE), Soniox ed ElevenLabs Scribe | Tre transcript |
| 0b.2 | Confrontare la qualità sull'italiano, la separazione degli interlocutori, i costi da listino e la regione dei dati | Tabella in `docs/decisioni.md` |
| 0b.3 | Scelta del provider | Decisione registrata |

### Fase 1 — Pipeline e transcript leggibile

| # | Attività |
| --- | --- |
| 1.1 | Progetto Supabase dedicato (da confermare), regione UE |
| 1.2 | Migrazioni: `projects`, `people`, `project_people`, `meetings`, `tracks`, `utterances`, `speaker_map`, con RLS mono-utente |
| 1.3 | Storage: bucket privato `meetings/{meeting_id}/{track}/` |
| 1.4 | Auth: login di Andrea (email/password o magic link) |
| 1.5 | App Mac: pulsante Registra, indicatore nella barra dei menu, promemoria di avvisare i partecipanti |
| 1.6 | App Mac: upload a blocchi ogni 30–60 s, ripresa degli upload dopo un crash, stato `uploaded` |
| 1.7 | Edge Function `transcribe-meeting`: URL firmati e job sul provider (traccia system con diarizzazione, mic senza) |
| 1.8 | Edge Function `transcription-webhook`: scrittura in `utterances` e passaggio a `transcribed` |
| 1.9 | Interfaccia provider `transcribe(audioUrl) → utterances[]` |
| 1.10 | App Mac: elenco meeting con stato e filtro progetto, transcript con audio sincronizzato |

**Fatta quando:** una registrazione reale diventa un transcript leggibile nell'app Mac.

### Fase 2 — Nomi e progetti

| # | Attività |
| --- | --- |
| 2.1 | Rubrica persone (CRUD) e persona "Io" |
| 2.2 | Progetti e `project_people` |
| 2.3 | Schermata di assegnazione: etichetta del provider → persona, con anteprima audio |
| 2.4 | Mappatura automatica della traccia mic su "Io" |
| 2.5 | Passaggi di stato `speakers_named` → `ready` |

**Fatta quando:** un meeting nominato mostra i nomi veri nel transcript.

### Fase 3 — Claude Code legge e riassume

| # | Attività |
| --- | --- |
| 3.1 | Vista `meeting_transcript_view` |
| 3.2 | Ruolo Postgres `claude_code`: SELECT ovunque, scritture solo tramite funzioni |
| 3.3 | Funzioni `save_summary(meeting_id, text)` e `create_task(...)` (SECURITY DEFINER) |
| 3.4 | Scelta del metodo di connessione: connettore Supabase o connessione diretta con il ruolo ristretto |
| 3.5 | `CLAUDE.md` con le 5 regole del documento di contesto |
| 3.6 | App Mac: visualizzazione del riassunto |

**Fatta quando:** "Riassumi le call di oggi" salva un riassunto nel DB e l'app lo mostra.

### Fase 4 — Task e commenti

| # | Attività |
| --- | --- |
| 4.1 | Tabelle `tasks` e `comments` |
| 4.2 | Task collegati alla frase di origine, con scadenza, stato e assegnatario |
| 4.3 | App Mac: vista task (lista e filtri), modifica, commenti |
| 4.4 | Protezione dei task creati dall'utente rispetto a Claude |

**Fatta quando:** i task creati da Claude Code si vedono e si correggono nell'app.

### Fase 5 — App smartphone

| # | Attività |
| --- | --- |
| 5.1 | Progetto Expo Go con la stessa configurazione di Clink e MB Companion |
| 5.2 | Supabase Auth |
| 5.3 | Elenco meeting, transcript (solo testo), riassunto, task e commenti in sola lettura |

**Fatta quando:** tutto è consultabile dal telefono.

---

## Struttura del repository (proposta)

```
assistente-meeting/
├── CLAUDE.md                  # regole per Claude Code (fase 3)
├── README.md
├── docs/
│   ├── contesto.md            # documento di contesto originale
│   ├── piano-operativo.md     # questo file
│   ├── requisiti.md           # step A
│   ├── decisioni.md           # registro delle decisioni (stack, provider, ...)
│   └── design/                # step B: mappa, wireframe, mockup
├── spikes/
│   └── audio-capture/         # fase 0
├── apps/
│   ├── mac/                   # app Mac (stack deciso dallo spike)
│   └── mobile/                # app Expo (fase 5)
└── supabase/
    ├── migrations/
    └── functions/
        ├── transcribe-meeting/
        └── transcription-webhook/
```

## Decisioni aperte

| Decisione | Quando si chiude | Proposta |
| --- | --- | --- |
| Stack app Mac | Fine fase 0 | Swift/SwiftUI |
| Versione macOS | Subito (0.1) | — |
| Provider di trascrizione | Fine fase 0b | AssemblyAI UE, salvo il confronto |
| Conservazione audio | Fase 1 | 30 giorni dopo `transcribed`, poi cancellazione |
| Progetto Supabase | Inizio fase 1 | Nuovo e dedicato, regione UE |
| Ruolo `claude_code` | Fase 3 | Funzioni SECURITY DEFINER + ruolo con login dedicato |

## Prossimo passo

Andrea manda l'elenco delle funzionalità (step A). Intanto, se va bene, si prepara il codice dello spike audio da provare sul Mac.
