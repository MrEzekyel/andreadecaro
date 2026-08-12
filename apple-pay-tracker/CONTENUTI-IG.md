# Contenuti Instagram — i primi 15 post

Serie organica per il feed, da pubblicare **prima** di qualunque post
sponsorizzato. Scritta il 12 agosto 2026.

Vale la voce di `MARKETING.md` §2: diretta, onesta, senza gonfiare. Niente
"rivoluzionario", niente "l'unica app che ti serve". La copertura reale
(40-60%) si dichiara, non si nasconde — nei contenuti social quell'onestà
**è il gancio**, non una nota a piè di pagina.

**Il referral non compare mai in questi post** (`P20`, deciso): è un
beneficio per chi c'è già, non un'esca.

---

## Le due famiglie di post, e perché si alternano

**Tipo A — lo schermo.** Uno o più iPhone con dentro screenshot veri
dell'app. Dimostrano. Sono la prova che la cosa esiste e funziona.

**Tipo B — la grafica.** Nessun telefono: un soggetto grafico grande che
occupa quasi tutta l'immagine, con una frase sopra. Affermano.

Alternati uno-uno, sulla griglia a tre colonne di Instagram formano una
diagonale regolare, e il profilo si legge come una cosa sola invece che
come una raccolta di screenshot.

### La regola che tiene insieme il tipo B

I post di tipo B **non usano oggetti 3D, render, mani o fotografie**.
Usano la grafica dell'app stessa, ingrandita fino a diventare un
manifesto: il semicerchio delle Uscite, le barre del Flusso, le colonne
dei mesi.

Il motivo è che quelle forme sono già flat, già arancio, già nostre — e
soprattutto **sono l'unica parte del progetto che nessun concorrente ha**.
Un semicerchio Clinck alto 800 pixel su fondo bianco è riconoscibile al
terzo post; un render 3D di un salvadanaio potrebbe essere di chiunque.

Vale anche come vincolo di brand: la moodboard di riferimento (RY8STUDIO,
Orely, Eurovision) è costruita su gradienti, ombre profonde e oggetti
lucidi, tutte cose che il nostro design system esclude. Da quelle immagini
si prende la **composizione** — un soggetto solo che domina, testo grosso,
un accento unico, molto vuoto attorno — mai la finitura.

---

## Il blocco stile

Va incollato **in fondo a ogni prompt**, identico, senza modifiche. È
quello che tiene la serie coerente da un post all'altro.

```
STYLE: minimal, calm, confident, editorial. Completely flat design.
Palette strictly limited to four colors: pure white #FFFFFF, warm
vanilla #FFF6C0, warm orange #FF5E2C, near-black ink #141413. Clean
humanist sans-serif, LIGHT weight only, generous letter spacing.
Emphasis comes from size and color, never from bold weight. Lots of
flat negative space.

STRICTLY EXCLUDE: no drop shadows, no gradients, no glow, no 3D or
glossy effects, no reflections, no textures, no comic book elements,
no speech bubbles, no starbursts, no sound-effect lettering, no
badges, no stars, no laurel wreaths, no people, no hands, no floral
motifs, no photographic elements, no extra text of any kind beyond
what is specified above.
```

Tutti i post sono **1080x1350px, 4:5 verticale** — il formato che occupa
più altezza possibile nel feed.

---

## Il blocco telefono (solo tipo A)

Per i post con un telefono solo, incollare questo fra la parte specifica
e il blocco stile:

```
PHONE: One realistic iPhone 15 Pro, thin dark bezel, shown front-on but
rotated about 12 degrees counter-clockwise so it sits at a relaxed
diagonal. Large, centered horizontally, cropped by the bottom edge of
the canvas.

SCREEN CONTENT: Place the attached image inside the phone screen,
filling the screen area completely and matching the phone's 12 degree
tilt. Reproduce the attached interface exactly as provided — same
colors, same layout, same text, sharp and undistorted. Do not redraw,
redesign, restyle or reinterpret any part of it, and do not add any
elements to it.
```

Se il modello sbava sulla UI, rilanciare insistendo sulla riga
*"Reproduce the attached interface exactly as provided"*: è l'unica parte
che tende a reinterpretare.

---

# I 15 post, in ordine di pubblicazione

| # | Tipo | Titolo | Cosa dimostra |
| --- | --- | --- | --- |
| 1 | A | Paghi col telefono. La spesa è automatica. | il gancio |
| 2 | B | Non «quanto ho speso». «Quanto mi resta». | la decisione |
| 3 | A | Due domande diverse. Due schermate. | Uscite / Entrate |
| 4 | B | Noi no. | privacy |
| 5 | A | E la bolletta? Tre secondi, a voce. | Siri |
| 6 | B | Metà delle tue spese non entra da sola. | onestà |
| 7 | A | Anche il portafoglio. Compreso, e gratis. | investimenti |
| 8 | B | 1,99 | prezzo |
| 9 | A | Dove finiscono davvero i soldi. | statistiche |
| 10 | B | Lo spazio fra le due barre. | flusso |
| 11 | A | Due minuti. Una volta sola. | configurazione |
| 12 | B | Sto spendendo tanto? | confronto mesi |
| 13 | A | Sai già cosa ti verrà tolto. | prossimi addebiti |
| 14 | B | Un file, non una richiesta. | export |
| 15 | B | Due mesi. Poi decidi tu. | trial |

Il 15 chiude la serie ed è l'unico con una richiesta esplicita: arriva
dopo quattordici post che hanno già dimostrato tutto.

---

## 1 · A — Il gancio ✅ già prodotto

Screenshot da allegare: **Home, scheda Uscite**.

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, centered
horizontally, generous white margin on all sides, cropped by the bottom
edge of the canvas.

[BLOCCO TELEFONO]

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Paghi col telefono."
   line 2, larger:   "La spesa è automatica."

LINE GRAPHICS: Sparse decorative elements drawn as thin even continuous
outlines in orange #FF5E2C, about 3px stroke, no fill: three nested
concentric arcs like a contactless payment symbol in the upper left; one
long slender curved arrow sweeping from the end of the headline down
toward the top of the phone; two small hollow circles in the upper right.
Keep them small, elegant and technical — never cartoon, never sketchy.

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 2 · B — La decisione

Il semicerchio delle Uscite ingrandito fino a diventare un manifesto. È
il "Free to Spend" di Copilot Money, il riferimento del settore — ma il
numero grande che ci mettiamo dentro è quello che serve a decidere, non
quello che serve a pentirsi.

```
1080x1350px, 4:5 portrait. Flat graphic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

SUBJECT: One enormous semicircular gauge arc, drawn as a thick rounded
stroke, spanning almost the full width of the canvas and positioned in
the lower half. The arc opens upward, like the top half of a ring. Its
left portion, roughly 45 percent of the arc, is solid warm orange
#FF5E2C; the remaining portion is warm vanilla #FFF6C0. The two sections
meet in a clean butt join. Flat color only, no gradient, no shadow, no
outline.

CENTER LABEL: Inside the arc, centered, in ink #141413, light weight,
one large line: "restano 755,79 €"

HEADLINE: In the upper third of the canvas, centered, ink #141413, two
lines:
   line 1, smaller:  "Non «quanto ho speso»."
   line 2, larger:   "«Quanto mi resta»."

WORDMARK: Bottom left corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 3 · A — Due domande diverse

Screenshot da allegare: **due**, Home scheda Uscite e Home scheda Entrate.

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

PHONES: Two realistic iPhone 15 Pro devices, thin dark bezels, side by
side and slightly overlapping. The left phone is rotated about 10 degrees
counter-clockwise and sits slightly lower; the right phone is rotated
about 10 degrees clockwise and sits slightly higher and partly behind the
left one. Both are cropped by the bottom edge of the canvas.

SCREEN CONTENT: Place the first attached image inside the left phone
screen and the second attached image inside the right phone screen,
each filling its screen completely and matching that phone's tilt.
Reproduce both attached interfaces exactly as provided — same colors,
same layout, same text, sharp and undistorted. Do not redraw, redesign,
restyle or reinterpret any part of them.

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Due domande diverse."
   line 2, larger:   "Due schermate."

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 4 · B — Privacy

Il contrasto competitivo vero (`MARKETING.md` §2). Post interamente
tipografico: qui il soggetto grafico **è** il testo, come nei riferimenti
della moodboard costruiti sulla scritta gigante.

```
1080x1350px, 4:5 portrait. Flat typographic poster.

BACKGROUND: Solid warm orange #FF5E2C, full bleed, completely flat.

TEXT: All text in warm vanilla #FFF6C0, clean humanist sans-serif, light
weight, generous letter spacing, left aligned, with a wide margin on the
left side.
 - In the upper half, small size, three short lines stacked:
     "Le altre app di spese"
     "ti chiedono le credenziali"
     "della tua banca."
 - In the lower half, one enormous line occupying nearly the full width
   of the canvas, dramatically larger than everything else:
     "Noi no."

RULE: One thin horizontal line in vanilla #FFF6C0, short, sitting in the
empty space between the small text block and the large line.

WORDMARK: Bottom left corner, small, vanilla #FFF6C0: "clinck"

[BLOCCO STILE]
```

---

## 5 · A — Siri

Screenshot da allegare: **inserimento a voce con Siri** (o Movimenti
subito dopo l'inserimento).

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

[BLOCCO TELEFONO]

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "E la bolletta? I contanti?"
   line 2, larger:   "Tre secondi, a voce."

LINE GRAPHICS: In the upper left white area, a small group of five thin
vertical rounded bars of different heights in orange #FF5E2C, evenly
spaced, suggesting a voice waveform. Flat, no fill variation, no
animation blur.

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 6 · B — Onestà

Il post più importante della serie. Nessuna app di spese dice questa
frase, ed è esattamente il motivo per cui la diciamo: chi arriva
sapendolo resta, chi la scopre da solo alla prima bolletta se ne va e
lascia una stella.

```
1080x1350px, 4:5 portrait. Flat graphic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

SUBJECT: One enormous horizontal bar with fully rounded ends, spanning
almost the full width of the canvas, positioned in the vertical middle,
quite thick. Its left half is solid warm orange #FF5E2C and its right
half is warm vanilla #FFF6C0, meeting in a clean vertical join at the
exact center. Flat color only.

BAR LABELS: Small text in ink #141413, light weight, placed just below
the bar, aligned under each half:
   under the left half:   "entra da solo"
   under the right half:  "lo aggiungi tu"

HEADLINE: In the upper third, centered, ink #141413, two lines:
   line 1, larger:   "Metà delle tue spese"
   line 2, larger:   "non entra da sola."

SUBLINE: In the lower third, centered, small, ink #141413, one line:
   "Te lo diciamo prima, non dopo."

WORDMARK: Bottom left corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 7 · A — Investimenti

Screenshot da allegare: **Investimenti**, con il grafico del portafoglio.

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm orange
#FF5E2C, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

[BLOCCO TELEFONO]

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Anche il portafoglio."
   line 2, larger:   "Compreso, e gratis."

LINE GRAPHICS: In the upper right white area, one thin ascending zigzag
line in orange #FF5E2C, about 3px stroke, like a small stock chart, with
a tiny hollow circle marking its highest point.

WORDMARK: Bottom left, on the orange panel, small, vanilla #FFF6C0:
"clinck"

[BLOCCO STILE]
```

Nota: qui il pannello di fondo è arancio invece che vaniglia. Serve a
spezzare il ritmo a metà serie — se tutti i tipo A avessero lo stesso
fondo, la griglia diventerebbe monotona.

---

## 8 · B — Prezzo

```
1080x1350px, 4:5 portrait. Flat typographic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

MAIN NUMERAL: One enormous numeral occupying most of the canvas height,
centered, in warm orange #FF5E2C, clean humanist sans-serif, light
weight, reading exactly: "1,99"
Immediately after it, much smaller and aligned to its top, in ink
#141413: "€"

CAPTION ABOVE: Small line centered above the numeral, ink #141413:
   "Al mese. Oppure 15 € l'anno."

CAPTION BELOW: Two small lines centered below the numeral, ink #141413:
   "Paghi solo perché le spese si scrivano da sole."
   "Tutto il resto dell'app non si paga mai."

WORDMARK: Bottom left corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 9 · A — Statistiche

Screenshot da allegare: **Statistiche**, ripartizione per categoria.

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

[BLOCCO TELEFONO]

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Non dove pensi."
   line 2, larger:   "Dove finiscono davvero."

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 10 · B — Flusso

Le due barre di `FlowCompare` ingrandite. L'idea originale è di Andrea e
si spiega da sola in un'immagine: la distanza fra le due punte **è**
quello che avanza, uno spazio da guardare invece di un numero da leggere.

```
1080x1350px, 4:5 portrait. Flat graphic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

SUBJECT: Two enormous horizontal bars with fully rounded ends, stacked
one above the other with a generous gap between them, both starting from
the same left edge, positioned in the vertical middle of the canvas.
 - The upper bar is longer, reaching almost the full width, solid warm
   orange #FF5E2C.
 - The lower bar is clearly shorter, reaching about 65 percent of the
   width, warm vanilla #FFF6C0.
Flat color only, no outline.

BAR LABELS: Small text in ink #141413, light weight, placed just above
each bar at its left end:
   above the upper bar:  "INTROITI"
   above the lower bar:  "USCITE"

GAP MARKER: One thin vertical dashed line in orange #FF5E2C rising from
the right end of the shorter bar up to the level of the longer bar, and
a short horizontal arrow in orange connecting the two bar ends. Small
label next to it in ink #141413: "quello che avanza"

HEADLINE: In the upper third, centered, ink #141413, two lines:
   line 1, smaller:  "Non è un numero da leggere."
   line 2, larger:   "È lo spazio fra le due barre."

WORDMARK: Bottom left corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 11 · A — Configurazione

Tre telefoni: è l'unico post in cui la quantità di schermate è il
messaggio — "sono tre passaggi, li vedi tutti, non ti nascondo niente".

Screenshot da allegare: **tre passi della guida** (installa il comando,
incolla la chiave, crea l'automazione).

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

PHONES: Three realistic iPhone 15 Pro devices, thin dark bezels,
arranged in an overlapping fan across the width of the canvas. The left
phone is rotated about 14 degrees counter-clockwise, the center phone is
almost upright and sits in front, the right phone is rotated about 14
degrees clockwise. All three are cropped by the bottom edge.

SCREEN CONTENT: Place the first attached image inside the left phone
screen, the second inside the center phone screen, and the third inside
the right phone screen, each filling its screen completely and matching
that phone's tilt. Reproduce all attached interfaces exactly as provided
— same colors, same layout, same text, sharp and undistorted. Do not
redraw, redesign, restyle or reinterpret any part of them.

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Due minuti di configurazione."
   line 2, larger:   "Una volta sola."

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 12 · B — Confronto fra i mesi

Le colonne di `MonthBars`: i mesi passati spenti, quello in corso pieno —
l'unico ancora in movimento.

```
1080x1350px, 4:5 portrait. Flat graphic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

SUBJECT: Six enormous vertical bars with rounded tops, evenly spaced,
sitting on a common invisible baseline in the lower two thirds of the
canvas, spanning almost the full width. Their heights vary irregularly.
The first five bars are warm vanilla #FFF6C0. The sixth and last bar,
on the right, is solid warm orange #FF5E2C and is clearly the shortest.
Flat color only.

BAR LABELS: Small text in ink #141413, light weight, centered under each
bar, reading left to right: "Mar" "Apr" "Mag" "Giu" "Lug" "Ago"

HEADLINE: In the upper third, centered, ink #141413, two lines:
   line 1, larger:   "«Sto spendendo tanto?»"
   line 2, smaller:  "Il totale del mese da solo non può dirlo."

WORDMARK: Bottom left corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 13 · A — Prossimi addebiti

Screenshot da allegare: **Home**, sezione Prossimi addebiti.

```
1080x1350px, 4:5 portrait. Minimal editorial App Store style promo image.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

BACKDROP PANEL: One large rounded-corner rectangle of warm vanilla
#FFF6C0, flat, occupying the lower two thirds of the canvas, cropped by
the bottom edge.

[BLOCCO TELEFONO]

HEADLINE: On the white area at the top, centered, ink #141413, two lines:
   line 1, smaller:  "Sai già cosa ti verrà tolto."
   line 2, larger:   "E quando."

LINE GRAPHICS: In the upper left white area, three small hollow circles
in orange #FF5E2C connected by a thin horizontal line, like points on a
timeline.

WORDMARK: Bottom left, on the vanilla panel, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 14 · B — Export

Un file che esce, non un'assistenza da contattare. È un argomento di
fiducia spendibile anche in un articolo (`MARKETING.md` §3).

```
1080x1350px, 4:5 portrait. Flat graphic poster.

BACKGROUND: Pure flat white #FFFFFF, full bleed.

SUBJECT: A large flat rectangular grid in the lower two thirds of the
canvas, like a stylized spreadsheet: four columns and seven rows of
plain rectangles separated by thin orange #FF5E2C lines, about 2px
stroke. The cells are empty except for short abstract vanilla #FFF6C0
blocks of varying widths suggesting text, and in the rightmost column
short orange blocks suggesting figures. The grid is cropped by the right
and bottom edges of the canvas, as if it continues beyond the frame.

HEADLINE: In the upper third, left aligned with a wide left margin, ink
#141413, two lines:
   line 1, smaller:  "I tuoi dati escono quando vuoi."
   line 2, larger:   "Un file, non una richiesta."

WORDMARK: Top right corner, small, ink #141413: "clinck"

[BLOCCO STILE]
```

---

## 15 · B — Trial

L'unico post con una richiesta esplicita, e arriva per ultimo.

```
1080x1350px, 4:5 portrait. Flat typographic poster.

BACKGROUND: Solid warm orange #FF5E2C, full bleed, completely flat.

MAIN TEXT: One enormous two-line phrase occupying most of the canvas
height, centered, in warm vanilla #FFF6C0, clean humanist sans-serif,
light weight, generous letter spacing:
   line 1: "Due mesi."
   line 2: "Poi decidi tu."

CAPTION: Two small lines centered in the lower area, vanilla #FFF6C0:
   "L'automazione è gratis per due mesi dall'iscrizione."
   "Se non abboni, resta tutto il resto. Per sempre."

RULE: One thin horizontal line in vanilla #FFF6C0, short, centered
between the large phrase and the caption.

WORDMARK: Bottom left corner, small, vanilla #FFF6C0: "clinck"

[BLOCCO STILE]
```

---

## Cosa manca ancora, e non va inventato

- **Prova sociale.** Negli esempi di riferimento c'è quasi sempre (stelle,
  "App of the Day", numeri di download). Noi non ce l'abbiamo e non si
  fabbrica: arriva dalla beta di 20-50 persone (`MARKETING.md` §9,
  settimane 3-4). Appena esistono 5 frasi vere, diventano il post 16 —
  formato tipo B, una citazione grande su fondo arancio.
- **Il link.** Finché non c'è App Store né dominio, in bio non c'è niente
  da mettere. Questi 15 post servono anche a **riempire il profilo prima**
  che il link esista: un profilo con un post solo non converte nemmeno il
  traffico che gli arriva gratis.
- **Gli screenshot veri.** Ogni post di tipo A ne richiede almeno uno
  aggiornato alla UI attuale (dopo l'unificazione in Movimenti). Vanno
  fatti in una sessione sola, sullo stesso dispositivo, con lo stesso mese
  di dati: screenshot presi in giorni diversi mostrano numeri diversi e la
  serie perde credibilità.

## Dopo questi 15

Solo allora ha senso passare agli sponsorizzati — e comunque
`MARKETING.md` §8 dice che a 1,99 €/mese il paid di acquisizione è
strutturalmente in perdita: gli unici euro che hanno senso sono i ~60 €
di Apple Search Ads nel mese di lancio e i ~25 € di boost sul singolo
contenuto organico che avrà già dimostrato di funzionare da solo.
