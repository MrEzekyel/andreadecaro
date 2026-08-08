import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { space, type } from "../lib/theme";

type Props = {
  /** Gia' pronto per la lettura: "aggiornato alle 09:14". */
  label: string;
  /**
   * Messaggio tecnico della lettura fallita.
   *
   * Non e' sempre "manca la rete": il progetto in pausa o un errore RLS
   * falliscono a connessione perfettamente funzionante, e dire "senza
   * connessione" manderebbe l'utente a controllare il proprio telefono per un
   * problema che non e' suo.
   */
  reason?: string | null;
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
export function StaleNote({ label, reason, onRetry }: Props) {
  const { palette } = useTheme();

  const rete = reason
    ? /network|fetch|timeout|connection|abort/i.test(reason)
    : true;

  return (
    <View style={styles.row}>
      <Icon name={rete ? "cloud-off" : "circle-alert"} size={13} color={palette.ink3} />
      <Text style={[styles.text, { color: palette.ink3 }]} numberOfLines={2}>
        {rete ? "Senza connessione" : "Dati non aggiornati"} · {label}
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
