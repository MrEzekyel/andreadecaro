import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { Sheet } from "../components/Sheet";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import {
  findByHandle,
  listConnections,
  requestConnection,
  respondConnection,
  setHandle,
} from "../lib/social";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Connection, FoundProfile } from "../lib/types";

/**
 * Il Clinck Tag e gli amici.
 *
 * Ci si cerca **solo col tag esatto**: una ricerca a prefisso su una tabella
 * di profili sarebbe un modo per farsi enumerare tutta l'utenza tre lettere
 * alla volta. Il tag si condivide (di persona, in chat, col tasto qui sotto)
 * e chi lo riceve lo scrive per intero.
 */
export default function FriendsScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { reload: reloadPeople } = useData();

  const [handle, setLocalHandle] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draftHandle, setDraftHandle] = useState("");
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundProfile | null>(null);
  // Distingue "non ho ancora cercato" da "ho cercato e non c'e' nessuno":
  // senza, la schermata direbbe "nessun risultato" prima di ogni ricerca.
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: profile, error: profileError }, list] = await Promise.all([
        supabase.from("profiles").select("handle, display_name").maybeSingle(),
        listConnections(),
      ]);
      if (profileError) throw new Error(profileError.message);
      setLocalHandle(profile?.handle ?? null);
      setDisplayName(profile?.display_name ?? null);
      setConnections(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di lettura");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveHandle() {
    setSaving(true);
    try {
      await setHandle(draftHandle, draftName);
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert("Tag non salvato", e instanceof Error ? e.message : "Riprova.");
    } finally {
      setSaving(false);
    }
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
      await load();
    } catch (e) {
      Alert.alert("Richiesta non inviata", e instanceof Error ? e.message : "Riprova.");
    }
  }

  async function respond(connection: Connection, accept: boolean) {
    try {
      await respondConnection(connection.connection_id, accept);
      // Accettare crea il contatto in rubrica su entrambi i lati: senza
      // ricaricare, l'amico appena accettato non comparirebbe fra le persone
      // con cui dividere una spesa finche' non si riapre l'app.
      await Promise.all([load(), reloadPeople()]);
    } catch (e) {
      Alert.alert("Non riuscito", e instanceof Error ? e.message : "Riprova.");
    }
  }

  const requests = connections.filter((c) => c.status === "pending" && c.incoming);
  const sent = connections.filter((c) => c.status === "pending" && !c.incoming);
  const friends = connections.filter((c) => c.status === "accepted");

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={backHitSlop}>
            <Icon name="chevron-left" size={20} color={palette.ink2} />
            <Text style={[styles.backText, { color: palette.ink2 }]}>Indietro</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text style={[styles.title, { color: palette.ink }]}>Amici</Text>

          {error ? (
            <LoadError message={error} onRetry={load} />
          ) : (
            <>
              {/* ── Il proprio tag ─────────────────────────────────────── */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: palette.surface, borderColor: palette.hairline },
                ]}
              >
                <Text style={[styles.cardLabel, { color: palette.ink3 }]}>
                  Il tuo Clinck Tag
                </Text>

                {handle ? (
                  <>
                    <Text style={[styles.handle, { color: palette.ink }]}>
                      @{handle}
                    </Text>
                    {displayName && (
                      <Text style={[styles.name, { color: palette.ink3 }]}>
                        {displayName}
                      </Text>
                    )}

                    <View style={styles.tagActions}>
                      <TouchableOpacity
                        style={[styles.pill, { backgroundColor: palette.accent }]}
                        onPress={() =>
                          Share.share({
                            message: `Aggiungimi su Clinck: @${handle}`,
                          })
                        }
                      >
                        <Icon name="share" size={14} color={palette.onAccent} />
                        <Text style={[styles.pillText, { color: palette.onAccent }]}>
                          Condividi
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pill, { borderWidth: 1, borderColor: palette.hairline }]}
                        onPress={() => {
                          setDraftHandle(handle);
                          setDraftName(displayName ?? "");
                          setEditing(true);
                        }}
                      >
                        <Text style={[styles.pillText, { color: palette.ink2 }]}>
                          Cambia
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.body, { color: palette.ink3 }]}>
                      Scegli un tag e i tuoi amici potranno trovarti per dividere
                      le spese senza scriversi ogni volta chi deve cosa.
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: palette.accent }]}
                      onPress={() => {
                        setDraftHandle("");
                        setDraftName("");
                        setEditing(true);
                      }}
                    >
                      <Text style={[styles.buttonText, { color: palette.onAccent }]}>
                        Scegli il tuo tag
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* ── Cerca ───────────────────────────────────────────────── */}
              <View>
                <Text style={[styles.label, { color: palette.ink3 }]}>
                  Aggiungi un amico
                </Text>
                <View style={styles.searchRow}>
                  <View
                    style={[
                      styles.searchBox,
                      { backgroundColor: palette.surface, borderColor: palette.hairline },
                    ]}
                  >
                    <Text style={[styles.at, { color: palette.ink3 }]}>@</Text>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={search}
                      placeholder="il tag dell'amico"
                      placeholderTextColor={palette.ink3}
                      autoCapitalize="none"
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

                {/* Il tag va scritto per intero, e va detto: chi cerca "and"
                    e non trova "andrea" deve capire perche', altrimenti
                    conclude che l'amico non ha l'app. */}
                <Text style={[styles.hint, { color: palette.ink3 }]}>
                  Serve il tag esatto, per intero.
                </Text>

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
                        @{found.handle}
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
                        <Text style={[styles.pillText, { color: palette.onAccent }]}>
                          Aggiungi
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {searched && !found && (
                  <Text style={[styles.empty, { color: palette.ink3 }]}>
                    Nessun account con questo tag.
                  </Text>
                )}
              </View>

              {/* ── Richieste ricevute ──────────────────────────────────── */}
              {requests.length > 0 && (
                <View>
                  <Text style={[styles.label, { color: palette.ink3 }]}>
                    Ti hanno aggiunto
                  </Text>
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: palette.surface, borderColor: palette.hairline },
                    ]}
                  >
                    {requests.map((request, index) => (
                      <View key={request.connection_id}>
                        {index > 0 && (
                          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
                        )}
                        <View style={styles.friendRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.resultName, { color: palette.ink }]}>
                              {request.display_name}
                            </Text>
                            <Text style={[styles.resultHandle, { color: palette.ink3 }]}>
                              @{request.handle}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.pill, { backgroundColor: palette.accent }]}
                            onPress={() => respond(request, true)}
                          >
                            <Text style={[styles.pillText, { color: palette.onAccent }]}>
                              Accetta
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => respond(request, false)}
                            hitSlop={8}
                            accessibilityLabel={`Rifiuta ${request.display_name}`}
                          >
                            <Icon name="x" size={17} color={palette.ink3} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Amici ───────────────────────────────────────────────── */}
              <View>
                <Text style={[styles.label, { color: palette.ink3 }]}>
                  {friends.length === 0
                    ? "I tuoi amici"
                    : `I tuoi amici · ${friends.length}`}
                </Text>

                {friends.length === 0 && sent.length === 0 ? (
                  <Text style={[styles.empty, { color: palette.ink3 }]}>
                    Ancora nessuno. Le spese divise con chi non ha Clinck
                    continuano a funzionare come prima: restano in "Mi devono".
                  </Text>
                ) : (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: palette.surface, borderColor: palette.hairline },
                    ]}
                  >
                    {[...friends, ...sent].map((friend, index) => (
                      <View key={friend.connection_id}>
                        {index > 0 && (
                          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
                        )}
                        <View style={styles.friendRow}>
                          <View
                            style={[
                              styles.avatar,
                              { backgroundColor: tint(palette.accent, dark) },
                            ]}
                          >
                            <Text style={[styles.avatarText, { color: palette.accent }]}>
                              {friend.display_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.resultName, { color: palette.ink }]}>
                              {friend.display_name}
                            </Text>
                            <Text style={[styles.resultHandle, { color: palette.ink3 }]}>
                              @{friend.handle}
                            </Text>
                          </View>
                          {friend.status === "pending" && (
                            <Text style={[styles.state, { color: palette.ink3 }]}>
                              In attesa
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <Sheet
          visible={editing}
          onClose={() => setEditing(false)}
          title={handle ? "Cambia il tag" : "Scegli il tuo tag"}
        >
          <View>
            <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Tag</Text>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <Text style={[styles.at, { color: palette.ink3 }]}>@</Text>
              <TextInput
                value={draftHandle}
                onChangeText={(text) =>
                  // Si normalizza mentre si scrive invece di rifiutare dopo:
                  // il tag e' minuscolo per forza, e far scrivere "Andrea"
                  // per poi dire di no e' un giro inutile.
                  setLocalDraft(text, setDraftHandle)
                }
                placeholder="andrea"
                placeholderTextColor={palette.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                style={[styles.searchInput, { color: palette.ink }]}
              />
            </View>
            <Text style={[styles.hint, { color: palette.ink3 }]}>
              Da 3 a 20 caratteri: lettere, numeri e underscore.
            </Text>
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
              Come ti vedono
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Il tuo nome"
              placeholderTextColor={palette.ink3}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.hairline,
                  color: palette.ink,
                },
              ]}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={saveHandle}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={palette.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: palette.onAccent }]}>
                Salva
              </Text>
            )}
          </TouchableOpacity>
        </Sheet>
      </View>
    </SwipeBack>
  );
}

/** Minuscole e caratteri ammessi, mentre si scrive. */
function setLocalDraft(text: string, set: (value: string) => void) {
  set(text.toLowerCase().replace(/[^a-z0-9_]/g, ""));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  backText: { ...type.body },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 60 },
  title: { ...type.title },
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: 6 },
  cardLabel: { ...type.caption },
  handle: { ...type.title },
  name: { ...type.body },
  body: { ...type.small, lineHeight: 18 },
  label: { ...type.caption, marginBottom: 8 },
  tagActions: { flexDirection: "row", gap: 8, marginTop: space.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  pillText: { ...type.caption, fontWeight: "500" },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: space.xs,
  },
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
  at: { ...type.body },
  searchInput: { flex: 1, ...type.body, padding: 0 },
  searchButton: {
    width: 46,
    borderRadius: radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { ...type.small, marginTop: 6 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    marginTop: space.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...type.bodyMedium },
  resultName: { ...type.bodyMedium },
  resultHandle: { ...type.small },
  state: { ...type.small },
  empty: { ...type.small, lineHeight: 18 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  divider: { height: 1 },
  fieldLabel: { ...type.caption, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
});
