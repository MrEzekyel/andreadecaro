import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert(
        "Dati non validi",
        "Inserisci un'email valida e una password di almeno 6 caratteri."
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
        "Registrazione effettuata",
        "Se la conferma email è attiva sul progetto Supabase, controlla la posta prima di accedere."
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apple Pay Tracker</Text>
      <Text style={styles.subtitle}>
        {mode === "signin"
          ? "Accedi con la tua email per vedere i tuoi pagamenti."
          : "Crea il tuo account personale (una tantum)."}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="tuaemail@esempio.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === "signin" ? "Accedi" : "Registrati"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchMode}
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        <Text style={styles.switchModeText}>
          {mode === "signin"
            ? "Non hai un account? Registrati"
            : "Hai già un account? Accedi"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  switchMode: { marginTop: 16, alignItems: "center" },
  switchModeText: { color: "#555", fontSize: 14 },
});
