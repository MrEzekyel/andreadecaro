import React, { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Person } from "../lib/types";
import { AddPersonSheet } from "./AddPersonSheet";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { computeSplit, SplitMode, SplitState } from "./SplitEditor";

/** Al piu' quattro scelte rapide: piu' di cosi' e la riga di preferiti si
 *  allunga esattamente come l'elenco che deve evitare di far scorrere. */
const MAX_FAVORITES = 4;

const MODE_LABEL: Record<SplitMode, string> = {
  equal: "In parti uguali",
  percent: "Percentuale",
  exact: "Importo esatto",
};

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  total: number;
  split: SplitState;
  onChange: (next: SplitState) => void;
  existingPersonIds: string[];
};

/**
 * Il foglio dedicato a scegliere con chi dividere — annidato dentro il
 * foglio di aggiunta/modifica spesa (via `SplitEditor`), mai come fratello:
 * vedi la regola in CLAUDE.md sui fogli annidati.
 *
 * Prima l'intero elenco della rubrica viveva come una lunga lista di
 * checkbox dentro il foglio della spesa: con venti persone era piu' lungo di
 * tutto il resto. Qui c'e' spazio per cercare, per le scelte rapide, e per
 * gli importi di ciascuno senza far scorrere una spesa intera per trovarli.
 */
export function SplitPeopleSheet({
  visible,
  onClose,
  total,
  split,
  onChange,
  existingPersonIds,
}: Props) {
  const { palette, dark } = useTheme();
  const { people, reload } = useData();
  const [query, setQuery] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  const result = computeSplit(total, split);

  const favorites = useMemo(() => people.filter((p) => p.is_favorite), [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  function togglePerson(id: string) {
    const has = split.personIds.includes(id);
    onChange({
      ...split,
      enabled: true,
      personIds: has
        ? split.personIds.filter((p) => p !== id)
        : [...split.personIds, id],
      // Deselezionando si ripuliscono anche l'importo e "gia' saldato":
      // riselezionando la stessa persona piu' tardi non devono ricomparire
      // numeri vecchi che l'utente non ha scritto lui in questa sessione.
      values: has ? omitKey(split.values, id) : split.values,
      settledOnCreate: has
        ? omitKey(split.settledOnCreate, id)
        : split.settledOnCreate,
    });
  }

  async function toggleFavorite(person: Person) {
    const next = !person.is_favorite;
    if (next && favorites.length >= MAX_FAVORITES) {
      Alert.alert(
        "Preferiti al completo",
        `Puoi averne al più ${MAX_FAVORITES}. Togline uno prima di aggiungerne un altro.`
      );
      return;
    }
    const { error } = await supabase
      .from("people")
      .update({ is_favorite: next })
      .eq("id", person.id);
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    await reload();
  }

  async function onPersonCreated(person: Person) {
    await reload();
    setAddingPerson(false);
    onChange({
      ...split,
      enabled: true,
      personIds: [...split.personIds, person.id],
    });
  }

  const hasLinkedSelected = split.personIds.some(
    (id) => people.find((p) => p.id === id)?.linked_user_id
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Dividi con" dim>
      {people.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: palette.ink3 }]}>
            Per dividere una spesa aggiungi prima qualcuno con cui
            condividerla.
          </Text>
          <TouchableOpacity
            style={[styles.addPerson, { borderColor: palette.hairline }]}
            onPress={() => setAddingPerson(true)}
          >
            <Icon name="user-plus" size={15} color={palette.accent} />
            <Text style={[styles.addPersonLabel, { color: palette.accent }]}>
              Aggiungi persona
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
            {(Object.keys(MODE_LABEL) as SplitMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => onChange({ ...split, mode })}
                style={[
                  styles.segmentOption,
                  split.mode === mode && { backgroundColor: palette.surface },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: split.mode === mode ? palette.ink : palette.ink3 },
                  ]}
                  numberOfLines={1}
                >
                  {MODE_LABEL[mode]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={[
              styles.searchBox,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Icon name="search" size={15} color={palette.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca una persona"
              placeholderTextColor={palette.ink3}
              autoCorrect={false}
              style={[styles.searchInput, { color: palette.ink }]}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Icon name="x" size={15} color={palette.ink3} />
              </TouchableOpacity>
            )}
          </View>

          {favorites.length > 0 && (
            <View style={styles.favorites}>
              {favorites.map((person) => {
                const selected = split.personIds.includes(person.id);
                return (
                  <TouchableOpacity
                    key={person.id}
                    onPress={() => togglePerson(person.id)}
                    style={[
                      styles.favoriteChip,
                      {
                        backgroundColor: selected
                          ? tint(palette.accent, dark)
                          : palette.surface,
                        borderColor: selected ? palette.accent : palette.hairline,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.favoriteAvatar,
                        { backgroundColor: tint(palette.accent, dark) },
                      ]}
                    >
                      <Text style={[styles.favoriteInitial, { color: palette.accent }]}>
                        {person.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.favoriteName,
                        { color: selected ? palette.accent : palette.ink2 },
                      ]}
                      numberOfLines={1}
                    >
                      {person.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.list}>
            {filtered.map((person) => {
              const selected = split.personIds.includes(person.id);
              const isNew = !existingPersonIds.includes(person.id);
              // Ha senso dichiarare "gia' saldata" solo per un contatto senza
              // account Clinck (la quota di chi lo ha deve prima essere vista
              // e accettata) e solo per una quota che non esiste ancora.
              const canPreSettle = selected && !person.linked_user_id && isNew;

              return (
                <View key={person.id} style={styles.personBlock}>
                  <View style={styles.personRow}>
                    <TouchableOpacity
                      style={styles.personMain}
                      onPress={() => togglePerson(person.id)}
                    >
                      <View
                        style={[
                          styles.box,
                          {
                            borderColor: selected ? palette.accent : palette.ink3,
                            backgroundColor: selected ? palette.accent : "transparent",
                          },
                        ]}
                      >
                        {selected && (
                          <Icon
                            name="check"
                            size={11}
                            color={palette.onAccent}
                            strokeWidth={3}
                          />
                        )}
                      </View>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: tint(palette.accent, dark) },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: palette.accent }]}>
                          {person.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[styles.personName, { color: palette.ink }]}
                        numberOfLines={1}
                      >
                        {person.name}
                      </Text>
                      {/* Chi ha Clinck riceve la quota sull'app e deve
                          accettarla: e' una differenza di conseguenze, non un
                          dettaglio del profilo, e va vista prima di
                          selezionarlo. */}
                      {person.linked_user_id && (
                        <Icon name="at-sign" size={12} color={palette.good} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => toggleFavorite(person)}
                      hitSlop={8}
                      accessibilityLabel={
                        person.is_favorite
                          ? `Togli ${person.name} dai preferiti`
                          : `Aggiungi ${person.name} ai preferiti`
                      }
                    >
                      <Icon
                        name="star"
                        size={16}
                        color={person.is_favorite ? palette.warn : palette.ink3}
                        fill={person.is_favorite ? palette.warn : undefined}
                      />
                    </TouchableOpacity>
                  </View>

                  {selected && (
                    <View style={styles.personDetails}>
                      {split.mode !== "equal" && (
                        <TextInput
                          value={split.values[person.id] ?? ""}
                          onChangeText={(text) =>
                            onChange({
                              ...split,
                              values: { ...split.values, [person.id]: text },
                            })
                          }
                          keyboardType="decimal-pad"
                          placeholder={split.mode === "percent" ? "%" : "€"}
                          placeholderTextColor={palette.ink3}
                          style={[
                            styles.valueInput,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.hairline,
                              color: palette.ink,
                            },
                          ]}
                        />
                      )}
                      <Text style={[styles.owed, { color: palette.ink2 }]}>
                        {formatAmount(result.owed[person.id] ?? 0)}
                      </Text>
                    </View>
                  )}

                  {canPreSettle && (
                    <View style={styles.settleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settleLabel, { color: palette.ink }]}>
                          Già saldata
                        </Text>
                        <Text style={[styles.settleHint, { color: palette.ink3 }]}>
                          Hai già ricevuto questi soldi nella vita reale
                        </Text>
                      </View>
                      <Switch
                        value={!!split.settledOnCreate[person.id]}
                        onValueChange={(v) =>
                          onChange({
                            ...split,
                            settledOnCreate: {
                              ...split.settledOnCreate,
                              [person.id]: v,
                            },
                          })
                        }
                        trackColor={{ true: palette.good, false: palette.hairline }}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {filtered.length === 0 && (
              <Text style={[styles.emptySearch, { color: palette.ink3 }]}>
                Nessuno corrisponde a «{query}».
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.addPersonRow}
            onPress={() => setAddingPerson(true)}
          >
            <Icon name="user-plus" size={15} color={palette.accent} />
            <Text style={[styles.addPersonLabel, { color: palette.accent }]}>
              Aggiungi persona
            </Text>
          </TouchableOpacity>

          {split.personIds.length > 0 && (
            <View
              style={[
                styles.summary,
                {
                  backgroundColor: result.valid
                    ? palette.surface2
                    : `${palette.over}1f`,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: palette.ink2 }]}>
                {result.valid
                  ? "Resta a te"
                  : "Le quote superano il totale pagato"}
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: result.valid ? palette.ink : palette.over },
                ]}
              >
                {formatAmount(result.myShare)}
              </Text>
            </View>
          )}

          {hasLinkedSelected && (
            <Text style={[styles.hint, { color: palette.ink3 }]}>
              La quota di chi ha Clinck gli arriva sull'app: dovrà accettarla,
              e da quel momento la spesa comparirà anche nei suoi conti.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: palette.accent }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: palette.onAccent }]}>
              Fatto
            </Text>
          </TouchableOpacity>
        </>
      )}

      <AddPersonSheet
        visible={addingPerson}
        onClose={() => setAddingPerson(false)}
        onCreated={onPersonCreated}
        dim
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { gap: space.md, alignItems: "flex-start" },
  emptyText: { ...type.small, lineHeight: 17 },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontSize: 11, fontWeight: "500" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, ...type.body, padding: 0 },
  favorites: { flexDirection: "row", gap: 8 },
  favoriteChip: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  favoriteAvatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteInitial: { ...type.caption, fontWeight: "600" },
  favoriteName: { ...type.small, fontSize: 10.5 },
  list: { gap: space.sm },
  personBlock: { gap: 8 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  personMain: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  box: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...type.small, fontWeight: "600" },
  personName: { ...type.body, flexShrink: 1 },
  personDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingLeft: 34,
  },
  valueInput: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 74,
    textAlign: "right",
    ...type.caption,
  },
  owed: {
    ...type.caption,
    fontVariant: ["tabular-nums"],
    minWidth: 60,
    textAlign: "right",
  },
  settleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: 34,
  },
  settleLabel: { ...type.caption, fontWeight: "500" },
  settleHint: { ...type.small, fontSize: 10.5, marginTop: 1 },
  emptySearch: { ...type.small, paddingVertical: space.sm },
  addPersonRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  addPerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  addPersonLabel: { ...type.caption, fontWeight: "500" },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  summaryLabel: { ...type.caption, flex: 1 },
  summaryValue: { ...type.bodyMedium, fontVariant: ["tabular-nums"] },
  hint: { ...type.small, lineHeight: 16 },
  doneButton: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneButtonText: { ...type.bodyMedium, fontSize: 14.5 },
});
