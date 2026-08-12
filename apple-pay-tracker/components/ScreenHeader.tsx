import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNav } from "../lib/NavContext";
import { useTheme } from "../lib/ThemeContext";
import { type } from "../lib/theme";
import { Icon } from "./Icon";

/**
 * Titolo di una scheda con l'ingranaggio delle Impostazioni a destra.
 *
 * Solo sulle quattro schede principali, mai sulle pagine di dettaglio: quelle
 * hanno gia' un tasto Indietro, e un secondo modo di uscire accanto
 * confonderebbe quale dei due riporta dove. Impostazioni non e' una scheda a
 * se' (vedi CLAUDE.md) proprio perche' e' una destinazione che si configura,
 * non si guarda — ma deve restare raggiungibile da ogni scheda che si guarda,
 * non solo da Home.
 */
export function ScreenHeader({ title }: { title: string }) {
  const { palette } = useTheme();
  const { openSettings } = useNav();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
      <TouchableOpacity
        onPress={() => openSettings("root")}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Impostazioni"
      >
        <Icon name="settings" size={20} color={palette.ink3} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...type.title },
});
