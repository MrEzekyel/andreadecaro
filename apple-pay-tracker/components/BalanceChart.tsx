import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount, formatAmount } from "../lib/format";
import { type } from "../lib/theme";

const WIDTH = 320;
const TOP = 16;
const PLOT_H = 96;
const BASE = TOP + PLOT_H;
const HEIGHT = BASE + 15;

export type BalancePoint = {
  /** Giorno del mese, 1-based. */
  day: number;
  value: number;
  /** Introito arrivato quel giorno, se c'e': disegna il gradino in salita. */
  income?: number;
};

type Props = {
  points: BalancePoint[];
  /** Giorni totali del mese, per dare al grafico la larghezza giusta. */
  days: number;
  empty?: string;
};

/**
 * Il saldo del mese giorno per giorno: sale quando entra qualcosa, scende a
 * ogni spesa.
 *
 * E' l'andamento delle spese rovesciato, ed e' l'unico grafico che risponde a
 * "quanto mi e' rimasto" senza far fare sottrazioni: la linea **e'** quello
 * che resta. I gradini in salita sono gli introiti, etichettati con l'importo
 * perche' altrimenti sembrerebbero un errore di lettura del grafico.
 */
export function BalanceChart({
  points,
  days,
  empty = "Registra un introito per vedere il saldo del mese.",
}: Props) {
  const { palette } = useTheme();

  if (points.length < 2) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const values = points.map((p) => p.value);
  const peak = Math.max(...values, 0);
  // Il fondo scende sotto zero solo se il saldo ci e' andato davvero: un asse
  // che parte sempre da zero schiaccerebbe la linea nella meta' alta quando i
  // valori stanno tutti in alto, e non si vedrebbe piu' nessuna variazione.
  const floor = Math.min(...values, 0);
  const span = Math.max(peak - floor, 1);

  const xOf = (day: number) => ((day - 1) / Math.max(days - 1, 1)) * WIDTH;
  const yOf = (value: number) => BASE - ((value - floor) / span) * PLOT_H;

  const coords = points.map((p) => ({ ...p, x: xOf(p.day), y: yOf(p.value) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L ${last.x},${BASE} L ${coords[0].x},${BASE} Z`;

  const zeroY = floor < 0 ? yOf(0) : null;

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette.good} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={palette.good} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Line
          x1={0}
          y1={BASE}
          x2={WIDTH}
          y2={BASE}
          stroke={palette.hairline}
          strokeWidth={1}
        />

        {zeroY !== null && (
          <Line
            x1={0}
            y1={zeroY}
            x2={WIDTH}
            y2={zeroY}
            stroke={palette.over}
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.7}
          />
        )}

        <Path d={area} fill="url(#balFill)" />
        <Path
          d={line}
          fill="none"
          stroke={palette.good}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords
          .filter((c) => c.income && c.income > 0)
          .map((c) => (
            <React.Fragment key={`in-${c.day}`}>
              <Circle cx={c.x} cy={c.y} r={3.4} fill={palette.good} />
              <SvgText
                x={Math.min(c.x + 4, WIDTH - 4)}
                y={Math.max(c.y - 6, 9)}
                textAnchor={c.x > WIDTH - 50 ? "end" : "start"}
                fontSize={8}
                fill={palette.good}
              >
                {`+${compactAmount(c.income as number)}`}
              </SvgText>
            </React.Fragment>
          ))}

        <Circle cx={last.x} cy={last.y} r={5} fill={palette.ground} />
        <Circle cx={last.x} cy={last.y} r={3.4} fill={palette.good} />

        <SvgText x={0} y={BASE + 11} fontSize={8} fill={palette.ink3}>
          1
        </SvgText>
        <SvgText
          x={WIDTH}
          y={BASE + 11}
          textAnchor="end"
          fontSize={8}
          fill={palette.ink3}
        >
          {String(days)}
        </SvgText>
      </Svg>

      <Text style={[styles.foot, { color: palette.ink2 }]}>
        Oggi ti restano{" "}
        <Text style={{ color: palette.good, fontWeight: "600" }}>
          {formatAmount(last.value)}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, lineHeight: 19 },
  foot: { ...type.caption, marginTop: 4, fontVariant: ["tabular-nums"] },
});
