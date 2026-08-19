import React, { useRef } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";

const WIDTH = 320;
const GUTTER = 26;
const TOP = 16;
const PLOT_H = 100;
const BASE = TOP + PLOT_H;
const AXIS_H = 15;
const HEIGHT = BASE + AXIS_H;
const BAR_GAP = 3;
const GROUP_GAP = 14;
const RADIUS = 3;

export type BarGroup = {
  key: string;
  label: string;
  /** Un valore per serie, nello stesso ordine di `colors`. */
  values: number[];
};

type Props = {
  groups: BarGroup[];
  /** Un colore per serie — deve avere la stessa lunghezza di ogni `values`. */
  colors: string[];
  formatValue: (value: number) => string;
  minGroupWidth?: number;
};

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Barre raggruppate: due (o piu') serie affiancate per ogni categoria.
 *
 * `BarChart` (lib/aggregate.ts + components/BarChart.tsx) disegna una barra
 * per intervallo di tempo — non regge un secondo valore accanto al primo.
 * Qui serve proprio quello: per ogni persona (o per ogni mese, nel dettaglio
 * di una persona) due barre affiancate, "ricevuto" e "inviato", cosi' il
 * confronto fra le due direzioni si legge senza leggere due grafici diversi.
 */
export function GroupedBarChart({ groups, colors, formatValue, minGroupWidth }: Props) {
  const { palette } = useTheme();
  const scroller = useRef<ScrollView>(null);

  const peak = Math.max(...groups.flatMap((g) => g.values), 0);
  const step = niceStep(peak / 3);
  const chartMax = peak > 0 ? Math.ceil(peak / step) * step : step;
  const range = chartMax || 1;

  const ticks: number[] = [];
  for (let value = step; value <= chartMax + step / 100; value += step) {
    ticks.push(value);
  }

  const scorre =
    minGroupWidth != null && GUTTER + groups.length * minGroupWidth > WIDTH;
  const gutter = scorre ? 0 : GUTTER;
  const width = scorre ? groups.length * minGroupWidth! : WIDTH;

  const plotWidth = width - gutter;
  const groupWidth = Math.max(
    (plotWidth - GROUP_GAP * (groups.length - 1)) / Math.max(groups.length, 1),
    18
  );
  const seriesCount = colors.length;
  const barWidth = Math.max(
    (groupWidth - BAR_GAP * (seriesCount - 1)) / Math.max(seriesCount, 1),
    2
  );

  const yOf = (value: number) => BASE - (value / range) * PLOT_H;

  const tickLabel = (value: number) => formatValue(value);

  const disegno = (
    <Svg width={scorre ? width : "100%"} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
      {ticks.map((value) => {
        const y = yOf(value);
        return (
          <React.Fragment key={`tick-${value}`}>
            <Line
              x1={gutter}
              y1={y}
              x2={width}
              y2={y}
              stroke={palette.hairline}
              strokeWidth={1}
              opacity={0.7}
            />
            <SvgText x={gutter - 6} y={y + 3} textAnchor="end" fontSize={8} fill={palette.ink3}>
              {tickLabel(value)}
            </SvgText>
          </React.Fragment>
        );
      })}

      <Line x1={gutter} y1={BASE} x2={width} y2={BASE} stroke={palette.hairline} strokeWidth={1} />

      {groups.map((group, gi) => {
        const gx = gutter + gi * (groupWidth + GROUP_GAP);
        // Con una sola serie diversa da zero (chi divide solo in una
        // direzione, il caso comune) le due barre affiancate lascerebbero
        // quella visibile spostata a sinistra del centro — il centro vero
        // e' quello della coppia, non della singola barra rimasta. Con una
        // sola barra da disegnare la si centra sul nome invece di lasciarla
        // dov'era nella coppia.
        const nonZero = group.values
          .map((value, si) => ({ value, si }))
          .filter((entry) => entry.value > 0);

        const bars =
          nonZero.length <= 1
            ? [
                {
                  si: nonZero[0]?.si ?? 0,
                  value: nonZero[0]?.value ?? 0,
                  x: gx + groupWidth / 2 - barWidth,
                  width: barWidth * 2,
                },
              ]
            : group.values.map((value, si) => ({
                si,
                value,
                x: gx + si * (barWidth + BAR_GAP),
                width: barWidth,
              }));

        return (
          <React.Fragment key={group.key}>
            {bars.map(({ si, value, x, width: barW }) => {
              const drawn = value > 0 ? Math.max((value / range) * PLOT_H, 2) : 0;
              const top = BASE - drawn;
              return (
                <Rect
                  key={si}
                  x={x}
                  y={top}
                  width={barW}
                  height={drawn}
                  rx={RADIUS}
                  fill={value === 0 ? palette.hairline : colors[si]}
                />
              );
            })}

            <SvgText
              x={gx + groupWidth / 2}
              y={BASE + 11}
              textAnchor="middle"
              fontSize={8}
              fill={palette.ink3}
            >
              {group.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );

  if (!scorre) return <View>{disegno}</View>;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Svg width={GUTTER} height={HEIGHT}>
        {ticks.map((value) => (
          <SvgText
            key={`axis-${value}`}
            x={GUTTER - 6}
            y={yOf(value) + 3}
            textAnchor="end"
            fontSize={8}
            fill={palette.ink3}
          >
            {tickLabel(value)}
          </SvgText>
        ))}
      </Svg>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {disegno}
      </ScrollView>
    </View>
  );
}
