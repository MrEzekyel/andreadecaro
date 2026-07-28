import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EditPaymentSheet } from "../components/EditPaymentSheet";
import { Icon } from "../components/Icon";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Payment, PaymentSplit } from "../lib/types";

type Props = {
  payment: Payment;
  onBack: () => void;
  onChanged: () => void;
  onOpenMerchant: (merchantId: string, title: string) => void;
};

const SOURCE_LABEL: Record<string, string> = {
  shortcut: "Apple Pay",
  siri: "Dettata a Siri",
  manual: "Inserita a mano",
  recurring: "Ricorrente",
};

export default function TransactionDetailScreen({
  payment: initial,
  onBack,
  onChanged,
  onOpenMerchant,
}: Props) {
  const { palette, dark } = useTheme();
  const { categoryById, personById } = useData();

  const [payment, setPayment] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [merchantTotal, setMerchantTotal] = useState<{
    count: number;
    total: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [fresh, splitRows] = await Promise.all([
      supabase.from("payments").select("*").eq("id", initial.id).maybeSingle(),
      supabase.from("payment_splits").select("*").eq("payment_id", initial.id),
    ]);

    if (fresh.data) setPayment(fresh.data as Payment);
    if (splitRows.data) setSplits(splitRows.data as PaymentSplit[]);

    if (initial.merchant_id) {
      const { data } = await supabase
        .from("payments")
        .select("effective_amount")
        .eq("merchant_id", initial.merchant_id);

      if (data) {
        setMerchantTotal({
          count: data.length,
          total: data.reduce((sum, r) => sum + Number(r.effective_amount), 0),
        });
      }
    }
  }, [initial.id, initial.merchant_id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExcluded(value: boolean) {
    // Ottimistico: il tocco su uno switch deve rispondere subito, e in caso
    // di errore lo si riporta indietro.
    setPayment((p) => ({ ...p, excluded_from_stats: value }));

    const { error } = await supabase
      .from("payments")
      .update({ excluded_from_stats: value })
      .eq("id", payment.id);

    if (error) {
      setPayment((p) => ({ ...p, excluded_from_stats: !value }));
      Alert.alert("Errore", error.message);
      return;
    }
    onChanged();
  }

  const category = categoryById(payment.category_id);
  const color = category
    ? categoryColor(category.color, dark)
    : palette.uncategorized;

  const amount = splitAmount(Number(payment.effective_amount));
  const isSplit = payment.my_share !== null;

  const rows: { label: string; value: string }[] = [
    { label: "Data", value: formatDate(payment.occurred_at) },
    { label: "Origine", value: SOURCE_LABEL[payment.source] ?? payment.source },
  ];
  if (payment.card_name) rows.push({ label: "Carta", value: payment.card_name });
  if (payment.city) rows.push({ label: "Città", value: payment.city });
  if (payment.transaction_name && payment.transaction_name !== payment.merchant_name) {
    rows.push({ label: "Nome", value: payment.transaction_name });
  }
  if (payment.note) rows.push({ label: "Nota", value: payment.note });

  return (
    <>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.back}
            accessibilityLabel="Indietro"
          >
            <Icon name="chevron-left" size={20} color={palette.ink} />
          </TouchableOpacity>
          <Text style={[styles.headTitle, { color: palette.ink }]}>Spesa</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.edit, { color: palette.accent }]}>Modifica</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View
              style={[styles.icon, { backgroundColor: tint(color, dark) }]}
            >
              <Icon
                name={category?.icon ?? "circle-help"}
                size={22}
                color={color}
              />
            </View>

            <Text style={[styles.merchant, { color: palette.ink }]}>
              {payment.merchant_name}
            </Text>

            <Text style={[styles.amount, { color: palette.ink }]}>
              {amount.whole}
              <Text style={[styles.cents, { color: palette.ink3 }]}>
                {amount.cents}
              </Text>
            </Text>

            {isSplit && (
              <Text style={[styles.splitNote, { color: palette.ink2 }]}>
                quota tua su {formatAmount(Number(payment.amount))} pagati
              </Text>
            )}

            <View
              style={[styles.chip, { backgroundColor: tint(color, dark) }]}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.chipText, { color }]}>
                {category?.name ?? "Da categorizzare"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {rows.map((row, index) => (
              <View key={row.label}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: palette.ink3 }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[styles.rowValue, { color: palette.ink }]}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {splits.length > 0 && (
            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                Divisa con
              </Text>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                {splits.map((split, index) => (
                  <View key={split.id}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: palette.hairline },
                        ]}
                      />
                    )}
                    <View style={styles.row}>
                      <Text style={[styles.rowLabel, { color: palette.ink2 }]}>
                        {personById(split.person_id)?.name ?? "—"}
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          {
                            color: split.settled_at ? palette.good : palette.ink,
                          },
                        ]}
                      >
                        {formatAmount(Number(split.amount_owed))}
                        {split.settled_at ? " · saldato" : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {payment.merchant_id && merchantTotal && (
            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                Presso questo esercente
              </Text>

              <View style={styles.statsRow}>
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.statValue, { color: color }]}>
                    {merchantTotal.count}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    {merchantTotal.count === 1 ? "transazione" : "transazioni"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.statValue, { color: color }]}>
                    {formatAmount(merchantTotal.total)}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    totale speso
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.linkButton,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.hairline,
                  },
                ]}
                onPress={() =>
                  onOpenMerchant(payment.merchant_id!, payment.merchant_name)
                }
              >
                <Text style={[styles.linkText, { color: palette.accent }]}>
                  Vedi tutte le transazioni
                </Text>
                <Icon name="chevron-right" size={16} color={palette.accent} />
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Text style={[styles.rowLabel, { color: palette.ink }]}>
                  Escludi dalle classifiche
                </Text>
                <Text style={[styles.rowHint, { color: palette.ink3 }]}>
                  Resta nel totale speso, ma non compare in "dove spendo di più".
                </Text>
              </View>
              <Switch
                value={payment.excluded_from_stats}
                onValueChange={toggleExcluded}
                trackColor={{ true: palette.accent, false: palette.hairline }}
              />
            </View>
          </View>
        </ScrollView>
      </View>

      <EditPaymentSheet
        payment={editing ? payment : null}
        visible={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          load();
          onChanged();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: { padding: 2 },
  headTitle: { ...type.bodyMedium, flex: 1 },
  edit: { ...type.body },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  hero: { alignItems: "center", gap: space.sm },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: { ...type.title, textAlign: "center" },
  amount: { ...type.hero, fontVariant: ["tabular-nums"] },
  cents: { ...type.heroCents },
  splitNote: { ...type.small },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  chipText: { ...type.caption, fontWeight: "500" },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 13,
  },
  rowLabel: { ...type.caption },
  rowHint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  rowValue: { ...type.caption, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  label: { ...type.label, marginBottom: space.sm },
  statsRow: { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  statCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.md,
    alignItems: "center",
    gap: 3,
  },
  statValue: { ...type.bodyMedium, fontSize: 16, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5 },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: 13,
  },
  linkText: { ...type.bodyMedium },
});
