import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../lib/ThemeContext";
import { formatDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { Sheet } from "./Sheet";

/**
 * I campi che questo foglio legge e riscrive. Un sottoinsieme di `Income`
 * (lib/types.ts) invece del tipo intero: chi lo apre da un elenco che non ha
 * letto `user_id`/`is_reimbursement` (Home, che si tiene leggera) non deve
 * procurarseli solo per soddisfare il tipo — nessuno dei due qui li tocca.
 */
export type EditableIncome = {
  id: string;
  label: string;
  amount: number;
  note: string | null;
  occurred_at: string;
};

type Props = {
  /** L'introito da modificare, o `null` quando il foglio e' chiuso. */
  income: EditableIncome | null;
  onClose: () => void;
  onSaved: () => void;
};

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Modifica/eliminazione di un introito, usata sia da `MovementsScreen`
 * (Entrate, tocco sulla riga) sia da Home (Ultimi introiti): stessa logica di
 * apertura, la stessa gia' provata prima che ci fosse un secondo elenco da
 * cui aprirla.
 *
 * Non e' `AddIncomeSheet` in modalita' modifica: qui c'e' gia' un `id` da
 * aggiornare/cancellare invece che da creare, e i due fogli non condividono
 * abbastanza (niente `insert`, in piu' l'eliminazione) perche' un solo
 * componente coi due modi regga meglio di due gemelli separati.
 */
export function EditIncomeSheet({ income, onClose, onSaved }: Props) {
  const { palette } = useTheme();

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  // L'ultimo introito aperto, tenuto anche dopo che il chiamante azzera
  // `income` per chiudere: il foglio scivola giu' con un'animazione, e senza
  // questo i campi sparirebbero a meta' invece di restare leggibili fino a
  // che non e' sparito del tutto.
  const [current, setCurrent] = useState<EditableIncome | null>(null);

  useEffect(() => {
    if (!income) return;
    setCurrent(income);
    setLabel(income.label);
    setAmount(String(income.amount).replace(".", ","));
    setNote(income.note ?? "");
    setOccurredAt(new Date(income.occurred_at));
  }, [income]);

  async function save() {
    if (!current) return;
    const parsedAmount = parseAmountInput(amount);
    if (!label.trim()) {
      Alert.alert("Nome mancante", "Dai un nome all'introito.");
      return;
    }
    if (parsedAmount === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("incomes")
      .update({
        label: label.trim(),
        amount: parsedAmount,
        note: note.trim() || null,
        occurred_at: occurredAt.toISOString(),
      })
      .eq("id", current.id);
    setSaving(false);

    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }

    onSaved();
    onClose();
  }

  function confirmDelete() {
    if (!current) return;
    Alert.alert(`Eliminare "${current.label}"?`, "L'operazione non è reversibile.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("incomes")
            .delete()
            .eq("id", current.id);
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

  return (
    <Sheet visible={income !== null} onClose={onClose} title="Modifica introito">
      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Nome</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. Stipendio"
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

      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.good }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>Salva</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghost} onPress={confirmDelete}>
        <Text style={[styles.ghostText, { color: palette.over }]}>
          Elimina introito
        </Text>
      </TouchableOpacity>
    </Sheet>
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
