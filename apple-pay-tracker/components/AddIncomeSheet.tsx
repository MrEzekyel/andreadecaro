import React, { useState } from "react";
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
import { useTheme } from "../lib/ThemeContext";
import { formatDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Gemello di `AddPaymentSheet`, ma per gli introiti: e' quello che apre il
 * tasto centrale della tabbar quando la scheda Movimenti e' su Entrate. Solo
 * aggiunta — modificare o eliminare un introito gia' registrato resta un
 * tocco sulla sua riga nella lista, dove la modifica ha gia' contesto (che
 * introito, di che mese) che qui non c'e' ancora.
 */
export function AddIncomeSheet({ visible, onClose, onSaved }: Props) {
  const { palette } = useTheme();

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setLabel("");
    setAmount("");
    setNote("");
    setOccurredAt(new Date());
  }

  async function save() {
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

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setSaving(false);
      Alert.alert("Sessione scaduta", "Accedi di nuovo per salvare l'introito.");
      return;
    }

    const { error } = await supabase.from("incomes").insert({
      user_id: userId,
      label: label.trim(),
      amount: parsedAmount,
      note: note.trim() || null,
      occurred_at: occurredAt.toISOString(),
    });

    setSaving(false);

    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }

    reset();
    onSaved();
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Nuovo introito">
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
        {saving ? (
          <ActivityIndicator color={palette.onAccent} />
        ) : (
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Aggiungi
          </Text>
        )}
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
});
