import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { categoryColor, radius, tint, type } from "../lib/theme";
import { Category, Payment } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  payment: Payment;
  category: Category | undefined;
  onPress: () => void;
  /**
   * Mostra il punto vendita invece dell'insegna.
   *
   * Serve dentro il dettaglio di un'insegna, dove ogni riga porterebbe
   * altrimenti lo stesso nome ripetuto: li' l'unica cosa che distingue una
   * spesa dall'altra e' proprio in quale McDonald's si e' stati.
   */
  exactName?: boolean;
};

export function PaymentRow({ payment, category, onPress, exactName }: Props) {
  const { palette, dark } = useTheme();
  const { brandLabel } = useData();

  // In elenco si legge l'insegna: "McDonald's" tre volte in una settimana
  // dice qualcosa, "McDonald's Cristoforo Col" ripetuto con tre code diverse
  // fa sembrare tre posti differenti.
  const name = exactName ? payment.merchant_name : brandLabel(payment);

  const color = category
    ? categoryColor(category.color, dark)
    : palette.uncategorized;
  const iconName = category?.icon ?? "circle-help";
  const categoryName = category?.name ?? "Da categorizzare";

  const isRecurring = payment.source === "recurring";

  // `my_share` non nullo = spesa divisa: quello che compete a me
  // (`effective_amount`) e' il numero che si vuole vedere subito, il totale
  // pagato resta sotto, piccolo — e' contesto, non la cifra su cui si
  // decide "posso permettermelo?". Le quote arrivano solo se la query le ha
  // richieste esplicitamente (vedi `usePayments`/`DetailScreen`): finche'
  // non sono note si tratta la divisione come ancora aperta, mai come gia'
  // saldata per difetto.
  const isSplit = payment.my_share !== null;
  const splits = payment.payment_splits;
  const isSettled =
    isSplit && !!splits && splits.length > 0 && splits.every((s) => s.settled_at);
  const statusLabel = isSettled ? "Saldato" : "In attesa";
  const statusColor = isSettled ? palette.good : palette.ink3;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatAmount(
        payment.effective_amount
      )}${isSplit ? ` su ${formatAmount(payment.amount)} totali, divisione ${statusLabel.toLowerCase()}` : ""}, ${categoryName}`}
    >
      <View style={[styles.icon, { backgroundColor: tint(color, dark) }]}>
        <Icon name={iconName} size={17} color={color} />
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: palette.ink }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isRecurring && (
            <Icon
              name="repeat"
              size={12}
              color={palette.ink3}
              strokeWidth={2}
            />
          )}
        </View>
        <Text style={[styles.meta, { color: palette.ink3 }]} numberOfLines={1}>
          {categoryName}
        </Text>
      </View>

      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: palette.ink }]}>
          −{formatAmount(payment.effective_amount)}
        </Text>
        {isSplit && (
          <View style={styles.splitMeta}>
            <Icon name="split" size={11} color={statusColor} />
            <Text style={[styles.splitMetaText, { color: statusColor }]}>
              {statusLabel}
            </Text>
            <Text style={[styles.splitMetaText, { color: palette.ink3 }]}>
              · {formatAmount(payment.amount)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
  },
  icon: {
    width: 35,
    height: 35,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { ...type.bodyMedium, flexShrink: 1 },
  meta: { ...type.caption, marginTop: 2 },
  amountCol: { alignItems: "flex-end" },
  amount: { ...type.amount, fontVariant: ["tabular-nums"] },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  splitMetaText: { ...type.small, fontSize: 10.5 },
});
