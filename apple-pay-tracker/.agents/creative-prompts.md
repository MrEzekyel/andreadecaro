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

## Blocco stile (da includere in ogni prompt)

```
Brand color palette: warm orange #FF5E2C as dominant background/accent, warm vanilla/cream #FFF6C0 as secondary background and text-on-orange color, near-black ink #141413 used sparingly for small text on cream backgrounds. No black or dark backgrounds. Typography: clean humanist sans-serif, light-to-medium weight only, generous letter spacing, warm and editorial — never a heavy bold geometric display font. Composition: bold single focal point, lots of confident negative space, high contrast between the two brand colors, minimal and graphic rather than busy or cluttered. Overall mood: confident, honest, understated — not shouty or hyped, no gradients, no drop shadows, no glossy 3D effects. Format 1080x1350px (4:5 portrait).
```

## Sezione A — Post organici (pagina social)

### A1 — Manifesto / "Chi è Clinck"
```
[Blocco stile] Full-bleed warm orange #FF5E2C background. Large, light-weight sans-serif headline in vanilla #FFF6C0, centered, reading "Il rumore dei soldi che spendi, finalmente lo senti prima" — but only the word "Clinck" is set much larger and bolder than the rest, acting as the visual anchor. In the bottom third, a small comic-style sound burst / speech-bubble shape in vanilla outline containing the word "CLINCK!" like an onomatopoeia in a comic panel. Plenty of empty orange space around the type. No photography, no icons, pure typographic poster.
```

### A2 — Il gancio prodotto (prima/dopo)
```
[Blocco stile] Split composition, top half solid vanilla #FFF6C0, bottom half solid orange #FF5E2C. Top half: a photorealistic hand holding an iPhone near a payment terminal, subtle motion/glow suggesting an Apple Pay tap, minimal, cropped tight, warm color grading toward orange tones. Bottom half: light-weight vanilla sans-serif text "Paghi. Appare da sola." with a small comic-style burst icon containing "clinck" next to the word "appare". No app UI screenshots in this one — pure gesture and typography.
```

### A3 — La leva privacy
```
[Blocco stile] Solid vanilla #FFF6C0 background. Centered, a simple flat-graphic icon of a closed padlock, drawn in orange #FF5E2C outline only (no fill, no shadow, no gradient). Below it, light-weight ink #141413 sans-serif headline: "Niente banca collegata a nessuno." Smaller line beneath in lighter ink: "Solo il tuo iPhone, solo tu." Generous margins, minimal, poster-like.
```

### A4 — Confronto prezzo
```
[Blocco stile] Solid orange #FF5E2C background. Two large numbers set side by side in vanilla #FFF6C0 light-weight sans-serif type: "95€" with a thin diagonal strike-through line, and next to it much larger "15€/anno". Small caption beneath in vanilla, smaller weight: "Stesso lavoro. Un decimo del prezzo." No logos of competitors, no icons — pure numeric typography as the hero.
```

### A5 — Investimenti inclusi
```
[Blocco stile] Solid vanilla #FFF6C0 background. A minimal flat line-art icon in orange #FF5E2C of an ascending bar chart (matching the app icon style, four bars ascending left to right), centered, medium size. Below, ink #141413 light-weight headline: "Spese e investimenti. Un posto solo." Clean, generous white space, no additional graphic elements.
```

### A6 — Carosello "Come funziona" (3 slide, organico)

*Slide 1:*
```
[Blocco stile] Solid orange #FF5E2C background. Large vanilla numeral "1" top-left, small and light-weight. Centered below, vanilla headline: "Paghi con Apple Pay." Simple flat icon of a phone tapping a payment symbol, orange-on-vanilla line art, small, placed below the text.
```

*Slide 2:*
```
[Blocco stile] Solid vanilla #FFF6C0 background. Large orange numeral "2" top-left, small and light-weight. Centered below, ink #141413 headline: "Clinck la registra da sola." Small comic-style burst icon with "clinck" inside, orange outline, placed below the text.
```

*Slide 3:*
```
[Blocco stile] Solid orange #FF5E2C background. Large vanilla numeral "3" top-left, small and light-weight. Centered below, vanilla headline: "Tu vedi dove vanno i soldi." Simple flat line-art icon of an ascending bar chart in vanilla, small, placed below the text.
```

## Sezione B — Concept per gli ads (Meta Ads — sceglierne UNO, non lanciarli insieme)

Il piano (`.agents/marketing-plan.md` §1, §4) è esplicito: con 100€ di budget
serve **un creativo unico**, non una variante multipla — mescolare concept nel
primo test renderebbe il risultato illeggibile.

### B1 — Hook sul dolore ("ho mollato tre app")
```
[Blocco stile] Solid vanilla #FFF6C0 background. Bold light-weight ink #141413 headline, large, taking most of the frame: "Hai scaricato tre app per tracciare le spese e le hai mollate tutte?" Small orange sans-serif line at the very bottom: "Questa si scrive da sola." No photography, pure typographic hook slide — designed to be the first slide of a carousel ad, must stop the scroll with text alone.
```

### B2 — Hook sul gesto (prima/dopo visivo)
```
[Blocco stile] Solid orange #FF5E2C background, photorealistic close-up of a hand tapping an iPhone against a payment terminal, warm orange color grading, cropped tight and cinematic, shot from a low angle. Overlaid in the lower third, vanilla #FFF6C0 light-weight sans-serif text: "Il momento in cui la tua spesa si registra da sola." Small comic burst icon with "clinck" near the tap point. Designed as the first slide of a carousel ad.
```

### B3 — Hook sul prezzo/trial
```
[Blocco stile] Solid orange #FF5E2C background. Enormous vanilla #FFF6C0 light-weight numeral "2" as the dominant visual element, filling most of the vertical space. Beneath it, smaller vanilla text: "mesi gratis per provarla." Small ink-on-vanilla caption pill at the very bottom: "poi 1,99€/mese." Minimal, numeral-led, no photography.
```

## Prossimo passo
Quando Andrea sceglie un concept fra B1/B2/B3, si producono le 2-4 slide
successive del carosello nello stesso concept, coerenti con quella scelta —
non prima, per non generare lavoro su varianti che non verranno usate.
