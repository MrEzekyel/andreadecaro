import { useCallback, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Ultima posizione di scorrimento vista per schermata, fuori da React.
 *
 * Le quattro schede principali si smontano e rimontano da zero ogni volta
 * che si cambia tab (`App.tsx` renderizza `{tab === "home" && <HomeScreen/>}`)
 * o si torna da un dettaglio aperto sopra di loro (`Explorer`, il dettaglio di
 * un asset in `PortfolioScreen`: stesso schema, `if (aperto) return <Dettaglio/>`
 * al posto della schermata normale) — quindi un `ref` interno alla schermata
 * sparirebbe insieme a lei. Una mappa a livello di modulo sopravvive al
 * montaggio/smontaggio e vale per l'intera sessione dell'app, non per
 * componente.
 */
const positions = new Map<string, number>();

// `any` sul nodo: la stessa ref si passa sia a `ScrollView` (che ha
// `scrollTo` diretto) sia a `SectionList`/`FlatList` (che lo espone solo
// dietro `getScrollResponder()`) — un tipo unico e preciso per entrambi non
// esiste, ed e' quello che il controllo dentro `onContentSizeChange` risolve
// a runtime.
type ScrollRestoration = {
  ref: (node: any) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: () => void;
  scrollEventThrottle: number;
};

/**
 * Ricorda la posizione di scorrimento di una schermata e la ripristina al
 * rimontaggio, cosi' avanti-indietro fra schede o verso un dettaglio non
 * fa ripartire ogni volta dalla cima.
 *
 * Da passare a un `ScrollView` (o a un `SectionList`/`FlatList`, che accetta
 * le stesse prop e la cui `ref` espone `getScrollResponder()`):
 * `<ScrollView {...useScrollRestoration("home")}>`.
 *
 * Il ripristino avviene su `onContentSizeChange`, non al mount: e' lo stesso
 * punto in cui `BarChart`/`GroupedBarChart` gia' aspettano che il contenuto
 * abbia una misura vera prima di scorrere, perche' uno `scrollTo` chiamato
 * prima che il contenuto sia disposto non ha niente su cui agire. Scatta una
 * sola volta per montaggio (`restored`): un ricaricamento dati che cambia
 * l'altezza del contenuto (tira-per-aggiornare, un elenco che si allunga) non
 * deve strappare la pagina da sotto al dito di chi la sta gia' scorrendo.
 *
 * Non e' pensato per un caso limite in cui il contenuto cambia cosi' tanto da
 * rendere la vecchia posizione priva di senso (es. un filtro che svuota
 * l'elenco): li' si ripristina comunque un numero, che `ScrollView` limita da
 * solo entro l'intervallo scorribile — non un errore, solo una posizione che
 * non descrive piu' niente di preciso.
 */
export function useScrollRestoration(key: string): ScrollRestoration {
  const nodeRef = useRef<any>(null);
  const restored = useRef(false);

  const ref = useCallback((node: any) => {
    nodeRef.current = node;
  }, []);

  const onContentSizeChange = useCallback(() => {
    if (restored.current) return;
    restored.current = true;
    const y = positions.get(key);
    if (!y) return;

    const node = nodeRef.current;
    const target = node?.scrollTo ? node : node?.getScrollResponder?.();
    target?.scrollTo?.({ y, animated: false });
  }, [key]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      positions.set(key, event.nativeEvent.contentOffset.y);
    },
    [key]
  );

  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 50 };
}
