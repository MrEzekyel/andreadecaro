import React, { useMemo, useState } from "react";
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
import { Sheet } from "../components/Sheet";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { GROUP_LABEL, GROUP_ORDER } from "../lib/portfolio";
import { supabase } from "../lib/supabase";
import { radius, space, tint, type } from "../lib/theme";
import { Asset, InvestmentRule, RecurringFrequency } from "../lib/types";

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: "Ogni settimana",
  monthly: "Ogni mese",
  yearly: "Ogni anno",
};

/** Quanto pesa al mese un piano, qualunque sia la sua cadenza. */
function monthlyEquivalent(rule: InvestmentRule) {
  const amount = Number(rule.amount);
  if (rule.frequency === "weekly") return (amount * 52) / 12;
  if (rule.frequency === "yearly") return amount / 12;
  return amount;
}

function parseAmountInput(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type Props = {
  rules: InvestmentRule[];
  assets: Asset[];
  onBack: () => void;
  onSaved: () => void;
};

/**
 * I piani di accumulo: quanto entra ogni mese e su cosa.
 *
 * Da quando lo storico arriva dall'estratto conto del broker, questi piani
 * **descrivono** e non **generano**: le operazioni vere le porta l'import, e
 * una regola che creasse la rata stimata la duplicherebbe. Restano qui perche'
 * sono l'unica cosa che dice cosa succedera' il mese prossimo — e' il dato su
 * cui si appoggia qualunque proiezione.
 */
export default function PacScreen({ rules, assets, onBack, onSaved }: Props) {
  const { palette, dark } = useTheme();

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<InvestmentRule | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [day, setDay] = useState("3");
  const [saving, setSaving] = useState(false);

  const assetById = useMemo(
    () => new Map(assets.map((a) => [a.id, a])),
    [assets]
  );

  const active = rules.filter((r) => r.active);
  const paused = rules.filter((r) => !r.active);
  const monthlyTotal = active.reduce((s, r) => s + monthlyEquivalent(r), 0);

  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    rules: rules.filter((r) => {
      const asset = r.asset_id ? assetById.get(r.asset_id) : undefined;
      return asset?.asset_group === group;
    }),
  })).filter((g) => g.rules.length > 0);

  const orphans = rules.filter(
    (r) => !r.asset_id || !assetById.has(r.asset_id)
  );

  function openNew() {
    setEditing(null);
    setAssetId(assets[0]?.id ?? null);
    setAmount("");
    setFrequency("monthly");
    setDay("3");
    setSheet(true);
  }

  function openEdit(rule: InvestmentRule) {
    setEditing(rule);
    setAssetId(rule.asset_id);
    setAmount(String(rule.amount).replace(".", ","));
    setFrequency(rule.frequency);
    setDay(String(rule.day_of_month ?? 1));
    setSheet(true);
  }

  async function save() {
    const parsed = parseAmountInput(amount);
    const asset = assetId ? assetById.get(assetId) : undefined;

    if (!asset) {
      Alert.alert("Titolo mancante", "Scegli su cosa versa questo piano.");
      return;
    }
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un importo maggiore di zero.");
      return;
    }

    const dayNumber = Math.min(Math.max(Number(day) || 1, 1), 28);
    const payload = {
      asset_id: asset.id,
      label: asset.name,
      amount: parsed,
      frequency,
      day_of_month: frequency === "weekly" ? null : dayNumber,
      card_name: "Trade Republic",
    };

    setSaving(true);
    const { error } = editing
      ? await supabase.from("investment_rules").update(payload).eq("id", editing.id)
      : await supabase.from("investment_rules").insert({
          ...payload,
          // I piani descrivono, non generano: `next_run_on` non fa piu'
          // scattare niente, ma la colonna e' obbligatoria dallo schema.
          next_run_on: new Date().toISOString().slice(0, 10),
          active: true,
        });
    setSaving(false);

    if (error) {
      Alert.alert("Non salvato", error.message);
      return;
    }
    setSheet(false);
    onSaved();
  }

  async function toggle(rule: InvestmentRule) {
    await supabase
      .from("investment_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);
    onSaved();
  }

  function confirmDelete(rule: InvestmentRule) {
    Alert.alert("Eliminare il piano?", rule.label, [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          await supabase.from("investment_rules").delete().eq("id", rule.id);
          onSaved();
        },
      },
    ]);
  }

  return (
    <SwipeBack onBack={onBack}>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity onPress={onBack} hitSlop={backHitSlop} style={styles.back}>
          <Icon name="chevron-left" size={18} color={palette.ink2} />
          <Text style={[styles.backText, { color: palette.ink2 }]}>
            Investimenti
          </Text>
        </TouchableOpacity>

        <View>
          <Text style={[styles.title, { color: palette.ink }]}>
            Piani di accumulo
          </Text>
          <Text style={[styles.subtitle, { color: palette.ink3 }]}>
            quanto entra ogni mese, e su cosa
          </Text>
        </View>

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Al mese</Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {formatAmount(monthlyTotal)}
          </Text>
          <Text style={[styles.note, { color: palette.ink3 }]}>
            {active.length} pian{active.length === 1 ? "o" : "i"} in corso
            {paused.length > 0 ? ` · ${paused.length} in pausa` : ""}
          </Text>
        </View>

        {byGroup.map((group) => (
          <View key={group.group}>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              {group.label}
            </Text>
            {group.rules.map((rule) => (
              <PlanRow
                key={rule.id}
                rule={rule}
                share={monthlyTotal > 0 ? monthlyEquivalent(rule) / monthlyTotal : 0}
                onPress={() => openEdit(rule)}
                onToggle={() => toggle(rule)}
                onLongPress={() => confirmDelete(rule)}
              />
            ))}
          </View>
        ))}

        {orphans.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Senza titolo collegato
            </Text>
            {orphans.map((rule) => (
              <PlanRow
                key={rule.id}
                rule={rule}
                share={0}
                onPress={() => openEdit(rule)}
                onToggle={() => toggle(rule)}
                onLongPress={() => confirmDelete(rule)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.add, { borderColor: palette.hairline }]}
          onPress={openNew}
        >
          <Icon name="plus" size={16} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>
            Nuovo piano
          </Text>
        </TouchableOpacity>

        <Text style={[styles.note, { color: palette.ink3 }]}>
          Ogni piano attivo inserisce la sua rata da solo il giorno stabilito,
          segnandola come prevista: conta nel saldo, ma resta fuori dal prezzo
          medio e dal rendimento finche' non si sa a che prezzo ha comprato.
          Quando arriva l'estratto conto di Trade Republic, l'operazione vera
          prende il posto della stima di quel mese — cosi' la rata non finisce
          contata due volte.
        </Text>
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={editing ? "Modifica piano" : "Nuovo piano"}
      >
        <Text style={[styles.field, { color: palette.ink3 }]}>Titolo</Text>
        <View style={styles.chips}>
          {assets.map((asset) => {
            const selected = asset.id === assetId;
            return (
              <TouchableOpacity
                key={asset.id}
                onPress={() => setAssetId(asset.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? tint(palette.accent, dark)
                      : palette.surface2,
                    borderColor: selected ? palette.accent : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? palette.accent : palette.ink2 },
                  ]}
                >
                  {asset.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.field, { color: palette.ink3 }]}>Importo</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface2,
              color: palette.ink,
              borderColor: palette.hairline,
            },
          ]}
        />

        <Text style={[styles.field, { color: palette.ink3 }]}>Cadenza</Text>
        <View style={styles.chips}>
          {(Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((value) => {
            const selected = value === frequency;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setFrequency(value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? tint(palette.accent, dark)
                      : palette.surface2,
                    borderColor: selected ? palette.accent : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? palette.accent : palette.ink2 },
                  ]}
                >
                  {FREQUENCY_LABEL[value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {frequency !== "weekly" && (
          <>
            <Text style={[styles.field, { color: palette.ink3 }]}>
              Giorno del mese
            </Text>
            <TextInput
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface2,
                  color: palette.ink,
                  borderColor: palette.hairline,
                },
              ]}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.save, { backgroundColor: palette.accent }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={[styles.saveText, { color: palette.onAccent }]}>
            {saving ? "Salvo…" : "Salva"}
          </Text>
        </TouchableOpacity>
      </Sheet>
    </SwipeBack>
  );
}

function PlanRow({
  rule,
  share,
  onPress,
  onToggle,
  onLongPress,
}: {
  rule: InvestmentRule;
  share: number;
  onPress: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={styles.planRow}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.planMain}>
        <Text
          style={[
            styles.planName,
            { color: rule.active ? palette.ink : palette.ink3 },
          ]}
          numberOfLines={1}
        >
          {rule.label}
        </Text>
        <Text style={[styles.planMeta, { color: palette.ink3 }]}>
          {FREQUENCY_LABEL[rule.frequency].toLowerCase()}
          {rule.day_of_month ? ` il ${rule.day_of_month}` : ""}
          {rule.active && share > 0 ? ` · ${(share * 100).toFixed(0)}% del piano` : ""}
          {!rule.active ? " · in pausa" : ""}
        </Text>
      </View>

      <Text
        style={[
          styles.planAmount,
          { color: rule.active ? palette.ink : palette.ink3 },
        ]}
      >
        {formatAmount(Number(rule.amount))}
      </Text>

      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={rule.active ? "Metti in pausa" : "Riattiva"}
      >
        <Icon
          name={rule.active ? "pause" : "play"}
          size={15}
          color={palette.ink3}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  back: { flexDirection: "row", alignItems: "center", gap: 3 },
  backText: { ...type.body },
  title: { ...type.title },
  subtitle: { ...type.caption, marginTop: 2 },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontSize: 34 },
  note: { ...type.caption, lineHeight: 18, marginTop: space.xs },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 11,
  },
  planMain: { flex: 1, gap: 2 },
  planName: { ...type.body },
  planMeta: { ...type.small },
  planAmount: { ...type.amount },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  addText: { ...type.body, fontWeight: "500" },
  field: { ...type.label, marginTop: space.md, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { ...type.small, fontWeight: "500" },
  input: {
    borderRadius: radius.field,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    ...type.body,
  },
  save: {
    marginTop: space.xl,
    paddingVertical: 14,
    borderRadius: radius.button,
    alignItems: "center",
  },
  saveText: { ...type.body, fontWeight: "500" },
});
