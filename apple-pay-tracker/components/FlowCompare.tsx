import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount, formatAmount } from "../lib/format";
import { radius, type } from "../lib/theme";

type Props = {
  income: number;
  spent: number;
  invested: number;
};

/**
 * Introiti contro uscite su una scala sola.
 *
 * Le tre fasce non hanno piu' la stessa lunghezza come in un diagramma di
 * flusso: la barra piu' lunga e' quella che vince (gli introiti se il mese
 * chiude in positivo, le uscite se chiude in rosso) e l'altra si misura
 * contro di lei. L'investito riparte da dove finisce lo speso, quindi la
 * distanza fra la fine della barra verde e la fine di quella arancione **e'**
 * quello che avanza: non un numero da leggere ma uno spazio da guardare.
 *
 * Idea di Andrea. Con tre fasce di uguale lunghezza (il flusso classico) quel
 * divario non si vedeva affatto, perche' ogni ramo era largo quanto il suo
 * valore ma tutti finivano allineati.
 */
export function FlowCompare({ income, spent, invested }: Props) {
  const { palette } = useTheme();

  const outflow = spent + invested;
  const scale = Math.max(income, outflow, 1);
  const gap = income - outflow;

  const pct = (value: number): `${number}%` =>
    `${Math.max((value / scale) * 100, 0)}%`;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.key, { color: palette.ink3 }]}>INTROITI</Text>
        <Text style={[styles.val, { color: palette.ink2 }]}>
          {compactAmount(income)} €
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
        <View
          style={[styles.fill, { width: pct(income), backgroundColor: palette.good }]}
        />
      </View>

      <View style={[styles.row, { marginTop: 9 }]}>
        <Text style={[styles.key, { color: palette.ink3 }]}>USCITE</Text>
        <Text style={[styles.val, { color: palette.ink2 }]}>
          {compactAmount(outflow)} €
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
        <View style={styles.stack}>
          <View
            style={[styles.fill, { width: pct(spent), backgroundColor: palette.accent }]}
          />
          {invested > 0 && (
            <View
              style={[styles.fill, { width: pct(invested), backgroundColor: palette.limit }]}
            />
          )}
        </View>
      </View>

      {/* Il numero sotto non ripete le barre: dice il verso del divario, che
          e' l'unica cosa che le barre da sole non distinguono a colpo
          d'occhio quando sono quasi uguali. */}
      <Text
        style={[
          styles.gap,
          { color: gap >= 0 ? palette.good : palette.over },
        ]}
      >
        {gap >= 0
          ? `Avanzano ${formatAmount(gap)}`
          : `Mancano ${formatAmount(-gap)}`}
      </Text>

      <View style={styles.legend}>
        <Legend color={palette.accent} label="Speso" value={spent} />
        {invested > 0 && (
          <Legend color={palette.limit} label="Investito" value={invested} />
        )}
      </View>
    </View>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendName, { color: palette.ink3 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.legendVal, { color: palette.ink2 }]}>
        {compactAmount(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  key: { fontSize: 9, fontWeight: "600", letterSpacing: 0.8 },
  val: { ...type.small, fontSize: 10.5, fontVariant: ["tabular-nums"] },
  track: {
    height: 9,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: 4,
  },
  stack: { flexDirection: "row", height: 9 },
  fill: { height: 9 },
  gap: {
    ...type.small,
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 9,
    fontVariant: ["tabular-nums"],
  },
  legend: { marginTop: 6, gap: 3 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  legendName: { fontSize: 9.5, flex: 1 },
  legendVal: { fontSize: 9.5, fontVariant: ["tabular-nums"] },
});
