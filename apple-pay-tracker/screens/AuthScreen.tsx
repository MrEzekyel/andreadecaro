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

  /**
   * Quale conferma stiamo aspettando, se ne aspettiamo una.
   *
   * `"signup"` dopo la registrazione, `"recovery"` dopo la richiesta di
   * recupero. Un solo campo invece di due booleani, perche' i due stati si
   * escludono e tenerli separati permetterebbe di finire in entrambi.
   */
  const [pendingCode, setPendingCode] = useState<null | "signup" | "recovery">(
    null
  );
  const [code, setCode] = useState("");

  function goTo(next: Mode) {
    setMode(next);
    setPendingCode(null);
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

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (!error) return;

      // Chi ha annullato sulla schermata del codice (o ha chiuso l'app: e'
      // stato in memoria) ha un account che esiste ma non e' confermato.
      // Riprovando ad accedere si prenderebbe "Email not confirmed" — in
      // inglese, dentro un'app in italiano, senza nessuna strada visibile per
      // tornare al codice. E' il momento di massimo abbandono: un utente nuovo
      // che non ha ancora niente dentro. Lo si riporta dov'era.
      if (/not confirmed|email_not_confirmed/i.test(error.message)) {
        setPendingCode("signup");
        // L'esito del reinvio va guardato: GoTrue limita la frequenza, e dopo
        // due tentativi di accesso ravvicinati risponde "you can only request
        // this after N seconds". Affermare di aver mandato un codice che non
        // partira' lascerebbe ad aspettare una mail che non arriva, proprio
        // nel momento di massimo abbandono.
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
        });
        Alert.alert(
          "Manca la conferma dell'indirizzo",
          resendError
            ? `Il tuo indirizzo non è ancora confermato. Non è stato possibile rimandarti il codice adesso (${resendError.message}): usa "Invia un altro codice" fra qualche istante.`
            : `Ti abbiamo rimandato un codice a ${email}. Inseriscilo per completare la registrazione.`
        );
        return;
      }

      Alert.alert("Errore", error.message);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }

    // Con la conferma via email attiva `signUp` non apre nessuna sessione: si
    // chiede il codice. Con la conferma disattivata la sessione arriva subito
    // e si e' gia' dentro. Si guarda cosa e' tornato invece di assumere una
    // delle due configurazioni: cambiarla sulla dashboard non deve rompere
    // l'app.
    if (data.session) return;

    setPendingCode("signup");
    // Con la protezione contro l'enumerazione degli indirizzi, `signUp` su una
    // email gia' registrata e confermata risponde esattamente come su una
    // nuova. Affermare "ti abbiamo mandato un codice" farebbe aspettare un
    // codice che non arrivera' mai: si usa la stessa cautela di `sendCode`.
    Alert.alert(
      "Controlla la posta",
      `Se ${email} non è già registrata, riceverai un codice a sei cifre. Serve a confermare che l'indirizzo è tuo: senza, un domani non potresti recuperare la password.`
    );
  }

  /** Conferma l'indirizzo con il codice ricevuto, e con quello entra. */
  async function confirmSignup() {
    if (code.trim().length < 6) {
      Alert.alert("Codice incompleto", "Inserisci le sei cifre che hai ricevuto.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    setLoading(false);

    if (error) {
      Alert.alert(
        "Codice non valido",
        "Il codice è sbagliato o è scaduto. Richiedine uno nuovo."
      );
      return;
    }
  }

  async function resendSignupCode() {
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
    Alert.alert(
      error ? "Non è stato possibile inviare il codice" : "Codice inviato",
      error ? error.message : `Controlla la posta di ${email}.`
    );
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
    setPendingCode("recovery");
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
  const attesaRecupero = pendingCode === "recovery";
  const attesaRegistrazione = pendingCode === "signup";

  const title = attesaRegistrazione
    ? "Conferma il tuo indirizzo"
    : attesaRecupero
      ? "Scegli una nuova password"
      : recovering
        ? "Recupera l'accesso"
        : "Apple Pay Tracker";

  const subtitle = attesaRegistrazione
    ? `Inserisci il codice che abbiamo mandato a ${email}.`
    : attesaRecupero
      ? `Inserisci il codice inviato a ${email} e la password che vuoi usare da ora.`
      : recovering
        ? "Ti mandiamo un codice via email per reimpostare la password."
        : mode === "signin"
          ? "Accedi per vedere le tue spese."
          : "Crea il tuo account personale.";

  const passwordPlaceholder = recovering ? "Nuova password" : "Password";

  const action = attesaRegistrazione
    ? confirmSignup
    : attesaRecupero
      ? resetPassword
      : recovering
        ? sendCode
        : submit;

  const actionLabel = attesaRegistrazione
    ? "Conferma ed entra"
    : attesaRecupero
      ? "Salva e accedi"
      : recovering
        ? "Invia il codice"
        : mode === "signin"
          ? "Accedi"
          : "Registrati";

  /** L'email non si tocca piu' finche' un codice e' in volo: e' legato a quella. */
  const mostraEmail = pendingCode === null;
  const mostraCodice = pendingCode !== null;
  /** In registrazione la password l'ha gia' scelta; nel recupero la sceglie ora. */
  const mostraPassword = attesaRecupero || (!recovering && pendingCode === null);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: palette.ground }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>{subtitle}</Text>

        {/* Con un codice in volo l'email non si tocca piu': il codice e' legato
            a quell'indirizzo, e cambiarlo qui lo renderebbe silenziosamente
            invalido. */}
        {mostraEmail && (
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

        {mostraCodice && (
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

        {mostraPassword && (
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

        {mostraCodice && (
          <TouchableOpacity
            style={styles.switch}
            onPress={attesaRegistrazione ? resendSignupCode : sendCode}
            disabled={loading}
          >
            <Text style={[styles.switchText, { color: palette.ink2 }]}>
              Non è arrivato? Invia un altro codice
            </Text>
          </TouchableOpacity>
        )}

        {mode === "signin" && pendingCode === null && (
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
          onPress={() => goTo(mode === "signin" && !pendingCode ? "signup" : "signin")}
        >
          <Text style={[styles.switchText, { color: palette.ink2 }]}>
            {pendingCode !== null
              ? "Annulla"
              : mode === "signin"
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
