import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Icon } from "./Icon";
import { NamePromptSheet } from "./NamePromptSheet";

const CASH = "Contanti";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Metodo di pagamento: le carte gia' viste in altre spese, "Contanti", e
 * "Aggiungi" per registrarne uno nuovo.
 *
 * Niente campo di testo libero accanto ai chip: un metodo nuovo si crea con
 * lo stesso gesto di categorie e persone, invece di restare un campo sempre
 * aperto che finiva per confondersi con la scelta fra i chip.
 */
export function CardPicker({ value, onChange }: Props) {
  const { palette, dark } = useTheme();
  const [known, setKnown] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase
      .from("payments")
      .select("card_name")
      .not("card_name", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const names = new Set<string>();
        for (const row of data) {
          if (row.card_name && row.card_name !== CASH) names.add(row.card_name);
        }
        setKnown(Array.from(names).sort());
      });
  }, []);

  function addMethod(name: string) {
    setKnown((current) =>
      current.includes(name) ? current : [...current, name].sort()
    );
    onChange(name);
    setAdding(false);
  }

  const chips = [CASH, ...known];

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {chips.map((name) => {
          const selected = value === name;
          return (
            <TouchableOpacity
              key={name}
              onPress={() => onChange(selected ? "" : name)}
              style={[
                styles.chip,
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
              {name === CASH && (
                <Icon
                  name="banknote"
                  size={13}
                  color={selected ? palette.accent : palette.ink2}
                />
              )}
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? palette.accent : palette.ink2 },
                ]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => setAdding(true)}
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
          accessibilityRole="button"
          accessibilityLabel="Nuovo metodo di pagamento"
        >
          <Icon name="plus" size={13} color={palette.accent} />
          <Text style={[styles.chipText, { color: palette.accent }]}>Aggiungi</Text>
        </TouchableOpacity>
      </ScrollView>

      <NamePromptSheet
        visible={adding}
        title="Nuovo metodo di pagamento"
        placeholder="Es. Postepay"
        onClose={() => setAdding(false)}
        onSubmit={(name) => addMethod(name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...type.caption, fontWeight: "500" },
});
