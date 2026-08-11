import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { space, type } from "../lib/theme";
import { RecurringRule } from "../lib/types";

export type UpcomingRule = Pick<
  RecurringRule,
  "id" | "label" | "amount" | "next_run_on"
>;

type Props = {
  /** Le prossime rate in ordine di data, gia' tagliate a monte (2-3). */
  upcoming: UpcomingRule[];
  /** Numero totale di regole ricorrenti attive. */
  count: number;
  /** Somma delle sole rate mensili. */
  monthlyTotal: number;
  onPress?: () => void;
};

/**
 * Quando arriva la data della rata, non solo quanto pesa: "l'affitto parte
 * fra 3 giorni" e' un'informazione su cui si agisce, la vecchia barra col
 * peso percentuale dei ricorrenti sul mese era un numero che non chiedeva
 * niente a nessuno. E' lo stesso pattern dei "prossimi addebiti" delle
 * app di riferimento (Copilot su tutte).
 */
export function RecurringSummary({ upcoming, count, monthlyTotal, onPress }: Props) {
  const { palette } = useTheme();

  if (upcoming.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {upcoming.map((rule) => (
        <View key={rule.id} style={styles.row}>
          <Text
            style={[styles.rowLabel, { color: palette.ink }]}
            numberOfLines={1}
          >
            {rule.label}
          </Text>
          <Text style={[styles.rowWhen, { color: palette.ink3 }]}>
            {fraQuanto(rule.next_run_on)}
          </Text>
          <Text style={[styles.rowAmount, { color: palette.ink2 }]}>
            {formatAmount(Number(rule.amount))}
          </Text>
        </View>
      ))}

      <View style={styles.foot}>
        <Text style={[styles.footText, { color: palette.ink3 }]}>
          {count} {count === 1 ? "rata attiva" : "rate attive"}
          {monthlyTotal > 0 ? ` · ${formatAmount(monthlyTotal)} al mese` : ""}
        </Text>
        {onPress && <Icon name="chevron-right" size={13} color={palette.ink3} />}
      </View>
    </TouchableOpacity>
  );
}

/** "oggi" / "domani" / "fra N giorni" / "il 15 set" oltre le due settimane. */
function fraQuanto(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff <= 14) return `fra ${diff} giorni`;
  return `il ${target.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rowLabel: { ...type.body, flex: 1 },
  rowWhen: { ...type.small },
  rowAmount: {
    ...type.body,
    fontVariant: ["tabular-nums"],
    minWidth: 76,
    textAlign: "right",
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  footText: { ...type.small, fontVariant: ["tabular-nums"] },
});
