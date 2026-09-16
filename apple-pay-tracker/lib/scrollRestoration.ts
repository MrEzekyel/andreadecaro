import { useCallback, useEffect, useRef } from "react";
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

/**
 * Quando ritentare lo `scrollTo`, in millisecondi da quando il contenuto ha
 * annunciato una misura sufficiente. Il primo tentativo e' subito, gli altri
 * coprono il ritardo con cui il thread principale applica `contentSize` allo
 * `UIScrollView` — vedi "Perche' il primo tentativo non bastava" sotto.
 */
const RETRY_DELAYS = [0, 32, 96, 220, 420];

/**
 * Oltre questa distanza dall'ultimo tentativo nostro, un evento di scroll e'
 * dell'utente: il ripristino ha perso il suo momento e va abbandonato, o
 * continuerebbe a rifiutarsi di salvare dove l'utente sta andando davvero.
 */
const OURS_WINDOW_MS = 150;

/** Rete di sicurezza: dopo questo tempo si smette comunque di inseguire. */
const GIVE_UP_MS = 4000;

// `any` sul nodo: la stessa ref si passa sia a `ScrollView` (che ha
// `scrollTo` diretto) sia a `SectionList`/`FlatList` (che lo espone solo
// dietro `getScrollResponder()`) — un tipo unico e preciso per entrambi non
// esiste, ed e' quello che il controllo dentro `scrollNow` risolve a runtime.
type ScrollRestoration = {
  ref: (node: any) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (width: number, height: number) => void;
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
 * ## Perche' il primo tentativo non bastava (secondo giro su questo bug)
 *
 * La prima versione ripristinava una volta sola dentro `onContentSizeChange`,
 * la seconda ci ha aggiunto "ritenta finche' il contenuto non e' abbastanza
 * alto". Nessuna delle due funzionava, e il motivo non e' l'altezza del
 * contenuto: e' **dove atterra `scrollTo`**.
 *
 * Su iOS (Fabric) `RCTScrollViewComponentView scrollTo:` non scorre al valore
 * chiesto: lo **tronca** dentro `contentSize.height - bounds.size.height`
 * prima di applicarlo. E `contentSize` viene scritta sullo `UIScrollView` dal
 * thread principale, dentro `updateState:` della transazione di mount, mentre
 * `onContentSizeChange` e' l'`onLayout` del contenitore del contenuto —
 * emesso dal lato JS appena la misura dell'albero ombra e' nota. I due non
 * sono ordinati fra loro: nel caso normale il JS arriva per primo, lo
 * `UIScrollView` ha ancora `contentSize` a zero (o quella vecchia, piu'
 * corta), e la posizione salvata viene troncata — in pratica a zero. Cioe'
 * **la Home torna in cima**, che e' esattamente il sintomo segnalato.
 * Peggio: `scrollToOffset:` esce subito se l'offset non cambia davvero
 * (`CGPointEqualToPoint`), quindi un ripristino troncato a zero non emette
 * nemmeno un evento di scroll — fallisce in silenzio. E il tentativo unico
 * era gia' stato consumato.
 *
 * Da qui le tre cose che questa versione fa e le precedenti no:
 *
 * 1. **Si ritenta su piu' frame** (`RETRY_DELAYS`), non una volta sola: al
 *    primo tentativo utile il thread principale puo' non aver ancora
 *    applicato `contentSize`, e l'unica cura e' riprovare piu' tardi.
 * 2. **Il ripristino si considera riuscito solo quando un evento di scroll lo
 *    conferma**, non quando `scrollTo` e' stato chiamato: la chiamata non
 *    dice niente su dove si e' finiti. Uno `scrollTo` che sposta davvero
 *    l'offset forza l'evento (`_forceDispatchNextScrollEvent`), quindi
 *    l'evento e' un segnale affidabile.
 * 3. **Finche' il ripristino e' in corso, `onScroll` non scrive in
 *    `positions`.** Un atterraggio troncato riporterebbe un numero piu'
 *    piccolo di quello vero, e il tentativo successivo inseguirebbe quello:
 *    la memoria si sarebbe erosa da sola a ogni tentativo fallito.
 *
 * Restano validi i due accorgimenti gia' presenti:
 * - **Si aspetta che il contenuto sia alto almeno quanto la posizione
 *   salvata**: al primo montaggio i dati arrivano da una lettura di rete,
 *   quindi il primo `onContentSizeChange` puo' scattare su un elenco ancora
 *   vuoto. Se l'atterraggio resta incollato al fondo (contenuto ancora
 *   incompleto) il ripristino non si chiude: si riprova alla prossima misura.
 * - **Lo stato si azzera quando il nodo rimonta davvero**, non resta buono
 *   per tutta la vita dello screen. Le quattro schede restano montate quando
 *   aprono un dettaglio sopra di loro (`if (aperto) return <Dettaglio/>`):
 *   e' lo `ScrollView` a smontarsi e rimontare, non lo screen che possiede
 *   questo hook.
 *
 * Un ricaricamento dati che allunga il contenuto DOPO che il ripristino e'
 * concluso non lo ripete: non deve strappare la pagina da sotto al dito di
 * chi la sta gia' scorrendo. Per lo stesso motivo un evento di scroll che
 * arriva fuori dalla finestra di un nostro tentativo (`OURS_WINDOW_MS`) e'
 * preso per quello che e' — l'utente che scorre — e chiude il ripristino
 * invece di contendergli la pagina.
 */
export function useScrollRestoration(key: string): ScrollRestoration {
  const nodeRef = useRef<any>(null);
  // Posizione che questo montaggio deve ancora raggiungere. `null` = niente
  // da ripristinare, o ripristino concluso: da li' in poi `onScroll` torna a
  // essere l'unica cosa che scrive in `positions`.
  const pending = useRef<number | null>(null);
  const retries = useRef<ReturnType<typeof setTimeout>[]>([]);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttempt = useRef(0);

  // Ferma i tentativi in coda ma non chiude il ripristino: serve quando
  // l'atterraggio e' incollato al fondo e ha senso riprovare piu' tardi,
  // quando il contenuto sara' cresciuto.
  const stop = useCallback(() => {
    retries.current.forEach(clearTimeout);
    retries.current = [];
  }, []);

  const finish = useCallback(() => {
    pending.current = null;
    stop();
    if (giveUp.current) {
      clearTimeout(giveUp.current);
      giveUp.current = null;
    }
  }, [stop]);

  const scrollNow = useCallback(() => {
    const y = pending.current;
    if (y === null) return;
    const node = nodeRef.current;
    const target = node?.scrollTo ? node : node?.getScrollResponder?.();
    if (!target?.scrollTo) return;
    lastAttempt.current = Date.now();
    target.scrollTo({ y, animated: false });
  }, []);

  const arm = useCallback(() => {
    stop();
    retries.current = RETRY_DELAYS.map((delay) => setTimeout(scrollNow, delay));
  }, [scrollNow, stop]);

  const ref = useCallback(
    (node: any) => {
      // Il nodo passa per `null` quando lo ScrollView si smonta (cambio
      // scheda, o un dettaglio aperto sopra la stessa schermata) e torna
      // non-null quando rimonta: e' il segnale che un nuovo ripristino ha
      // senso, perche' questa e' davvero una nuova istanza dello ScrollView.
      if (node && !nodeRef.current) {
        finish();
        const saved = positions.get(key) ?? 0;
        pending.current = saved > 0 ? saved : null;
        lastAttempt.current = 0;
        if (pending.current !== null) {
          giveUp.current = setTimeout(finish, GIVE_UP_MS);
        }
      }
      if (!node) finish();
      nodeRef.current = node;
    },
    [key, finish]
  );

  const onContentSizeChange = useCallback(
    (_width: number, contentHeight: number) => {
      if (pending.current === null) return;
      // Il contenuto potrebbe non essere ancora cresciuto abbastanza (dati
      // non ancora arrivati): si aspetta la prossima misura invece di
      // scorrere su un elenco ancora corto, dove il limite nativo
      // troncherebbe comunque la posizione.
      if (contentHeight < pending.current) return;
      arm();
    },
    [arm]
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const y = contentOffset.y;
      const goal = pending.current;

      if (goal !== null) {
        if (Date.now() - lastAttempt.current > OURS_WINDOW_MS) {
          // Non e' l'eco di un nostro tentativo: sta scorrendo l'utente.
          finish();
        } else if (Math.abs(y - goal) <= 2) {
          finish();
        } else {
          const max = Math.max(0, contentSize.height - layoutMeasurement.height);
          // Incollati al fondo: il contenuto non e' ancora tutto qui. Si
          // smette di ritentare adesso e si riparte quando
          // `onContentSizeChange` annuncia un contenuto piu' alto.
          if (y >= max - 2) stop();
          // In ogni caso non si salva: e' una posizione nostra e sbagliata,
          // e sovrascriverebbe quella vera che stiamo ancora inseguendo.
          return;
        }
      }

      positions.set(key, y);
    },
    [key, finish, stop]
  );

  useEffect(() => finish, [finish]);

  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 50 };
}
