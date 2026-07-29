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
import { formatAmount, shortDateTime, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Payment, PaymentSplit } from "../lib/types";

type Props = {
  payment: Payment;
  onBack: () => void;
  onChanged: () => void;
  onOpenMerchant: (merchantId: string, title: string) => void;
};

type Row = {
  label: string;
  value: string;
  /** Icona a sinistra del valore, per la riga della categoria. */
  icon?: string;
  iconColor?: string;
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

  const rows: Row[] = [
    {
      label: "Categoria",
      value: category?.name ?? "Da categorizzare",
      icon: category?.icon ?? "circle-help",
      iconColor: color,
    },
    // Il metodo compare sempre, anche vuoto: sapere che il dato non e'
    // arrivato e' un'informazione, cercarlo invano no. Le spese importate
    // dagli estratti conto non lo portano con se'.
    { label: "Metodo di pagamento", value: payment.card_name ?? "—" },
    { label: "Origine", value: SOURCE_LABEL[payment.source] ?? payment.source },
  ];
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
            <View style={[styles.icon, { backgroundColor: tint(color, dark) }]}>
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

            <Text style={[styles.when, { color: palette.ink3 }]}>
              {shortDateTime(payment.occurred_at)}
            </Text>

            {isSplit && (
              <Text style={[styles.splitNote, { color: palette.ink2 }]}>
                quota tua su {formatAmount(Number(payment.amount))} pagati
              </Text>
            )}
          </View>

          <View style={styles.rows}>
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
                  <View style={styles.rowValueWrap}>
                    {row.icon && (
                      <Icon
                        name={row.icon}
                        size={14}
                        color={row.iconColor ?? palette.ink2}
                      />
                    )}
                    <Text
                      style={[styles.rowValue, { color: palette.ink }]}
                      numberOfLines={2}
                    >
                      {row.value}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {splits.length > 0 && (
            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                Divisa con
              </Text>
              <View style={styles.rows}>
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
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color }]}>
                    {merchantTotal.count}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    {merchantTotal.count === 1 ? "transazione" : "transazioni"}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color }]}>
                    {formatAmount(merchantTotal.total)}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    totale speso
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.link}
                onPress={() =>
                  onOpenMerchant(payment.merchant_id!, payment.merchant_name)
                }
              >
                <Text style={[styles.linkText, { color: palette.accent }]}>
                  Vedi tutte le transazioni
                </Text>
                <Icon name="chevron-right" size={15} color={palette.accent} />
              </TouchableOpacity>
            </View>
          )}

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
  when: { ...type.caption, marginTop: -2 },
  splitNote: { ...type.small },
  rows: {},
  divider: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 13,
  },
  rowLabel: { ...type.caption },
  rowHint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  rowValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  rowValue: {
    ...type.caption,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  label: { ...type.label, marginBottom: space.sm },
  statsRow: { flexDirection: "row", gap: space.xxl },
  stat: { gap: 3 },
  statValue: { ...type.bodyMedium, fontSize: 17, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 13,
    marginTop: space.sm,
  },
  linkText: { ...type.body },
});
