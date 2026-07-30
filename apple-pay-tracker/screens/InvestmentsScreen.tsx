import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CardPicker } from "../components/CardPicker";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, monthName, shortDateTime } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Investment, InvestmentRule, RecurringFrequency } from "../lib/types";
import { monthRange } from "../lib/usePayments";

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

/** Prima scadenza a partire da oggi, coerente con frequenza e giorno scelti. */
function firstRun(frequency: RecurringFrequency, day: number, weekday: number) {
  const today = new Date();

  if (frequency === "weekly") {
    const next = new Date(today);
    const current = next.getDay() === 0 ? 7 : next.getDay();
    const delta = (weekday - current + 7) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return next.toISOString().slice(0, 10);
  }

  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate <= today) {
    candidate.setMonth(candidate.getMonth() + (frequency === "yearly" ? 12 : 1));
  }
  const lastDay = new Date(
    candidate.getFullYear(),
    candidate.getMonth() + 1,
    0
  ).getDate();
  candidate.setDate(Math.min(day, lastDay));
  return candidate.toISOString().slice(0, 10);
}

export default function InvestmentsScreen({ onBack }: { onBack: () => void }) {
  const { palette, dark } = useTheme();

  const [month, setMonth] = useState(() => new Date());
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [rules, setRules] = useState<InvestmentRule[]>([]);

  const [entrySheet, setEntrySheet] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Investment | null>(null);

  const [ruleSheet, setRuleSheet] = useState(false);
  const [editingRule, setEditingRule] = useState<InvestmentRule | null>(null);

  // Campi condivisi dai due fogli.
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [card, setCard] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [day, setDay] = useState(1);
  const [weekday, setWeekday] = useState(1);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [entriesResult, rulesResult] = await Promise.all([
      supabase
        .from("investments")
        .select("*")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: false }),
      supabase.from("investment_rules").select("*").order("next_run_on"),
    ]);
    if (entriesResult.data) setInvestments(entriesResult.data as Investment[]);
    if (rulesResult.data) setRules(rulesResult.data as InvestmentRule[]);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  const total = investments.reduce((sum, i) => sum + Number(i.amount), 0);

  function openNewEntry() {
    setEditingEntry(null);
    setLabel("");
    setAmount("");
    setCard("");
    setNote("");
    setOccurredAt(new Date());
    setEntrySheet(true);
  }

  function openEditEntry(entry: Investment) {
    setEditingEntry(entry);
    setLabel(entry.label);
    setAmount(String(entry.amount).replace(".", ","));
    setCard(entry.card_name ?? "");
    setNote(entry.note ?? "");
    setOccurredAt(new Date(entry.occurred_at));
    setEntrySheet(true);
  }

  async function saveEntry() {
    const parsed = parseAmountInput(amount);
    if (!label.trim()) {
      Alert.alert("Nome mancante", "Dai un nome all'investimento.");
      return;
    }
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    if (editingEntry) {
      const { error } = await supabase
        .from("investments")
        .update({
          label: label.trim(),
          amount: parsed,
          card_name: card.trim() || null,
          note: note.trim() || null,
          occurred_at: occurredAt.toISOString(),
        })
        .eq("id", editingEntry.id);
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
      const { error } = await supabase.from("investments").insert({
        user_id: userId,
        label: label.trim(),
        amount: parsed,
        card_name: card.trim() || null,
        note: note.trim() || null,
        occurred_at: occurredAt.toISOString(),
        source: "manual",
      });
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    }

    setEntrySheet(false);
    await load();
  }

  function confirmDeleteEntry(entry: Investment) {
    Alert.alert(`Eliminare "${entry.label}"?`, "L'operazione non è reversibile.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("investments")
            .delete()
            .eq("id", entry.id);
          if (error) {
            Alert.alert("Errore", error.message);
            return;
          }
          setEntrySheet(false);
          await load();
        },
      },
    ]);
  }

  function openNewRule() {
    setEditingRule(null);
    setLabel("");
    setAmount("");
    setCard("");
    setFrequency("monthly");
    setDay(1);
    setWeekday(1);
    setRuleSheet(true);
  }

  function openEditRule(rule: InvestmentRule) {
    setEditingRule(rule);
    setLabel(rule.label);
    setAmount(String(rule.amount).replace(".", ","));
    setCard(rule.card_name ?? "");
    setFrequency(rule.frequency);
    setDay(rule.day_of_month ?? 1);
    setWeekday(rule.weekday ?? 1);
    setRuleSheet(true);
  }

  async function saveRule() {
    const parsed = parseAmountInput(amount);
    if (!label.trim()) {
      Alert.alert("Nome mancante", "Dai un nome all'investimento ricorrente.");
      return;
    }
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    const payload = {
      label: label.trim(),
      amount: parsed,
      card_name: card.trim() || null,
      frequency,
      day_of_month: frequency === "weekly" ? null : day,
      weekday: frequency === "weekly" ? weekday : null,
    };

    if (editingRule) {
      const { error } = await supabase
        .from("investment_rules")
        .update(payload)
        .eq("id", editingRule.id);
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
      const { error } = await supabase.from("investment_rules").insert({
        ...payload,
        user_id: userId,
        next_run_on: firstRun(frequency, day, weekday),
      });
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    }

    setRuleSheet(false);
    await load();
  }

  async function toggleRuleActive(rule: InvestmentRule) {
    const { error } = await supabase
      .from("investment_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    await load();
  }

  function confirmDeleteRule(rule: InvestmentRule) {
    Alert.alert(
      `Eliminare "${rule.label}"?`,
      "Gli investimenti già generati restano, smette solo di generarne di nuovi.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("investment_rules")
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
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Icon name="chevron-left" size={20} color={palette.ink} />
          <Text style={[styles.title, { color: palette.ink }]}>Investimenti</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openNewEntry} style={styles.addBtn}>
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            accessibilityLabel="Mese precedente"
          >
            <Icon name="chevron-left" size={16} color={palette.ink3} />
          </TouchableOpacity>
          <Text style={[styles.month, { color: palette.ink }]}>
            {monthName(month)} {month.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            accessibilityLabel="Mese successivo"
          >
            <Icon name="chevron-right" size={16} color={palette.ink3} />
          </TouchableOpacity>
        </View>

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            Investito nel mese
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {formatAmount(total)}
          </Text>
        </View>

        {investments.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {investments.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <TouchableOpacity
                  style={styles.entryRow}
                  onPress={() => openEditEntry(entry)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.entryLabel, { color: palette.ink }]}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.entryMeta, { color: palette.ink3 }]}>
                      {shortDateTime(entry.occurred_at)}
                      {entry.card_name ? ` · ${entry.card_name}` : ""}
                      {entry.source === "recurring" ? " · ricorrente" : ""}
                    </Text>
                  </View>
                  <Text style={[styles.entryAmount, { color: palette.ink }]}>
                    {formatAmount(entry.amount)}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun investimento in questo mese.
          </Text>
        )}

        <View>
          <View style={styles.rulesHead}>
            <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
              Ricorrenti
            </Text>
            <TouchableOpacity onPress={openNewRule} style={styles.addBtn}>
              <Icon name="plus" size={14} color={palette.accent} />
              <Text style={[styles.addText, { color: palette.accent }]}>Nuovo</Text>
            </TouchableOpacity>
          </View>

          {rules.length === 0 && (
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              Nessun piano di accumulo o versamento ricorrente configurato.
            </Text>
          )}

          {rules.map((rule) => (
            <View
              key={rule.id}
              style={[
                styles.ruleCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.hairline,
                  opacity: rule.active ? 1 : 0.55,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.ruleMain}
                onPress={() => openEditRule(rule)}
              >
                <View
                  style={[styles.ruleIcon, { backgroundColor: tint(palette.good, dark) }]}
                >
                  <Icon name="trending-up" size={16} color={palette.good} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryLabel, { color: palette.ink }]}>
                    {rule.label}
                  </Text>
                  <Text style={[styles.entryMeta, { color: palette.ink3 }]}>
                    {FREQUENCY_LABEL[rule.frequency]}
                    {rule.card_name ? ` · ${rule.card_name}` : ""}
                    {rule.active
                      ? ` · prossimo ${new Date(
                          rule.next_run_on
                        ).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`
                      : " · sospeso"}
                  </Text>
                </View>
                <Text style={[styles.entryAmount, { color: palette.ink }]}>
                  {formatAmount(Number(rule.amount))}
                </Text>
              </TouchableOpacity>

              <View style={styles.ruleActions}>
                <TouchableOpacity onPress={() => toggleRuleActive(rule)}>
                  <Text style={[styles.action, { color: palette.ink3 }]}>
                    {rule.active ? "Sospendi" : "Riattiva"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteRule(rule)}>
                  <Text style={[styles.action, { color: palette.over }]}>Elimina</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Sheet
        visible={entrySheet}
        onClose={() => setEntrySheet(false)}
        title={editingEntry ? "Modifica investimento" : "Nuovo investimento"}
      >
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. ETF Accumulo"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink }]}
        />
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink }]}
        />

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[styles.input, styles.inputButton, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
        >
          <Text style={{ color: palette.ink, ...type.body }}>
            {formatDate(occurredAt.toISOString())}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={occurredAt}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, selected) => {
              if (Platform.OS !== "ios") setShowDatePicker(false);
              if (selected) setOccurredAt(selected);
            }}
          />
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Metodo di pagamento
        </Text>
        <CardPicker value={card} onChange={setCard} />

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nota facoltativa"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink }]}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={saveEntry}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>Salva</Text>
        </TouchableOpacity>

        {editingEntry && (
          <TouchableOpacity style={styles.ghost} onPress={() => confirmDeleteEntry(editingEntry)}>
            <Text style={[styles.ghostText, { color: palette.over }]}>
              Elimina investimento
            </Text>
          </TouchableOpacity>
        )}
      </Sheet>

      <Sheet
        visible={ruleSheet}
        onClose={() => setRuleSheet(false)}
        title={editingRule ? "Modifica ricorrente" : "Nuovo ricorrente"}
      >
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. Piano di accumulo ETF"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink }]}
        />
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink }]}
        />

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Frequenza</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {(Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setFrequency(option)}
              style={[styles.segmentOption, frequency === option && { backgroundColor: palette.surface }]}
            >
              <Text
                style={[styles.segmentLabel, { color: frequency === option ? palette.ink : palette.ink3 }]}
              >
                {option === "weekly" ? "Settimana" : option === "monthly" ? "Mese" : "Anno"}
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
                      backgroundColor: weekday === index + 1 ? palette.accent : palette.surface,
                      borderColor: weekday === index + 1 ? palette.accent : palette.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: weekday === index + 1 ? palette.onAccent : palette.ink2 }]}
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
                      backgroundColor: day === value ? palette.accent : palette.surface,
                      borderColor: day === value ? palette.accent : palette.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: day === value ? palette.onAccent : palette.ink2 }]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Metodo di pagamento
        </Text>
        <CardPicker value={card} onChange={setCard} />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={saveRule}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>Salva</Text>
        </TouchableOpacity>
      </Sheet>
    </View>
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
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { ...type.title },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...type.caption, fontWeight: "500" },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  month: { ...type.bodyMedium, textTransform: "capitalize" },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontSize: 34, fontVariant: ["tabular-nums"] },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    gap: space.md,
  },
  entryLabel: { ...type.body },
  entryMeta: { ...type.small, marginTop: 2 },
  entryAmount: { ...type.amount, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, lineHeight: 20, textAlign: "center", marginTop: space.sm },
  rulesHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  ruleCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: 10,
    marginBottom: space.md,
  },
  ruleMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.lg },
  action: { ...type.small },
  fieldLabel: { ...type.caption },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  inputButton: { justifyContent: "center" },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8 },
  segmentLabel: { ...type.small, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1 },
  dayChip: { width: 38, paddingVertical: 8, borderRadius: radius.field, borderWidth: 1, alignItems: "center" },
  chipText: { ...type.caption, fontWeight: "500" },
  button: { borderRadius: radius.button, paddingVertical: 14, alignItems: "center", marginTop: space.xs },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  ghost: { paddingVertical: 8, alignItems: "center" },
  ghostText: { ...type.body },
});
