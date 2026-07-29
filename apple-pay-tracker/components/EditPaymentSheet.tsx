import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { Payment } from "../lib/types";
import { CardPicker } from "./CardPicker";
import { CategoryPicker } from "./CategoryPicker";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import {
  computeSplit,
  emptySplit,
  SplitEditor,
  SplitState,
} from "./SplitEditor";

type Props = {
  payment: Payment | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Apre gia' con la divisione attiva, per chi arriva dal tasto "Dividi". */
  focusSplit?: boolean;
};

/** Accetta sia "12,99" sia "12.99", come li scrive chi digita in italiano. */
function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function EditPaymentSheet({
  payment,
  visible,
  onClose,
  onSaved,
  focusSplit,
}: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [card, setCard] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [split, setSplit] = useState<SplitState>(emptySplit);
  const [siblingCount, setSiblingCount] = useState(0);
  const [applyToAll, setApplyToAll] = useState(true);
  const [remember, setRemember] = useState(true);

  const originalCategoryId = payment?.category_id ?? null;
  const categoryChanged = categoryId !== originalCategoryId;

  useEffect(() => {
    if (!payment) return;
    setMerchant(payment.merchant_name);
    setAmount(String(payment.amount).replace(".", ","));
    setNote(payment.note ?? "");
    setCategoryId(payment.category_id);
    setCard(payment.card_name ?? "");
    setOccurredAt(new Date(payment.occurred_at));
    setApplyToAll(true);
    setRemember(true);
    setSiblingCount(0);
    setSplit(focusSplit ? { ...emptySplit, enabled: true } : emptySplit);

    // Le quote gia' salvate vanno ricaricate come importi esatti: e' l'unica
    // modalita' che rappresenta fedelmente qualunque divisione precedente,
    // anche se era stata fatta in parti uguali o a percentuale.
    supabase
      .from("payment_splits")
      .select("person_id, amount_owed")
      .eq("payment_id", payment.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setSplit({
          enabled: true,
          mode: "exact",
          personIds: data.map((row) => row.person_id),
          values: Object.fromEntries(
            data.map((row) => [
              row.person_id,
              String(row.amount_owed).replace(".", ","),
            ])
          ),
        });
      });
  }, [payment, focusSplit]);

  // Quante altre spese dello stesso esercente verrebbero toccate.
  useEffect(() => {
    let cancelled = false;

    async function countSiblings() {
      if (!payment?.merchant_id || !categoryChanged) {
        if (!cancelled) setSiblingCount(0);
        return;
      }
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", payment.merchant_id)
        .neq("id", payment.id);

      if (!cancelled) setSiblingCount(count ?? 0);
    }

    countSiblings();
    return () => {
      cancelled = true;
    };
  }, [payment, categoryChanged]);

  async function save() {
    if (!payment) return;

    const parsedAmount = parseAmountInput(amount);
    if (parsedAmount === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }
    if (!merchant.trim()) {
      Alert.alert("Esercente mancante", "Inserisci il nome dell'esercente.");
      return;
    }

    const splitResult = computeSplit(parsedAmount, split);
    if (!splitResult.valid) {
      Alert.alert(
        "Quote troppo alte",
        "La somma delle quote altrui supera il totale pagato."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("payments")
      .update({
        merchant_name: merchant.trim(),
        amount: parsedAmount,
        category_id: categoryId,
        note: note.trim() || null,
        card_name: card.trim() || null,
        occurred_at: occurredAt.toISOString(),
        my_share: split.enabled ? splitResult.myShare : null,
      })
      .eq("id", payment.id);

    if (error) {
      setSaving(false);
      Alert.alert("Errore", error.message);
      return;
    }

    // Le quote vengono riscritte da zero: gestire l'insieme differenziale
    // (chi e' stato tolto, chi aggiunto, chi cambiato) sarebbe piu' codice
    // per lo stesso risultato, e questa tabella e' piccola per definizione.
    await supabase.from("payment_splits").delete().eq("payment_id", payment.id);

    if (split.enabled && split.personIds.length > 0) {
      const rows = split.personIds.map((personId) => ({
        payment_id: payment.id,
        person_id: personId,
        amount_owed: splitResult.owed[personId] ?? 0,
      }));
      const { error: splitError } = await supabase
        .from("payment_splits")
        .insert(rows);

      if (splitError) {
        setSaving(false);
        Alert.alert(
          "Spesa salvata, ma non le quote",
          `La divisione non e' stata registrata: ${splitError.message}`
        );
        onSaved();
        onClose();
        return;
      }
    }

    // Le due scelte sono indipendenti: si possono volere entrambe, una sola,
    // o nessuna.
    if (categoryChanged && payment.merchant_id) {
      if (applyToAll && siblingCount > 0) {
        const { error: bulkError } = await supabase
          .from("payments")
          .update({ category_id: categoryId })
          .eq("merchant_id", payment.merchant_id)
          .neq("id", payment.id);

        if (bulkError) {
          setSaving(false);
          Alert.alert(
            "Spesa salvata, ma non le altre",
            `Le altre spese di questo esercente non sono state aggiornate: ${bulkError.message}`
          );
          onSaved();
          onClose();
          return;
        }
      }

      if (remember) {
        const { error: merchantError } = await supabase
          .from("merchants")
          .update({ category_id: categoryId })
          .eq("id", payment.merchant_id);

        if (merchantError) {
          setSaving(false);
          Alert.alert(
            "Spesa salvata, ma non la regola",
            `La categoria non verrà ricordata per i prossimi pagamenti: ${merchantError.message}`
          );
          onSaved();
          onClose();
          return;
        }
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  function confirmDelete() {
    if (!payment) return;
    Alert.alert("Eliminare la spesa?", "L'operazione non è reversibile.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("payments")
            .delete()
            .eq("id", payment.id);
          if (error) {
            Alert.alert("Errore", error.message);
            return;
          }
          onSaved();
          onClose();
        },
      },
    ]);
  }

  const newCategoryName = categoryById(categoryId)?.name ?? "Nessuna categoria";
  const showAsk = categoryChanged && !!payment?.merchant_id;

  return (
    <Sheet visible={visible} onClose={onClose} title="Modifica spesa">
      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Esercente
        </Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
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

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Importo</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
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

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Data</Text>
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
      </View>

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

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Categoria
        </Text>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Metodo di pagamento
        </Text>
        <CardPicker value={card} onChange={setCard} />
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Nota</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Facoltativa"
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

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Divisione
        </Text>
        <SplitEditor
          total={parseAmountInput(amount) ?? 0}
          split={split}
          onChange={setSplit}
        />
      </View>

      {showAsk && (
        <View style={[styles.ask, { backgroundColor: palette.accentSoft }]}>
          <Text style={[styles.askHead, { color: palette.ink }]}>
            Hai spostato {payment?.merchant_name} in {newCategoryName}.
          </Text>

          {siblingCount > 0 && (
            <Checkbox
              checked={applyToAll}
              onToggle={() => setApplyToAll((v) => !v)}
              label={`Applica anche alle altre ${siblingCount} spese di questo esercente`}
            />
          )}

          <Checkbox
            checked={remember}
            onToggle={() => setRemember((v) => !v)}
            label="Ricorda per i pagamenti futuri"
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.accent }]}
        onPress={save}
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

      <TouchableOpacity style={styles.ghost} onPress={confirmDelete}>
        <Text style={[styles.ghostText, { color: palette.over }]}>
          Elimina spesa
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={styles.check}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? palette.accent : palette.ink3,
            backgroundColor: checked ? palette.accent : "transparent",
          },
        ]}
      >
        {checked && <Icon name="check" size={11} color={palette.onAccent} strokeWidth={3} />}
      </View>
      <Text style={[styles.checkLabel, { color: palette.ink2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.caption, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  inputButton: { justifyContent: "center" },
  ask: {
    borderRadius: radius.card,
    padding: 14,
    gap: 11,
  },
  askHead: { ...type.caption, lineHeight: 19 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  box: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { ...type.caption, flex: 1, lineHeight: 18 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  ghost: { paddingVertical: 8, alignItems: "center" },
  ghostText: { ...type.body },
});
