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
import { useData } from "../lib/DataContext";
import { resolveMerchant } from "../lib/merchants";
import { CardPicker } from "./CardPicker";
import { CategoryPicker } from "./CategoryPicker";
import { MerchantPicker } from "./MerchantPicker";
import { Sheet } from "./Sheet";
import {
  computeSplit,
  emptySplit,
  settledOnInsertIds,
  SplitEditor,
  SplitState,
} from "./SplitEditor";

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

export function AddPaymentSheet({ visible, onClose, onSaved }: Props) {
  const { palette, dark } = useTheme();
  const { people, reload: reloadData } = useData();

  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Una categoria scelta a mano non deve essere sovrascritta scegliendo poi
  // l'esercente dall'elenco: `null` da solo non distingue "non ho scelto" da
  // "ho scelto Nessuna".
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [card, setCard] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [split, setSplit] = useState<SplitState>(emptySplit);

  function reset() {
    setMerchant("");
    setAmount("");
    setNote("");
    setCategoryId(null);
    setCategoryTouched(false);
    setCard("");
    setOccurredAt(new Date());
    setSplit(emptySplit);
  }

  async function save() {
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

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setSaving(false);
      Alert.alert("Sessione scaduta", "Accedi di nuovo per salvare la spesa.");
      return;
    }

    const resolved = await resolveMerchant(userId, merchant);

    const { data: inserted, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        amount: parsedAmount,
        merchant_raw: merchant.trim(),
        merchant_name: merchant.trim(),
        merchant_id: resolved?.merchant_id ?? null,
        // Se non scegli una categoria, eredita quella gia' ricordata
        // per questo esercente — o per la sua insegna.
        category_id: categoryId ?? resolved?.effective_category_id ?? null,
        occurred_at: occurredAt.toISOString(),
        note: note.trim() || null,
        card_name: card.trim() || null,
        source: "manual",
        my_share: split.enabled ? splitResult.myShare : null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSaving(false);
      Alert.alert("Errore", error?.message ?? "Salvataggio non riuscito.");
      return;
    }

    // Le quote nascono insieme alla spesa, non in un secondo passaggio: ogni
    // riga e' per forza nuova, quindi qui e' un semplice insert — nessuna
    // quota preesistente da preservare come in `EditPaymentSheet`.
    if (split.enabled && split.personIds.length > 0) {
      const settleNow = settledOnInsertIds(split, people);
      const { error: splitError } = await supabase.from("payment_splits").insert(
        split.personIds.map((personId) => ({
          payment_id: inserted.id,
          person_id: personId,
          amount_owed: splitResult.owed[personId] ?? 0,
          settled_at: settleNow.has(personId) ? new Date().toISOString() : null,
        }))
      );

      if (splitError) {
        setSaving(false);
        Alert.alert(
          "Spesa salvata, ma non la divisione",
          `Le quote non sono state registrate: ${splitError.message}`
        );
        reloadData();
        reset();
        onSaved();
        onClose();
        return;
      }
    }

    setSaving(false);

    // Un esercente nuovo deve comparire fra i suggerimenti del foglio
    // successivo senza chiudere e riaprire l'app.
    reloadData();
    reset();
    onSaved();
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Nuova spesa">
      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Esercente
        </Text>
        <MerchantPicker
          value={merchant}
          onChange={setMerchant}
          onPick={(_picked, categoryId) => {
            if (!categoryTouched) setCategoryId(categoryId);
          }}
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
        <>
          <DateTimePicker
            value={occurredAt}
            mode="date"
            themeVariant={dark ? "dark" : "light"}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, selected) => {
              if (Platform.OS !== "ios") setShowDatePicker(false);
              if (selected) setOccurredAt(selected);
            }}
          />
          {/* Il calendario "inline" di iOS resta aperto finche' non lo si
              chiude a mano: senza questo tasto non c'e' altro modo di
              uscirne se non toccare fuori dal foglio. */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              style={styles.doneButton}
              accessibilityRole="button"
            >
              <Text style={[styles.doneText, { color: palette.accent }]}>Fatto</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Categoria
        </Text>
        <CategoryPicker
          value={categoryId}
          onChange={(next) => {
            setCategoryTouched(true);
            setCategoryId(next);
          }}
        />
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

      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.accent }]}
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
  doneButton: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 2 },
  doneText: { ...type.bodyMedium, fontSize: 14.5 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
