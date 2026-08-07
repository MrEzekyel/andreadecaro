import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CardPicker } from "../components/CardPicker";
import { CategoryPicker } from "../components/CategoryPicker";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { Sheet } from "../components/Sheet";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { nextRunOn, scheduleChanged } from "../lib/recurrence";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { RecurringFrequency, RecurringRule } from "../lib/types";

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: "Ogni settimana",
  monthly: "Ogni mese",
  yearly: "Ogni anno",
};

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function parseAmountInput(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function RecurringScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [card, setCard] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [day, setDay] = useState(1);
  const [weekday, setWeekday] = useState(1);

  const load = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("recurring_rules")
      .select("*")
      .order("next_run_on");
    setError(failure?.message ?? null);
    if (!failure) setRules((data ?? []) as RecurringRule[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setLabel("");
    setAmount("");
    setCategoryId(null);
    setCard("");
    setFrequency("monthly");
    setDay(1);
    setWeekday(1);
    setOpen(true);
  }

  function openEdit(rule: RecurringRule) {
    setEditing(rule);
    setLabel(rule.label);
    setAmount(String(rule.amount).replace(".", ","));
    setCategoryId(rule.category_id);
    setCard(rule.card_name ?? "");
    setFrequency(rule.frequency);
    setDay(rule.day_of_month ?? 1);
    setWeekday(rule.weekday ?? 1);
    setOpen(true);
  }

  async function save() {
    const parsed = parseAmountInput(amount);
    if (!label.trim()) {
      Alert.alert("Nome mancante", "Dai un nome alla spesa ricorrente.");
      return;
    }
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    const payload = {
      label: label.trim(),
      amount: parsed,
      category_id: categoryId,
      card_name: card.trim() || null,
      frequency,
      day_of_month: frequency === "weekly" ? null : day,
      weekday: frequency === "weekly" ? weekday : null,
    };

    if (editing) {
      // Cambiando la cadenza va ricalcolata anche la prossima scadenza:
      // aggiornare solo il giorno lascerebbe `next_run_on` a quello vecchio,
      // e la regola continuerebbe a mostrare e generare la data precedente.
      const { error } = await supabase
        .from("recurring_rules")
        .update(
          scheduleChanged(editing, frequency, day, weekday)
            ? { ...payload, next_run_on: nextRunOn(frequency, day, weekday) }
            : payload
        )
        .eq("id", editing.id);
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    } else {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        Alert.alert("Sessione scaduta", "Accedi di nuovo.");
        return;
      }
      const { error } = await supabase.from("recurring_rules").insert({
        ...payload,
        user_id: userId,
        next_run_on: nextRunOn(frequency, day, weekday),
      });
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    }

    setOpen(false);
    await load();
  }

  async function toggleActive(rule: RecurringRule) {
    const { error } = await supabase
      .from("recurring_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    await load();
  }

  function confirmDelete(rule: RecurringRule) {
    Alert.alert(
      `Eliminare "${rule.label}"?`,
      "Le spese già generate restano, smette solo di generarne di nuove.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("recurring_rules")
              .delete()
              .eq("id", rule.id);
            if (error) {
              Alert.alert("Errore", error.message);
              return;
            }
            await load();
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
          <Text style={[styles.title, { color: palette.ink }]}>Ricorrenti</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {error && <LoadError message={error} onRetry={load} />}

        {!error && rules.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessuna spesa ricorrente. Aggiungi mutuo, rata dell'auto o
            abbonamenti che vengono scalati dal conto senza passare da Apple Pay.
          </Text>
        )}

        {rules.map((rule) => {
          const category = categoryById(rule.category_id);
          const color = category
            ? categoryColor(category.color, dark)
            : palette.uncategorized;

          return (
            <View
              key={rule.id}
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.hairline,
                  opacity: rule.active ? 1 : 0.55,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => openEdit(rule)}
              >
                <View
                  style={[styles.icon, { backgroundColor: tint(color, dark) }]}
                >
                  <Icon name={category?.icon ?? "repeat"} size={16} color={color} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>
                    {rule.label}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.ink3 }]}>
                    {FREQUENCY_LABEL[rule.frequency]}
                    {rule.card_name ? ` · ${rule.card_name}` : ""}
                    {rule.active
                      ? ` · prossima ${new Date(
                          rule.next_run_on
                        ).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                        })}`
                      : " · sospesa"}
                  </Text>
                </View>

                <Text style={[styles.cardAmount, { color: palette.ink }]}>
                  {formatAmount(Number(rule.amount))}
                </Text>
              </TouchableOpacity>

              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => toggleActive(rule)}>
                  <Text style={[styles.action, { color: palette.ink3 }]}>
                    {rule.active ? "Sospendi" : "Riattiva"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(rule)}>
                  <Text style={[styles.action, { color: palette.over }]}>
                    Elimina
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={[styles.note, { color: palette.ink3 }]}>
          Le spese vengono generate automaticamente ogni notte e restano
          modificabili come tutte le altre.
        </Text>
      </ScrollView>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifica ricorrente" : "Nuova ricorrente"}
      >
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. Mutuo casa"
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

        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
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

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Frequenza</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {(Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setFrequency(option)}
              style={[
                styles.segmentOption,
                frequency === option && { backgroundColor: palette.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: frequency === option ? palette.ink : palette.ink3 },
                ]}
              >
                {option === "weekly"
                  ? "Settimana"
                  : option === "monthly"
                  ? "Mese"
                  : "Anno"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {frequency === "weekly" ? (
          <>
            <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
              Giorno della settimana
            </Text>
            <View style={styles.chipRow}>
              {WEEKDAYS.map((name, index) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => setWeekday(index + 1)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        weekday === index + 1 ? palette.accent : palette.surface,
                      borderColor:
                        weekday === index + 1 ? palette.accent : palette.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          weekday === index + 1 ? palette.onAccent : palette.ink2,
                      },
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
              Giorno del mese
            </Text>
            <View style={styles.chipRow}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setDay(value)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor:
                        day === value ? palette.accent : palette.surface,
                      borderColor:
                        day === value ? palette.accent : palette.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: day === value ? palette.onAccent : palette.ink2 },
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.hint, { color: palette.ink3 }]}>
              Nei mesi più corti la spesa cade sull'ultimo giorno disponibile,
              poi torna al giorno scelto.
            </Text>
          </>
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Categoria</Text>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Metodo di pagamento
        </Text>
        <CardPicker value={card} onChange={setCard} />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={save}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Salva
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
  list: { padding: space.lg, gap: space.md },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: 10 },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...type.bodyMedium },
  cardMeta: { ...type.small, marginTop: 2 },
  cardAmount: { ...type.amount, fontVariant: ["tabular-nums"] },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.lg },
  action: { ...type.small },
  empty: { ...type.body, lineHeight: 21, textAlign: "center", marginTop: space.lg },
  note: { ...type.small, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  fieldLabel: { ...type.caption, marginTop: space.xs },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dayChip: {
    width: 38,
    paddingVertical: 8,
    borderRadius: radius.field,
    borderWidth: 1,
    alignItems: "center",
  },
  chipText: { ...type.caption, fontWeight: "500" },
  hint: { ...type.small, lineHeight: 16 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.md,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
