import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Merchant } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /**
   * Scattato solo quando si sceglie dall'elenco, non quando si scrive.
   *
   * La categoria arriva gia' risolta sull'insegna quando il punto vendita non
   * ne ha una propria: chi chiama non deve rifare la stessa regola.
   */
  onPick?: (merchant: Merchant, categoryId: string | null) => void;
  placeholder?: string;
};

/** Massimo di suggerimenti: oltre, l'elenco copre il resto del foglio. */
const MAX = 5;

/** Minuscole e senza accenti: "Caffè" si deve trovare scrivendo "caffe". */
function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nome dell'esercente: si scrive, oppure si sceglie fra quelli gia' usati.
 *
 * Serve a non moltiplicare lo stesso esercente per una lettera diversa.
 * "Esselunga", "esselunga" ed "Esselunga " sono gia' la stessa riga grazie
 * alla normalizzazione, ma "Esselunga Spa" no: da li' in poi sono due voci
 * distinte in "dove spendo di piu'", due categorie da correggere, e nessuna
 * schermata lo segnala perche' ogni riga presa da sola sembra giusta.
 *
 * Non e' un elenco a discesa: e' un campo di testo che *propone*. Chi paga in
 * un posto nuovo deve poter scrivere e basta, senza passare da "crea nuovo".
 */
export function MerchantPicker({ value, onChange, onPick, placeholder }: Props) {
  const { merchants, categoryById, merchantById } = useData();
  const { palette, dark } = useTheme();
  const [focused, setFocused] = useState(false);
  // Scegliere dall'elenco riempie il campo: senza questo, il testo appena
  // scelto tornerebbe subito a filtrare e l'elenco resterebbe aperto sotto la
  // scelta appena fatta.
  const [picked, setPicked] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const needle = fold(value);
    if (!focused || needle.length < 2 || picked === value) return [];

    const matches: { merchant: Merchant; startsWith: boolean }[] = [];

    for (const merchant of merchants) {
      const name = fold(merchant.display_name);
      if (name === needle) continue; // gia' scritto per intero: non serve
      const at = name.indexOf(needle);
      if (at === -1) continue;
      matches.push({ merchant, startsWith: at === 0 });
    }

    // Chi inizia col testo scritto viene prima: e' quasi sempre quello
    // cercato, e su un elenco corto l'ordine decide cosa si vede.
    matches.sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.merchant.display_name.localeCompare(b.merchant.display_name, "it");
    });

    return matches.slice(0, MAX).map((m) => m.merchant);
  }, [merchants, value, focused, picked]);

  function choose(merchant: Merchant) {
    const brand = merchant.parent_id ? merchantById(merchant.parent_id) : undefined;
    setPicked(merchant.display_name);
    onChange(merchant.display_name);
    onPick?.(merchant, merchant.category_id ?? brand?.category_id ?? null);
  }

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(text) => {
          setPicked(null);
          onChange(text);
        }}
        onFocus={() => setFocused(true)}
        // Senza il ritardo il tocco su un suggerimento arriva dopo la chiusura
        // dell'elenco e non seleziona niente.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? "Es. Esselunga"}
        placeholderTextColor={palette.ink3}
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.hairline,
            color: palette.ink,
          },
        ]}
      />

      {suggestions.length > 0 && (
        <View
          style={[
            styles.list,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          {suggestions.map((merchant, index) => {
            const category = categoryById(merchant.category_id);
            const brand = merchant.parent_id
              ? merchantById(merchant.parent_id)
              : undefined;
            // La categoria del punto vendita, o quella dell'insegna: e' la
            // stessa regola che applica `resolve_merchant` al salvataggio, e
            // mostrarla qui e' il modo di far vedere *prima* cosa succede
            // scegliendo un esercente gia' noto invece di riscriverlo.
            const shown = category ?? categoryById(brand?.category_id ?? null);

            return (
              <TouchableOpacity
                key={merchant.id}
                onPress={() => choose(merchant)}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline },
                ]}
                accessibilityRole="button"
              >
                <View style={styles.rowMain}>
                  <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                    {merchant.display_name}
                  </Text>
                  {brand && (
                    <Text style={[styles.brand, { color: palette.ink3 }]} numberOfLines={1}>
                      {brand.display_name}
                    </Text>
                  )}
                </View>

                {shown && (
                  <View style={styles.category}>
                    <Icon
                      name={shown.icon}
                      size={13}
                      color={categoryColor(shown.color, dark)}
                    />
                    <Text style={[styles.categoryName, { color: palette.ink3 }]}>
                      {shown.name}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  list: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: radius.field,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  rowMain: { flex: 1, gap: 1 },
  name: { ...type.body },
  brand: { ...type.small },
  category: { flexDirection: "row", alignItems: "center", gap: 5 },
  categoryName: { ...type.small },
});
