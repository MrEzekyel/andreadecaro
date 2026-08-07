import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { space, type } from "../lib/theme";

type Props = {
  /** Gia' pronto per la lettura: "aggiornato alle 09:14". */
  label: string;
  onRetry?: () => void;
};

/**
 * "Questi numeri sono di prima", detto senza allarmare.
 *
 * E' il terzo stato, fra il dato fresco e l'errore: i numeri sotto sono veri,
 * solo non di adesso. Va scritto piccolo e senza colori d'allarme — un
 * riquadro rosso sopra a dati corretti farebbe dubitare di numeri giusti,
 * mentre non dire niente li spaccerebbe per aggiornati.
 */
export function StaleNote({ label, onRetry }: Props) {
  const { palette } = useTheme();

  return (
    <View style={styles.row}>
      <Icon name="cloud-off" size={13} color={palette.ink3} />
      <Text style={[styles.text, { color: palette.ink3 }]}>
        Senza connessione · {label}
      </Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.retry, { color: palette.accent }]}>Riprova</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { ...type.small, flex: 1 },
  retry: { ...type.small, fontWeight: "500" },
});
