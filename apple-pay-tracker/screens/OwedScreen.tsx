import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { Sheet } from "../components/Sheet";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { OpenCredit } from "../lib/types";

/** Dopo quanti giorni un credito aperto viene segnalato come in ritardo. */
const OVERDUE_DAYS = 3;

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

export default function OwedScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { people, reload: reloadPeople } = useData();

  const [credits, setCredits] = useState<OpenCredit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    // La spesa arriva in join perche' un credito senza il suo contesto
    // ("22,50 € da Leonardo") non dice abbastanza per agire.
    const { data, error: failure } = await supabase
      .from("payment_splits")
      .select(
        "*, person:people(*), payment:payments(id, merchant_name, occurred_at, amount)"
      )
      .order("created_at", { ascending: false });

    setError(failure?.message ?? null);
    if (!failure) setCredits((data ?? []) as unknown as OpenCredit[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = useMemo(
    () => credits.filter((c) => !c.settled_at),
    [credits]
  );
  const settled = useMemo(
    () => credits.filter((c) => c.settled_at),
    [credits]
  );

  const totalOpen = open.reduce((sum, c) => sum + Number(c.amount_owed), 0);

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const credit of open) {
      const current = map.get(credit.person_id);
      map.set(credit.person_id, {
        name: credit.person?.name ?? "—",
        total: (current?.total ?? 0) + Number(credit.amount_owed),
      });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [open]);

  async function settle(credit: OpenCredit) {
    const { error } = await supabase
      .from("payment_splits")
      .update({ settled_at: new Date().toISOString() })
      .eq("id", credit.id);
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    await load();
  }

  async function reopen(credit: OpenCredit) {
    const { error } = await supabase
      .from("payment_splits")
      .update({ settled_at: null })
      .eq("id", credit.id);
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    await load();
  }

  async function addPerson() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      Alert.alert("Sessione scaduta", "Accedi di nuovo.");
      return;
    }

    const { error } = await supabase
      .from("people")
      .insert({ user_id: userId, name: trimmed });

    if (error) {
      Alert.alert(
        "Errore",
        error.code === "23505"
          ? "Hai già una persona con questo nome."
          : error.message
      );
      return;
    }

    setNewName("");
    setAddingPerson(false);
    await reloadPeople();
  }

  function confirmDeletePerson(id: string, name: string) {
    Alert.alert(
      `Eliminare ${name}?`,
      "Spariscono anche le quote associate a questa persona.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("people").delete().eq("id", id);
            if (error) {
              Alert.alert("Errore", error.message);
              return;
            }
            await Promise.all([reloadPeople(), load()]);
          },
        },
      ]
    );
  }

  const amount = splitAmount(totalOpen);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), reloadPeople()]);
    setRefreshing(false);
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
          <Text style={[styles.title, { color: palette.ink }]}>Mi devono</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAddingPerson(true)}
          style={styles.addBtn}
        >
          <Icon name="user-plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Persona</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* "Totale da recuperare 0,00 € da 0 persone" con la rete spenta
            direbbe a chi legge che non gli deve piu' niente nessuno. */}
        {!error && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Totale da recuperare
            </Text>
            <Text style={[styles.hero, { color: palette.ink }]}>
              {amount.whole}
              <Text style={[styles.heroCents, { color: palette.ink3 }]}>
                {amount.cents}
              </Text>
            </Text>
            <Text style={[styles.heroMeta, { color: palette.ink2 }]}>
              da {byPerson.length}{" "}
              {byPerson.length === 1 ? "persona" : "persone"}
            </Text>
          </View>
        )}

        {open.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {open.map((credit, index) => {
              const late = daysSince(credit.created_at) >= OVERDUE_DAYS;
              const days = daysSince(credit.created_at);

              return (
                <View key={credit.id}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: palette.hairline },
                      ]}
                    />
                  )}
                  <View style={styles.creditRow}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: tint(palette.accent, dark) },
                      ]}
                    >
                      <Text style={[styles.initial, { color: palette.accent }]}>
                        {(credit.person?.name ?? "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.person, { color: palette.ink }]}>
                        {credit.person?.name ?? "—"}
                      </Text>
                      <Text style={[styles.context, { color: palette.ink3 }]}>
                        {credit.payment?.merchant_name ?? "spesa eliminata"}
                        {" · "}
                        {new Date(
                          credit.payment?.occurred_at ?? credit.created_at
                        ).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>
                    </View>

                    <View style={styles.creditRight}>
                      <Text style={[styles.owed, { color: palette.ink }]}>
                        {formatAmount(Number(credit.amount_owed))}
                      </Text>
                      {late && (
                        <View
                          style={[
                            styles.pill,
                            { backgroundColor: `${palette.over}22` },
                          ]}
                        >
                          <Text style={[styles.pillText, { color: palette.over }]}>
                            da {days} giorni
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => settle(credit)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Segna come saldato"
                    >
                      <Icon name="check" size={18} color={palette.good} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {error && <LoadError message={error} onRetry={load} />}

        {!error && open.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun credito aperto. Le quote compaiono qui quando dividi una
            spesa dalla schermata di modifica.
          </Text>
        )}

        {people.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>Persone</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              {people.map((person, index) => (
                <View key={person.id}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: palette.hairline },
                      ]}
                    />
                  )}
                  <View style={styles.personRow}>
                    <Text style={[styles.person, { color: palette.ink }]}>
                      {person.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmDeletePerson(person.id, person.name)}
                      accessibilityLabel={`Elimina ${person.name}`}
                    >
                      <Icon name="trash-2" size={16} color={palette.ink3} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {settled.length > 0 && (
          <View>
            <TouchableOpacity
              onPress={() => setShowSettled((v) => !v)}
              style={styles.settledToggle}
            >
              <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
                Già saldati ({settled.length})
              </Text>
              <Icon
                name={showSettled ? "chevron-up" : "chevron-down"}
                size={14}
                color={palette.ink3}
              />
            </TouchableOpacity>

            {showSettled && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.hairline,
                    marginTop: space.sm,
                  },
                ]}
              >
                {settled.map((credit, index) => (
                  <View key={credit.id}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: palette.hairline },
                        ]}
                      />
                    )}
                    <View style={styles.creditRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.person, { color: palette.ink2 }]}>
                          {credit.person?.name ?? "—"}
                        </Text>
                        <Text style={[styles.context, { color: palette.ink3 }]}>
                          {credit.payment?.merchant_name ?? "spesa eliminata"}
                        </Text>
                      </View>
                      <Text style={[styles.owed, { color: palette.ink3 }]}>
                        {formatAmount(Number(credit.amount_owed))}
                      </Text>
                      <TouchableOpacity onPress={() => reopen(credit)}>
                        <Text style={[styles.context, { color: palette.accent }]}>
                          Annulla
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <Text style={[styles.note, { color: palette.ink3 }]}>
          I crediti aperti da più di {OVERDUE_DAYS} giorni vengono evidenziati.
          Le notifiche push arriveranno più avanti.
        </Text>
      </ScrollView>

      <Sheet
        visible={addingPerson}
        onClose={() => setAddingPerson(false)}
        title="Nuova persona"
      >
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Nome"
          placeholderTextColor={palette.ink3}
          autoFocus
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.hairline,
              color: palette.ink,
            },
          ]}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={addPerson}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Aggiungi
          </Text>
        </TouchableOpacity>
      </Sheet>
    </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
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
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...type.caption, fontWeight: "500" },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  heroMeta: { ...type.caption, marginTop: space.sm },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { ...type.bodyMedium },
  person: { ...type.bodyMedium },
  context: { ...type.small, marginTop: 2 },
  creditRight: { alignItems: "flex-end", gap: 3 },
  owed: { ...type.amount, fontVariant: ["tabular-nums"] },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  pillText: { ...type.small, fontSize: 10, fontWeight: "500" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  settledToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  empty: { ...type.body, lineHeight: 21, textAlign: "center" },
  note: { ...type.small, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
