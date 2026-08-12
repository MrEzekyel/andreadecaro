import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount, formatAmount } from "../lib/format";
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
  /** Etichette dei mesi sotto le barre: si spengono quando lo spazio manca. */
  showLabels?: boolean;
};

/** Media dei mesi mostrati: si scrive accanto al titolo, non sul grafico. */
export function monthBarsAverage(bars: MonthBar[]) {
  if (bars.length === 0) return 0;
  return bars.reduce((sum, b) => sum + b.value, 0) / bars.length;
}

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
  showLabels = true,
}: Props) {
  const { palette } = useTheme();

  if (bars.length === 0) return null;

  const axisH = showLabels ? 12 : 2;
  const plotH = height - axisH;
  const peak = Math.max(...bars.map((b) => b.value), 1);
  const slot = width / bars.length;
  const barW = Math.min(slot * 0.62, 26);
  // Il valore sopra ogni barra vuole la sua fascia: senza, la barra piu' alta
  // si prendeva tutta l'altezza e il numero finiva fuori dal viewBox.
  const valueFont = width > 200 ? 8 : 6.4;
  const headroom = valueFont + 5;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Niente riga della media qui sopra: era un riferimento che nessun mese
          toccava e rubava lo spazio ai numeri veri, che sono quelli che
          rispondono a "quanto". La media sta scritta accanto al titolo. */}
      {bars.map((bar, index) => {
        const h = Math.max(
          (bar.value / peak) * (plotH - headroom),
          bar.value > 0 ? 2 : 0
        );
        const last = index === bars.length - 1;
        return (
          <Rect
            key={`${bar.label}-${index}`}
            x={index * slot + (slot - barW) / 2}
            y={plotH - h}
            width={barW}
            height={h}
            rx={2.5}
            // `hairline` e non `surface2`: quest'ultimo sta a un soffio dal
            // fondo pagina, e a piena larghezza (fuori da una carta) i mesi
            // passati sparivano — restava la loro etichetta sospesa sul
            // vuoto, che e' peggio di non disegnarli affatto.
            fill={last ? color : palette.hairline}
          />
        );
      })}

      {bars.map((bar, index) => {
        if (bar.value <= 0) return null;
        const h = Math.max((bar.value / peak) * (plotH - headroom), 2);
        const last = index === bars.length - 1;
        return (
          <SvgText
            key={`v-${bar.label}-${index}`}
            x={index * slot + slot / 2}
            y={plotH - h - 3.5}
            textAnchor="middle"
            fontSize={valueFont}
            fontWeight={last ? "600" : "400"}
            fill={last ? color : palette.ink3}
          >
            {compactAmount(bar.value)}
          </SvgText>
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
      {`Totale ${suffix} · ${formatAmount(total)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: { ...type.small, fontSize: 10.5, fontVariant: ["tabular-nums"] },
});
