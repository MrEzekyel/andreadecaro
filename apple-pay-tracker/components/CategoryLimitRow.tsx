import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { LimitStatus } from "../lib/useLimits";
import { Icon } from "./Icon";

const PERIOD_LABEL = { weekly: "sett.", monthly: "mese" } as const;

type Props = {
  status: LimitStatus;
  category: Category;
};

/**
 * Una riga per un limite di categoria, pensata per la Home — non per
 * `LimitsScreen`, che ha gia' `LimitCard` con la sua barra di avanzamento.
 * Qui serve qualcosa di piu' piccolo che possa stare in fila fino a tre
 * volte sotto "Restano" senza spingere giu' il resto della schermata, e che
 * porti il colore della categoria invece di quello dello stato: e' cosi'
 * che si riconosce a colpo d'occhio *quale* categoria, non solo se va bene
 * o male — quello lo dice gia' il numero.
 */
export function CategoryLimitRow({ status, category }: Props) {
  const { palette, dark } = useTheme();
  const color = categoryColor(category.color, dark);
  const { spent, ratio, level } = status;
  const amount = Number(status.limit.amount);

  // Il colore della percentuale dice se va bene o male, come in `LimitCard`
  // (LimitsScreen): il colore della riga invece e' quello della categoria,
  // e resta cosi' anche quando il limite e' sforato — sennò due limiti
  // sforati insieme diventerebbero indistinguibili, entrambi rossi.
  const pctColor =
    level === "over" ? palette.over : level === "warn" ? palette.warn : palette.ink2;

  return (
    <View style={[styles.row, { backgroundColor: tint(color, dark) }]}>
      <View style={[styles.icon, { backgroundColor: `${color}33` }]}>
        <Icon name={category.icon} size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={[styles.detail, { color: palette.ink2 }]} numberOfLines={1}>
          {formatAmount(spent)} di {formatAmount(amount)} · {PERIOD_LABEL[status.limit.period]}
        </Text>
      </View>
      <Text style={[styles.pct, { color: pctColor }]}>{Math.round(ratio * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.card,
    paddingVertical: 9,
    paddingHorizontal: space.md,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...type.caption, fontWeight: "500" },
  detail: { ...type.small, fontSize: 10.5, marginTop: 1 },
  pct: { ...type.small, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
