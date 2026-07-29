import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

/**
 * Tavolozza offerta per le categorie personali.
 * Sono gli stessi valori verificati per contrasto e distinguibilita' usati
 * dalle categorie predefinite, cosi' una categoria creata da te resta
 * coerente con le altre nei grafici.
 */
export const CATEGORY_COLOR_CHOICES = [
  "#16a34a", "#2563eb", "#ea580c", "#db2777",
  "#4f46e5", "#0891b2", "#a16207", "#7c3aed",
  "#dc2626", "#0d9488", "#65a30d", "#71717a",
];

export const CATEGORY_ICON_CHOICES = [
  "shopping-cart", "utensils", "train-front", "shopping-bag",
  "repeat", "plane", "plug-zap", "house",
  "heart-pulse", "film", "dumbbell", "gift",
  "book", "cat", "baby", "wrench",
];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** null = nuova categoria. */
  editing: Category | null;
  /** Chiamato con la riga salvata, cosi' chi apre il foglio puo' selezionarla subito. */
  onSaved: (category: Category) => void;
};

/**
 * Foglio di creazione/modifica categoria, condiviso fra la schermata
 * Categorie e il "+" del selettore categoria: aggiungerne una al volo mentre
 * si registra una spesa non deve duplicare questo modulo.
 */
export function CategoryFormSheet({ visible, onClose, editing, onSaved }: Props) {
  const { palette, dark } = useTheme();

  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLOR_CHOICES[0]);
  const [icon, setIcon] = useState(CATEGORY_ICON_CHOICES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? CATEGORY_COLOR_CHOICES[0]);
    setIcon(editing?.icon ?? CATEGORY_ICON_CHOICES[0]);
  }, [visible, editing]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Nome mancante", "Dai un nome alla categoria.");
      return;
    }

    setSaving(true);

    if (editing) {
      const { data, error } = await supabase
        .from("categories")
        .update({ name: trimmed, color, icon })
        .eq("id", editing.id)
        .select()
        .single();

      setSaving(false);
      if (error || !data) {
        Alert.alert("Errore", error?.message ?? "Salvataggio non riuscito.");
        return;
      }
      onSaved(data as Category);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setSaving(false);
      Alert.alert("Sessione scaduta", "Accedi di nuovo.");
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: trimmed, color, icon, sort_order: 500 })
      .select()
      .single();

    setSaving(false);
    if (error || !data) {
      Alert.alert(
        "Errore",
        error?.code === "23505"
          ? "Esiste già una categoria con questo nome."
          : error?.message ?? "Salvataggio non riuscito."
      );
      return;
    }
    onSaved(data as Category);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
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
        {CATEGORY_COLOR_CHOICES.map((choice) => (
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
        {CATEGORY_ICON_CHOICES.map((choice) => (
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
                  icon === choice ? categoryColor(color, dark) : palette.hairline,
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
        disabled={saving}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>Salva</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
