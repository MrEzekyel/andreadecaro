import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EditPaymentSheet } from "../components/EditPaymentSheet";
import { Icon } from "../components/Icon";
import { LimitCard } from "../components/LimitCard";
import { PaymentRow } from "../components/PaymentRow";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, monthName, splitAmount } from "../lib/format";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Payment } from "../lib/types";
import { useLimits } from "../lib/useLimits";
import { usePayments } from "../lib/usePayments";

export default function HomeScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [month, setMonth] = useState(() => new Date());
  const { payments, reload } = usePayments(month);
  const { monthlyOverall, alerts, reload: reloadLimits } = useLimits();
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  // I limiti valgono sempre sul periodo corrente: mostrarli mentre si
  // sfoglia un mese passato darebbe un confronto senza senso.
  const viewingCurrentMonth =
    month.getFullYear() === new Date().getFullYear() &&
    month.getMonth() === new Date().getMonth();

  const total = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of payments) {
      const key = payment.category_id;
      map.set(key, (map.get(key) ?? 0) + Number(payment.amount));
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const recent = payments.slice(0, 5);
  const amount = splitAmount(total);

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
    await Promise.all([reload(), reloadLimits()]);
    setRefreshing(false);
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>
            {monthName(month)}
          </Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              accessibilityLabel="Mese precedente"
            >
              <Icon name="chevron-left" size={16} color={palette.ink3} />
            </TouchableOpacity>
            <Text style={[styles.year, { color: palette.ink3 }]}>
              {month.getFullYear()}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              accessibilityLabel="Mese successivo"
            >
              <Icon name="chevron-right" size={16} color={palette.ink3} />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            Speso questo mese
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {amount.whole}
            <Text style={[styles.heroCents, { color: palette.ink3 }]}>
              {amount.cents}
            </Text>
          </Text>
          <Text style={[styles.heroMeta, { color: palette.ink2 }]}>
            {payments.length} {payments.length === 1 ? "spesa" : "spese"}
          </Text>
        </View>

        {viewingCurrentMonth &&
          alerts.map((status) => {
            const category = categoryById(status.limit.category_id);
            const scope = category ? category.name : "complessivo";
            const over = status.level === "over";
            const tone = over ? palette.over : palette.warn;

            return (
              <View
                key={`alert-${status.limit.id}`}
                style={[styles.alert, { backgroundColor: `${tone}1f` }]}
              >
                <Icon name="triangle-alert" size={16} color={tone} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.ink }]}>
                    {over
                      ? `Limite ${scope} superato`
                      : `Limite ${scope} quasi raggiunto`}
                  </Text>
                  <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                    {formatAmount(status.spent)} di{" "}
                    {formatAmount(Number(status.limit.amount))}
                    {over
                      ? ` — superato di ${formatAmount(-status.remaining)}.`
                      : ` — restano ${formatAmount(status.remaining)}.`}
                  </Text>
                </View>
              </View>
            );
          })}

        {viewingCurrentMonth && monthlyOverall && (
          <LimitCard status={monthlyOverall} />
        )}

        {byCategory.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.ink }]}>
              Ripartizione
            </Text>

            {byCategory.map(({ id, amount: value }) => {
              const category = categoryById(id);
              const color = category
                ? categoryColor(category.color, dark)
                : palette.uncategorized;
              const pct = total > 0 ? (value / total) * 100 : 0;

              return (
                <View key={id ?? "none"} style={styles.catRow}>
                  <View style={styles.catHead}>
                    <View style={styles.catName}>
                      <View
                        style={[styles.swatch, { backgroundColor: color }]}
                      />
                      <Text style={[styles.catLabel, { color: palette.ink2 }]}>
                        {category?.name ?? "Da categorizzare"}
                      </Text>
                    </View>
                    <Text style={[styles.catValue, { color: palette.ink }]}>
                      {formatAmount(value)}
                    </Text>
                    <Text style={[styles.catPct, { color: palette.ink3 }]}>
                      {Math.round(pct)}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.barTrack,
                      { backgroundColor: palette.surface2 },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {recent.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Ultime spese
            </Text>
            {recent.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                category={categoryById(payment.category_id)}
                onPress={() => setEditing(payment)}
              />
            ))}
          </View>
        )}

        {payments.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessuna spesa in questo mese. Configura la Shortcut sul telefono
            oppure aggiungine una a mano.
          </Text>
        )}
      </ScrollView>

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
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { ...type.title },
  monthNav: { flexDirection: "row", alignItems: "center", gap: space.sm },
  year: { ...type.caption, fontWeight: "500" },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  heroMeta: { ...type.caption, marginTop: space.sm },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  cardTitle: { ...type.bodyMedium, fontSize: 12.5 },
  catRow: { gap: 6 },
  catHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  catName: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  catLabel: { ...type.caption, flexShrink: 1 },
  catValue: { ...type.caption, fontWeight: "500", fontVariant: ["tabular-nums"] },
  catPct: {
    ...type.caption,
    width: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  barTrack: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 6, borderRadius: radius.pill },
  empty: { ...type.body, textAlign: "center", marginTop: space.xl, lineHeight: 21 },
  alert: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
    borderRadius: radius.card,
    padding: space.lg,
  },
  alertTitle: { ...type.bodyMedium, fontSize: 12.5, marginBottom: 3 },
  alertBody: { ...type.small, lineHeight: 17 },
});
