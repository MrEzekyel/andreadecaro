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
import {
  incomingSplits,
  linkPerson,
  listConnections,
  requestSettle,
  respondToSplit,
  unlinkPerson,
} from "../lib/social";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Connection, IncomingSplit, OpenCredit, Person } from "../lib/types";

/** Dopo quanti giorni un credito aperto viene segnalato come in ritardo. */
const OVERDUE_DAYS = 3;

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

/** I due lati della stessa domanda: chi mi deve, e a chi devo. */
type Side = "credits" | "debts";

export default function OwedScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { people, reload: reloadPeople } = useData();

  const [side, setSide] = useState<Side>("credits");
  const [credits, setCredits] = useState<OpenCredit[]>([]);
  const [debts, setDebts] = useState<IncomingSplit[]>([]);
  const [friends, setFriends] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState("");
  /** La persona a cui si sta cercando l'account Clinck da associare. */
  const [linking, setLinking] = useState<Person | null>(null);

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

    // Le quote in arrivo e gli amici passano dalle RPC: un errore qui non
    // deve cancellare i crediti gia' letti, che sono un'altra domanda.
    try {
      const [incoming, connections] = await Promise.all([
        incomingSplits(),
        listConnections(),
      ]);
      setDebts(incoming);
      setFriends(connections.filter((c) => c.status === "accepted"));
    } catch (e) {
      if (!failure) setError(e instanceof Error ? e.message : "Errore di lettura");
    }
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

  const openDebts = useMemo(() => debts.filter((d) => !d.settled_at), [debts]);
  const totalDebts = openDebts.reduce((sum, d) => sum + Number(d.amount_owed), 0);
  const pendingDebts = openDebts.filter((d) => d.status === "pending").length;

  const amount = splitAmount(side === "credits" ? totalOpen : totalDebts);

  async function respondDebt(debt: IncomingSplit, accept: boolean) {
    try {
      await respondToSplit(debt.split_id, accept);
      await load();
    } catch (e) {
      Alert.alert("Non riuscito", e instanceof Error ? e.message : "Riprova.");
    }
  }

  async function declarePaid(debt: IncomingSplit) {
    try {
      await requestSettle(debt.split_id);
      await load();
    } catch (e) {
      Alert.alert("Non riuscito", e instanceof Error ? e.message : "Riprova.");
    }
  }

  async function associate(person: Person, friend: Connection) {
    try {
      const moved = await linkPerson(person.id, friend.other_user_id);
      setLinking(null);
      await Promise.all([reloadPeople(), load()]);
      Alert.alert(
        "Associato",
        moved === 0
          ? `${person.name} è ora collegato a @${friend.handle}. Le prossime divisioni gli arriveranno sull'app.`
          : `${moved} ${moved === 1 ? "quota aperta è passata" : "quote aperte sono passate"} a @${friend.handle}: ora le vede sull'app e può accettarle.`
      );
    } catch (e) {
      Alert.alert("Non riuscito", e instanceof Error ? e.message : "Riprova.");
    }
  }

  function confirmUnlink(person: Person) {
    Alert.alert(
      `Scollegare ${person.name}?`,
      "Le quote che non ha ancora accettato tornano private. Quelle già accettate restano nei suoi conti: cancellargliele da qui gli abbasserebbe un totale senza che nessuno glielo abbia chiesto.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Scollega",
          style: "destructive",
          onPress: async () => {
            try {
              await unlinkPerson(person.id);
              await Promise.all([reloadPeople(), load()]);
            } catch (e) {
              Alert.alert("Non riuscito", e instanceof Error ? e.message : "Riprova.");
            }
          },
        },
      ]
    );
  }

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
          <Text style={[styles.title, { color: palette.ink }]}>Divisioni</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAddingPerson(true)}
          style={styles.addBtn}
        >
          <Icon name="user-plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Persona</Text>
        </TouchableOpacity>
      </View>

      {/* Due lati della stessa cosa, non due schermate: chi divide con gli
          amici sta sempre da tutte e due le parti nella stessa serata. */}
      <View style={[styles.sides, { backgroundColor: palette.surface2 }]}>
        {[
          { value: "credits" as Side, label: "Ti devono" },
          { value: "debts" as Side, label: "Devi" },
        ].map((option) => {
          const active = side === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setSide(option.value)}
              style={[
                styles.sideOption,
                active && { backgroundColor: palette.surface },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.sideLabel,
                  { color: active ? palette.ink : palette.ink3 },
                ]}
              >
                {option.label}
              </Text>
              {option.value === "debts" && pendingDebts > 0 && (
                <View style={[styles.badge, { backgroundColor: palette.accent }]}>
                  <Text style={[styles.badgeText, { color: palette.onAccent }]}>
                    {pendingDebts}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
              {side === "credits" ? "Totale da recuperare" : "Totale da restituire"}
            </Text>
            <Text style={[styles.hero, { color: palette.ink }]}>
              {amount.whole}
              <Text style={[styles.heroCents, { color: palette.ink3 }]}>
                {amount.cents}
              </Text>
            </Text>
            <Text style={[styles.heroMeta, { color: palette.ink2 }]}>
              {side === "credits"
                ? `da ${byPerson.length} ${byPerson.length === 1 ? "persona" : "persone"}`
                : `verso ${new Set(openDebts.map((d) => d.payer_handle ?? d.payer_name)).size} ${
                    new Set(openDebts.map((d) => d.payer_handle ?? d.payer_name)).size === 1
                      ? "persona"
                      : "persone"
                  }`}
            </Text>
          </View>
        )}

        {/* ── Quello che devo io ─────────────────────────────────────────
            Accettare non e' una formalita': crea la spesa nei propri conti,
            ed e' il motivo per cui la divisione fra account vale la pena.
            Per questo la riga dice l'importo intero della spesa accanto alla
            quota — si accetta sapendo su cosa. */}
        {side === "debts" && !error && openDebts.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {openDebts.map((debt, index) => (
              <View key={debt.split_id}>
                {index > 0 && (
                  <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
                )}
                <View style={styles.debtRow}>
                  <View style={styles.debtHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.person, { color: palette.ink }]}>
                        {debt.merchant}
                      </Text>
                      <Text style={[styles.context, { color: palette.ink3 }]}>
                        {debt.payer_name} · {shortDate(debt.occurred_at)} · su{" "}
                        {formatAmount(Number(debt.total_amount))}
                      </Text>
                    </View>
                    <Text style={[styles.owed, { color: palette.ink }]}>
                      {formatAmount(Number(debt.amount_owed))}
                    </Text>
                  </View>

                  {debt.status === "pending" ? (
                    <View style={styles.debtActions}>
                      <TouchableOpacity
                        style={[styles.action, { backgroundColor: palette.accent }]}
                        onPress={() => respondDebt(debt, true)}
                      >
                        <Text style={[styles.actionText, { color: palette.onAccent }]}>
                          Accetta
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.action,
                          { borderWidth: 1, borderColor: palette.hairline },
                        ]}
                        onPress={() => respondDebt(debt, false)}
                      >
                        <Text style={[styles.actionText, { color: palette.ink2 }]}>
                          Rifiuta
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : debt.settle_requested_at ? (
                    <Text style={[styles.context, { color: palette.ink3 }]}>
                      Hai detto di aver pagato: aspetta la conferma di{" "}
                      {debt.payer_name}.
                    </Text>
                  ) : (
                    <View style={styles.debtActions}>
                      <TouchableOpacity
                        style={[
                          styles.action,
                          { borderWidth: 1, borderColor: palette.hairline },
                        ]}
                        onPress={() => declarePaid(debt)}
                      >
                        <Text style={[styles.actionText, { color: palette.ink2 }]}>
                          Ho pagato
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {side === "debts" && !error && openDebts.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Non devi niente a nessuno. Quando un amico con Clinck divide una
            spesa con te, la trovi qui e decidi se accettarla.
          </Text>
        )}

        {side === "credits" && open.length > 0 && (
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
                      {/* Lo stato solo quando c'e' un account dall'altra
                          parte: su una persona senza Clinck non c'e' niente
                          da aspettare, e scrivere "in attesa" farebbe
                          credere che manchi un passaggio. */}
                      {credit.status !== "local" && (
                        <Text
                          style={[
                            styles.state,
                            {
                              color:
                                credit.status === "declined"
                                  ? palette.over
                                  : palette.ink3,
                            },
                          ]}
                        >
                          {credit.status === "pending"
                            ? "In attesa che accetti"
                            : credit.status === "declined"
                              ? "Ha rifiutato la quota"
                              : credit.settle_requested_at
                                ? "Dice di aver pagato"
                                : "Accettata"}
                        </Text>
                      )}
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

        {side === "credits" && !error && open.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun credito aperto. Le quote compaiono qui quando dividi una
            spesa dalla schermata di modifica.
          </Text>
        )}

        {side === "credits" && people.length > 0 && (
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
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.person, { color: palette.ink }]}>
                        {person.name}
                      </Text>
                      {person.linked_user_id && (
                        <Text style={[styles.state, { color: palette.good }]}>
                          Ha Clinck · le divisioni gli arrivano sull'app
                        </Text>
                      )}
                    </View>

                    {/* Il tasto che chiude il caso piu' comune: si e' diviso
                        per mesi con un amico che non aveva l'app, poi la
                        scarica. Da qui le quote gia' aperte diventano sue,
                        senza reinserire niente. */}
                    {person.linked_user_id ? (
                      <TouchableOpacity
                        onPress={() => confirmUnlink(person)}
                        hitSlop={8}
                        accessibilityLabel={`Scollega ${person.name}`}
                      >
                        <Icon name="unlink" size={16} color={palette.ink3} />
                      </TouchableOpacity>
                    ) : (
                      friends.length > 0 && (
                        <TouchableOpacity
                          style={[styles.action, { borderWidth: 1, borderColor: palette.hairline }]}
                          onPress={() => setLinking(person)}
                        >
                          <Text style={[styles.actionText, { color: palette.accent }]}>
                            Associa
                          </Text>
                        </TouchableOpacity>
                      )
                    )}

                    <TouchableOpacity
                      onPress={() => confirmDeletePerson(person.id, person.name)}
                      hitSlop={8}
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

        {side === "credits" && settled.length > 0 && (
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
          {side === "credits"
            ? `I crediti aperti da più di ${OVERDUE_DAYS} giorni vengono evidenziati. Le notifiche push arriveranno più avanti.`
            : "Accettare una quota la registra come spesa tua, con la data della spesa originale. Se chi ha pagato la corregge, si corregge anche la tua; se la cancella, sparisce anche dai tuoi conti."}
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

      <Sheet
        visible={linking !== null}
        onClose={() => setLinking(null)}
        title={linking ? `Associa ${linking.name}` : "Associa"}
      >
        <Text style={[styles.sheetBody, { color: palette.ink3 }]}>
          Scegli l'account Clinck di {linking?.name}. Le quote ancora aperte
          passano a lui: le vedrà sull'app e potrà accettarle o rifiutarle.
          Quelle già saldate restano dove sono.
        </Text>

        {friends.map((friend) => (
          <TouchableOpacity
            key={friend.connection_id}
            style={[styles.friendPick, { borderColor: palette.hairline }]}
            onPress={() => linking && associate(linking, friend)}
          >
            <View style={[styles.avatar, { backgroundColor: tint(palette.accent, dark) }]}>
              <Text style={[styles.initial, { color: palette.accent }]}>
                {friend.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.person, { color: palette.ink }]}>
                {friend.display_name}
              </Text>
              <Text style={[styles.context, { color: palette.ink3 }]}>
                {friend.handle}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={palette.ink3} />
          </TouchableOpacity>
        ))}
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
  sides: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.pill,
    padding: 3,
  },
  sideOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  sideLabel: { ...type.caption, fontWeight: "500" },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { ...type.small, fontSize: 11, fontWeight: "600" },
  debtRow: { paddingVertical: 11, gap: 9 },
  debtHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  debtActions: { flexDirection: "row", gap: 8 },
  action: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  actionText: { ...type.caption, fontWeight: "500" },
  state: { ...type.small, marginTop: 1 },
  sheetBody: { ...type.small, lineHeight: 18 },
  friendPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
  },
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
