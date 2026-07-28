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

export default function AuthScreen() {
  const { palette } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: palette.ground }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: palette.ink }]}>
          Apple Pay Tracker
        </Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>
          {mode === "signin"
            ? "Accedi per vedere le tue spese."
            : "Crea il tuo account personale."}
        </Text>

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
            placeholder="Password"
            placeholderTextColor={palette.ink3}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
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

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.onAccent} />
          ) : (
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              {mode === "signin" ? "Accedi" : "Registrati"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switch}
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          <Text style={[styles.switchText, { color: palette.ink2 }]}>
            {mode === "signin"
              ? "Non hai un account? Registrati"
              : "Hai già un account? Accedi"}
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
