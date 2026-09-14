import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, type } from "../lib/theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Massimo di suggerimenti: oltre, l'elenco copre il resto del foglio. */
const MAX = 5;

/** Minuscole e senza accenti: "Bonus" si deve trovare scrivendo "bonus". */
function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nome della fonte di un introito: si scrive, oppure si sceglie fra quelle
 * gia' usate — stesso pattern di `MerchantPicker` per l'esercente, ma qui
 * non c'e' una tabella dedicata come `merchants`. L'elenco si ricava dai
 * valori distinti gia' presenti in `incomes.label` (RLS lo scopre gia' al
 * solo utente), letti una volta sola al montaggio come fa `CardPicker` per
 * i metodi di pagamento.
 *
 * Non e' un elenco a discesa: e' un campo di testo che *propone*. Chi
 * registra una fonte nuova deve poter scrivere e basta, senza passare da
 * "crea nuova".
 */
export function IncomeSourcePicker({ value, onChange, placeholder }: Props) {
  const { palette } = useTheme();
  const [known, setKnown] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  // Scegliere dall'elenco riempie il campo: senza questo, il testo appena
  // scelto tornerebbe subito a filtrare e l'elenco resterebbe aperto sotto
  // la scelta appena fatta.
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("incomes")
      .select("label")
      // Serve solo un campione di nomi distinti per suggerirli, non ogni
      // entrata mai registrata: senza un limite, PostgREST tronca comunque
      // a 1000 righe (silenziosamente) dopo anni d'uso — meglio chiederne
      // esplicitamente un numero ragionevole, dalle più recenti.
      .order("occurred_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const names = new Set<string>();
        for (const row of data) {
          if (row.label) names.add(row.label);
        }
        setKnown(Array.from(names).sort((a, b) => a.localeCompare(b, "it")));
      });
  }, []);

  const suggestions = useMemo(() => {
    const needle = fold(value);
    if (!focused || needle.length < 2 || picked === value) return [];

    const matches: { name: string; startsWith: boolean }[] = [];

    for (const name of known) {
      const folded = fold(name);
      if (folded === needle) continue; // gia' scritto per intero: non serve
      const at = folded.indexOf(needle);
      if (at === -1) continue;
      matches.push({ name, startsWith: at === 0 });
    }

    // Chi inizia col testo scritto viene prima: e' quasi sempre quello
    // cercato, e su un elenco corto l'ordine decide cosa si vede.
    matches.sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.name.localeCompare(b.name, "it");
    });

    return matches.slice(0, MAX).map((m) => m.name);
  }, [known, value, focused, picked]);

  function choose(name: string) {
    setPicked(name);
    onChange(name);
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
        // Senza il ritardo il tocco su un suggerimento arriva dopo la
        // chiusura dell'elenco e non seleziona niente.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? "Es. Stipendio"}
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
          {suggestions.map((name, index) => (
            <TouchableOpacity
              key={name}
              onPress={() => choose(name)}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
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
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  name: { ...type.body },
});
