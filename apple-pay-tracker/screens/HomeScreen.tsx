import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
import { RecurringSummary } from "../components/RecurringSummary";
import { SavingsSummary } from "../components/SavingsSummary";
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
import { supabase } from "../lib/supabase";
import { useLimits } from "../lib/useLimits";
import {
  comparisonCutoff,
  isCurrentMonth,
  monthRange,
  usePayments,
} from "../lib/usePayments";

export default function HomeScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();
  const { openSettings } = useNav();

  const [month, setMonth] = useState(() => new Date());
  const { payments, total, previousTotal, reload } = usePayments(month);
  const { monthlyOverall, alerts, reload: reloadLimits } = useLimits();
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);

  const [recurring, setRecurring] = useState({ count: 0, monthlyTotal: 0 });

  // Le rate configurate non dipendono dal mese guardato: cambiano solo
  // quando le regole cambiano, non quando si sfoglia il calendario.
  const loadRecurring = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_rules")
      .select("amount")
      .eq("active", true)
      .eq("frequency", "monthly");

    if (data) {
      setRecurring({
        count: data.length,
        monthlyTotal: data.reduce((sum, r) => sum + Number(r.amount), 0),
      });
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyInvested, setMonthlyInvested] = useState(0);

  // A differenza delle rate ricorrenti, introiti e investimenti sono
  // legati al mese guardato: cambiano sfogliando il calendario.
  const loadBalance = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [incomeResult, investResult] = await Promise.all([
      supabase
        .from("incomes")
        .select("amount")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
      supabase
        .from("investments")
        .select("amount")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
    ]);

    if (incomeResult.data) {
      setMonthlyIncome(
        incomeResult.data.reduce((sum, r) => sum + Number(r.amount), 0)
      );
    }
    if (investResult.data) {
      setMonthlyInvested(
        investResult.data.reduce((sum, r) => sum + Number(r.amount), 0)
      );
    }
  }, [month]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

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

  // Lo scorrimento orizzontale sull'intestazione cambia mese, con
  // un'anteprima che compare gradualmente man mano che si trascina invece
  // di scattare solo al rilascio: non c'e' bisogno di vedere il mese
  // opposto, solo quello verso cui si sta scorrendo.
  const HEAD_TRAVEL = 60;
  const dragX = useRef(new Animated.Value(0)).current;
  /** 1 = verso il mese successivo (trascinamento a sinistra), -1 = precedente. */
  const [dragDir, setDragDir] = useState<0 | 1 | -1>(0);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderGrant: () => dragX.setValue(0),
      onPanResponderMove: (_event, gesture) => {
        dragX.setValue(gesture.dx);
        setDragDir(gesture.dx < 0 ? 1 : gesture.dx > 0 ? -1 : 0);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) >= HEAD_TRAVEL) {
          const dir = gesture.dx < 0 ? 1 : -1;
          Animated.timing(dragX, {
            toValue: -dir * HEAD_TRAVEL,
            duration: 90,
            useNativeDriver: true,
          }).start(() => {
            shiftMonth(dir);
            dragX.setValue(0);
            setDragDir(0);
          });
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start(() => setDragDir(0));
        }
      },
    })
  ).current;

  const outgoingOpacity = dragX.interpolate({
    inputRange: [-HEAD_TRAVEL, 0, HEAD_TRAVEL],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const outgoingTranslate = dragX.interpolate({
    inputRange: [-HEAD_TRAVEL, 0, HEAD_TRAVEL],
    outputRange: [-HEAD_TRAVEL * 0.4, 0, HEAD_TRAVEL * 0.4],
    extrapolate: "clamp",
  });
  const incomingOpacity = dragX.interpolate({
    inputRange: [-HEAD_TRAVEL, 0, HEAD_TRAVEL],
    outputRange: dragDir === 1 ? [1, 0, 0] : [0, 0, 1],
    extrapolate: "clamp",
  });
  const incomingTranslate = dragX.interpolate({
    inputRange: [-HEAD_TRAVEL, 0, HEAD_TRAVEL],
    outputRange:
      dragDir === 1 ? [0, HEAD_TRAVEL, HEAD_TRAVEL] : [-HEAD_TRAVEL, -HEAD_TRAVEL, 0],
    extrapolate: "clamp",
  });

  const incomingMonth = new Date(
    month.getFullYear(),
    month.getMonth() + dragDir,
    1
  );

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
    await Promise.all([reload(), reloadLimits(), loadRecurring(), loadBalance()]);
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
          <Animated.View
            style={[
              styles.headPair,
              {
                opacity: outgoingOpacity,
                transform: [{ translateX: outgoingTranslate }],
              },
            ]}
          >
            <Text style={[styles.title, { color: palette.ink }]}>
              {monthTitle(month)}
            </Text>
            <Text style={[styles.year, { color: palette.ink3 }]}>
              {month.getFullYear()}
            </Text>
          </Animated.View>

          {dragDir !== 0 && (
            <Animated.View
              style={[
                styles.headPair,
                styles.headIncoming,
                {
                  opacity: incomingOpacity,
                  transform: [{ translateX: incomingTranslate }],
                },
              ]}
            >
              <Text style={[styles.title, { color: palette.ink }]}>
                {monthTitle(incomingMonth)}
              </Text>
              <Text style={[styles.year, { color: palette.ink3 }]}>
                {incomingMonth.getFullYear()}
              </Text>
            </Animated.View>
          )}
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

        {(monthlyIncome > 0 || monthlyInvested > 0) && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Bilancio del mese
            </Text>
            <SavingsSummary
              income={monthlyIncome}
              expenses={total}
              invested={monthlyInvested}
            />
          </View>
        )}

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

            <View style={{ marginTop: space.lg }}>
              <RecurringSummary
                count={recurring.count}
                monthlyTotal={recurring.monthlyTotal}
                monthTotal={total}
                onPress={() => openSettings("recurring")}
              />
            </View>
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
  head: {},
  headPair: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: space.sm,
  },
  headIncoming: { position: "absolute", left: 0, top: 0, right: 0 },
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
