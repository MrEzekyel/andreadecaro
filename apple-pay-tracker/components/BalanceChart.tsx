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
/** Fascia a sinistra per i valori dell'asse: senza, la scala resta indovinata. */
const PAD_L = 30;
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
  /** Investito quel giorno: scende come una spesa, ma non e' speso. */
  invested?: number;
};

type Props = {
  points: BalancePoint[];
  /** Giorni totali del mese, per dare al grafico la larghezza giusta. */
  days: number;
  empty?: string;
};

/**
 * Il saldo del mese giorno per giorno: sale quando entra qualcosa, scende a
 * ogni spesa e a ogni investimento.
 *
 * E' l'andamento delle spese rovesciato, ed e' l'unico grafico che risponde a
 * "quanto mi e' rimasto" senza far fare sottrazioni: la linea **e'** quello
 * che resta. Gli investimenti scendono come le spese perche' quei soldi dal
 * conto sono usciti davvero — tenerli fuori faceva dire alla linea che c'era
 * piu' denaro disponibile di quanto ce ne fosse, che e' l'unico verso in cui
 * un errore qui e' pericoloso.
 *
 * I gradini sono etichettati con l'importo: senza, una salita improvvisa
 * sembrerebbe un errore di lettura del grafico.
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

  const plotW = WIDTH - PAD_L;
  const xOf = (day: number) =>
    PAD_L + ((day - 1) / Math.max(days - 1, 1)) * plotW;
  const yOf = (value: number) => BASE - ((value - floor) / span) * PLOT_H;

  const coords = points.map((p) => ({ ...p, x: xOf(p.day), y: yOf(p.value) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L ${last.x},${BASE} L ${coords[0].x},${BASE} Z`;

  const zeroY = floor < 0 ? yOf(0) : null;

  /** Tre riferimenti sull'asse: fondo, meta' e cima della scala vera. */
  const ticks = [floor, floor + span / 2, peak];

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette.good} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={palette.good} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {ticks.map((tick, index) => (
          <React.Fragment key={`t-${index}`}>
            <Line
              x1={PAD_L}
              y1={yOf(tick)}
              x2={WIDTH}
              y2={yOf(tick)}
              stroke={palette.hairline}
              strokeWidth={1}
              opacity={index === 0 ? 1 : 0.55}
            />
            <SvgText
              x={PAD_L - 4}
              // Il riferimento piu' basso sta sopra la sua riga e non sotto:
              // sotto finirebbe addosso ai giorni dell'asse orizzontale.
              y={index === 0 ? yOf(tick) - 3 : yOf(tick) + 3}
              textAnchor="end"
              fontSize={8}
              fill={palette.ink3}
            >
              {/* `compactAmount(0)` e' vuoto apposta — sulle barre uno zero
                  scritto e' rumore. Su un asse invece e' il riferimento che
                  dice dove sta il fondo, e va scritto. */}
              {tick === 0 ? "0" : compactAmount(tick)}
            </SvgText>
          </React.Fragment>
        ))}

        {zeroY !== null && (
          <Line
            x1={PAD_L}
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

        {coords
          .filter((c) => c.invested && c.invested > 0)
          .map((c) => (
            <React.Fragment key={`inv-${c.day}`}>
              <Circle cx={c.x} cy={c.y} r={3.4} fill={palette.invest} />
              <SvgText
                x={Math.min(c.x + 4, WIDTH - 4)}
                y={Math.min(c.y + 12, BASE - 2)}
                textAnchor={c.x > WIDTH - 50 ? "end" : "start"}
                fontSize={8}
                fill={palette.invest}
              >
                {`−${compactAmount(c.invested as number)}`}
              </SvgText>
            </React.Fragment>
          ))}

        <Circle cx={last.x} cy={last.y} r={5} fill={palette.ground} />
        <Circle cx={last.x} cy={last.y} r={3.4} fill={palette.good} />

        <SvgText x={PAD_L} y={BASE + 11} fontSize={8} fill={palette.ink3}>
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
        , al netto di spese e investimenti
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, lineHeight: 19 },
  foot: { ...type.caption, marginTop: 4, fontVariant: ["tabular-nums"] },
});
