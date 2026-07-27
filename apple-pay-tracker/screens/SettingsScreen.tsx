import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { IngestToken } from "../lib/types";

const INGEST_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ingest-payment`;

function formatDate(iso: string | null) {
  if (!iso) return "mai";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsScreen() {
  const [tokens, setTokens] = useState<IngestToken[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("ingest_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTokens(data as IngestToken[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function generateToken() {
    setGenerating(true);
    const { data, error } = await supabase.rpc("create_ingest_token", {
      p_label: "Shortcut iPhone",
    });
    setGenerating(false);

    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    setFreshToken(data as string);
    await load();
  }

  async function revokeToken(id: string) {
    Alert.alert(
      "Revocare il token?",
      "La Shortcut che lo usa smetterà di funzionare.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Revoca",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("ingest_tokens")
              .update({ revoked_at: new Date().toISOString() })
              .eq("id", id);
            if (error) {
              Alert.alert("Errore", error.message);
              return;
            }
            await load();
          },
        },
      ]
    );
  }

  async function copy(value: string, label: string) {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copiato", `${label} copiato negli appunti.`);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>URL per la Shortcut</Text>
      <TouchableOpacity
        style={styles.urlBox}
        onPress={() => copy(INGEST_URL, "URL")}
      >
        <Text style={styles.urlText} numberOfLines={2}>
          {INGEST_URL}
        </Text>
        <Text style={styles.copyHint}>Tocca per copiare</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Token di ingestione</Text>
      <Text style={styles.help}>
        La Shortcut invia questo token nell'header {"\n"}
        <Text style={styles.mono}>x-ingest-token</Text>. Viene mostrato una sola
        volta: se lo perdi, generane un altro.
      </Text>

      {freshToken && (
        <View style={styles.freshBox}>
          <Text style={styles.freshLabel}>Nuovo token — copialo adesso</Text>
          <Text style={styles.freshToken} selectable>
            {freshToken}
          </Text>
          <View style={styles.freshActions}>
            <TouchableOpacity
              style={styles.freshButton}
              onPress={() => copy(freshToken, "Token")}
            >
              <Text style={styles.freshButtonText}>Copia</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.freshButton, styles.freshButtonGhost]}
              onPress={() => setFreshToken(null)}
            >
              <Text style={styles.freshButtonGhostText}>Fatto</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={generateToken}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Genera nuovo token</Text>
        )}
      </TouchableOpacity>

      {tokens.map((token) => (
        <View key={token.id} style={styles.tokenRow}>
          <View style={styles.tokenInfo}>
            <Text style={styles.tokenLabel}>
              {token.label}
              {token.revoked_at ? " · revocato" : ""}
            </Text>
            <Text style={styles.tokenMeta}>
              creato {formatDate(token.created_at)} · ultimo uso{" "}
              {formatDate(token.last_used_at)}
            </Text>
          </View>
          {!token.revoked_at && (
            <TouchableOpacity onPress={() => revokeToken(token.id)}>
              <Text style={styles.revoke}>Revoca</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {tokens.length === 0 && (
        <Text style={styles.empty}>
          Nessun token ancora. Generane uno per collegare la Shortcut.
        </Text>
      )}

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
  },
  help: { fontSize: 13, color: "#666", lineHeight: 19, marginBottom: 14 },
  mono: { fontFamily: "Courier", fontWeight: "600", color: "#111" },
  urlBox: {
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  urlText: { fontSize: 13, color: "#111" },
  copyHint: { fontSize: 11, color: "#888", marginTop: 6 },
  freshBox: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  freshLabel: { color: "#f5c518", fontSize: 13, fontWeight: "600" },
  freshToken: {
    color: "#fff",
    fontSize: 13,
    marginTop: 10,
    lineHeight: 19,
  },
  freshActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  freshButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  freshButtonText: { color: "#111", fontWeight: "600" },
  freshButtonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#555",
  },
  freshButtonGhostText: { color: "#ddd", fontWeight: "600" },
  button: {
    backgroundColor: "#000",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  tokenInfo: { flexShrink: 1, paddingRight: 12 },
  tokenLabel: { fontSize: 15, fontWeight: "500" },
  tokenMeta: { fontSize: 12, color: "#888", marginTop: 3 },
  revoke: { color: "#c00", fontSize: 14 },
  empty: { textAlign: "center", color: "#888", marginTop: 10 },
  footerSpace: { height: 40 },
});
