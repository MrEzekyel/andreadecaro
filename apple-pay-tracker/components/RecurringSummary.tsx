import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, type } from "../lib/theme";

type Props = {
  /** Numero di regole ricorrenti mensili attive. */
  count: number;
  /** Somma delle rate mensili configurate. */
  monthlyTotal: number;
  /** Spesa totale del mese guardato, per calcolare il peso in percentuale. */
  monthTotal: number;
  onPress?: () => void;
};

/**
 * Peso delle spese ricorrenti sul mese, con lo stesso stile a barra del
 * riquadro del limite: sono entrambi "quanto di questo mese e' gia'
 * impegnato", solo che uno guarda un tetto e l'altro un impegno fisso.
 */
export function RecurringSummary({
  count,
  monthlyTotal,
  monthTotal,
  onPress,
}: Props) {
  const { palette } = useTheme();

  if (count === 0) return null;

  const ratio = monthTotal > 0 ? monthlyTotal / monthTotal : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: palette.ink }]}>
          {count} {count === 1 ? "pagamento ricorrente" : "pagamenti ricorrenti"}
        </Text>
        <Text style={[styles.pct, { color: palette.ink3 }]}>
          {Math.round(ratio * 100)}%
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(ratio * 100, 100)}%`,
              backgroundColor: palette.accent,
            },
          ]}
        />
      </View>

      <Text style={[styles.footText, { color: palette.ink2 }]}>
        {formatAmount(monthlyTotal)} al mese su {formatAmount(monthTotal)} spesi
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { gap: 11 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  title: { ...type.bodyMedium, fontSize: 12.5 },
  pct: { ...type.small, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  footText: { ...type.small, fontVariant: ["tabular-nums"] },
});
