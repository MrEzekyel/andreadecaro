import DateTimePicker from "@react-native-community/datetimepicker";
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
import { formatDate } from "../lib/format";
import { GROUP_LABEL, GROUP_ORDER } from "../lib/portfolio";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, tint, type } from "../lib/theme";
import { Asset, Investment } from "../lib/types";
import { AddAssetSheet } from "./AddAssetSheet";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

function parseAmountInput(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const KIND_LABEL: Record<Investment["kind"], string> = {
  buy: "Acquisto",
  sell: "Vendita",
  dividend: "Dividendo",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  assets: Asset[];
  reloadAssets: () => void;
};

/**
 * Inserimento manuale di un investimento — la parte che mancava per chi
 * scarica l'app con un portafoglio già avviato altrove: prima gli acquisti
 * entravano solo dall'estratto conto o dai piani di accumulo, mai a mano.
 *
 * **Un acquisto o una vendita non si salvano mai senza un prezzo.**
 * `buildPositions()` (lib/portfolio.ts) somma l'importo di ogni operazione
 * `settled` alle quote possedute solo se porta con sé `quantity`: senza,
 * l'importo finirebbe comunque nel capitale versato ma le quote resterebbero
 * a zero, e la posizione apparirebbe *chiusa* nonostante il denaro sia
 * uscito — una perdita del 100% inventata. Per questo si cerca sempre un
 * prezzo alla data scelta (`asset_prices`, il più recente non successivo) e,
 * se non c'è, si blocca il salvataggio invece di inventare quote da un
 * prezzo che non si conosce. I dividendi non hanno questo vincolo: non
 * toccano `quantity`, solo l'importo.
 */
export function AddInvestmentSheet({ visible, onClose, onSaved, assets, reloadAssets }: Props) {
  const { palette, dark } = useTheme();

  const [assetId, setAssetId] = useState<string | null>(null);
  const [kind, setKind] = useState<Investment["kind"]>("buy");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);

  function reset() {
    setAssetId(null);
    setKind("buy");
    setAmount("");
    setOccurredAt(new Date());
  }

  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    assets: assets.filter((a) => a.asset_group === group && !a.archived),
  })).filter((g) => g.assets.length > 0);

  async function save() {
    const asset = assets.find((a) => a.id === assetId);
    const parsedAmount = parseAmountInput(amount);

    if (!asset) {
      Alert.alert("Manca il titolo", "Scegli su cosa hai investito.");
      return;
    }
    if (parsedAmount === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    const dateIso = occurredAt.toISOString();

    setSaving(true);

    let quantity: number | null = null;
    let unitPrice: number | null = null;

    if (kind !== "dividend") {
      const { data: priceRow, error: priceError } = await supabase
        .from("asset_prices")
        .select("close_eur, on_date")
        .eq("asset_id", asset.id)
        .lte("on_date", dateIso.slice(0, 10))
        .order("on_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priceError) {
        setSaving(false);
        Alert.alert("Errore", priceError.message);
        return;
      }

      if (!priceRow) {
        setSaving(false);
        Alert.alert(
          "Nessun prezzo per questa data",
          `Non ho un prezzo di "${asset.name}" a quella data, quindi non posso calcolare le quote — servirebbe per non far apparire l'operazione come una posizione chiusa. Prova una data più recente, o aggiorna lo storico dell'asset.`
        );
        return;
      }

      unitPrice = Number(priceRow.close_eur);
      quantity = parsedAmount / unitPrice;
    }

    const { error } = await supabase.from("investments").insert({
      asset_id: asset.id,
      label: asset.name,
      amount: parsedAmount,
      kind,
      quantity,
      unit_price: unitPrice,
      status: "settled",
      occurred_at: dateIso,
      source: "manual",
    });

    setSaving(false);

    if (error) {
      Alert.alert("Non salvato", error.message);
      return;
    }

    reset();
    onSaved();
    onClose();
  }

  return (
      <Sheet
        visible={visible}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Nuovo investimento"
      >
        <Text style={styles.field}>Titolo</Text>
        {byGroup.map(({ group, assets: groupAssets }) => (
          <View key={group} style={styles.groupBlock}>
            <Text style={[styles.groupLabel, { color: palette.ink3 }]}>
              {GROUP_LABEL[group]}
            </Text>
            <View style={styles.chips}>
              {groupAssets.map((asset) => {
                const selected = asset.id === assetId;
                return (
                  <TouchableOpacity
                    key={asset.id}
                    onPress={() => setAssetId(asset.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? tint(palette.invest, dark)
                          : palette.surface2,
                        borderColor: selected ? palette.invest : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: selected ? palette.invest : palette.ink2 },
                      ]}
                    >
                      {asset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.newAsset, { borderColor: palette.hairline }]}
          onPress={() => setAddingAsset(true)}
        >
          <Icon name="plus" size={14} color={palette.invest} />
          <Text style={[styles.newAssetText, { color: palette.invest }]}>
            Nuovo asset
          </Text>
        </TouchableOpacity>

        <Text style={styles.field}>Tipo</Text>
        <View style={styles.chips}>
          {(Object.keys(KIND_LABEL) as Investment["kind"][]).map((value) => {
            const selected = value === kind;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setKind(value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? tint(palette.invest, dark)
                      : palette.surface2,
                    borderColor: selected ? palette.invest : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? palette.invest : palette.ink2 },
                  ]}
                >
                  {KIND_LABEL[value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.field}>Importo</Text>
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

        <Text style={styles.field}>Data</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.input,
            styles.dateButton,
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
            maximumDate={new Date()}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, selected) => {
              if (Platform.OS !== "ios") setShowDatePicker(false);
              if (selected) setOccurredAt(selected);
            }}
          />
        )}

        {kind !== "dividend" && (
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Le quote si calcolano dal prezzo di chiusura di quel giorno: se
            non l'abbiamo ancora, il salvataggio si blocca invece di
            inventare un numero.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.save, { backgroundColor: palette.invest }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={palette.onAccent} />
          ) : (
            <Text style={[styles.saveText, { color: palette.onAccent }]}>Salva</Text>
          )}
        </TouchableOpacity>

        {/* Dentro il foglio, non accanto: due `Modal` fratelli non possono
            stare aperti insieme su iOS — il secondo viene presentato da una
            vista che e' gia' coperta dal primo e non compare mai. Annidato
            nell'albero del foglio che lo apre, invece, si presenta sopra.
            E' il motivo per cui "Nuovo asset" prima non faceva nulla. */}
        <AddAssetSheet
          visible={addingAsset}
          onClose={() => setAddingAsset(false)}
          assets={assets}
          onCreated={(asset) => {
            reloadAssets();
            setAssetId(asset.id);
          }}
        />
      </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { ...type.label, marginTop: space.md, marginBottom: space.sm },
  groupBlock: { gap: space.xs },
  groupLabel: { ...type.small, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { ...type.small, fontWeight: "500" },
  newAsset: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1,
    marginTop: space.sm,
  },
  newAssetText: { ...type.small, fontWeight: "500" },
  input: {
    borderRadius: radius.field,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    ...type.body,
  },
  dateButton: { justifyContent: "center" },
  note: { ...type.small, lineHeight: 17, marginTop: space.xs },
  save: {
    marginTop: space.xl,
    paddingVertical: 14,
    borderRadius: radius.button,
    alignItems: "center",
  },
  saveText: { ...type.body, fontWeight: "500" },
});
