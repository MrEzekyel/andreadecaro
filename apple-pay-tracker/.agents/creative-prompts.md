# Prompt creativi — Nanobanana Pro

Prompt per la generazione immagini (Nanobanana Pro) per la pagina social di
**Clinck** e per il carosello Meta Ads del test da 100€ descritto in
`.agents/marketing-plan.md` §4 Move 3.

## Fonti

- **Nome**: Clinck — onomatopea del suono delle monete/dei soldi nei fumetti
- **Moodboard di riferimento** (screenshot condivisi da Andrea, stile
  RY8STUDIO/D.CREW): tipografia grande come protagonista, un solo fuoco per
  immagine, contrasto netto, oggetti/foto trattati con dominante di colore.
  **Il nero della moodboard è stato scartato** su richiesta esplicita di
  Andrea — sostituito con la palette del brand.
- **Palette**: arancione `#FF5E2C`, vaniglia `#FFF6C0`, ink `#141413` (lo
  stesso usato in app per il testo su fondo chiaro — vedi `lib/theme.ts`)
- **Icona app**: quadrato arancione arrotondato, barre ascendenti in
  vaniglia — già esistente, va riusata come asset, non rigenerata
- **Font**: nessun file specifico, descritto per caratteristiche — umanista,
  peso basso, mai bold pesante, coerente con lo stile tipografico di Claude
  già usato in app (`CLAUDE.md` → "pesi tipografici bassi, mai oltre 600")

## UI reale, non generata

È un'app: quando lo schermo del telefono deve mostrare l'interfaccia, si usa
uno **screenshot vero** composto dentro una cornice iPhone, non un'interfaccia
inventata dal modello — altrimenti il rischio è un'app "plausibile" ma diversa
da quella reale (colori sballati, layout inventato), la stessa disonestà che
il resto del progetto evita sempre. Nanobanana Pro accetta un'immagine di
riferimento insieme al prompt: si allega lo screenshot e si chiede di
comporlo dentro una cornice iPhone nella scena descritta, senza modificarne il
contenuto.

Screenshot serviti, e dove vanno:
1. **Home con una spesa appena registrata in cima alla lista** → A2, A6 slide 2, Sezione B slide 2
2. **Home o Statistiche con il grafico dell'andamento mensile** → A7, Sezione B slide 3 (una delle due alternative)
3. **Investimenti** → Sezione B slide 3 (l'altra alternativa)

Ogni prompt qui sotto segnato **[UI reale]** presuppone lo screenshot allegato
come immagine di riferimento. I prompt senza quel segno restano generazione
pura — lo schermo del telefono, dove compare, resta volutamente non
leggibile (gesto, non contenuto), quindi non serve nessuno screenshot.

## Blocco stile (da includere in ogni prompt)

```
Brand color palette: warm orange #FF5E2C as dominant background/accent, warm vanilla/cream #FFF6C0 as secondary background and text-on-orange color, near-black ink #141413 used sparingly for small text on cream backgrounds. No black or dark backgrounds. Typography: clean humanist sans-serif, light-to-medium weight only, generous letter spacing, warm and editorial — never a heavy bold geometric display font. Composition: bold single focal point, lots of confident negative space, high contrast between the two brand colors, minimal and graphic rather than busy or cluttered. Overall mood: confident, honest, understated — not shouty or hyped, no gradients, no drop shadows, no glossy 3D effects. Format 1080x1350px (4:5 portrait).
```

## Sezione A — Post organici (pagina social)

### A1 — Manifesto / "Chi è Clinck"
```
[Blocco stile] Full-bleed warm orange #FF5E2C background. Large, light-weight sans-serif headline in vanilla #FFF6C0, centered, reading "Il rumore dei soldi che spendi, finalmente lo senti prima" — but only the word "Clinck" is set much larger and bolder than the rest, acting as the visual anchor. In the bottom third, a small comic-style sound burst / speech-bubble shape in vanilla outline containing the word "CLINCK!" like an onomatopoeia in a comic panel. Plenty of empty orange space around the type. No photography, no icons, pure typographic poster.
```

### A2 — Il gancio prodotto (prima/dopo) **[UI reale — screenshot 1]**
```
[Blocco stile] Split composition, top half solid vanilla #FFF6C0, bottom half solid orange #FF5E2C. Top half: a photorealistic hand holding an iPhone near a payment terminal, subtle motion/glow suggesting an Apple Pay tap, minimal, cropped tight, warm color grading toward orange tones — the phone screen is angled away from camera or motion-blurred, not showing app content here. Bottom half: a second iPhone shown straight-on and sharp, composited using the attached real app screenshot inside a realistic iPhone 15/16 frame (no watch, no other UI chrome), the screenshot content exactly as provided, not altered or reinterpreted. Vanilla sans-serif light-weight caption above the second phone: "Paghi. Appare da sola." with a small comic-style burst icon containing "clinck" next to the word "appare".
```

### A3 — La leva privacy
```
[Blocco stile] Solid vanilla #FFF6C0 background. Centered, a simple flat-graphic icon of a closed padlock, drawn in orange #FF5E2C outline only (no fill, no shadow, no gradient). Below it, light-weight ink #141413 sans-serif headline: "Niente banca collegata a nessuno." Smaller line beneath in lighter ink: "Solo il tuo iPhone, solo tu." Generous margins, minimal, poster-like.
```

### A4 — Confronto prezzo
```
[Blocco stile] Solid orange #FF5E2C background. Two large numbers set side by side in vanilla #FFF6C0 light-weight sans-serif type: "95€" with a thin diagonal strike-through line, and next to it much larger "15€/anno". Small caption beneath in vanilla, smaller weight: "Stesso lavoro. Un decimo del prezzo." No logos of competitors, no icons — pure numeric typography as the hero.
```

### A8 — Il gesto + CLINCK ✅ generata, approvata per la pagina IG
```
[Blocco stile] Solid orange #FF5E2C background, photorealistic close-up of a hand tapping an iPhone against a payment terminal, warm orange color grading, cropped tight and cinematic, shot from a low angle. Overlaid near the tap point, a small comic-style sound burst shape in vanilla outline containing the word "CLINCK". Below, vanilla #FFF6C0 light-weight sans-serif text: "Il momento in cui la tua spesa si registra da sola." Pure gesture and typography, no app UI visible.
```

### A9 — "2 mesi gratis" ✅ generata, approvata per la pagina IG
```
[Blocco stile] Solid orange #FF5E2C background. Enormous vanilla #FFF6C0 light-weight numeral "2" as the dominant visual element, filling most of the vertical space. Beneath it, smaller vanilla text: "mesi gratis per provarla." Small ink-on-vanilla caption pill at the very bottom: "poi 1,99€/mese." Minimal, numeral-led, no photography.
```

### A5 — Investimenti inclusi
```
[Blocco stile] Solid vanilla #FFF6C0 background. A minimal flat line-art icon in orange #FF5E2C of an ascending bar chart (matching the app icon style, four bars ascending left to right), centered, medium size. Below, ink #141413 light-weight headline: "Spese e investimenti. Un posto solo." Clean, generous white space, no additional graphic elements.
```

### A7 — Vetrina prodotto: andamento mensile **[UI reale — screenshot 2]**
```
[Blocco stile] Solid orange #FF5E2C background. A realistic iPhone 15/16 frame, centered and large (occupying most of the vertical space), containing the attached real app screenshot exactly as provided, not altered or reinterpreted, shown straight-on. Small vanilla #FFF6C0 light-weight caption above the phone: "Il mese, in una schermata." App Store screenshot style — the phone is the hero, minimal additional graphic elements, generous orange margin around it.
```

### A6 — Carosello "Come funziona" (3 slide, organico)

*Slide 1:*
```
[Blocco stile] Solid orange #FF5E2C background. Large vanilla numeral "1" top-left, small and light-weight. Centered below, vanilla headline: "Paghi con Apple Pay." Simple flat icon of a phone tapping a payment symbol, orange-on-vanilla line art, small, placed below the text.
```

*Slide 2:* **[UI reale — screenshot 1]**
```
[Blocco stile] Solid vanilla #FFF6C0 background. Large orange numeral "2" top-left, small and light-weight. Centered below, ink #141413 headline: "Clinck la registra da sola." Below the headline, a realistic iPhone 15/16 frame containing the attached real app screenshot exactly as provided, not altered or reinterpreted, shown straight-on, medium size, centered. Small comic-style burst icon with "clinck" inside, orange outline, placed near the top of the phone frame as if popping out of the screen.
```

*Slide 3:*
```
[Blocco stile] Solid orange #FF5E2C background. Large vanilla numeral "3" top-left, small and light-weight. Centered below, vanilla headline: "Tu vedi dove vanno i soldi." Simple flat line-art icon of an ascending bar chart in vanilla, small, placed below the text.
```

## Sezione B — Carosello ads (sponsorizzate), 4 slide

**Cambio rispetto alla versione precedente**: il concept "solo testo" (hook sul
dolore) è stato scartato dopo prova — non funzionava. I due concept "gesto +
CLINCK" e "2 mesi gratis" hanno invece reso bene, ma **per gli ads servono più
dense**: chi scorre un annuncio a pagamento non ha ancora fiducia, e il
prodotto vero deve vedersi, non solo il concept. Restano ottimi così come
sono per la pagina organica (A8, A9) — per gli ads si costruisce un carosello
a sé, che riusa gli stessi due ganci ma li affianca a prove vere del prodotto.

Struttura: gancio → prova densa → prova completa → prezzo/CTA. **Le slide 2 e
3 richiedono gli screenshot del test account** (non ancora arrivati — vedi
promemoria in cima al file).

### Slide 1 — Gancio (prezzo/trial)
Riusa **A9** com'è — ha già reso bene, non serve rigenerarla per l'ads, la
stessa immagine funziona da apertura del carosello.

### Slide 2 — Prova densa: gesto + UI reale **[UI reale — screenshot 1]**
```
[Blocco stile] Solid orange #FF5E2C background, photorealistic close-up of a hand tapping an iPhone against a payment terminal in the upper-left area, warm orange color grading, cinematic, the phone screen in this gesture angled away from camera. A small comic-style burst shape in vanilla outline containing "CLINCK" sits between the gesture and a second element: a realistic iPhone 15/16 frame, larger and positioned lower-right, containing the attached real app screenshot exactly as provided, not altered or reinterpreted, shown straight-on and sharp — as if this is what appears a second after the tap. Vanilla #FFF6C0 light-weight headline across the middle, layered behind the phone: "La tua spesa Apple Pay appare da sola." This slide is intentionally denser than the organic posts — two visual elements (gesture + real product) plus headline, not a single isolated focal point.
```

### Slide 3 — Prova completa: un'altra schermata reale **[UI reale — screenshot 2 o 3]**
```
[Blocco stile] Solid vanilla #FFF6C0 background. A realistic iPhone 15/16 frame, large and centered, containing the attached real app screenshot exactly as provided, not altered or reinterpreted, shown straight-on. Ink #141413 light-weight headline above the phone: "Spese e investimenti. Un'unica app." Small orange accent line beneath the phone as a graphic anchor. App Store screenshot style, product-forward — the real UI is the main proof point of this slide.
```

### Slide 4 — Prezzo e CTA
```
[Blocco stile] Solid orange #FF5E2C background. Vanilla #FFF6C0 light-weight headline, large, centered: "15€/anno, o 1,99€/mese." Smaller line beneath: "2 mesi gratis per iniziare." At the bottom, a simple text-only call to action in a vanilla pill shape with ink #141413 text: "Scaricala ora." No attempt to reproduce Apple's official "Download on the App Store" badge — plain text only, the real badge gets added separately by Andrea if needed, since it's a trademarked asset that shouldn't be AI-generated.
```

## Promemoria aperto
Le slide 2 e 3 aspettano gli screenshot del test account (Home con spesa
fresca, e uno fra andamento mensile/Investimenti) — vedi "UI reale, non
generata" in cima al file per l'elenco completo e dove ogni screenshot va
usato anche nella Sezione A.
