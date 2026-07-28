import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  SectionList,
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
import { dayKey, dayLabel, formatAmount, monthName } from "../lib/format";
import { space, type } from "../lib/theme";
import { Payment } from "../lib/types";
import { usePayments } from "../lib/usePayments";

export default function PaymentsScreen() {
  const { palette } = useTheme();
  const { categoryById } = useData();

  const [month, setMonth] = useState(() => new Date());
  const { payments, reload } = usePayments(month);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  // Le spese arrivano gia' ordinate dal piu' recente: raggrupparle in
  // sequenza preserva l'ordine senza dover riordinare le sezioni.
  const sections = useMemo(() => {
    const groups: { title: string; total: number; data: Payment[] }[] = [];
    let currentKey: string | null = null;

    for (const payment of payments) {
      const key = dayKey(payment.occurred_at);
      if (key !== currentKey) {
        groups.push({
          title: dayLabel(payment.occurred_at),
          total: 0,
          data: [],
        });
        currentKey = key;
      }
      const group = groups[groups.length - 1];
      group.data.push(payment);
      group.total += Number(payment.effective_amount);
    }

    return groups;
  }, [payments]);

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>Spese</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              accessibilityLabel="Mese precedente"
            >
              <Icon name="chevron-left" size={16} color={palette.ink3} />
            </TouchableOpacity>
            <Text style={[styles.month, { color: palette.ink3 }]}>
              {monthName(month)}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              accessibilityLabel="Mese successivo"
            >
              <Icon name="chevron-right" size={16} color={palette.ink3} />
            </TouchableOpacity>
          </View>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={[styles.dayLabel, { color: palette.ink3 }]}>
                {section.title}
              </Text>
              <Text style={[styles.dayTotal, { color: palette.ink3 }]}>
                {formatAmount(section.total)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PaymentRow
              payment={item}
              category={categoryById(item.category_id)}
              onPress={() => setEditing(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              Nessuna spesa in {monthName(month)}.
            </Text>
          }
        />
      </View>

      <EditPaymentSheet
        payment={editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  title: { ...type.title },
  monthNav: { flexDirection: "row", alignItems: "center", gap: space.sm },
  month: { ...type.caption, fontWeight: "500", textTransform: "capitalize" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: space.md,
    marginBottom: 4,
  },
  dayLabel: { ...type.label },
  dayTotal: { ...type.small, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, textAlign: "center", marginTop: space.xxl },
});
