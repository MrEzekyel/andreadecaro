import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, splitAmount } from "../lib/format";
import { space, type } from "../lib/theme";

const WIDTH = 300;
const HEIGHT = 30;
const GAP = 2;

type Props = {
  /** Capitale messo di tasca propria. */
  invested: number;
  /** Guadagno o perdita maturata sopra a quel capitale. */
  gain: number;
  gainPct: number | null;
  color: string;
};

/**
 * Quanto del valore di oggi e' denaro tuo e quanto l'ha prodotto il mercato.
 *
 * Una riga "Valore", una "Capitale versato" e una "Guadagno" dicono gli stessi
 * tre numeri, ma lasciano al lettore il lavoro di capire che il primo e' la
 * somma degli altri due. Qui la relazione si vede: la barra e' il valore, e i
 * due pezzi sono la sua composizione.
 *
 * In perdita la barra racconta la stessa cosa al contrario — quanto del
 * capitale versato e' rimasto — perche' una fetta di lunghezza negativa non
 * esiste e disegnarla come se fosse un guadagno mentirebbe.
 */
export function ValueSplit({ invested, gain, gainPct, color }: Props) {
  const { palette } = useTheme();

  const value = invested + gain;
  const inPerdita = gain < 0;
  const amount = splitAmount(value);

  // In guadagno la barra piena e' il valore; in perdita e' il capitale
  // versato, cosi' la parte mancante e' visibile invece che tagliata via.
  const totale = inPerdita ? invested : value;
  const quotaCapitale = totale > 0 ? Math.min(invested, totale) / totale : 1;
  const larghezzaCapitale = inPerdita
    ? (value / (totale || 1)) * WIDTH
    : quotaCapitale * WIDTH;
  const larghezzaGuadagno = Math.max(WIDTH - larghezzaCapitale, 0);

  const coloreGuadagno = inPerdita ? palette.over : palette.good;

  return (
    <View>
      <Text style={[styles.value, { color: palette.ink }]}>
        {amount.whole}
        <Text style={[styles.cents, { color: palette.ink2 }]}>{amount.cents}</Text>
      </Text>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Rect
          x={0}
          y={0}
          width={Math.max(larghezzaCapitale - GAP, 1)}
          height={HEIGHT}
          rx={4}
          fill={color}
        />
        {larghezzaGuadagno > GAP && (
          <Rect
            x={larghezzaCapitale}
            y={0}
            width={larghezzaGuadagno}
            height={HEIGHT}
            rx={4}
            fill={coloreGuadagno}
            fillOpacity={inPerdita ? 0.28 : 1}
          />
        )}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.name, { color: palette.ink2 }]}>
            {inPerdita ? "Valore di oggi" : "Capitale versato"}
          </Text>
          <Text style={[styles.amount, { color: palette.ink }]}>
            {formatAmount(inPerdita ? value : invested)}
          </Text>
        </View>

        <View style={styles.row}>
          <View
            style={[
              styles.dot,
              { backgroundColor: coloreGuadagno, opacity: inPerdita ? 0.5 : 1 },
            ]}
          />
          <Text style={[styles.name, { color: palette.ink2 }]}>
            {inPerdita ? "Perdita" : "Guadagno"}
          </Text>
          {gainPct !== null && (
            <Text style={[styles.pct, { color: coloreGuadagno }]}>
              {gain >= 0 ? "+" : "−"}
              {Math.abs(gainPct * 100).toFixed(1)}%
            </Text>
          )}
          <Text style={[styles.amount, { color: coloreGuadagno }]}>
            {gain >= 0 ? "+" : "−"}
            {formatAmount(Math.abs(gain))}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { ...type.hero, fontSize: 34, marginBottom: space.md },
  cents: { ...type.heroCents, fontSize: 20 },
  legend: { marginTop: space.md, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 2 },
  name: { ...type.caption, flex: 1 },
  pct: { ...type.small, fontWeight: "500" },
  amount: {
    ...type.amount,
    minWidth: 92,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
