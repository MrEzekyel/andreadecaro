import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
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
   * Dove sarebbe l'indicatore spendendo lo stesso ogni giorno (0-1).
   * Una tacca chiara sull'arco: se il pieno la supera si e' in anticipo.
   */
  paceRatio?: number | null;
  stroke?: number;
  /** Contenuto al centro dell'arco (importo, etichette). */
  children?: React.ReactNode;
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
  paceRatio,
  stroke = 11,
  children,
}: Props) {
  const { palette } = useTheme();

  const r = (width - stroke) / 2;
  const cx = width / 2;
  const cy = r + stroke / 2;
  const height = cy + stroke / 2;

  const arcs = (ring: Ring, radius: number, width_: number) => {
    const circumference = 2 * Math.PI * radius;
    const half = circumference / 2;
    let cursor = 0;

    return ring.segments.map((segment, index) => {
      const ratio =
        ring.max > 0 ? Math.max(Math.min(segment.value / ring.max, 1), 0) : 0;
      // Il cumulato si ferma a 1: oltre il massimo l'arco e' pieno e i
      // segmenti successivi non hanno piu' spazio dove finire.
      const start = Math.min(cursor, 1);
      const length = Math.min(ratio, 1 - start);
      cursor = start + length;
      if (length <= 0) return null;

      return (
        <Circle
          key={`${radius}-${index}`}
          cx={cx}
          cy={cy}
          r={radius}
          stroke={segment.color}
          strokeWidth={width_}
          fill="none"
          // Un solo segmento puo' avere le punte tonde; con piu' segmenti si
          // sovrapporrebbero mangiandosi il confine fra una fonte e l'altra.
          strokeLinecap={ring.segments.length === 1 ? "round" : "butt"}
          strokeDasharray={`${half * length} ${circumference}`}
          transform={`rotate(${180 + 180 * start} ${cx} ${cy})`}
        />
      );
    });
  };

  const innerRadius = r - stroke - 5;

  const paceAngle =
    paceRatio != null ? ((180 + 180 * Math.min(Math.max(paceRatio, 0), 1)) * Math.PI) / 180
      : null;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* fondo dell'arco esterno */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={palette.surface2}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * r} ${2 * Math.PI * r}`}
          transform={`rotate(180 ${cx} ${cy})`}
        />
        {arcs(outer, r, stroke)}

        {inner && innerRadius > stroke && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={innerRadius}
              stroke={palette.surface2}
              strokeWidth={stroke - 2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${Math.PI * innerRadius} ${2 * Math.PI * innerRadius}`}
              transform={`rotate(180 ${cx} ${cy})`}
            />
            {arcs(inner, innerRadius, stroke - 2)}
          </>
        )}

        {paceAngle !== null && (
          <Line
            x1={cx + (r - stroke / 2 - 2) * Math.cos(paceAngle)}
            y1={cy + (r - stroke / 2 - 2) * Math.sin(paceAngle)}
            x2={cx + (r + stroke / 2 + 2) * Math.cos(paceAngle)}
            y2={cy + (r + stroke / 2 + 2) * Math.sin(paceAngle)}
            stroke={palette.ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
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
