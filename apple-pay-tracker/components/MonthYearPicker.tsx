import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, tint, type } from "../lib/theme";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

const MONTHS_SHORT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

type Props = {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
};

/**
 * Selettore mese/anno a schermo, al posto dello swipe: l'anno si sposta con
 * le frecce, il mese si sceglie da una griglia di 12 caselle. Uno swipe
 * mese per mese non permette di saltare a un anno lontano in un colpo solo,
 * questo si'.
 */
export function MonthYearPicker({ visible, value, onSelect, onClose }: Props) {
  const { palette, dark } = useTheme();
  const [year, setYear] = useState(value.getFullYear());

  // Ogni apertura riparte dall'anno del mese attualmente selezionato, non
  // da dove l'utente l'aveva lasciato l'ultima volta che l'ha aperto.
  useEffect(() => {
    if (visible) setYear(value.getFullYear());
  }, [visible, value]);

  function pick(monthIndex: number) {
    onSelect(new Date(year, monthIndex, 1));
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Seleziona mese">
      <View style={styles.yearRow}>
        <TouchableOpacity
          onPress={() => setYear((y) => y - 1)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Anno precedente"
        >
          <Icon name="chevron-left" size={20} color={palette.ink2} />
        </TouchableOpacity>
        <Text style={[styles.year, { color: palette.ink }]}>{year}</Text>
        <TouchableOpacity
          onPress={() => setYear((y) => y + 1)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Anno successivo"
        >
          <Icon name="chevron-right" size={20} color={palette.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {MONTHS_SHORT.map((label, index) => {
          const selected =
            year === value.getFullYear() && index === value.getMonth();
          return (
            <TouchableOpacity
              key={label}
              onPress={() => pick(index)}
              style={[
                styles.month,
                {
                  backgroundColor: selected
                    ? tint(palette.accent, dark)
                    : palette.surface,
                  borderColor: selected ? palette.accent : palette.hairline,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.monthText,
                  { color: selected ? palette.accent : palette.ink2 },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xl,
    marginBottom: space.lg,
  },
  year: { ...type.title, fontVariant: ["tabular-nums"] },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  month: {
    width: "31%",
    paddingVertical: 14,
    borderRadius: radius.field,
    borderWidth: 1,
    alignItems: "center",
  },
  monthText: { ...type.bodyMedium },
});
