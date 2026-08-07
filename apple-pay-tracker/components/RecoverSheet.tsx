import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { recoverFromFile } from "../lib/recoverPayments";
import { radius, space, type } from "../lib/theme";

/**
 * Recupera le spese che l'automazione non e' riuscita a mandare.
 *
 * Si sceglie il file a mano invece di leggerlo da un percorso fisso perche'
 * iOS non da' accesso diretto a iCloud Drive: il selettore di sistema e'
 * l'unico modo, e ha il vantaggio di funzionare ovunque l'utente abbia deciso
 * di salvarlo.
 */
export function RecoverSheet({ onDone }: { onDone: () => void }) {
  const { palette } = useTheme();
  const [running, setRunning] = useState(false);

  async function scegli() {
    const scelta = await DocumentPicker.getDocumentAsync({
      // Il file lo scrive la Shortcut come testo semplice; `*/*` evita che
      // iOS lo nasconda solo perche' l'estensione non e' quella attesa.
      type: ["public.plain-text", "public.json", "*/*"],
      copyToCacheDirectory: true,
    });

    const file = scelta.assets?.[0];
    if (scelta.canceled || !file) return;

    setRunning(true);
    try {
      const { importate, duplicate, illeggibili } = await recoverFromFile(
        file.uri
      );

      const righe = [
        `${importate} ${importate === 1 ? "spesa importata" : "spese importate"}.`,
      ];
      // I doppioni si dicono perche' altrimenti "0 importate" sembrerebbe un
      // guasto quando invece vuol dire che erano gia' tutte arrivate.
      if (duplicate > 0) {
        righe.push(
          `${duplicate} erano già registrate e sono state saltate.`
        );
      }
      if (illeggibili > 0) {
        righe.push(
          `${illeggibili} ${illeggibili === 1 ? "riga non era leggibile" : "righe non erano leggibili"} e ${illeggibili === 1 ? "è stata saltata" : "sono state saltate"}: controllale nel file.`
        );
      }

      Alert.alert("Recupero completato", righe.join("\n\n"));
      onDone();
    } catch (error) {
      Alert.alert(
        "Recupero non riuscito",
        error instanceof Error ? error.message : "Riprova fra poco."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface2 }]}>
      <View style={styles.head}>
        <Icon name="file-up" size={16} color={palette.ink2} />
        <Text style={[styles.title, { color: palette.ink }]}>
          Recupera spese non inviate
        </Text>
      </View>

      <Text style={[styles.body, { color: palette.ink3 }]}>
        Quando il telefono è offline al momento del pagamento, l'automazione
        scrive la spesa in un file invece di perderla. Da qui la rileggi: i
        doppioni vengono riconosciuti e saltati, quindi puoi importare lo stesso
        file più volte senza fare danni.
      </Text>

      <TouchableOpacity
        style={[styles.button, { borderColor: palette.hairline }]}
        onPress={scegli}
        disabled={running}
        accessibilityRole="button"
      >
        {running ? (
          <ActivityIndicator color={palette.accent} />
        ) : (
          <Text style={[styles.buttonText, { color: palette.accent }]}>
            Scegli il file
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { ...type.bodyMedium },
  body: { ...type.small, lineHeight: 16 },
  button: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.caption, fontWeight: "500" },
});
