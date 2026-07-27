import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { categoryColor, radius, tint, type } from "../lib/theme";
import { Category, Payment } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  payment: Payment;
  category: Category | undefined;
  onPress: () => void;
};

export function PaymentRow({ payment, category, onPress }: Props) {
  const { palette, dark } = useTheme();

  const color = category
    ? categoryColor(category.color, dark)
    : palette.uncategorized;
  const iconName = category?.icon ?? "circle-help";
  const categoryName = category?.name ?? "Da categorizzare";

  const isRecurring = payment.source === "recurring";

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${payment.merchant_name}, ${formatAmount(
        payment.amount
      )}, ${categoryName}`}
    >
      <View style={[styles.icon, { backgroundColor: tint(color, dark) }]}>
        <Icon name={iconName} size={17} color={color} />
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.name, { color: palette.ink }]}
          numberOfLines={1}
        >
          {payment.merchant_name}
        </Text>
        <Text style={[styles.meta, { color: palette.ink3 }]} numberOfLines={1}>
          {categoryName}
          {isRecurring ? " · ricorrente" : ""}
        </Text>
      </View>

      <Text style={[styles.amount, { color: palette.ink }]}>
        −{formatAmount(payment.amount)}
      </Text>
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
  name: { ...type.bodyMedium },
  meta: { ...type.caption, marginTop: 2 },
  amount: { ...type.amount, fontVariant: ["tabular-nums"] },
});
