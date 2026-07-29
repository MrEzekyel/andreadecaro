import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { type } from "../lib/theme";

export type LetterOption<T extends string> = {
  value: T;
  /** La lettera mostrata: "W", "M", "A". */
  letter: string;
  /** Detto per esteso a chi usa VoiceOver, che una lettera sola non basta. */
  label: string;
};

type Props<T extends string> = {
  options: LetterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Interruttore ridotto a due lettere, da appoggiare in alto a destra di un
 * grafico.
 *
 * Le lettere sono distanziate e hanno un'area di tocco piu' larga del glifo:
 * due caratteri accostati sarebbero un bersaglio troppo piccolo e si
 * finirebbe per selezionare quello sbagliato.
 */
export function LetterToggle<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const { palette } = useTheme();

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={styles.hit}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.letter,
                {
                  color: active ? palette.ink : palette.ink3,
                  fontWeight: active ? "600" : "400",
                },
              ]}
            >
              {option.letter}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  hit: { paddingHorizontal: 4, paddingVertical: 2 },
  letter: { ...type.caption, fontSize: 12.5, letterSpacing: 0.4 },
});
