import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { Icon } from "./Icon";

type Props = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

/** Minuscole e senza accenti: cercando "farm" deve comparire anche "Farmacia". */
function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Striscia orizzontale di categorie, con "Cerca" fisso a sinistra.
 *
 * "Cerca" non scorre con le altre: è il primo ovale, sempre nella stessa
 * posizione, e apre un pannello separato invece di essere un'altra scelta
 * nella striscia — su una lista lunga scorrerla per trovare un nome è più
 * lento che scriverlo. Il resto (categorie, "Nessuna", "Nuova") scorre come
 * prima.
 *
 * Il pannello di ricerca filtra per **prefisso** del nome, non per
 * contenuto: scrivendo "F" deve comparire "Farmacia", non una categoria che
 * ha una "f" in mezzo al nome — altrimenti con una manciata di lettere la
 * lista non si accorcia quasi mai.
 */
export function CategoryPicker({ value, onChange }: Props) {
  const { categories, reload } = useData();
  const { palette, dark } = useTheme();
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  async function onCreated(category: Category) {
    setCreating(false);
    await reload();
    onChange(category.id);
  }

  function openSearch() {
    setQuery("");
    setSearching(true);
  }

  function closeSearch() {
    setSearching(false);
    setQuery("");
  }

  function chooseFromSearch(category: Category) {
    onChange(category.id);
    closeSearch();
  }

  const filtered = useMemo(() => {
    const needle = fold(query);
    if (!needle) return categories;
    return categories.filter((category) => fold(category.name).startsWith(needle));
  }, [categories, query]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={openSearch}
        style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
        accessibilityRole="button"
        accessibilityLabel="Cerca categoria"
      >
        <Icon name="search" size={16} color={palette.accent} />
        <Text style={[styles.label, { color: palette.accent }]}>Cerca</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: palette.hairline }]} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripScroll}
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
              <Icon name={category.icon} size={16} color={color} />
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
          <Icon name="circle-help" size={16} color={palette.uncategorized} />
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
          <Icon name="plus" size={16} color={palette.accent} />
          <Text style={[styles.label, { color: palette.accent }]}>Nuova</Text>
        </TouchableOpacity>
      </ScrollView>

      <CategoryFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        editing={null}
        onSaved={onCreated}
      />

      <Modal visible={searching} transparent animationType="fade" onRequestClose={closeSearch}>
        <View style={styles.overlay}>
          <SafeAreaView style={[styles.panel, { backgroundColor: palette.ground }]}>
            <View style={styles.panelHead}>
              <TouchableOpacity
                onPress={closeSearch}
                style={styles.panelBack}
                accessibilityLabel="Indietro"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="chevron-left" size={20} color={palette.ink} />
              </TouchableOpacity>
              <Text style={[styles.panelTitle, { color: palette.ink }]}>Cerca categoria</Text>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nome della categoria…"
              placeholderTextColor={palette.ink3}
              autoFocus
              autoCorrect={false}
              style={[
                styles.input,
                { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink },
              ]}
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.panelList}
            >
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: palette.ink3 }]}>
                  Nessuna categoria trovata.
                </Text>
              ) : (
                filtered.map((category) => {
                  const color = categoryColor(category.color, dark);
                  const selected = value === category.id;

                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => chooseFromSearch(category)}
                      style={styles.panelRow}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={[styles.panelIcon, { backgroundColor: tint(color, dark) }]}>
                        <Icon name={category.icon} size={16} color={color} />
                      </View>
                      <Text
                        style={[
                          styles.panelRowText,
                          { color: selected ? palette.ink : palette.ink2 },
                        ]}
                        numberOfLines={1}
                      >
                        {category.name}
                      </Text>
                      {selected && <Icon name="check" size={16} color={palette.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>

          <Pressable
            style={styles.backdrop}
            onPress={closeSearch}
            accessibilityLabel="Chiudi"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  stripScroll: { flex: 1 },
  strip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  divider: { width: 1, height: 22, marginHorizontal: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { ...type.body, fontWeight: "500" },

  overlay: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.32)" },
  panel: {
    width: "60%",
    borderTopRightRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    overflow: "hidden",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
  },
  panelBack: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  panelTitle: { ...type.sheetTitle },
  input: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 11,
    ...type.body,
  },
  panelList: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: 2,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  panelIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  panelRowText: { ...type.body, flex: 1 },
  empty: { ...type.small, lineHeight: 17, paddingTop: space.sm },
});
