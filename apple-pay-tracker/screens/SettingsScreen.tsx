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
import { useData } from "../lib/DataContext";
import { ThemePreference, useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { IngestToken } from "../lib/types";
import CategoriesScreen from "./CategoriesScreen";

const INGEST_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ingest-payment`;

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "light", label: "Chiaro", icon: "sun" },
  { value: "dark", label: "Scuro", icon: "moon" },
  { value: "system", label: "Sistema", icon: "smartphone" },
];

export default function SettingsScreen() {
  const { palette, preference, setPreference } = useTheme();
  const { categories } = useData();

  const [page, setPage] = useState<"root" | "categories" | "token">("root");
  const [tokens, setTokens] = useState<IngestToken[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    const { data } = await supabase
      .from("ingest_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTokens(data as IngestToken[]);
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  if (page === "categories") {
    return <CategoriesScreen onBack={() => setPage("root")} />;
  }

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
    <ScrollView
      style={{ backgroundColor: palette.ground }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: palette.ink }]}>Impostazioni</Text>

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>Aspetto</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {THEME_OPTIONS.map((option) => {
            const active = preference === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={[
                  styles.segmentOption,
                  active && { backgroundColor: palette.surface },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Icon
                  name={option.icon}
                  size={14}
                  color={active ? palette.ink : palette.ink3}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? palette.ink : palette.ink3 },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <SettingRow
          icon="palette"
          label="Categorie"
          value={String(categories.length)}
          onPress={() => setPage("categories")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow icon="gauge" label="Limiti di spesa" value="presto" muted />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow icon="repeat" label="Spese ricorrenti" value="presto" muted />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow icon="users" label="Persone" value="presto" muted />
      </View>

      <View>
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

        <Text style={[styles.note, { color: palette.ink3 }]}>
          {activeTokens === 0
            ? "Genera un token e incollalo nell'intestazione x-ingest-token della Shortcut."
            : "Il token si vede una volta sola. Se lo perdi, generane un altro e revoca il vecchio."}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.logout}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={[styles.logoutText, { color: palette.over }]}>Esci</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  muted,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  muted?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Icon name={icon} size={17} color={muted ? palette.ink3 : palette.ink2} />
      <Text
        style={[styles.settingName, { color: muted ? palette.ink3 : palette.ink }]}
      >
        {label}
      </Text>
      <Text style={[styles.settingValue, { color: palette.ink3 }]}>{value}</Text>
      {onPress && <Icon name="chevron-right" size={14} color={palette.ink3} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  title: { ...type.title },
  label: { ...type.label, marginBottom: space.sm },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 13,
  },
  settingName: { ...type.body, flex: 1 },
  settingValue: { ...type.caption },
  urlBox: {
    borderRadius: radius.field,
    borderWidth: 1,
    padding: 12,
    marginBottom: space.md,
  },
  url: { ...type.caption },
  hint: { ...type.small, fontSize: 10.5, marginTop: 5 },
  fresh: { borderRadius: radius.card, padding: 14, marginBottom: space.md, gap: 9 },
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
  logout: { alignItems: "center", paddingVertical: space.md },
  logoutText: { ...type.body },
});
