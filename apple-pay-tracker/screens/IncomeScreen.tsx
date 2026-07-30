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
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { Sheet } from "../components/Sheet";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, monthName, shortDateTime } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { Income } from "../lib/types";
import { monthRange } from "../lib/usePayments";

function parseAmountInput(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function IncomeScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();

  const [month, setMonth] = useState(() => new Date());
  const [incomes, setIncomes] = useState<Income[]>([]);

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    const { data } = await supabase
      .from("incomes")
      .select("*")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: false });
    if (data) setIncomes(data as Income[]);
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

  const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  function openNew() {
    setEditing(null);
    setLabel("");
    setAmount("");
    setNote("");
    setOccurredAt(new Date());
    setSheet(true);
  }

  function openEdit(income: Income) {
    setEditing(income);
    setLabel(income.label);
    setAmount(String(income.amount).replace(".", ","));
    setNote(income.note ?? "");
    setOccurredAt(new Date(income.occurred_at));
    setSheet(true);
  }

  async function save() {
    const parsed = parseAmountInput(amount);
    if (!label.trim()) {
      Alert.alert("Nome mancante", "Dai un nome all'introito.");
      return;
    }
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("incomes")
        .update({
          label: label.trim(),
          amount: parsed,
          note: note.trim() || null,
          occurred_at: occurredAt.toISOString(),
        })
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
      const { error } = await supabase.from("incomes").insert({
        user_id: userId,
        label: label.trim(),
        amount: parsed,
        note: note.trim() || null,
        occurred_at: occurredAt.toISOString(),
      });
      if (error) {
        Alert.alert("Errore", error.message);
        return;
      }
    }

    setSheet(false);
    await load();
  }

  function confirmDelete(income: Income) {
    Alert.alert(`Eliminare "${income.label}"?`, "L'operazione non è reversibile.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("incomes")
            .delete()
            .eq("id", income.id);
          if (error) {
            Alert.alert("Errore", error.message);
            return;
          }
          setSheet(false);
          await load();
        },
      },
    ]);
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
          <Text style={[styles.title, { color: palette.ink }]}>Introiti</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openNew} style={styles.addBtn}>
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
            Entrato nel mese
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {formatAmount(total)}
          </Text>
        </View>

        {incomes.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {incomes.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <TouchableOpacity
                  style={styles.entryRow}
                  onPress={() => openEdit(entry)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.entryLabel, { color: palette.ink }]}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.entryMeta, { color: palette.ink3 }]}>
                      {shortDateTime(entry.occurred_at)}
                    </Text>
                  </View>
                  <Text style={[styles.entryAmount, { color: palette.good }]}>
                    +{formatAmount(entry.amount)}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun introito in questo mese. Aggiungi lo stipendio o i ricavi
            delle tue attività quando li ricevi.
          </Text>
        )}
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={editing ? "Modifica introito" : "Nuovo introito"}
      >
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. Stipendio"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink },
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
            { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink },
          ]}
        />

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.input,
            styles.inputButton,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
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

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nota facoltativa"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            { backgroundColor: palette.surface, borderColor: palette.hairline, color: palette.ink },
          ]}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={save}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>Salva</Text>
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity style={styles.ghost} onPress={() => confirmDelete(editing)}>
            <Text style={[styles.ghostText, { color: palette.over }]}>
              Elimina introito
            </Text>
          </TouchableOpacity>
        )}
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
  fieldLabel: { ...type.caption },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  inputButton: { justifyContent: "center" },
  button: { borderRadius: radius.button, paddingVertical: 14, alignItems: "center", marginTop: space.xs },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  ghost: { paddingVertical: 8, alignItems: "center" },
  ghostText: { ...type.body },
});
