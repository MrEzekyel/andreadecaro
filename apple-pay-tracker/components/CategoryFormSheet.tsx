import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

/**
 * Tavolozza offerta per le categorie personali.
 *
 * La prima riga e' quella storica: gli stessi valori usati dalle categorie
 * predefinite, verificati per contrasto e distinguibilita', cosi' una
 * categoria creata da te resta coerente con le altre nei grafici.
 *
 * La seconda serie li raddoppia. Ogni tinta ha lo stesso trattamento delle
 * altre — valore chiaro qui, variante schiarita in `DARK_CATEGORY_OVERRIDES`
 * per il tema scuro — ma vale la pena essere onesti sul limite: a ventidue
 * colori alcune coppie sono vicine (lampone e rosso, porpora e violetto, i
 * due verdi). Restano leggibili e distinguibili una accanto all'altra nella
 * griglia, che e' dove si sceglie; in un grafico con dodici fette accostate
 * sarebbe un'altra storia, ma una torta di spese non arriva mai a dodici
 * categorie usate davvero.
 */
export const CATEGORY_COLOR_CHOICES = [
  "#16a34a", "#2563eb", "#ea580c", "#db2777",
  "#4f46e5", "#0891b2", "#a16207", "#7c3aed",
  "#dc2626", "#0d9488", "#65a30d", "#71717a",
  // Seconda serie.
  "#15803d", "#0284c7", "#92400e", "#e11d48",
  "#9333ea", "#059669", "#ca8a04", "#c026d3",
  "#831843", "#475569",
];

/**
 * Le icone raggruppate per ambito di spesa.
 *
 * Erano sedici in un blocco unico, e per una categoria come "Carburante" o
 * "Rate del prestito" non c'era niente di adatto: si finiva su `repeat` o
 * `wrench`, che nell'elenco spese non dicono niente. Con quarantaquattro un
 * elenco piatto diventa pero' un muro da scorrere — da qui le intestazioni:
 * chi cerca il simbolo della banca guarda "Denaro" e ha finito.
 *
 * Ogni nome va verificato sui file di `lucide-react-native`: `Icon` ripiega
 * in silenzio su `CircleHelp` quando non esiste, quindi un refuso non rompe
 * niente e non si vede finche' non si apre il foglio.
 */
export const CATEGORY_ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: "Casa e utenze",
    icons: [
      "house", "plug-zap", "flame", "droplet",
      "wifi", "washing-machine", "building-2", "wrench",
    ],
  },
  {
    label: "Trasporti",
    icons: [
      "car", "fuel", "train-front", "plane",
      "bike", "circle-parking",
    ],
  },
  {
    label: "Spesa e cibo",
    icons: [
      "shopping-cart", "utensils", "coffee", "pizza",
      "wine", "shopping-bag",
    ],
  },
  {
    label: "Denaro",
    icons: [
      "landmark", "banknote", "credit-card", "hand-coins",
      "piggy-bank", "receipt", "shield-check", "repeat",
    ],
  },
  {
    label: "Persona e salute",
    icons: [
      "heart-pulse", "pill", "dumbbell", "scissors",
      "shirt", "graduation-cap", "baby", "cat", "dog",
    ],
  },
  {
    label: "Tempo libero",
    icons: [
      "film", "music", "gamepad-2", "ticket",
      "book", "bed-double", "gift",
    ],
  },
];

/**
 * Icona di partenza di una categoria nuova.
 *
 * Dichiarata invece che presa come primo elemento della lista: cosi' e' una
 * scelta, non una conseguenza dell'ordine dei gruppi — che infatti e'
 * cambiato quando le icone sono passate da sedici a quarantaquattro.
 */
export const DEFAULT_CATEGORY_ICON = "shopping-cart";

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
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? CATEGORY_COLOR_CHOICES[0]);
    setIcon(editing?.icon ?? DEFAULT_CATEGORY_ICON);
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
      {/* Riquadro con scorrimento proprio, non l'elenco disteso: a
          quarantaquattro icone il tasto "Salva" finirebbe due schermate sotto
          il campo del nome, e per salvare una categoria si dovrebbe scorrere
          tutto il catalogo. Cosi' nome, colore, icona e Salva restano visibili
          insieme, e il catalogo scorre dentro il suo riquadro. */}
      <ScrollView
        style={[styles.iconBox, { borderColor: palette.hairline }]}
        contentContainerStyle={styles.iconBoxContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {CATEGORY_ICON_GROUPS.map((gruppo) => (
          <View key={gruppo.label} style={styles.iconGroup}>
            <Text style={[styles.groupLabel, { color: palette.ink3 }]}>
              {gruppo.label}
            </Text>
            <View style={styles.grid}>
              {gruppo.icons.map((choice) => (
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: icon === choice }}
                  accessibilityLabel={choice}
                >
                  <Icon
                    name={choice}
                    size={17}
                    color={
                      icon === choice ? categoryColor(color, dark) : palette.ink3
                    }
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

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
  // Il `gap` del foglio separa gia' i campi fra loro: dentro l'elenco icone
  // serve un passo piu' stretto, altrimenti i sei gruppi si leggono come sei
  // sezioni diverse invece che come un unico selettore.
  iconGroup: { gap: 7 },
  groupLabel: { ...type.caption },
  iconBox: {
    // Circa tre gruppi a vista: abbastanza da far capire che l'elenco
    // continua, poco abbastanza da lasciare il tasto Salva sullo schermo.
    maxHeight: 268,
    borderWidth: 1,
    borderRadius: radius.field,
  },
  iconBoxContent: { padding: 11, gap: space.sm },
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
