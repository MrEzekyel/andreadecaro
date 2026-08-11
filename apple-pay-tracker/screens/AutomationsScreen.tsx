import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
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
import { SHORTCUT_INSTALL_URL } from "../lib/guide";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { IngestToken } from "../lib/types";

const INGEST_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ingest-payment`;

type Props = {
  onBack: () => void;
  /** Apre la guida passo per passo, il primo posto dove mandare chi arriva qui. */
  onOpenGuide?: () => void;
};

export default function AutomationsScreen({ onBack, onOpenGuide }: Props) {
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

        {/* Un solo gesto primario. Prima qui c'erano tre pulsanti che si
            contendevano l'occhio (installa, guida, genera token) e non si
            capiva da dove cominciare: la guida ora contiene tutto —
            installazione, chiave, automazione — quindi e' lei l'unico
            ingresso. Il resto della schermata e' manutenzione. */}
        <TouchableOpacity
          onPress={
            onOpenGuide ?? (() => Linking.openURL(SHORTCUT_INSTALL_URL))
          }
          style={[styles.primary, { backgroundColor: palette.accent }]}
        >
          <Icon name="book-open" size={17} color={palette.onAccent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.primaryTitle, { color: palette.onAccent }]}>
              Configura l'automazione
            </Text>
            <Text style={[styles.primaryBody, { color: palette.onAccent }]}>
              Comando pronto da installare e chiave da collegare, passo per
              passo — pochi minuti
            </Text>
          </View>
          <Icon name="chevron-right" size={15} color={palette.onAccent} />
        </TouchableOpacity>

        <Text style={[styles.label, { color: palette.ink3 }]}>
          Le tue chiavi
        </Text>

        {tokens.map((token) => (
          <View key={token.id} style={styles.tokenRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tokenLabel, { color: palette.ink }]}>
                {token.label}
                {token.revoked_at ? " · revocata" : ""}
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

        {freshToken && (
          <View style={[styles.fresh, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.freshLabel, { color: palette.accent }]}>
              Nuova chiave — copiala adesso
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

        {/* Secondario apposta (niente fondo pieno): generare una chiave fuori
            dalla guida serve solo a chi deve sostituirne una persa o
            revocata, non e' il primo passo di nessuno. */}
        <TouchableOpacity
          style={[styles.secondary, { borderColor: palette.hairline }]}
          onPress={generateToken}
        >
          <Text style={[styles.secondaryText, { color: palette.ink }]}>
            Genera una nuova chiave
          </Text>
        </TouchableOpacity>

        {!error && (
          <Text style={[styles.note, { color: palette.ink3 }]}>
            {activeTokens === 0
              ? "Nessuna chiave ancora: la crei durante la configurazione guidata."
              : "La chiave si vede una volta sola. Se la perdi, generane un'altra e revoca la vecchia."}
          </Text>
        )}

        <RecoverSheet onDone={loadTokens} />

        {/* In fondo e piccolo di proposito: serve solo a chi si costruisce
            il comando rapido da zero invece di installare quello pronto. */}
        <Text style={[styles.label, { color: palette.ink3 }]}>
          Se fai da te
        </Text>
        <TouchableOpacity onPress={() => copy(INGEST_URL, "URL")}>
          <Text style={[styles.url, { color: palette.ink3 }]} numberOfLines={2}>
            {INGEST_URL}
          </Text>
          <Text style={[styles.hint, { color: palette.ink3 }]}>
            L'indirizzo a cui il comando manda le spese — tocca per copiarlo.
            Serve solo se costruisci il comando da zero.
          </Text>
        </TouchableOpacity>
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
  label: { ...type.label, marginTop: space.sm },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: radius.card,
    padding: 14,
  },
  primaryTitle: { ...type.bodyMedium, fontSize: 15 },
  primaryBody: { ...type.small, lineHeight: 16, marginTop: 2, opacity: 0.9 },
  url: { ...type.caption },
  hint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 5 },
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
  secondary: {
    borderRadius: radius.button,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { ...type.bodyMedium, fontSize: 14 },
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
