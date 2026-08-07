import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";

/**
 * Segna che c'e' un cambio password iniziato e non concluso.
 *
 * Vive su disco e non in memoria perche' deve sopravvivere alla chiusura
 * dell'app: e' l'unica cosa che distingue "sessione legittima" da "sessione
 * aperta da verifyOtp e mai completata".
 */
export const RECOVERY_FLAG = "recupero-password-in-corso";

type Mode = "signin" | "signup" | "recover";

type Props = {
  /**
   * Segnala che c'e' un recupero password a meta' strada.
   *
   * `verifyOtp` apre una sessione vera, quindi senza questo segnale l'app
   * salterebbe dentro nel momento esatto in cui il codice viene accettato —
   * cioe' prima che la password nuova sia stata scritta. Se poi `updateUser`
   * fallisse, l'utente si troverebbe dentro con la vecchia password e nessuno
   * glielo direbbe.
   */
  onRecoveringChange?: (recovering: boolean) => void;
};

export default function AuthScreen({ onRecoveringChange }: Props) {
  const { palette } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /** Nel recupero: `false` chiede l'email, `true` chiede codice e password. */
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");

  function goTo(next: Mode) {
    setMode(next);
    setCodeSent(false);
    setCode("");
    setPassword("");
    setShowPassword(false);
  }

  async function submit() {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert(
        "Dati non validi",
        "Serve un'email valida e una password di almeno 6 caratteri."
      );
      return;
    }

    setLoading(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }

    if (mode === "signup") {
      Alert.alert(
        "Account creato",
        "Se il progetto Supabase richiede la conferma via email, controlla la posta prima di accedere."
      );
    }
  }

  async function sendCode() {
    if (!email.includes("@")) {
      Alert.alert("Email non valida", "Controlla l'indirizzo e riprova.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert("Non è stato possibile inviare il codice", error.message);
      return;
    }

    // Supabase risponde allo stesso modo se l'email non esiste, per non
    // rivelare quali indirizzi sono registrati. Il messaggio lo rispecchia
    // invece di promettere un codice che potrebbe non arrivare mai.
    setCodeSent(true);
    Alert.alert(
      "Controlla la posta",
      `Se esiste un account per ${email}, fra pochi istanti riceverai un codice a sei cifre.`
    );
  }

  async function resetPassword() {
    if (code.trim().length < 6) {
      Alert.alert("Codice incompleto", "Inserisci le sei cifre che hai ricevuto.");
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        "Password troppo corta",
        "La nuova password deve avere almeno 6 caratteri."
      );
      return;
    }

    setLoading(true);
    onRecoveringChange?.(true);
    // Marcatore persistente, non solo stato in memoria: `verifyOtp` apre una
    // sessione vera e la salva su AsyncStorage, quindi chiudendo l'app fra le
    // due chiamate al rilancio si entrerebbe con la vecchia password credendo
    // di averla cambiata. Al prossimo avvio App.tsx trova questo marcatore e
    // chiude la sessione a meta' invece di fidarsene.
    await AsyncStorage.setItem(RECOVERY_FLAG, email);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "recovery",
    });

    if (verifyError) {
      await AsyncStorage.removeItem(RECOVERY_FLAG);
      onRecoveringChange?.(false);
      setLoading(false);
      Alert.alert(
        "Codice non valido",
        "Il codice è sbagliato o è scaduto. Richiedine uno nuovo."
      );
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      // La sessione aperta da verifyOtp resta valida ma la password e' ancora
      // quella vecchia: restare dentro darebbe l'idea che abbia funzionato.
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(RECOVERY_FLAG);
      onRecoveringChange?.(false);
      setLoading(false);
      Alert.alert("Non è stato possibile salvare la password", updateError.message);
      return;
    }

    await AsyncStorage.removeItem(RECOVERY_FLAG);
    setLoading(false);
    onRecoveringChange?.(false);
    goTo("signin");
  }

  const recovering = mode === "recover";
  const title = recovering
    ? codeSent
      ? "Scegli una nuova password"
      : "Recupera l'accesso"
    : "Apple Pay Tracker";
  const subtitle = recovering
    ? codeSent
      ? `Inserisci il codice inviato a ${email} e la password che vuoi usare da ora.`
      : "Ti mandiamo un codice via email per reimpostare la password."
    : mode === "signin"
      ? "Accedi per vedere le tue spese."
      : "Crea il tuo account personale.";

  const passwordPlaceholder = recovering ? "Nuova password" : "Password";
  const action = recovering
    ? codeSent
      ? resetPassword
      : sendCode
    : submit;
  const actionLabel = recovering
    ? codeSent
      ? "Salva e accedi"
      : "Invia il codice"
    : mode === "signin"
      ? "Accedi"
      : "Registrati";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: palette.ground }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>{subtitle}</Text>

        {/* Nel secondo passo l'email non si tocca piu': il codice e' legato a
            quell'indirizzo, e cambiarlo qui lo renderebbe silenziosamente
            invalido. */}
        {!(recovering && codeSent) && (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="tuaemail@esempio.com"
            placeholderTextColor={palette.ink3}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                color: palette.ink,
              },
            ]}
          />
        )}

        {recovering && codeSent && (
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Codice a sei cifre"
            placeholderTextColor={palette.ink3}
            autoCapitalize="none"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            style={[
              styles.input,
              styles.code,
              {
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                color: palette.ink,
              },
            ]}
          />
        )}

        {!(recovering && !codeSent) && (
          <View
            style={[
              styles.input,
              styles.passwordField,
              {
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
              },
            ]}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={passwordPlaceholder}
              placeholderTextColor={palette.ink3}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={recovering ? "new-password" : "password"}
              style={[styles.passwordInput, { color: palette.ink }]}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Nascondi la password" : "Mostra la password"
              }
            >
              <Icon
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={palette.ink3}
              />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={action}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.onAccent} />
          ) : (
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              {actionLabel}
            </Text>
          )}
        </TouchableOpacity>

        {recovering && codeSent && (
          <TouchableOpacity
            style={styles.switch}
            onPress={sendCode}
            disabled={loading}
          >
            <Text style={[styles.switchText, { color: palette.ink2 }]}>
              Non è arrivato? Invia un altro codice
            </Text>
          </TouchableOpacity>
        )}

        {mode === "signin" && (
          <TouchableOpacity
            style={styles.switch}
            onPress={() => goTo("recover")}
          >
            <Text style={[styles.switchText, { color: palette.ink2 }]}>
              Password dimenticata?
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.switch}
          onPress={() => goTo(mode === "signin" ? "signup" : "signin")}
        >
          <Text style={[styles.switchText, { color: palette.ink2 }]}>
            {mode === "signin"
              ? "Non hai un account? Registrati"
              : mode === "signup"
                ? "Hai già un account? Accedi"
                : "Torna all'accesso"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  inner: { padding: space.xxl, gap: space.md },
  title: { ...type.hero, fontSize: 30, marginBottom: 2 },
  subtitle: { ...type.body, marginBottom: space.md, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...type.body,
    fontSize: 15,
  },
  code: {
    fontSize: 20,
    letterSpacing: 6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 0,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    ...type.body,
    fontSize: 15,
  },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.bodyMedium, fontSize: 15 },
  switch: { alignItems: "center", paddingVertical: space.sm },
  switchText: { ...type.caption },
});
