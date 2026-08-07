import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { RecoverSheet } from "../components/RecoverSheet";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { IngestToken } from "../lib/types";

const INGEST_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ingest-payment`;

export default function AutomationsScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();

  const [tokens, setTokens] = useState<IngestToken[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("ingest_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    setError(failure?.message ?? null);
    if (!failure) setTokens((data ?? []) as IngestToken[]);
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const activeTokens = tokens.filter((t) => !t.revoked_at).length;

  async function generateToken() {
    const { data, error } = await supabase.rpc("create_ingest_token", {
      p_label: "Shortcut iPhone",
    });
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    setFreshToken(data as string);
    await loadTokens();
  }

  async function copy(value: string, what: string) {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copiato", `${what} copiato negli appunti.`);
  }

  function revoke(id: string) {
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
            await loadTokens();
          },
        },
      ]
    );
  }

  return (
    <SwipeBack onBack={onBack}>
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          hitSlop={backHitSlop}
        >
          <Icon name="chevron-left" size={20} color={palette.ink} />
          <Text style={[styles.title, { color: palette.ink }]}>Automazioni</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Detto qui e non solo nel README: e' la schermata in cui uno decide
            se fidarsi dell'automazione, ed e' meglio che scopra il limite
            adesso invece che quando manca la bolletta della luce. */}
        <Text style={[styles.intro, { color: palette.ink2 }]}>
          L'automazione vede i pagamenti <Text style={{ fontWeight: "500" }}>Apple Pay</Text>{" "}
          e li registra da sola. Non vede contanti, bonifici, addebiti diretti
          né le carte fisiche fuori da Wallet: quelli si aggiungono a mano o
          con Siri.
        </Text>

        <Text style={[styles.label, { color: palette.ink3 }]}>
          Collegamento Shortcut
        </Text>

        <TouchableOpacity
          onPress={() => copy(INGEST_URL, "URL")}
          style={[
            styles.urlBox,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <Text style={[styles.url, { color: palette.ink }]} numberOfLines={2}>
            {INGEST_URL}
          </Text>
          <Text style={[styles.hint, { color: palette.ink3 }]}>
            Tocca per copiare
          </Text>
        </TouchableOpacity>

        {freshToken && (
          <View style={[styles.fresh, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.freshLabel, { color: palette.accent }]}>
              Nuovo token — copialo adesso
            </Text>
            <Text style={[styles.freshToken, { color: palette.ink }]} selectable>
              {freshToken}
            </Text>
            <View style={styles.freshActions}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: palette.accent }]}
                onPress={() => copy(freshToken, "Token")}
              >
                <Text style={[styles.smallBtnText, { color: palette.onAccent }]}>
                  Copia
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { borderColor: palette.hairline, borderWidth: 1 }]}
                onPress={() => setFreshToken(null)}
              >
                <Text style={[styles.smallBtnText, { color: palette.ink2 }]}>
                  Fatto
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={generateToken}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Genera nuovo token
          </Text>
        </TouchableOpacity>

        {tokens.map((token) => (
          <View key={token.id} style={styles.tokenRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tokenLabel, { color: palette.ink }]}>
                {token.label}
                {token.revoked_at ? " · revocato" : ""}
              </Text>
              <Text style={[styles.tokenMeta, { color: palette.ink3 }]}>
                ultimo uso{" "}
                {token.last_used_at
                  ? new Date(token.last_used_at).toLocaleDateString("it-IT")
                  : "mai"}
              </Text>
            </View>
            {!token.revoked_at && (
              <TouchableOpacity onPress={() => revoke(token.id)}>
                <Text style={[styles.revoke, { color: palette.over }]}>
                  Revoca
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* L'elenco dei token vuoto e "non sono riuscito a leggerli" portano a
            due azioni opposte: generarne uno, o riprovare. */}
        {error && <LoadError message={error} onRetry={loadTokens} />}

        <RecoverSheet onDone={loadTokens} />

        {!error && (
        <Text style={[styles.note, { color: palette.ink3 }]}>
          {activeTokens === 0
            ? "Genera un token e incollalo nell'intestazione x-ingest-token della Shortcut."
            : "Il token si vede una volta sola. Se lo perdi, generane un altro e revoca il vecchio."}
        </Text>
        )}
      </ScrollView>
    </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  intro: { ...type.body, lineHeight: 21, marginBottom: space.xs },
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 18,
  },
  title: { ...type.title },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  label: { ...type.label },
  urlBox: {
    borderRadius: radius.field,
    borderWidth: 1,
    padding: 12,
  },
  url: { ...type.caption },
  hint: { ...type.small, fontSize: 10.5, marginTop: 5 },
  fresh: { borderRadius: radius.card, padding: 14, gap: 9 },
  freshLabel: { ...type.small, fontWeight: "500" },
  freshToken: { ...type.caption, lineHeight: 18 },
  freshActions: { flexDirection: "row", gap: 9 },
  smallBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  smallBtnText: { ...type.caption, fontWeight: "500" },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: space.md,
  },
  tokenLabel: { ...type.body },
  tokenMeta: { ...type.small, marginTop: 2 },
  revoke: { ...type.caption },
  note: { ...type.small, lineHeight: 17, marginTop: space.sm },
});
