import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { categoryColor, radius, space, type } from "../lib/theme";
import { LimitStatus } from "../lib/useLimits";

const PERIOD_LABEL = { weekly: "Settimanale", monthly: "Mensile" } as const;

type Props = {
  status: LimitStatus;
  onPress?: () => void;
};

export function LimitCard({ status, onPress }: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const { limit, spent, ratio, level, remaining } = status;
  const category = categoryById(limit.category_id);

  // Il colore dice lo stato dell'avanzamento, non l'identita' della
  // categoria: verde sotto soglia, ambra oltre l'avviso, rosso se sforato.
  const barColor =
    level === "over" ? palette.over : level === "warn" ? palette.warn : palette.good;

  const scope = category
    ? category.name
    : "tutte le categorie";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.hairline },
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.head}>
        <View style={styles.titleRow}>
          {category && (
            <View
              style={[
                styles.swatch,
                { backgroundColor: categoryColor(category.color, dark) },
              ]}
            />
          )}
          <Text style={[styles.title, { color: palette.ink }]}>
            {PERIOD_LABEL[limit.period]} · {scope}
          </Text>
        </View>
        <Text
          style={[
            styles.pct,
            {
              color: level === "over" ? palette.over : palette.ink3,
              fontWeight: level === "over" ? "500" : "400",
            },
          ]}
        >
          {Math.round(ratio * 100)}%
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(ratio * 100, 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      <View style={styles.foot}>
        <Text
          style={[
            styles.footText,
            { color: level === "over" ? palette.over : palette.ink2 },
          ]}
        >
          {formatAmount(spent)} di {formatAmount(Number(limit.amount))}
        </Text>
        <Text style={[styles.footText, { color: palette.ink3 }]}>
          {remaining >= 0
            ? `restano ${formatAmount(remaining)}`
            : `superato di ${formatAmount(-remaining)}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: 11,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  title: { ...type.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  pct: { ...type.small, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  foot: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  footText: { ...type.small, fontVariant: ["tabular-nums"] },
});
