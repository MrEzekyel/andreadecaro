import React, { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CategoryDonut, DonutSlice } from "../components/CategoryDonut";
import { useExplorer } from "../components/Explorer";
import { Icon } from "../components/Icon";
import { LimitCard } from "../components/LimitCard";
import { PaymentRow } from "../components/PaymentRow";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { useData } from "../lib/DataContext";
import { useNav } from "../lib/NavContext";
import { useTheme } from "../lib/ThemeContext";
import {
  formatAmount,
  monthName,
  monthTitle,
  percentChange,
  splitAmount,
} from "../lib/format";
import { categoryColor, radius, space, type } from "../lib/theme";
import { useLimits } from "../lib/useLimits";
import { comparisonCutoff, isCurrentMonth, usePayments } from "../lib/usePayments";

export default function HomeScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();
  const { openSettings } = useNav();

  const [month, setMonth] = useState(() => new Date());
  const { payments, total, previousTotal, reload } = usePayments(month);
  const { monthlyOverall, alerts, reload: reloadLimits } = useLimits();
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);

  // I limiti valgono sempre sul periodo corrente: mostrarli mentre si
  // sfoglia un mese passato darebbe un confronto senza senso.
  const viewingCurrentMonth = isCurrentMonth(month);

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  // Lo scorrimento orizzontale sull'intestazione cambia mese. Il responder si
  // attiva solo quando il gesto e' nettamente orizzontale, altrimenti
  // ruberebbe lo scorrimento verticale della pagina.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx <= -40) shiftMonth(1);
        else if (gesture.dx >= 40) shiftMonth(-1);
      },
    })
  ).current;

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of payments) {
      const key = payment.category_id;
      map.set(key, (map.get(key) ?? 0) + Number(payment.effective_amount));
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const slices = useMemo<DonutSlice[]>(
    () =>
      byCategory.map(({ id, amount }) => {
        const category = categoryById(id);
        return {
          id,
          label: category?.name ?? "Da categorizzare",
          value: amount,
          color: category
            ? categoryColor(category.color, dark)
            : palette.uncategorized,
          icon: category?.icon ?? "circle-help",
        };
      }),
    [byCategory, categoryById, dark, palette.uncategorized]
  );

  /** Spesa cumulata giorno per giorno, fino a oggi se il mese e' in corso. */
  const trend = useMemo<TrendPoint[]>(() => {
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const elapsed = viewingCurrentMonth ? new Date().getDate() : days;

    const perDay = new Array(days).fill(0);
    for (const payment of payments) {
      const day = new Date(payment.occurred_at).getDate();
      perDay[day - 1] += Number(payment.effective_amount);
    }

    const points: TrendPoint[] = [];
    let running = 0;
    for (let i = 0; i < elapsed; i++) {
      running += perDay[i];
      points.push({ label: String(i + 1), value: running });
    }
    return points;
  }, [payments, month, viewingCurrentMonth]);

  const limitAmount =
    viewingCurrentMonth && monthlyOverall
      ? Number(monthlyOverall.limit.amount)
      : null;

  const delta = percentChange(total, previousTotal);
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const cutoff = comparisonCutoff(month);
  const deltaLabel = viewingCurrentMonth
    ? `su ${monthName(previousMonth)} 1–${cutoff}`
    : `su ${monthName(previousMonth)}`;

  const recent = payments.slice(0, 5);
  const amount = splitAmount(total);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([reload(), reloadLimits()]);
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={styles.head}
          {...pan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={`${monthTitle(month)} ${month.getFullYear()}`}
          accessibilityHint="Scorri a destra o a sinistra per cambiare mese"
          accessibilityActions={[
            { name: "increment", label: "Mese successivo" },
            { name: "decrement", label: "Mese precedente" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") shiftMonth(1);
            if (event.nativeEvent.actionName === "decrement") shiftMonth(-1);
          }}
        >
          <Text style={[styles.title, { color: palette.ink }]}>
            {monthTitle(month)}
          </Text>
          <Text style={[styles.year, { color: palette.ink3 }]}>
            {month.getFullYear()}
          </Text>
        </View>

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            {viewingCurrentMonth ? "Speso questo mese" : "Speso nel mese"}
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {amount.whole}
            <Text style={[styles.heroCents, { color: palette.ink3 }]}>
              {amount.cents}
            </Text>
          </Text>

          <View style={styles.heroFoot}>
            <Text style={[styles.heroMeta, { color: palette.ink2 }]}>
              {payments.length} {payments.length === 1 ? "spesa" : "spese"}
            </Text>

            {delta !== null && (
              <View style={styles.delta}>
                <Icon
                  name={delta >= 0 ? "trending-up" : "trending-down"}
                  size={13}
                  color={delta >= 0 ? palette.over : palette.good}
                />
                <Text
                  style={[
                    styles.deltaValue,
                    { color: delta >= 0 ? palette.over : palette.good },
                  ]}
                >
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(delta))}%
                </Text>
                <Text style={[styles.deltaNote, { color: palette.ink3 }]}>
                  {deltaLabel}
                </Text>
              </View>
            )}
          </View>
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
          <LimitCard
            status={monthlyOverall}
            plain
            onPress={() => openSettings("limits")}
          />
        )}

        {trend.length > 1 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>Andamento</Text>
            <TrendChart
              points={trend}
              limit={limitAmount}
              color={palette.accent}
            />
          </View>
        )}

        {slices.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Ripartizione
            </Text>
            <CategoryDonut
              slices={slices}
              centerLabel={monthTitle(month).toLowerCase()}
              onSelect={(slice) =>
                explorer.openDetail({
                  kind: "category",
                  id: slice.id,
                  title: slice.label,
                })
              }
            />
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
                onPress={() => explorer.openPayment(payment)}
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

      {explorer.overlay}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  title: { ...type.title, fontSize: 27, letterSpacing: -0.3 },
  year: { ...type.body, fontWeight: "500" },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  heroFoot: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  heroMeta: { ...type.caption },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaValue: {
    ...type.caption,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  deltaNote: { ...type.small, fontSize: 10.5 },
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
