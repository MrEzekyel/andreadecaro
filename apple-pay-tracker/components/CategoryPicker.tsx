import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { categoryColor, radius, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { Icon } from "./Icon";

type Props = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  const { categories, reload } = useData();
  const { palette, dark } = useTheme();
  const [creating, setCreating] = useState(false);

  async function onCreated(category: Category) {
    setCreating(false);
    await reload();
    onChange(category.id);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {categories.map((category) => {
        const color = categoryColor(category.color, dark);
        const selected = value === category.id;

        return (
          <TouchableOpacity
            key={category.id}
            onPress={() => onChange(category.id)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? tint(color, dark) : palette.surface,
                borderColor: selected ? color : palette.hairline,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Icon name={category.icon} size={14} color={color} />
            <Text
              style={[
                styles.label,
                { color: selected ? palette.ink : palette.ink2 },
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={() => onChange(null)}
        style={[
          styles.chip,
          {
            backgroundColor:
              value === null ? tint(palette.uncategorized, dark) : palette.surface,
            borderColor: value === null ? palette.uncategorized : palette.hairline,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
      >
        <Icon name="circle-help" size={14} color={palette.uncategorized} />
        <Text
          style={[
            styles.label,
            { color: value === null ? palette.ink : palette.ink2 },
          ]}
        >
          Nessuna
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setCreating(true)}
        style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
        accessibilityRole="button"
        accessibilityLabel="Nuova categoria"
      >
        <Icon name="plus" size={14} color={palette.accent} />
        <Text style={[styles.label, { color: palette.accent }]}>Nuova</Text>
      </TouchableOpacity>

      <CategoryFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        editing={null}
        onSaved={onCreated}
      />
    </ScrollView>
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
  label: { ...type.caption, fontWeight: "500" },
});
