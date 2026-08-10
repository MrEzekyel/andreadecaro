import React, { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";

type Props = {
  onUnlock: () => Promise<boolean>;
};

/**
 * Quello che si vede al posto dell'app finche' non arriva il volto giusto.
 *
 * Non mostra nessun dato — nemmeno il totale del mese in trasparenza: un
 * blocco che lascia leggere il numero dietro non blocca niente.
 */
export function LockScreen({ onUnlock }: Props) {
  const { palette } = useTheme();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Il tentativo automatico si fa una volta sola per apertura. */
  const tried = useRef(false);

  async function attempt() {
    if (busy) return;
    setBusy(true);
    const ok = await onUnlock();
    setBusy(false);
    // Un annullamento non e' un guasto: si resta qui, con il pulsante pronto.
    if (!ok) setFailed(true);
  }

  // Face ID parte da solo all'apertura: chiedere un tocco prima di provare
  // aggiungerebbe un gesto a ogni singolo avvio dell'app.
  //
  // Ma **non prima che l'app sia davvero attiva**. All'avvio a freddo iOS
  // passa da `inactive` prima di arrivare a `active`, e in quella finestra il
  // riconoscimento non si puo' presentare: il sistema ripiega sul codice del
  // telefono senza dire niente — `authenticateAsync` risponde comunque
  // "riuscito", quindi dal codice non si distingue da un Face ID andato bene.
  // E' il motivo per cui il blocco all'avvio chiedeva sempre il codice.
  useEffect(() => {
    if (tried.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (tried.current) return;
      tried.current = true;
      // Un istante dopo `active`: la transizione di stato arriva prima che la
      // finestra sia pronta a presentare la richiesta.
      timer = setTimeout(attempt, 350);
    };

    if (AppState.currentState === "active") {
      start();
    } else {
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active") {
          subscription.remove();
          start();
        }
      });
      return () => {
        subscription.remove();
        if (timer) clearTimeout(timer);
      };
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <Icon name="lock" size={30} color={palette.ink3} strokeWidth={1.4} />

      <Text style={[styles.title, { color: palette.ink }]}>
        Le tue spese sono protette
      </Text>

      <Text style={[styles.body, { color: palette.ink2 }]}>
        {failed
          ? "Sblocca con Face ID, Touch ID o il codice del telefono per continuare."
          : "Un istante…"}
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.accent }]}
        onPress={attempt}
        disabled={busy}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>
          Sblocca
        </Text>
      </TouchableOpacity>

      {/* La via d'uscita, e non e' un dettaglio: se il riconoscimento smette
          di funzionare del tutto, senza questo pulsante l'unico modo di
          rientrare nei propri dati sarebbe reinstallare l'app. Da qui si esce
          e si rientra con email e password, e il blocco si puo' spegnere. */}
      <TouchableOpacity
        style={styles.escape}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={[styles.escapeText, { color: palette.ink3 }]}>
          Esci e accedi con la password
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Copertura piena per l'anteprima che iOS scatta quando l'app esce di scena. */
export function LockCover() {
  const { palette } = useTheme();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: palette.ground }]}
      pointerEvents="none"
    >
      <Icon name="lock" size={26} color={palette.ink3} strokeWidth={1.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    gap: space.sm,
  },
  title: { ...type.title, textAlign: "center", marginTop: space.sm },
  body: { ...type.body, textAlign: "center", lineHeight: 21 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: "center",
    marginTop: space.md,
  },
  buttonText: { ...type.bodyMedium, fontSize: 15 },
  escape: { paddingVertical: space.sm, marginTop: space.xs },
  escapeText: { ...type.caption },
  cover: { alignItems: "center", justifyContent: "center" },
});
