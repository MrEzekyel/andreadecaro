import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { findByHandle, requestConnection } from "../lib/social";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, tint, type } from "../lib/theme";
import { FoundProfile, Person } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Chiamata solo quando nasce una persona subito utilizzabile — mai per
   *  una richiesta di amicizia, che resta in sospeso fino all'accettazione. */
  onCreated: (person: Person) => void;
};

/**
 * Aggiungere qualcuno con cui dividere: due strade, non una.
 *
 * Prima "Dividi spese" aveva solo "Aggiungi persona" (un nome, un contatto
 * locale) — per cercare un amico col suo Clinck Tag bisognava uscire da qui,
 * andare in Profilo, cercarlo, tornare indietro. Le due cose restano
 * separate perche' hanno esiti diversi: un nome e' subito pronto per
 * dividere una spesa; un tag trovato genera solo una richiesta di amicizia,
 * che va accettata prima di comparire in elenco — non si puo' scegliere
 * per la spesa che si sta salvando adesso.
 */
export function AddPersonSheet({ visible, onClose, onCreated }: Props) {
  const { palette, dark } = useTheme();
  const [tab, setTab] = useState<"name" | "tag">("name");

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundProfile | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTab("name");
    setName("");
    setQuery("");
    setFound(null);
    setSearched(false);
  }, [visible]);

  async function createByName() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setSaving(false);
      Alert.alert("Sessione scaduta", "Accedi di nuovo.");
      return;
    }

    const { data, error } = await supabase
      .from("people")
      .insert({ user_id: userId, name: trimmed })
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      Alert.alert(
        "Errore",
        error?.code === "23505"
          ? "Hai già una persona con questo nome."
          : error?.message ?? "Salvataggio non riuscito."
      );
      return;
    }

    onCreated(data as Person);
  }

  async function search() {
    const trimmed = query.trim().replace(/^@/, "");
    if (!trimmed) return;
    setSearching(true);
    setSearched(false);
    try {
      const profile = await findByHandle(trimmed);
      setFound(profile);
      setSearched(true);
    } catch (e) {
      Alert.alert("Ricerca non riuscita", e instanceof Error ? e.message : "Riprova.");
    } finally {
      setSearching(false);
    }
  }

  async function invite(profile: FoundProfile) {
    try {
      await requestConnection(profile.user_id);
      setFound({ ...profile, connection_status: "pending" });
    } catch (e) {
      Alert.alert("Richiesta non inviata", e instanceof Error ? e.message : "Riprova.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Nuova persona">
      <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
        {[
          { value: "name" as const, label: "Nome" },
          { value: "tag" as const, label: "Clinck Tag" },
        ].map((option) => {
          const active = tab === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setTab(option.value)}
              style={[styles.segmentOption, active && { backgroundColor: palette.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
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

      {tab === "name" ? (
        <>
          <Text style={[styles.hint, { color: palette.ink3 }]}>
            Un contatto della tua rubrica, senza Clinck: pronto subito per
            dividere questa spesa.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome"
            placeholderTextColor={palette.ink3}
            autoFocus
            style={[
              styles.input,
              { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink },
            ]}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={createByName}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={palette.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: palette.onAccent }]}>Aggiungi</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: palette.ink3 }]}>
            Chi ha Clinck si cerca per tag esatto. Una volta accettata la
            richiesta, lo trovi in elenco senza doverlo cercare di nuovo —
            per questa spesa userai comunque "Nome" finché non accetta.
          </Text>
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                placeholder="CLI-076982"
                placeholderTextColor={palette.ink3}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                style={[styles.searchInput, { color: palette.ink }]}
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: palette.accent }]}
              onPress={search}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color={palette.onAccent} />
              ) : (
                <Icon name="search" size={16} color={palette.onAccent} />
              )}
            </TouchableOpacity>
          </View>

          {found && (
            <View
              style={[
                styles.result,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: tint(palette.accent, dark) }]}>
                <Text style={[styles.avatarText, { color: palette.accent }]}>
                  {found.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultName, { color: palette.ink }]}>
                  {found.display_name}
                </Text>
                <Text style={[styles.resultHandle, { color: palette.ink3 }]}>
                  {found.handle}
                </Text>
              </View>

              {found.connection_status === "accepted" ? (
                <Text style={[styles.state, { color: palette.ink3 }]}>Già amici</Text>
              ) : found.connection_status === "pending" ? (
                <Text style={[styles.state, { color: palette.ink3 }]}>In attesa</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.pill, { backgroundColor: palette.accent }]}
                  onPress={() => invite(found)}
                >
                  <Text style={[styles.pillText, { color: palette.onAccent }]}>Aggiungi</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {searched && !found && (
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              Nessun account con questo tag.
            </Text>
          )}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4, marginBottom: space.md },
  segmentOption: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  segmentLabel: { ...type.small, fontWeight: "500" },
  hint: { ...type.small, lineHeight: 17, marginBottom: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  button: { borderRadius: radius.button, paddingVertical: 14, alignItems: "center", marginTop: space.sm },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, ...type.body, padding: 0 },
  searchButton: { width: 46, borderRadius: radius.field, alignItems: "center", justifyContent: "center" },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    marginTop: space.sm,
  },
  avatar: { width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  avatarText: { ...type.bodyMedium },
  resultName: { ...type.bodyMedium },
  resultHandle: { ...type.small },
  state: { ...type.small },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill },
  pillText: { ...type.caption, fontWeight: "500" },
  empty: { ...type.small, lineHeight: 18, marginTop: space.sm },
});
