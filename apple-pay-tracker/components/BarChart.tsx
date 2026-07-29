import React from "react";
import { View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { Bucket } from "../lib/aggregate";
import { compactAmount } from "../lib/format";

const WIDTH = 320;
/** Colonna riservata alle etichette dell'asse y. */
const GUTTER = 26;
/** Aria sopra le colonne, per i valori scritti sulle cime. */
const TOP = 16;
const PLOT_H = 100;
const BASE = TOP + PLOT_H;
const AXIS_H = 15;
const HEIGHT = BASE + AXIS_H;
const GAP = 4;
const RADIUS = 3;

type Props = {
  buckets: Bucket[];
  /** 'amount' disegna la spesa, 'count' il numero di transazioni. */
  metric: "amount" | "count";
  color: string;
  /** Chiave della colonna in evidenza; le altre restano smorzate. */
  selectedKey?: string | null;
  onSelect?: (bucket: Bucket) => void;
  /** Valore della linea tratteggiata di riferimento (media). */
  average?: number | null;
};

/** Passo "tondo" piu' vicino a `raw`: 1, 2, 2.5 o 5 per decade. */
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function BarChart({
  buckets,
  metric,
  color,
  selectedKey,
  onSelect,
  average,
}: Props) {
  const { palette } = useTheme();

  const values = buckets.map((b) => (metric === "amount" ? b.total : b.count));
  const peak = Math.max(...values, 0);

  // Con l'asse a valori tondi la cima del grafico e' l'ultima tacca, non il
  // massimo osservato: altrimenti la colonna piu' alta tocca il bordo e le
  // tacche cadono a quote arbitrarie.
  const rawStep = metric === "count" ? Math.max(peak / 3, 1) : peak / 3;
  const step = metric === "count" ? Math.max(1, Math.round(niceStep(rawStep))) : niceStep(rawStep);
  const chartMax = peak > 0 ? Math.ceil(peak / step) * step : step;

  const ticks: number[] = [];
  for (let value = step; value <= chartMax + step / 100; value += step) {
    ticks.push(value);
  }

  const plotWidth = WIDTH - GUTTER;
  const barWidth = Math.max(
    (plotWidth - GAP * (buckets.length - 1)) / Math.max(buckets.length, 1),
    2
  );

  const yOf = (value: number) => BASE - (value / chartMax) * PLOT_H;
  const averageY =
    average != null && average > 0 && average <= chartMax ? yOf(average) : null;

  const tickLabel = (value: number) =>
    metric === "amount" ? compactAmount(value) : String(Math.round(value));

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {ticks.map((value) => {
          const y = yOf(value);
          return (
            <React.Fragment key={`tick-${value}`}>
              <Line
                x1={GUTTER}
                y1={y}
                x2={WIDTH}
                y2={y}
                stroke={palette.hairline}
                strokeWidth={1}
                opacity={0.7}
              />
              <SvgText
                x={GUTTER - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={8}
                fill={palette.ink3}
              >
                {tickLabel(value)}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line
          x1={GUTTER}
          y1={BASE}
          x2={WIDTH}
          y2={BASE}
          stroke={palette.hairline}
          strokeWidth={1}
        />

        {buckets.map((bucket, index) => {
          const value = values[index];
          const x = GUTTER + index * (barWidth + GAP);
          const height = (value / chartMax) * PLOT_H;

          // Un periodo a zero resta visibile come traccia: distinguere
          // "niente speso" da "periodo assente" e' il punto del grafico.
          const drawn = Math.max(height, 2);
          const selected = selectedKey == null || bucket.key === selectedKey;
          const label =
            metric === "amount" ? compactAmount(value) : value > 0 ? String(value) : "";

          return (
            <React.Fragment key={bucket.key}>
              <Rect
                x={x}
                y={BASE - drawn}
                width={barWidth}
                height={drawn}
                rx={RADIUS}
                fill={value > 0 ? color : palette.hairline}
                fillOpacity={value > 0 && !selected ? 0.32 : 1}
              />

              {label !== "" && (
                <SvgText
                  x={x + barWidth / 2}
                  y={BASE - drawn - 4}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight={bucket.key === selectedKey ? "600" : "400"}
                  fill={bucket.key === selectedKey ? palette.ink : palette.ink3}
                >
                  {label}
                </SvgText>
              )}

              <SvgText
                x={x + barWidth / 2}
                y={BASE + 11}
                textAnchor="middle"
                fontSize={8}
                fontWeight={bucket.key === selectedKey ? "600" : "400"}
                fill={bucket.key === selectedKey ? palette.ink : palette.ink3}
              >
                {bucket.label}
              </SvgText>

              {/* Bersaglio a tutta altezza: la colonna da sola sarebbe
                  impossibile da centrare quando il valore e' basso. */}
              {onSelect && (
                <Rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={BASE + AXIS_H}
                  fill="transparent"
                  onPress={() => onSelect(bucket)}
                />
              )}
            </React.Fragment>
          );
        })}

        {averageY !== null && (
          <Line
            x1={GUTTER}
            y1={averageY}
            x2={WIDTH}
            y2={averageY}
            stroke={palette.limit}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.75}
          />
        )}
      </Svg>
    </View>
  );
}
