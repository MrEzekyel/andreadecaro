import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CategoryFormSheet } from "../components/CategoryFormSheet";
import { DraggableCategoryList } from "../components/DraggableCategoryList";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { space, type } from "../lib/theme";
import { Category } from "../lib/types";

export default function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const { categories, reload } = useData();

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

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
    <SwipeBack onBack={onBack}>
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          hitSlop={backHitSlop}
          accessibilityLabel="Indietro"
        >
          <Icon name="chevron-left" size={20} color={palette.ink} />
          <Text style={[styles.title, { color: palette.ink }]}>Categorie</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setEditing(null);
            setCreating(true);
          }}
          style={styles.addBtn}
        >
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <DraggableCategoryList
          categories={categories}
          onEdit={(category) => {
            setEditing(category);
            setCreating(true);
          }}
          onDelete={confirmDelete}
          onReordered={reload}
        />

        <Text style={[styles.note, { color: palette.ink3 }]}>
          Tieni premuta la maniglia per riordinare: l'ordine qui è lo stesso
          in cui compaiono nei selettori categoria. Eliminando una categoria
          le spese non vengono perse: tornano semplicemente da categorizzare.
        </Text>
      </ScrollView>

      <CategoryFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        editing={editing}
        onSaved={async () => {
          setCreating(false);
          await reload();
        }}
      />
    </View>
    </SwipeBack>
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
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 18,
  },
  title: { ...type.title },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...type.caption, fontWeight: "500" },
  list: { padding: space.lg, gap: space.md },
  note: { ...type.small, lineHeight: 17, marginTop: space.sm },
});
