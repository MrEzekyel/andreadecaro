import { useEffect, useMemo, useRef, useState } from "react";
import { GestureResponderEvent, PanResponder, View } from "react-native";

/**
 * La finestra visibile dell'asse orizzontale, in frazioni del periodo intero:
 * `{ start: 0, end: 1 }` e' tutto il grafico.
 */
export type ZoomView = { start: number; end: number };

const FULL: ZoomView = { start: 0, end: 1 };
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 6;

type Options = {
  /**
   * La finestra piu' stretta consentita, in frazione del periodo. Ogni grafico
   * la calcola dai propri punti: oltre un certo ingrandimento fra due punti
   * non c'e' niente da vedere.
   */
  minSpan: number;
  /**
   * Gesto a un dito, per i grafici che ne hanno gia' uno (la lettura al tocco
   * di ScrubChart). Senza, un dito sposta la finestra quando si e' ingranditi.
   */
  single?: {
    start: (x: number) => void;
    move: (x: number) => void;
    end: () => void;
  };
  /**
   * Cambia quando cambiano i dati (mese, periodo 1M/6M/1A): la finestra torna
   * al periodo intero, invece di restare su un tratto che non c'entra piu'.
   */
  resetKey?: string;
};

/**
 * Zoom libero sull'asse orizzontale, come nei grafici delle app di trading:
 * due dita allargano o stringono attorno al punto in cui stanno e, muovendosi
 * insieme, spostano la finestra; un doppio tocco torna al periodo intero.
 *
 * E' fatto a mano con `PanResponder` per lo stesso motivo di ScrubChart e
 * della ghiera dei mesi: niente `gesture-handler`, per restare dentro Expo Go.
 * Il pizzico si cattura (`...Capture`) appena le dita sono due, cosi' un
 * figlio che aveva preso il primo dito non lo trattiene; con un dito solo si
 * prende il gesto solo se il movimento e' piu' orizzontale che verticale,
 * altrimenti scorrere la pagina passando sopra a un grafico si bloccherebbe.
 *
 * Il grafico dice dove sta la sua area di disegno con `setPlot`, perche' il
 * punto sotto le dita va misurato li', non sul contenitore intero (a sinistra
 * c'e' a volte la colonna dei valori dell'asse).
 */
export function useChartZoom({ minSpan, single, resetKey }: Options) {
  const [view, setView] = useState<ZoomView>(FULL);
  useEffect(() => setView(FULL), [resetKey]);
  const ref = useRef<View>(null);

  // Il responder si crea una volta: tutto cio' che cambia passa da un ref.
  const live = useRef({ view, minSpan, single });
  live.current = { view, minSpan, single };

  const plot = useRef({ left: 0, width: 1 });
  const originX = useRef(0);
  const gesture = useRef({
    mode: "none" as "none" | "single" | "pan" | "pinch",
    startView: FULL,
    anchor: 0,
    dist0: 1,
    x0: 0,
    moved: false,
    lastTap: 0,
  });

  const zoomed = view.end - view.start < 0.999;

  function clampView(start: number, span: number): ZoomView {
    const s = Math.min(Math.max(span, live.current.minSpan), 1);
    const st = Math.min(Math.max(start, 0), 1 - s);
    return { start: st, end: st + s };
  }

  /** Posizione del dito dentro l'area di disegno, in frazione (0-1). */
  function screenFraction(pageX: number) {
    const { left, width } = plot.current;
    return (pageX - originX.current - left) / Math.max(width, 1);
  }

  function pinchBase(e: GestureResponderEvent) {
    const [a, b] = e.nativeEvent.touches;
    const g = gesture.current;
    const v = live.current.view;
    const span = v.end - v.start;
    g.mode = "pinch";
    g.startView = v;
    g.dist0 = Math.max(Math.abs(a.pageX - b.pageX), 10);
    g.anchor = v.start + screenFraction((a.pageX + b.pageX) / 2) * span;
    g.moved = true;
    live.current.single?.end();
  }

  function begin(e: GestureResponderEvent) {
    // L'origine si rimisura a ogni gesto: un carosello orizzontale sposta il
    // grafico sulla pagina senza che il suo layout cambi.
    ref.current?.measure((_x, _y, _w, _h, pageX) => {
      originX.current = pageX;
    });
    const g = gesture.current;
    const touches = e.nativeEvent.touches;
    g.moved = false;
    g.x0 = touches[0]?.pageX ?? e.nativeEvent.pageX;
    g.startView = live.current.view;
    if (touches.length >= 2) {
      pinchBase(e);
    } else if (live.current.single) {
      g.mode = "single";
      live.current.single.start(e.nativeEvent.locationX);
    } else {
      g.mode = "pan";
    }
  }

  function move(e: GestureResponderEvent) {
    const g = gesture.current;
    const touches = e.nativeEvent.touches;

    if (touches.length >= 2) {
      if (g.mode !== "pinch") pinchBase(e);
      const [a, b] = touches;
      const dist = Math.max(Math.abs(a.pageX - b.pageX), 10);
      const span0 = g.startView.end - g.startView.start;
      const span = span0 * (g.dist0 / dist);
      const center = screenFraction((a.pageX + b.pageX) / 2);
      setView(clampView(g.anchor - center * span, span));
      return;
    }

    // Tornati a un dito dopo un pizzico: il gesto resta finito finche' non
    // si alzano tutte le dita, altrimenti il dito rimasto farebbe saltare la
    // finestra.
    if (g.mode === "pinch") return;

    const dx = (touches[0]?.pageX ?? e.nativeEvent.pageX) - g.x0;
    if (Math.abs(dx) > TAP_SLOP) g.moved = true;

    if (g.mode === "single") {
      live.current.single?.move(e.nativeEvent.locationX);
    } else if (g.mode === "pan") {
      const span = g.startView.end - g.startView.start;
      if (span >= 0.999) return;
      setView(
        clampView(g.startView.start - (dx / Math.max(plot.current.width, 1)) * span, span)
      );
    }
  }

  function end() {
    const g = gesture.current;
    if (g.mode === "single") live.current.single?.end();
    if (!g.moved) {
      const now = Date.now();
      if (now - g.lastTap < DOUBLE_TAP_MS) {
        setView(FULL);
        g.lastTap = 0;
      } else {
        g.lastTap = now;
      }
    }
    g.mode = "none";
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: begin,
        onPanResponderMove: move,
        onPanResponderRelease: end,
        onPanResponderTerminate: end,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    view,
    zoomed,
    reset: () => setView(FULL),
    /** Da chiamare a ogni render con l'area di disegno in px del contenitore. */
    setPlot: (left: number, width: number) => {
      plot.current = { left, width };
    },
    /** Da spargere sul `View` che contiene il grafico. */
    containerProps: { ref, ...responder.panHandlers },
  };
}
