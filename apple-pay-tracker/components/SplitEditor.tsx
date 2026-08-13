import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, type } from "../lib/theme";
import { Person } from "../lib/types";
import { AddPersonSheet } from "./AddPersonSheet";
import { Icon } from "./Icon";

export type SplitMode = "equal" | "percent" | "exact";

export type SplitState = {
  enabled: boolean;
  mode: SplitMode;
  /** id delle persone con cui e' divisa (io non sono in elenco). */
  personIds: string[];
  /** Per 'percent' la percentuale altrui, per 'exact' l'importo altrui. */
  values: Record<string, string>;
};

export const emptySplit: SplitState = {
  enabled: false,
  mode: "equal",
  personIds: [],
  values: {},
};

function toNumber(value: string) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Calcola quanto deve ogni persona e quanto resta a me.
 *
 * In modalita' equa il totale si divide fra me e le altre persone, quindi il
 * divisore e' `persone + 1`: dimenticare quel +1 e' l'errore classico che fa
 * sparire la propria quota.
 */
export function computeSplit(total: number, split: SplitState) {
  const owed: Record<string, number> = {};

  if (!split.enabled || split.personIds.length === 0) {
    return { owed, myShare: total, assigned: 0, valid: true };
  }

  if (split.mode === "equal") {
    const perHead = total / (split.personIds.length + 1);
    for (const id of split.personIds) owed[id] = round(perHead);
  } else if (split.mode === "percent") {
    for (const id of split.personIds) {
      owed[id] = round((total * toNumber(split.values[id] ?? "")) / 100);
    }
  } else {
    for (const id of split.personIds) {
      owed[id] = round(toNumber(split.values[id] ?? ""));
    }
  }

  const assigned = Object.values(owed).reduce((sum, v) => sum + v, 0);
  return {
    owed,
    myShare: round(total - assigned),
    assigned: round(assigned),
    // La somma delle quote altrui non puo' superare il totale pagato.
    valid: assigned <= total + 0.001,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

type Props = {
  total: number;
  split: SplitState;
  onChange: (next: SplitState) => void;
};

const MODE_LABEL: Record<SplitMode, string> = {
  equal: "In parti uguali",
  percent: "Percentuale",
  exact: "Importo esatto",
};

export function SplitEditor({ total, split, onChange }: Props) {
  const { palette, dark } = useTheme();
  const { people, reload } = useData();
  const [addingPerson, setAddingPerson] = useState(false);

  const result = computeSplit(total, split);

  function togglePerson(id: string) {
    const has = split.personIds.includes(id);
    onChange({
      ...split,
      personIds: has
        ? split.personIds.filter((p) => p !== id)
        : [...split.personIds, id],
    });
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

  const addPersonRow = (
    <TouchableOpacity style={styles.addPerson} onPress={() => setAddingPerson(true)}>
      <Icon name="user-plus" size={15} color={palette.accent} />
      <Text style={[styles.addPersonLabel, { color: palette.accent }]}>
        Aggiungi persona
      </Text>
    </TouchableOpacity>
  );

  if (people.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.hint, { color: palette.ink3 }]}>
          Per dividere una spesa aggiungi prima qualcuno con cui condividerla.
        </Text>
        {addPersonRow}
        <AddPersonSheet
          visible={addingPerson}
          onClose={() => setAddingPerson(false)}
          onCreated={onPersonCreated}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => onChange({ ...split, enabled: !split.enabled })}
        accessibilityRole="switch"
        accessibilityState={{ checked: split.enabled }}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: split.enabled ? palette.accent : palette.ink3,
              backgroundColor: split.enabled ? palette.accent : "transparent",
            },
          ]}
        >
          {split.enabled && (
            <Icon name="check" size={11} color={palette.onAccent} strokeWidth={3} />
          )}
        </View>
        <Text style={[styles.toggleLabel, { color: palette.ink }]}>
          Spesa divisa con altri
        </Text>
      </TouchableOpacity>

      {split.enabled && (
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

          {people.map((person) => {
            const selected = split.personIds.includes(person.id);
            return (
              <View key={person.id} style={styles.personRow}>
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
                  <Text style={[styles.personName, { color: palette.ink }]}>
                    {person.name}
                  </Text>
                  {/* Chi ha Clinck riceve la quota sull'app e deve
                      accettarla: e' una differenza di conseguenze, non un
                      dettaglio del profilo, e va vista **prima** di
                      spuntare la casella. */}
                  {person.linked_user_id && (
                    <Icon name="at-sign" size={12} color={palette.good} />
                  )}
                </TouchableOpacity>

                {selected && split.mode !== "equal" && (
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

                {selected && (
                  <Text style={[styles.owed, { color: palette.ink2 }]}>
                    {formatAmount(result.owed[person.id] ?? 0)}
                  </Text>
                )}
              </View>
            );
          })}

          {addPersonRow}

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

          {/* Detto una volta sola sotto, non su ogni riga: salvando parte
              qualcosa verso un'altra persona, e chi divide deve saperlo
              prima di premere Salva, non scoprirlo dopo. */}
          {split.personIds.some(
            (id) => people.find((p) => p.id === id)?.linked_user_id
          ) && (
            <Text style={[styles.hint, { color: palette.ink3 }]}>
              La quota di chi ha Clinck gli arriva sull'app: dovrà accettarla,
              e da quel momento la spesa comparirà anche nei suoi conti.
            </Text>
          )}
        </>
      )}

      <AddPersonSheet
        visible={addingPerson}
        onClose={() => setAddingPerson(false)}
        onCreated={onPersonCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  hint: { ...type.small, lineHeight: 17 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 9 },
  toggleLabel: { ...type.body },
  box: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontSize: 11, fontWeight: "500" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  personMain: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  personName: { ...type.body },
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
    width: 72,
    textAlign: "right",
  },
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
  addPerson: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  addPersonLabel: { ...type.caption, fontWeight: "500" },
});
