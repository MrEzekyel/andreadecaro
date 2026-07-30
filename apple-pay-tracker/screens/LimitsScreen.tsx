import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { LimitCard } from "../components/LimitCard";
import { CategoryPicker } from "../components/CategoryPicker";
import { Sheet } from "../components/Sheet";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { SpendingLimit } from "../lib/types";
import { useLimits } from "../lib/useLimits";

const WARN_CHOICES = [50, 60, 70, 75, 80, 90];

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function LimitsScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const { statuses, reload } = useLimits();

  const [editing, setEditing] = useState<SpendingLimit | null>(null);
  const [open, setOpen] = useState(false);

  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [warnAt, setWarnAt] = useState(80);
  const [scopeAll, setScopeAll] = useState(true);

  function openCreate() {
    setEditing(null);
    setPeriod("monthly");
    setAmount("");
    setCategoryId(null);
    setScopeAll(true);
    setWarnAt(80);
    setOpen(true);
  }

  function openEdit(limit: SpendingLimit) {
    setEditing(limit);
    setPeriod(limit.period);
    setAmount(String(limit.amount).replace(".", ","));
    setCategoryId(limit.category_id);
    setScopeAll(limit.category_id === null);
    setWarnAt(limit.warn_at_percent);
    setOpen(true);
  }

  async function save() {
    const parsed = parseAmountInput(amount);
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un limite maggiore di zero.");
      return;
    }

    const targetCategory = scopeAll ? null : categoryId;
    if (!scopeAll && !targetCategory) {
      Alert.alert("Categoria mancante", "Scegli la categoria da limitare.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("spending_limits")
        .update({
          period,
          amount: parsed,
          category_id: targetCategory,
          warn_at_percent: warnAt,
        })
        .eq("id", editing.id);
      if (error) {
        Alert.alert("Errore", describe(error));
        return;
      }
    } else {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        Alert.alert("Sessione scaduta", "Accedi di nuovo.");
        return;
      }
      const { error } = await supabase.from("spending_limits").insert({
        user_id: userId,
        period,
        amount: parsed,
        category_id: targetCategory,
        warn_at_percent: warnAt,
      });
      if (error) {
        Alert.alert("Errore", describe(error));
        return;
      }
    }

    setOpen(false);
    await reload();
  }

  function describe(error: { code?: string; message: string }) {
    return error.code === "23505"
      ? "Esiste già un limite per questo periodo e questa categoria. Modifica quello."
      : error.message;
  }

  function confirmDelete(limit: SpendingLimit) {
    Alert.alert("Eliminare il limite?", "Non riceverai più avvisi per questo.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("spending_limits")
            .delete()
            .eq("id", limit.id);
          if (error) {
            Alert.alert("Errore", error.message);
            return;
          }
          await reload();
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
          <Text style={[styles.title, { color: palette.ink }]}>Limiti</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {statuses.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun limite impostato. Creane uno per ricevere un avviso quando ti
            avvicini alla soglia.
          </Text>
        )}

        {statuses.map((status) => (
          <View key={status.limit.id} style={styles.limitBlock}>
            <LimitCard status={status} onPress={() => openEdit(status.limit)} />
            <TouchableOpacity
              style={styles.deleteRow}
              onPress={() => confirmDelete(status.limit)}
            >
              <Text style={[styles.deleteText, { color: palette.ink3 }]}>
                Elimina
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.note, { color: palette.ink3 }]}>
          La settimana comincia il lunedì. Gli avvisi compaiono nella Home; le
          notifiche push arriveranno più avanti.
        </Text>
      </ScrollView>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifica limite" : "Nuovo limite"}
      >
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Periodo</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {(["weekly", "monthly"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setPeriod(option)}
              style={[
                styles.segmentOption,
                period === option && { backgroundColor: palette.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: period === option ? palette.ink : palette.ink3 },
                ]}
              >
                {option === "weekly" ? "Settimanale" : "Mensile"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Importo</Text>
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

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Si applica a
        </Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          <TouchableOpacity
            onPress={() => setScopeAll(true)}
            style={[
              styles.segmentOption,
              scopeAll && { backgroundColor: palette.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: scopeAll ? palette.ink : palette.ink3 },
              ]}
            >
              Tutto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScopeAll(false)}
            style={[
              styles.segmentOption,
              !scopeAll && { backgroundColor: palette.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: !scopeAll ? palette.ink : palette.ink3 },
              ]}
            >
              Una categoria
            </Text>
          </TouchableOpacity>
        </View>

        {!scopeAll && (
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Primo avviso al
        </Text>
        <View style={styles.warnRow}>
          {WARN_CHOICES.map((choice) => (
            <TouchableOpacity
              key={choice}
              onPress={() => setWarnAt(choice)}
              style={[
                styles.warnChip,
                {
                  backgroundColor:
                    warnAt === choice ? palette.accent : palette.surface,
                  borderColor:
                    warnAt === choice ? palette.accent : palette.hairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.warnText,
                  { color: warnAt === choice ? palette.onAccent : palette.ink2 },
                ]}
              >
                {choice}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
  list: { padding: space.lg, gap: space.lg },
  limitBlock: { gap: 4 },
  deleteRow: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 4 },
  deleteText: { ...type.small },
  empty: { ...type.body, lineHeight: 21, textAlign: "center", marginTop: space.xl },
  note: { ...type.small, lineHeight: 17 },
  fieldLabel: { ...type.caption, marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  warnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warnChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  warnText: { ...type.caption, fontWeight: "500" },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.md,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
