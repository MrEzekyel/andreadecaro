import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount } from "../lib/format";
import { type } from "../lib/theme";

export type MonthBar = {
  /** Etichetta breve sull'asse: "gen", "feb". */
  label: string;
  value: number;
};

type Props = {
  bars: MonthBar[];
  color: string;
  /** Larghezza del viewBox: la carta a meta' schermo ne usa una piu' stretta. */
  width?: number;
  height?: number;
  /** Riga tratteggiata sulla media, con etichetta. */
  showAverage?: boolean;
  /** Etichette dei mesi sotto le barre: si spengono quando lo spazio manca. */
  showLabels?: boolean;
};

/**
 * Un mese per barra, l'ultimo acceso.
 *
 * Serve alla domanda che il totale del mese da solo non puo' rispondere:
 * "sto spendendo tanto?" non ha senso in assoluto, solo confrontato con i
 * mesi che hai gia' vissuto. I mesi passati restano spenti e solo quello
 * corrente prende il colore pieno: e' l'unico ancora in movimento.
 */
export function MonthBars({
  bars,
  color,
  width = 128,
  height = 76,
  showAverage = true,
  showLabels = true,
}: Props) {
  const { palette } = useTheme();

  if (bars.length === 0) return null;

  const axisH = showLabels ? 12 : 2;
  const plotH = height - axisH;
  const peak = Math.max(...bars.map((b) => b.value), 1);
  const slot = width / bars.length;
  const barW = Math.min(slot * 0.62, 26);

  const average =
    bars.reduce((sum, b) => sum + b.value, 0) / Math.max(bars.length, 1);
  const averageY = plotH - (average / peak) * (plotH - 10);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {showAverage && average > 0 && (
        <>
          <Line
            x1={0}
            y1={averageY}
            x2={width}
            y2={averageY}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.55}
          />
          <SvgText
            x={width}
            y={Math.max(averageY - 3, 8)}
            textAnchor="end"
            fontSize={7.5}
            fill={color}
            opacity={0.85}
          >
            {`media ${compactAmount(average)} €`}
          </SvgText>
        </>
      )}

      {bars.map((bar, index) => {
        const h = Math.max((bar.value / peak) * (plotH - 10), bar.value > 0 ? 2 : 0);
        const last = index === bars.length - 1;
        return (
          <Rect
            key={`${bar.label}-${index}`}
            x={index * slot + (slot - barW) / 2}
            y={plotH - h}
            width={barW}
            height={h}
            rx={2.5}
            fill={last ? color : palette.surface2}
          />
        );
      })}

      <Line
        x1={0}
        y1={plotH}
        x2={width}
        y2={plotH}
        stroke={palette.hairline}
        strokeWidth={1}
      />

      {showLabels &&
        bars.map((bar, index) => {
          const last = index === bars.length - 1;
          return (
            <SvgText
              key={`l-${bar.label}-${index}`}
              x={index * slot + slot / 2}
              y={plotH + 9}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={last ? "600" : "400"}
              fill={last ? color : palette.ink3}
            >
              {bar.label}
            </SvgText>
          );
        })}
    </Svg>
  );
}

/** Riga di riepilogo sotto le barre: media e totale del periodo mostrato. */
export function MonthBarsFooter({
  bars,
  suffix,
}: {
  bars: MonthBar[];
  suffix: string;
}) {
  const { palette } = useTheme();
  const total = bars.reduce((sum, b) => sum + b.value, 0);
  return (
    <Text style={[styles.footer, { color: palette.ink3 }]}>
      {`Totale ${suffix} · ${compactAmount(total)} €`}
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: { ...type.small, fontSize: 10.5, fontVariant: ["tabular-nums"] },
});
