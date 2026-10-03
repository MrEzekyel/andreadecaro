import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../lib/ThemeContext";

/**
 * Il tasto che riporta un grafico ingrandito al periodo intero.
 *
 * Il doppio tocco fa la stessa cosa, ma non si scopre da solo: un grafico
 * ingrandito senza un modo visibile di tornare indietro sembra rotto, con
 * una parte del mese sparita.
 */
export function ZoomReset({ onPress }: { onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.chip, { backgroundColor: palette.surface2 }]}
    >
      <Text style={[styles.text, { color: palette.ink2 }]}>Tutto il periodo</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: { fontSize: 10, fontWeight: "500" },
});
