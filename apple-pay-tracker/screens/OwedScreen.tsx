import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AddPersonSheet } from "../components/AddPersonSheet";
import { ChartCarousel, ChartPage } from "../components/ChartCarousel";
import { GroupedBarChart } from "../components/GroupedBarChart";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SemiGauge } from "../components/SemiGauge";
import { Sheet } from "../components/Sheet";
import { StatTiles } from "../components/StatTiles";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useData } from "../lib/DataContext";
import { formatAmount } from "../lib/format";
import {
  buildSplitEvents,
  groupEventsByMonth,
  monthlySplitBuckets,
  personTotals,
  sameMonth,
  SplitEvent,
} from "../lib/splits";
import {
  incomingSplits,
  linkPerson,
  listConnections,
  requestSettle,
  respondToSplit,
  unlinkPerson,
} from "../lib/social";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { radius, shade, space, tint, type } from "../lib/theme";
import { Connection, IncomingSplit, OpenCredit, Person } from "../lib/types";
import PersonDetailScreen from "./PersonDetailScreen";

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

export default function OwedScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { people, reload: reloadPeople } = useData();
  const { width: windowWidth } = useWindowDimensions();
  const gaugeWidth = Math.min(windowWidth - space.lg * 2, 340);

  const [credits, setCredits] = useState<OpenCredit[]>([]);
  const [debts, setDebts] = useState<IncomingSplit[]>([]);
  const [friends, setFriends] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  /** La persona a cui si sta cercando l'account Clinck da associare. */
  const [linking, setLinking] = useState<Person | null>(null);
  /** La persona il cui dettaglio e' aperto, o null alla radice. */
  const [openPerson, setOpenPerson] = useState<{ id: string; name: string } | null>(
    null
  );
  const [showAllDivisions, setShowAllDivisions] = useState(false);

  const load = useCallback(async () => {
    // La spesa arriva in join perche' un credito senza il suo contesto
    // ("22,50 € da Leonardo") non dice abbastanza per agire.
    //
    // `payments!payment_splits_payment_id_fkey` e non il piu' semplice
    // `payments(...)`: da `mirror_payment_id` (la copia nel conto
    // dell'amico che accetta, migrazione 0038) `payment_splits` ha **due**
    // riferimenti a `payments`, e senza dire quale usare PostgREST rifiuta
    // la richiesta invece di indovinare ("more than one relationship was
    // found for 'payment_splits' and 'payments'").
    const { data, error: failure } = await supabase
      .from("payment_splits")
      .select(
        "*, person:people(*), payment:payments!payment_splits_payment_id_fkey(id, merchant_name, occurred_at, amount)"
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

  // Tutte le divisioni viste per persona invece che per direzione: i due
  // grafici sotto e l'elenco del mese ragionano su "quanto ho diviso con
  // Leonardo", non su "quanto nella tabella dei crediti e quanto in quella
  // dei debiti" — vedi lib/splits.ts.
  const events = useMemo(
    () => buildSplitEvents(credits, debts, people),
    [credits, debts, people]
  );

  const totalsByPerson = useMemo(
    () =>
      personTotals(events).sort(
        (a, b) => b.received + b.sent - (a.received + a.sent)
      ),
    [events]
  );
  const top5 = useMemo(() => totalsByPerson.slice(0, 5), [totalsByPerson]);

  // Ogni contatto della rubrica, anche chi non ha ancora diviso niente: senza
  // questo un "Persona" appena aggiunta sparirebbe dall'unico elenco che puo'
  // ancora eliminarla o associarla, prima che nasca la sua prima quota.
  const mergedPeople = useMemo(() => {
    return people
      .map((person) => {
        const totals = totalsByPerson.find((t) => t.personId === person.id);
        return {
          person,
          received: totals?.received ?? 0,
          receivedCount: totals?.receivedCount ?? 0,
          sent: totals?.sent ?? 0,
          sentCount: totals?.sentCount ?? 0,
        };
      })
      .sort((a, b) => b.received + b.sent - (a.received + a.sent));
  }, [people, totalsByPerson]);

  const monthEvents = useMemo(
    () => events.filter((e) => sameMonth(new Date(e.occurredAt), new Date())),
    [events]
  );
  const eventMonths = useMemo(() => groupEventsByMonth(events), [events]);
  const hasOlderDivisions = events.length > monthEvents.length;

  // ── Il semicerchio combinato ──────────────────────────────────────────
  // Riferimento di scala: il mese piu' pieno (ricevuto o inviato, quello dei
  // due che vince) fra gli ultimi sei. Senza un riferimento fisso l'arco di
  // ogni mese si scalerebbe sul proprio stesso totale e sarebbe sempre
  // pieno — un indicatore che non indica niente.
  const sixMonthBuckets = useMemo(() => monthlySplitBuckets(events, 6), [events]);
  const gaugeMax = Math.max(
    1,
    ...sixMonthBuckets.flatMap((b) => [b.received, b.sent])
  );

  // Il mese in corso, diviso fra la parte gia' saldata (colore pieno) e
  // quella ancora aperta (stesso colore, piu' scuro e piu' trasparente): due
  // segmenti consecutivi nello stesso anello, non due anelli — e' lo stesso
  // meccanismo con cui Home impila piu' fonti di introito in un solo arco.
  const now = new Date();
  const creditsThisMonth = useMemo(
    () => events.filter((e) => e.direction === "credit" && sameMonth(new Date(e.occurredAt), now)),
    [events]
  );
  const debtsThisMonth = useMemo(
    () => events.filter((e) => e.direction === "debt" && sameMonth(new Date(e.occurredAt), now)),
    [events]
  );
  const creditSettledMonth = creditsThisMonth
    .filter((e) => e.settled)
    .reduce((sum, e) => sum + e.amount, 0);
  const creditOpenMonth = creditsThisMonth
    .filter((e) => !e.settled)
    .reduce((sum, e) => sum + e.amount, 0);
  const debtSettledMonth = debtsThisMonth
    .filter((e) => e.settled)
    .reduce((sum, e) => sum + e.amount, 0);
  const debtOpenMonth = debtsThisMonth
    .filter((e) => !e.settled)
    .reduce((sum, e) => sum + e.amount, 0);

  // Statistiche di sempre, non del mese: quanto si e' diviso in totale da
  // quando esiste la funzione, per i riquadri sotto il semicerchio.
  const totalDivided = events.reduce((sum, e) => sum + e.amount, 0);
  const totalReceivedAllTime = events
    .filter((e) => e.direction === "credit")
    .reduce((sum, e) => sum + e.amount, 0);
  const distinctPeopleCount = new Set(events.map((e) => e.personId)).size;

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

  async function onPersonCreated() {
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

  if (openPerson) {
    return (
      <PersonDetailScreen
        personId={openPerson.id}
        personName={openPerson.name}
        events={events}
        onBack={() => setOpenPerson(null)}
      />
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

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Un solo semicerchio, non due affiancati: l'anello esterno e'
            quanto hai ricevuto questo mese, quello interno (specchiato,
            cresce dalla punta destra) e' quanto hai inviato — stessa scala
            per entrambi, il mese piu' pieno degli ultimi sei. Dentro ogni
            anello la parte gia' saldata usa il colore pieno, quella ancora
            aperta lo stesso colore piu' scuro e piu' trasparente: e' lo
            stesso meccanismo con cui Home impila piu' fonti di introito in
            un solo arco, non due anelli diversi. */}
        {!error && (
          <View style={styles.gaugeBlock}>
            <View style={styles.gaugeCenter}>
              <SemiGauge
                width={gaugeWidth}
                stroke={16}
                outer={{
                  segments: [
                    { value: creditSettledMonth, color: palette.good },
                    { value: creditOpenMonth, color: shade(palette.good) },
                  ],
                  max: gaugeMax,
                }}
                inner={{
                  segments: [
                    { value: debtSettledMonth, color: palette.over },
                    { value: debtOpenMonth, color: shade(palette.over) },
                  ],
                  max: gaugeMax,
                }}
                mirrorInner
              >
                <View style={styles.gaugeCenterRow}>
                  <View style={styles.gaugeCenterItem}>
                    <Text
                      style={[styles.gaugeAmount, { color: palette.good }]}
                      numberOfLines={1}
                    >
                      {formatAmount(totalOpen)}
                    </Text>
                    <Text style={[styles.gaugeSubLabel, { color: palette.good }]}>
                      da recuperare
                    </Text>
                  </View>
                  <View style={styles.gaugeCenterItem}>
                    <Text
                      style={[styles.gaugeAmount, { color: palette.over }]}
                      numberOfLines={1}
                    >
                      {formatAmount(totalDebts)}
                    </Text>
                    <Text style={[styles.gaugeSubLabel, { color: palette.over }]}>
                      da inviare
                    </Text>
                  </View>
                </View>
              </SemiGauge>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.good }]} />
                <Text style={[styles.legendText, { color: palette.ink2 }]}>
                  Ricevuto
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.over }]} />
                <Text style={[styles.legendText, { color: palette.ink2 }]}>
                  Inviato
                </Text>
              </View>
            </View>

            <StatTiles
              tiles={[
                { label: "Totale diviso", value: formatAmount(totalDivided) },
                { label: "Totale ricevuto", value: formatAmount(totalReceivedAllTime) },
                { label: "Transazioni", value: String(events.length) },
                { label: "Persone", value: String(distinctPeopleCount) },
              ]}
            />
          </View>
        )}

        {/* ── Quello che devo io ─────────────────────────────────────────
            Accettare non e' una formalita': crea la spesa nei propri conti,
            ed e' il motivo per cui la divisione fra account vale la pena.
            Per questo la riga dice l'importo intero della spesa accanto alla
            quota — si accetta sapendo su cosa. Niente piu' tab a nascondere
            l'una o l'altra: le due liste stanno sempre entrambe qui sotto. */}
        {!error && openDebts.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Da accettare
              {pendingDebts > 0 ? ` (${pendingDebts})` : ""}
            </Text>
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
          </View>
        )}

        {!error && open.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>Ti devono</Text>
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
          </View>
        )}

        {error && <LoadError message={error} onRetry={load} />}

        {!error && open.length === 0 && openDebts.length === 0 && events.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Ancora nessuna divisione. Le trovi qui quando dividi una spesa
            dalla schermata di modifica, o quando un amico con Clinck divide
            qualcosa con te.
          </Text>
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
          I crediti aperti da più di {OVERDUE_DAYS} giorni vengono
          evidenziati. Accettare una quota la registra come spesa tua, con la
          data della spesa originale: se chi ha pagato la corregge, si
          corregge anche la tua, e se la cancella sparisce anche dai tuoi
          conti.
        </Text>

        {/* ── Con chi divido di più ──────────────────────────────────────
            Le due direzioni fianco a fianco per persona, non due grafici
            separati: "quanto ho ricevuto da Leonardo" accanto a "quanto gli
            ho mandato" e' la domanda che ci si fa, non le due tabelle da cui
            i numeri arrivano. L'elenco sotto e' l'unico con le persone: prima
            ce n'era un secondo identico ma senza il grafico sopra, e le
            azioni di associare/scollegare/eliminare stavano solo li' — ora
            stanno qui, sull'elenco che gia' esiste, invece che duplicarlo. */}
        {top5.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Con chi dividi di più
            </Text>
            <ChartCarousel
              pages={[
                {
                  key: "amount",
                  title: "Quanto dividi",
                  subtitle: "per persona",
                  content: (
                    <GroupedBarChart
                      groups={top5.map((p) => ({
                        key: p.personId,
                        label: firstName(p.name),
                        values: [p.received, p.sent],
                      }))}
                      colors={[palette.good, palette.over]}
                      formatValue={(v) => formatAmount(v)}
                    />
                  ),
                } as ChartPage,
                {
                  key: "count",
                  title: "Quante volte",
                  subtitle: "numero di divisioni",
                  content: (
                    <GroupedBarChart
                      groups={top5.map((p) => ({
                        key: p.personId,
                        label: firstName(p.name),
                        values: [p.receivedCount, p.sentCount],
                      }))}
                      colors={[palette.good, palette.over]}
                      formatValue={(v) => String(Math.round(v))}
                    />
                  ),
                } as ChartPage,
              ]}
            />

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.good }]} />
                <Text style={[styles.legendText, { color: palette.ink2 }]}>Ricevuto</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.over }]} />
                <Text style={[styles.legendText, { color: palette.ink2 }]}>Inviato</Text>
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.hairline, marginTop: space.md },
              ]}
            >
              {mergedPeople.map(({ person, receivedCount, sentCount }, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  divider={index > 0}
                  count={receivedCount + sentCount}
                  canAssociate={friends.length > 0}
                  onOpen={() => setOpenPerson({ id: person.id, name: person.name })}
                  onAssociate={() => setLinking(person)}
                  onUnlink={() => confirmUnlink(person)}
                  onDelete={() => confirmDeletePerson(person.id, person.name)}
                />
              ))}
            </View>
          </View>
        )}

        {top5.length === 0 && people.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>Persone</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              {mergedPeople.map(({ person, receivedCount, sentCount }, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  divider={index > 0}
                  count={receivedCount + sentCount}
                  canAssociate={friends.length > 0}
                  onOpen={() => setOpenPerson({ id: person.id, name: person.name })}
                  onAssociate={() => setLinking(person)}
                  onUnlink={() => confirmUnlink(person)}
                  onDelete={() => confirmDeletePerson(person.id, person.name)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Divisioni del mese ─────────────────────────────────────────
            Stesso schema di "Vedi tutte le transazioni" nel dettaglio di
            una categoria: chiuso mostra solo il mese corrente, aperto
            l'intera storia raggruppata. */}
        {events.length > 0 && (
          <View>
            <View style={styles.listHead}>
              <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
                {showAllDivisions ? "Tutte le divisioni" : "Divisioni del mese"}
              </Text>
              {hasOlderDivisions && (
                <TouchableOpacity onPress={() => setShowAllDivisions((v) => !v)}>
                  <Text style={[styles.link, { color: palette.accent }]}>
                    {showAllDivisions ? "Mostra meno" : "Vedi tutte"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {showAllDivisions ? (
              eventMonths.map((group) => (
                <View key={group.key}>
                  <Text style={[styles.monthLabel, { color: palette.ink3 }]}>
                    {group.label}
                  </Text>
                  {group.data.map((event) => (
                    <DivisionRow
                      key={event.id}
                      event={event}
                      onPress={() => setOpenPerson({ id: event.personId, name: event.personName })}
                    />
                  ))}
                </View>
              ))
            ) : monthEvents.length > 0 ? (
              monthEvents.map((event) => (
                <DivisionRow
                  key={event.id}
                  event={event}
                  onPress={() => setOpenPerson({ id: event.personId, name: event.personName })}
                />
              ))
            ) : (
              <Text style={[styles.empty, { color: palette.ink3 }]}>
                Nessuna divisione questo mese.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <AddPersonSheet
        visible={addingPerson}
        onClose={() => setAddingPerson(false)}
        onCreated={onPersonCreated}
      />

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

/** Solo nome, per non far traboccare l'etichetta sotto le colonne del grafico. */
function firstName(name: string) {
  return name.split(" ")[0];
}

/**
 * Una riga dell'elenco Persone — nome cliccabile verso il dettaglio, azioni
 * di gestione a fianco. Usata sia sotto il grafico "Con chi dividi di più"
 * sia, quando non c'e' ancora nessuna divisione da mettere in grafico, come
 * unico elenco: prima erano due copie quasi identiche di questa stessa riga.
 */
function PersonRow({
  person,
  divider,
  count,
  canAssociate,
  onOpen,
  onAssociate,
  onUnlink,
  onDelete,
}: {
  person: Person;
  divider: boolean;
  count: number;
  canAssociate: boolean;
  onOpen: () => void;
  onAssociate: () => void;
  onUnlink: () => void;
  onDelete: () => void;
}) {
  const { palette } = useTheme();

  return (
    <View>
      {divider && <View style={[styles.divider, { backgroundColor: palette.hairline }]} />}
      <View style={styles.personRow}>
        <TouchableOpacity style={styles.personMain} onPress={onOpen}>
          <Text style={[styles.person, { color: palette.ink }]}>{person.name}</Text>
          <Text style={[styles.context, { color: palette.ink3 }]}>
            {person.linked_user_id
              ? "Ha Clinck"
              : count === 0
                ? "Nessuna divisione ancora"
                : `${count} ${count === 1 ? "divisione" : "divisioni"}`}
          </Text>
        </TouchableOpacity>

        {/* Il tasto che chiude il caso piu' comune: si e' diviso per mesi
            con un amico che non aveva l'app, poi la scarica. Da qui le
            quote gia' aperte diventano sue, senza reinserire niente. */}
        {person.linked_user_id ? (
          <TouchableOpacity
            onPress={onUnlink}
            hitSlop={8}
            accessibilityLabel={`Scollega ${person.name}`}
          >
            <Icon name="unlink" size={16} color={palette.ink3} />
          </TouchableOpacity>
        ) : (
          canAssociate && (
            <TouchableOpacity
              style={[styles.action, { borderWidth: 1, borderColor: palette.hairline }]}
              onPress={onAssociate}
            >
              <Text style={[styles.actionText, { color: palette.accent }]}>Associa</Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          onPress={onDelete}
          hitSlop={8}
          accessibilityLabel={`Elimina ${person.name}`}
        >
          <Icon name="trash-2" size={16} color={palette.ink3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DivisionRow({ event, onPress }: { event: SplitEvent; onPress: () => void }) {
  const { palette, dark } = useTheme();
  const credit = event.direction === "credit";
  const color = credit ? palette.good : palette.over;

  return (
    <TouchableOpacity style={styles.divisionRow} onPress={onPress}>
      <View style={[styles.divisionIcon, { backgroundColor: tint(color, dark) }]}>
        <Icon name={credit ? "arrow-down-left" : "arrow-up-right"} size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.person, { color: palette.ink }]} numberOfLines={1}>
          {event.personName}
        </Text>
        <Text style={[styles.context, { color: palette.ink3 }]} numberOfLines={1}>
          {event.merchant} ·{" "}
          {new Date(event.occurredAt).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>
      <Text style={[styles.owed, { color }]}>
        {credit ? "+" : "−"}
        {formatAmount(event.amount)}
      </Text>
    </TouchableOpacity>
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
  personMain: { flex: 1 },
  settledToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  empty: { ...type.body, lineHeight: 21, textAlign: "center" },
  note: { ...type.small, lineHeight: 17 },
  gaugeBlock: { gap: space.lg },
  gaugeCenter: { alignItems: "center" },
  gaugeCenterRow: { flexDirection: "row", gap: space.xl },
  gaugeCenterItem: { alignItems: "center" },
  gaugeAmount: { ...type.bodyMedium, fontSize: 17, fontVariant: ["tabular-nums"] },
  gaugeSubLabel: { ...type.small, fontWeight: "500", marginTop: 1 },
  legendRow: { flexDirection: "row", gap: space.lg, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.small },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  link: { ...type.caption, fontWeight: "500" },
  monthLabel: { ...type.label, marginTop: space.md, marginBottom: space.xs },
  divisionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  divisionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
