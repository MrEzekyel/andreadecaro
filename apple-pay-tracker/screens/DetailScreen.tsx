import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EditPaymentSheet } from "../components/EditPaymentSheet";
import { Icon } from "../components/Icon";
import { PaymentRow } from "../components/PaymentRow";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { dayLabel, formatAmount, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Payment } from "../lib/types";

/** Dettaglio di un singolo esercente oppure di una singola categoria. */
export type DetailTarget =
  | { kind: "merchant"; id: string; title: string }
  | { kind: "category"; id: string | null; title: string };

type Props = {
  target: DetailTarget;
  onBack: () => void;
};

export default function DetailScreen({ target, onBack }: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from("payments")
      .select("*")
      .order("occurred_at", { ascending: false });

    if (target.kind === "merchant") {
      query = query.eq("merchant_id", target.id);
    } else if (target.id === null) {
      // Le spese senza categoria si filtrano con IS NULL, non con "= null".
      query = query.is("category_id", null);
    } else {
      query = query.eq("category_id", target.id);
    }

    const { data } = await query;
    if (data) setPayments(data as Payment[]);
    setLoading(false);
  }, [target]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.effective_amount), 0),
    [payments]
  );

  /** Media per mese sui soli mesi in cui hai davvero speso qui. */
  const monthly = useMemo(() => {
    const months = new Set(
      payments.map((p) => p.occurred_at.slice(0, 7))
    );
    return months.size > 0 ? total / months.size : 0;
  }, [payments, total]);

  const accent =
    target.kind === "category"
      ? categoryById(target.id)
        ? categoryColor(categoryById(target.id)!.color, dark)
        : palette.uncategorized
      : palette.accent;

  const amount = splitAmount(total);

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
          <Text
            style={[styles.title, { color: palette.ink }]}
            numberOfLines={1}
          >
            {target.title}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Totale speso
            </Text>
            <Text style={[styles.hero, { color: palette.ink }]}>
              {amount.whole}
              <Text style={[styles.heroCents, { color: palette.ink3 }]}>
                {amount.cents}
              </Text>
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <Text style={[styles.statValue, { color: accent }]}>
                {payments.length}
              </Text>
              <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                {payments.length === 1 ? "spesa" : "spese"}
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <Text style={[styles.statValue, { color: accent }]}>
                {formatAmount(payments.length ? total / payments.length : 0)}
              </Text>
              <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                media a spesa
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <Text style={[styles.statValue, { color: accent }]}>
                {formatAmount(monthly)}
              </Text>
              <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                al mese
              </Text>
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Tutte le spese
            </Text>
            {payments.map((payment) => (
              <View key={payment.id}>
                <Text style={[styles.day, { color: palette.ink3 }]}>
                  {dayLabel(payment.occurred_at)}
                </Text>
                <PaymentRow
                  payment={payment}
                  category={categoryById(payment.category_id)}
                  onPress={() => setEditing(payment)}
                />
              </View>
            ))}

            {!loading && payments.length === 0 && (
              <Text style={[styles.empty, { color: palette.ink3 }]}>
                Nessuna spesa registrata.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>

      <EditPaymentSheet
        payment={editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: { padding: 2 },
  title: { ...type.title, flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  statsRow: { flexDirection: "row", gap: space.sm },
  statCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.md,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    ...type.bodyMedium,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { ...type.small, fontSize: 10.5, textAlign: "center" },
  day: { ...type.label, marginTop: space.md, marginBottom: 2 },
  empty: { ...type.body, textAlign: "center", marginTop: space.lg },
});
