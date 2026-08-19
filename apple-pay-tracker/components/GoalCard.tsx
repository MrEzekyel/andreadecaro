import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { goalCeiling } from "../lib/savings";
import { radius, space, type } from "../lib/theme";
import { SavingsGoal } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  goal: SavingsGoal;
  onPress?: () => void;
  /** Segna la card quando l'obiettivo e' coinvolto in un conflitto. */
  warn?: boolean;
};

/**
 * L'obiettivo di risparmio, con **il tetto di spesa che ne deriva**.
 *
 * La seconda riga e' la ragione per cui questa card esiste invece di un
 * semplice numero: "risparmia 1.000 €" non dice niente su cosa fare domani,
 * "puoi spendere fino a 1.000 €" si', ed e' esattamente la stessa cosa detta
 * dal lato su cui si agisce. Le entrate di riferimento sono scritte accanto
 * perche' il tetto dipende da loro: senza, un tetto che cambia da solo dopo
 * un aumento sembrerebbe un errore dell'app.
 */
export function GoalCard({ goal, onPress, warn }: Props) {
  const { palette } = useTheme();
  const ceiling = goalCeiling(goal);
  const income = Number(goal.reference_income);

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
          <Icon name="piggy-bank" size={15} color={palette.good} />
          <Text style={[styles.title, { color: palette.ink }]}>
            Obiettivo di risparmio · mese
          </Text>
        </View>
        {warn && <Icon name="triangle-alert" size={15} color={palette.warn} />}
      </View>

      <Text style={[styles.amount, { color: palette.ink }]}>
        {formatAmount(Number(goal.amount))}
      </Text>

      {/* Il tetto e' la traduzione operativa dell'obiettivo, non un secondo
          dato: sono lo stesso impegno visto dai due lati. */}
      <Text style={[styles.derived, { color: palette.ink2 }]}>
        {ceiling > 0
          ? `Puoi spendere fino a ${formatAmount(ceiling)} al mese`
          : "Non lascia niente per le spese"}
      </Text>
      <Text style={[styles.basis, { color: palette.ink3 }]}>
        su {formatAmount(income)} di entrate previste
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: 3,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  title: { ...type.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  amount: {
    ...type.title,
    fontSize: 26,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  derived: { ...type.small, marginTop: 2 },
  basis: { ...type.small, fontSize: 10.5 },
});
