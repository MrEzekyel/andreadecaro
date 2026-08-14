import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";

export type GaugeSegment = {
  value: number;
  color: string;
};

type Ring = {
  segments: GaugeSegment[];
  /** Valore che riempie il semicerchio per intero. */
  max: number;
};

type Props = {
  width: number;
  outer: Ring;
  /** Secondo anello concentrico piu' piccolo, per il confronto entrate/uscite. */
  inner?: Ring;
  /**
   * Tacca su una posizione dell'arco (0-1). Il significato lo decide chi
   * chiama — in Home segna dove arrivano i costi fissi sul limite — quindi
   * va sempre accompagnata da una voce in legenda che lo dica: una tacca
   * senza nome viene letta a caso, e qui si e' gia' visto scambiarla per
   * un'altra cosa.
   */
  markRatio?: number | null;
  markColor?: string;
  stroke?: number;
  /** Valore di fondo scala, scritto sotto la punta destra dell'arco. */
  endLabel?: string;
  /** Contenuto al centro dell'arco (importo, etichette). */
  children?: React.ReactNode;
  /**
   * L'anello interno riempie dalla punta destra invece che dalla sinistra,
   * restando concentrico con l'esterno.
   *
   * Serve a `OwedScreen`: un solo semicerchio con "quanto ti devono" fuori e
   * "quanto devi" dentro, che crescono l'uno verso l'altro invece che nello
   * stesso verso — altrimenti due archi concentrici identici si leggono come
   * la stessa cosa vista due volte, non come un confronto fra direzioni
   * opposte del denaro. Lo specchio e' un `<G>` che riflette solo il gruppo
   * dell'anello interno attorno all'asse verticale del centro (`cx`), non
   * l'intero `<Svg>`: l'esterno resta invariato.
   */
  mirrorInner?: boolean;
};

/**
 * Un semicerchio invece di un anello quasi chiuso: dice le stesse tre cose
 * (quanto, su quanto, e se sei in anticipo) occupando meta' dell'altezza
 * verticale, e lascia libera la fascia accanto per i numeri che prima non
 * c'erano. E' la forma scelta da Andrea dopo aver visto l'anello intero:
 * "é gigantesco".
 *
 * Regge piu' segmenti per arco perche' in "Entrate" l'arco esterno e' diviso
 * per fonte di introito, mentre in "Uscite" e' uno solo.
 */
export function SemiGauge({
  width,
  outer,
  inner,
  markRatio,
  markColor,
  stroke = 11,
  endLabel,
  children,
  mirrorInner,
}: Props) {
  const { palette } = useTheme();

  const r = (width - stroke) / 2;
  const cx = width / 2;
  const cy = r + stroke / 2;
  const footH = endLabel ? 13 : 0;
  const height = cy + stroke / 2 + footH;

  /**
   * Il fondo dell'arco usa `hairline` e non `surface2`: in tema chiaro
   * quest'ultimo (#f2f0e9) sta a un soffio dal fondo pagina (#f0eee6) e la
   * parte non ancora spesa spariva, lasciando l'arco pieno senza un "su
   * quanto". Un semicerchio a cui non si vede la fine non e' un semicerchio.
   */
  const trackColor = palette.hairline;

  /**
   * Gli archi di un anello, tutti con le punte tonde.
   *
   * Le punte tonde con piu' segmenti erano state escluse perche' la punta di
   * uno si mangiava il confine con quello dopo. La soluzione non e'
   * squadrarle ma impilarle: ogni segmento **rientra** sotto il precedente di
   * quasi uno spessore, e viene disegnato **prima** di lui. Cosi' il primo
   * finisce sopra tutti e la sua punta tonda chiude il confine invece di
   * essere tagliata — e nessuno dei due estremi lascia lo spicchio di fondo
   * scoperto che si vedeva quando due punte tonde si toccavano appena.
   */
  const arcs = (ring: Ring, radius: number, width_: number) => {
    const circumference = 2 * Math.PI * radius;
    const half = circumference / 2;
    /** Il rientro, espresso nella stessa frazione di semicerchio dei tratti. */
    const overlap = half > 0 ? width_ / half : 0;

    let cursor = 0;
    const spans: { color: string; start: number; length: number }[] = [];
    for (const segment of ring.segments) {
      const ratio =
        ring.max > 0 ? Math.max(Math.min(segment.value / ring.max, 1), 0) : 0;
      // Il cumulato si ferma a 1: oltre il massimo l'arco e' pieno e i
      // segmenti successivi non hanno piu' spazio dove finire.
      const start = Math.min(cursor, 1);
      const length = Math.min(ratio, 1 - start);
      cursor = start + length;
      if (length <= 0) continue;
      spans.push({ color: segment.color, start, length });
    }

    return spans
      .map(({ color, start, length }, index) => {
        // Il rientro allunga il tratto all'indietro, non in avanti: la punta
        // resta dov'e', ed e' la punta a dire il valore.
        const back = index === 0 ? 0 : Math.min(overlap, start);
        return (
          <Circle
            key={`${radius}-${index}`}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={width_}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${half * (length + back)} ${circumference}`}
            transform={`rotate(${180 + 180 * (start - back)} ${cx} ${cy})`}
          />
        );
      })
      .reverse();
  };

  const innerRadius = r - stroke - 5;

  const markAngle =
    markRatio != null
      ? ((180 + 180 * Math.min(Math.max(markRatio, 0), 1)) * Math.PI) / 180
      : null;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* fondo dell'arco esterno */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * r} ${2 * Math.PI * r}`}
          transform={`rotate(180 ${cx} ${cy})`}
        />
        {arcs(outer, r, stroke)}

        {inner && innerRadius > stroke && (
          <G transform={mirrorInner ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}>
            <Circle
              cx={cx}
              cy={cy}
              r={innerRadius}
              stroke={trackColor}
              strokeWidth={stroke - 2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${Math.PI * innerRadius} ${2 * Math.PI * innerRadius}`}
              transform={`rotate(180 ${cx} ${cy})`}
            />
            {arcs(inner, innerRadius, stroke - 2)}
          </G>
        )}

        {markAngle !== null && (
          <Line
            x1={cx + (r - stroke / 2 - 2) * Math.cos(markAngle)}
            y1={cy + (r - stroke / 2 - 2) * Math.sin(markAngle)}
            x2={cx + (r + stroke / 2 + 2) * Math.cos(markAngle)}
            y2={cy + (r + stroke / 2 + 2) * Math.sin(markAngle)}
            stroke={markColor ?? palette.ink}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* Il fondo scala sotto la punta destra: senza, l'arco dice quanto si
            e' riempito ma mai su quanto, e la frazione resta indovinata. */}
        {endLabel && (
          <SvgText
            x={width}
            y={cy + stroke / 2 + 10}
            textAnchor="end"
            fontSize={9.5}
            fill={palette.ink3}
          >
            {endLabel}
          </SvgText>
        )}
      </Svg>

      {/* Il contenuto al centro sta sopra come View e non come testo SVG:
          cosi' usa la stessa tipografia del resto dell'app. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - r * 0.62,
          alignItems: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}
