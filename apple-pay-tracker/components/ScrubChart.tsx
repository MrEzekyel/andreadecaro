import React, { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount } from "../lib/format";
import { space, type } from "../lib/theme";

export type ScrubPoint = {
  date: string;
  value: number;
  /** Seconda linea di confronto, es. il capitale versato. */
  baseline?: number;
};

type Props = {
  points: ScrubPoint[];
  color: string;
  /** Indice sotto il dito, o null quando non si sta trascinando. */
  onScrub?: (index: number | null) => void;
  height?: number;
  /** Nome della seconda linea in legenda. */
  baselineName?: string;
  empty?: string;
};

const TOP = 10;
const BOTTOM = 4;

function buildPath(xs: number[], ys: number[]) {
  let d = `M ${xs[0]},${ys[0]}`;
  for (let i = 1; i < xs.length; i++) d += ` L ${xs[i]},${ys[i]}`;
  return d;
}

/**
 * Andamento con lettura al tocco: si trascina il dito e il grafico dice quanto
 * valeva quel giorno.
 *
 * Il gesto e' un `PanResponder` con `onStartShouldSetPanResponder`, cosi'
 * risponde anche a un tocco fermo senza trascinamento. Il responder viene preso
 * solo quando il movimento e' piu' orizzontale che verticale: sopra c'e' una
 * lista che scorre, e un responder piu' avido bloccherebbe lo scorrimento
 * ogni volta che il dito passa sul grafico.
 */
export function ScrubChart({
  points,
  color,
  onScrub,
  height = 180,
  baselineName = "capitale versato",
  empty = "Ancora troppo pochi dati per disegnare l'andamento.",
}: Props) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Il PanResponder si crea una volta sola, ma deve leggere la larghezza e i
  // punti aggiornati: passano da un ref, non dalla closure iniziale.
  const geom = useRef({ width: 0, count: 0 });
  geom.current = { width, count: points.length };

  const report = useRef(onScrub);
  report.current = onScrub;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => clear(),
      onPanResponderTerminate: () => clear(),
    })
  ).current;

  function pick(x: number) {
    const { width: w, count } = geom.current;
    if (w <= 0 || count === 0) return;
    const ratio = Math.min(Math.max(x / w, 0), 1);
    const index = Math.round(ratio * (count - 1));
    setActive(index);
    report.current?.(index);
  }

  function clear() {
    setActive(null);
    report.current?.(null);
  }

  const shape = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;

    const plotH = height - TOP - BOTTOM;
    const values = points.map((p) => p.value);
    const baselines = points
      .map((p) => p.baseline)
      .filter((v): v is number => typeof v === "number");

    const min = Math.min(...values, ...baselines);
    const max = Math.max(...values, ...baselines);
    // Un intervallo piatto dividerebbe per zero e schiaccerebbe la linea.
    const span = max - min || Math.max(Math.abs(max), 1);

    const xOf = (i: number) => (i / (points.length - 1)) * width;
    const yOf = (v: number) => TOP + plotH - ((v - min) / span) * plotH;

    const xs = points.map((_, i) => xOf(i));
    const line = buildPath(xs, values.map(yOf));
    const area = `${line} L ${width},${height - BOTTOM} L 0,${height - BOTTOM} Z`;
    const base =
      baselines.length === points.length
        ? buildPath(xs, points.map((p) => yOf(p.baseline!)))
        : null;

    return { xs, yOf, line, area, base, min, max };
  }, [points, width, height]);

  if (points.length < 2) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const current = active === null ? points.length - 1 : active;

  return (
    <View>
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        {shape && width > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="scrubFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <Stop offset="100%" stopColor={color} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            <Path d={shape.area} fill="url(#scrubFill)" />

            {shape.base && (
              <Path
                d={shape.base}
                fill="none"
                stroke={palette.ink3}
                strokeWidth={1.2}
                strokeDasharray="4 4"
                opacity={0.75}
              />
            )}

            <Path
              d={shape.line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {active !== null && (
              <>
                <Line
                  x1={shape.xs[current]}
                  y1={TOP}
                  x2={shape.xs[current]}
                  y2={height - BOTTOM}
                  stroke={palette.ink3}
                  strokeWidth={1}
                />
                <Circle
                  cx={shape.xs[current]}
                  cy={shape.yOf(points[current].value)}
                  r={5.5}
                  fill={palette.surface}
                />
                <Circle
                  cx={shape.xs[current]}
                  cy={shape.yOf(points[current].value)}
                  r={3.4}
                  fill={color}
                />
              </>
            )}

            {active === null && (
              <>
                <Circle
                  cx={shape.xs[current]}
                  cy={shape.yOf(points[current].value)}
                  r={5}
                  fill={palette.surface}
                />
                <Circle
                  cx={shape.xs[current]}
                  cy={shape.yOf(points[current].value)}
                  r={3}
                  fill={color}
                />
              </>
            )}
          </Svg>
        )}
      </View>

      {/* Legenda con dei campioni disegnati invece che dei trattini scritti nel
          testo: due linee diverse vanno distinte da come sono fatte, non da un
          "— —" che sembra un refuso accanto al titolo della sezione. */}
      <View style={styles.footer}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={[styles.legendText, { color: palette.ink3 }]}>
              valore
            </Text>
          </View>

          {shape?.base && (
            <View style={styles.legendItem}>
              <View style={styles.swatchDashed}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.dash, { backgroundColor: palette.ink3 }]}
                  />
                ))}
              </View>
              <Text style={[styles.legendText, { color: palette.ink3 }]}>
                {baselineName}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.legendText, { color: palette.ink3 }]}>
          {compactAmount(shape?.min ?? 0)} – {compactAmount(shape?.max ?? 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, lineHeight: 19 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    gap: space.md,
  },
  legend: { flexDirection: "row", gap: space.md, alignItems: "center" },
  legendItem: { flexDirection: "row", gap: 5, alignItems: "center" },
  legendText: { ...type.small, fontSize: 10 },
  swatch: { width: 14, height: 2, borderRadius: 1 },
  swatchDashed: { flexDirection: "row", gap: 2, alignItems: "center" },
  dash: { width: 4, height: 2, borderRadius: 1 },
});
