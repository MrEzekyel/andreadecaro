import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";

/**
 * Tavolozza offerta per le categorie personali.
 * Sono gli stessi valori verificati per contrasto e distinguibilita' usati
 * dalle categorie predefinite, cosi' una categoria creata da te resta
 * coerente con le altre nei grafici.
 */
const COLOR_CHOICES = [
  "#16a34a", "#2563eb", "#ea580c", "#db2777",
  "#4f46e5", "#0891b2", "#a16207", "#7c3aed",
  "#dc2626", "#0d9488", "#65a30d", "#71717a",
];

const ICON_CHOICES = [
  "shopping-cart", "utensils", "train-front", "shopping-bag",
  "repeat", "plane", "plug-zap", "house",
  "heart-pulse", "film", "dumbbell", "gift",
  "book", "cat", "baby", "wrench",
];

export default function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { categories, reload } = useData();

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [icon, setIcon] = useState(ICON_CHOICES[0]);

  function openCreate() {
    setName("");
    setColor(COLOR_CHOICES[0]);
    setIcon(ICON_CHOICES[0]);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(category: Category) {
    setName(category.name);
    setColor(category.color);
    setIcon(category.icon);
    setEditing(category);
    setCreating(true);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Nome mancante", "Dai un nome alla categoria.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update({ name: trimmed, color, icon })
        .eq("id", editing.id);
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    } else {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        Alert.alert("Sessione scaduta", "Accedi di nuovo.");
        return;
      }
      const { error } = await supabase.from("categories").insert({
        user_id: userId,
        name: trimmed,
        color,
        icon,
        sort_order: 500,
      });
      if (error) {
        Alert.alert(
          "Errore",
          error.code === "23505"
            ? "Esiste già una categoria con questo nome."
            : error.message
        );
        return;
      }
    }

    setCreating(false);
    await reload();
  }

  function confirmDelete(category: Category) {
    Alert.alert(
      `Eliminare "${category.name}"?`,
      "Le spese che la usano resteranno, ma torneranno da categorizzare.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("categories")
              .delete()
              .eq("id", category.id);
            if (error) {
              Alert.alert("Errore", error.message);
              return;
            }
            await reload();
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          accessibilityLabel="Indietro"
        >
          <Icon name="chevron-left" size={20} color={palette.ink} />
          <Text style={[styles.title, { color: palette.ink }]}>Categorie</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          {categories.map((category, index) => {
            const resolved = categoryColor(category.color, dark);
            return (
              <View key={category.id}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => openEdit(category)}
                  >
                    <View
                      style={[
                        styles.icon,
                        { backgroundColor: tint(resolved, dark) },
                      ]}
                    >
                      <Icon name={category.icon} size={16} color={resolved} />
                    </View>
                    <Text style={[styles.rowName, { color: palette.ink }]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => confirmDelete(category)}
                    accessibilityLabel={`Elimina ${category.name}`}
                  >
                    <Icon name="trash-2" size={16} color={palette.ink3} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.note, { color: palette.ink3 }]}>
          Eliminando una categoria le spese non vengono perse: tornano
          semplicemente da categorizzare.
        </Text>
      </ScrollView>

      <Sheet
        visible={creating}
        onClose={() => setCreating(false)}
        title={editing ? "Modifica categoria" : "Nuova categoria"}
      >
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome"
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

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Colore</Text>
        <View style={styles.grid}>
          {COLOR_CHOICES.map((choice) => (
            <TouchableOpacity
              key={choice}
              onPress={() => setColor(choice)}
              style={[
                styles.colorDot,
                {
                  backgroundColor: categoryColor(choice, dark),
                  borderColor: color === choice ? palette.ink : "transparent",
                },
              ]}
              accessibilityLabel={`Colore ${choice}`}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Icona</Text>
        <View style={styles.grid}>
          {ICON_CHOICES.map((choice) => (
            <TouchableOpacity
              key={choice}
              onPress={() => setIcon(choice)}
              style={[
                styles.iconChoice,
                {
                  backgroundColor:
                    icon === choice
                      ? tint(categoryColor(color, dark), dark)
                      : palette.surface,
                  borderColor:
                    icon === choice
                      ? categoryColor(color, dark)
                      : palette.hairline,
                },
              ]}
            >
              <Icon
                name={choice}
                size={17}
                color={icon === choice ? categoryColor(color, dark) : palette.ink3}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={save}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Salva
          </Text>
        </TouchableOpacity>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { ...type.title },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...type.caption, fontWeight: "500" },
  list: { padding: space.lg, gap: space.md },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { ...type.body },
  note: { ...type.small, lineHeight: 17 },
  fieldLabel: { ...type.caption },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 9, borderWidth: 2 },
  iconChoice: {
    width: 42,
    height: 42,
    borderRadius: radius.field,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
