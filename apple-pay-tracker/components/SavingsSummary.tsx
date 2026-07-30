import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { space, type } from "../lib/theme";

type Props = {
  income: number;
  expenses: number;
  invested: number;
};

/**
 * Bilancio del mese: introiti, spese e investimenti messi a confronto, con
 * il risparmiato in evidenza in fondo.
 *
 * "Risparmiato" qui e' cio' che resta sul conto senza essere ne' speso ne'
 * investito — non il totale accantonato in senso lato, che include anche
 * gli investimenti. Tenerli separati e' il punto: sapere quanto e' stato
 * scelto di investire rispetto a quanto e' semplicemente rimasto li'.
 */
export function SavingsSummary({ income, expenses, invested }: Props) {
  const { palette } = useTheme();
  const saved = income - expenses - invested;

  const rows = [
    { label: "Introiti", value: income, color: palette.good, sign: "+" },
    { label: "Spese", value: expenses, color: palette.ink, sign: "−" },
    { label: "Investimenti", value: invested, color: palette.ink, sign: "−" },
  ];

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.rowLabel, { color: palette.ink2 }]}>{row.label}</Text>
          <Text style={[styles.rowValue, { color: row.color }]}>
            {row.value > 0 ? `${row.sign}${formatAmount(row.value)}` : formatAmount(0)}
          </Text>
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: palette.hairline }]} />

      <View style={styles.row}>
        <Text style={[styles.savedLabel, { color: palette.ink }]}>Risparmiato</Text>
        <Text
          style={[
            styles.savedValue,
            { color: saved >= 0 ? palette.good : palette.over },
          ]}
        >
          {saved >= 0 ? "+" : "−"}
          {formatAmount(Math.abs(saved))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { ...type.caption },
  rowValue: {
    ...type.caption,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  divider: { height: 1, marginVertical: 2 },
  savedLabel: { ...type.bodyMedium, fontSize: 13.5 },
  savedValue: {
    ...type.bodyMedium,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
});
