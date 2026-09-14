import { useWindowDimensions } from "react-native";

/**
 * Vero quando lo schermo ha abbastanza spazio per due colonne affiancate.
 *
 * L'altezza nel controllo non e' pignoleria: un telefono in orizzontale supera
 * i 900 px di larghezza (un Pro Max ne fa 932) ma ne lascia poco piu' di 400 di
 * altezza, e li' due colonne peggiorerebbero le cose invece di aiutare — il
 * problema di quel formato e' l'altezza, non la larghezza.
 *
 * Un iPad in verticale (834 px) resta di proposito a colonna singola: spezzarlo
 * darebbe due colonne troppo magre perche' un grafico o un importo grande ci
 * stiano dentro.
 */
export function useWideLayout() {
  const { width, height } = useWindowDimensions();
  return width >= 900 && height >= 600;
}

/**
 * Larghezza fissa della colonna sinistra nelle schermate a due colonne.
 *
 * Fissa e non proporzionale: a sinistra ci sono sempre gli stessi elementi —
 * l'importo grande, i riquadri, le righe di limite — e sono tarati su questa
 * misura. La larghezza in piu' di uno schermo piu' grande va tutta alla
 * colonna destra, che e' quella dove stanno grafici ed elenchi.
 */
export const LEFT_COLUMN = 440;

/**
 * Misura massima del contenuto nelle pagine di dettaglio corte.
 *
 * Una pagina fatta di righe etichetta-valore non guadagna niente ad allargarsi:
 * l'etichetta e il suo valore finirebbero ai due bordi opposti dello schermo,
 * con mezzo metro di vuoto in mezzo e l'occhio costretto a ricucirli.
 */
export const DETAIL_MEASURE = 620;

/**
 * Stile per il contenuto di una pagina di dettaglio corta.
 *
 * Una pagina fatta di righe etichetta-valore non ha niente da guadagnare
 * dall'allargarsi: restituisce una misura leggibile centrata, e sul telefono
 * non restituisce niente perche' li' la larghezza e' gia' quella giusta.
 */
export function useDetailMeasure() {
  const wide = useWideLayout();
  if (!wide) return null;
  return {
    width: "100%" as const,
    maxWidth: DETAIL_MEASURE,
    alignSelf: "center" as const,
  };
}
