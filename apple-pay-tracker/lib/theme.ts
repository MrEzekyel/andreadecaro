/**
 * Design system ispirato a quello di Anthropic / Claude.
 *
 * I caratteri originali (Styrene B, Tiempos Text) sono su licenza Anthropic e
 * non ridistribuibili: gli stack qui sotto li dichiarano per primi, cosi' se un
 * giorno vengono licenziati e caricati con expo-font subentrano da soli.
 *
 * Il tratto distintivo del sistema non sono i font ma la misura: pesi bassi
 * anche a corpo grande (mai oltre 600), crenatura quasi neutra, fondo caldo,
 * un solo accento.
 */

export type Palette = {
  ground: string;
  surface: string;
  surface2: string;
  hairline: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  limit: string;
  over: string;
  warn: string;
  good: string;
  uncategorized: string;
};

export const lightPalette: Palette = {
  ground: "#f0eee6",
  surface: "#faf9f5",
  surface2: "#f2f0e9",
  hairline: "#e3e1d9",
  ink: "#141413",
  ink2: "#5f5e5a",
  ink3: "#8a8880",
  accent: "#c2613f",
  accentSoft: "#f6e9e2",
  onAccent: "#fdfcfa",
  limit: "#8a8880",
  over: "#b4472c",
  warn: "#a16207",
  good: "#16a34a",
  uncategorized: "#71717a",
};

export const darkPalette: Palette = {
  ground: "#141413",
  surface: "#1f1e1c",
  surface2: "#262521",
  hairline: "#2e2d29",
  ink: "#f5f4ef",
  ink2: "#b0aea6",
  ink3: "#7a7872",
  accent: "#d97757",
  accentSoft: "#2e211a",
  onAccent: "#fdfcfa",
  limit: "#7a7872",
  over: "#e0765a",
  warn: "#b77f06",
  good: "#16a34a",
  uncategorized: "#8b8b96",
};

/**
 * I colori di categoria arrivano dal database (categories.color), che contiene
 * i valori del tema chiaro. In tema scuro alcuni vanno schiariti per restare
 * dentro la banda di luminosita' leggibile su fondo scuro: questa mappa
 * traduce solo quelli, gli altri passano invariati.
 *
 * Entrambe le serie sono state verificate a calcolo per luminosita', croma,
 * contrasto sul fondo e distinguibilita' per protanopia/deuteranopia.
 */
const DARK_CATEGORY_OVERRIDES: Record<string, string> = {
  "#2563eb": "#3b82f6", // Trasporti
  "#db2777": "#ec4899", // Shopping
  "#4f46e5": "#6366f1", // Abbonamenti
  "#a16207": "#b77f06", // Utenze
  "#7c3aed": "#8b5cf6", // Casa
  "#dc2626": "#ef4444", // Salute
  "#0d9488": "#14b8a6", // Cultura
  "#65a30d": "#84cc16", // Sport
  "#71717a": "#8b8b96", // non categorizzata
};

export function categoryColor(hex: string | null | undefined, dark: boolean) {
  const value = (hex ?? "#71717a").toLowerCase();
  if (!dark) return value;
  return DARK_CATEGORY_OVERRIDES[value] ?? value;
}

/** Sfondo tenue per il cerchio dell'icona, derivato dal colore di categoria. */
export function tint(hex: string, dark: boolean) {
  const alpha = dark ? "2e" : "24";
  return `${hex}${alpha}`;
}

export const font = {
  /** Titoli e prosa: al posto di Tiempos Text. */
  serif: "Tiempos Text",
  /** Interfaccia, etichette, importi: al posto di Styrene B. */
  sans: undefined as string | undefined,
};

/** Scala tipografica: rapporti contenuti, nessun salto brusco. */
export const type = {
  hero: { fontSize: 42, fontWeight: "500" as const, letterSpacing: -0.9 },
  heroCents: { fontSize: 25, fontWeight: "400" as const, letterSpacing: -0.3 },
  title: { fontSize: 23, fontWeight: "400" as const, letterSpacing: -0.2 },
  sheetTitle: { fontSize: 18, fontWeight: "400" as const, letterSpacing: -0.15 },
  body: { fontSize: 14, fontWeight: "400" as const },
  bodyMedium: { fontSize: 14, fontWeight: "500" as const },
  amount: { fontSize: 14.5, fontWeight: "500" as const, letterSpacing: -0.12 },
  caption: { fontSize: 12, fontWeight: "400" as const },
  small: { fontSize: 11.5, fontWeight: "400" as const },
  label: {
    fontSize: 10.5,
    fontWeight: "500" as const,
    letterSpacing: 1.05,
    textTransform: "uppercase" as const,
  },
};

export const radius = {
  card: 14,
  field: 10,
  button: 10,
  sheet: 22,
  pill: 999,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};
