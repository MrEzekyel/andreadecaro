import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Icon } from "./Icon";

const CASH = "Contanti";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Metodo di pagamento: le carte gia' viste in altre spese, "Contanti", e un
 * campo libero per una carta nuova.
 *
 * E' un vocabolario aperto — non c'e' un elenco fisso di carte come per le
 * categorie — quindi i chip sono scorciatoie per riempire il campo, non
 * l'unica scelta possibile.
 */
export function CardPicker({ value, onChange }: Props) {
  const { palette, dark } = useTheme();
  const [known, setKnown] = useState<string[]>([]);

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
      </ScrollView>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Oppure scrivi il nome della carta"
        placeholderTextColor={palette.ink3}
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.hairline,
            color: palette.ink,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingVertical: 2, paddingBottom: space.sm, paddingRight: 8 },
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
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
});
