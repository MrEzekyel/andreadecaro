import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, monthName } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Payment } from "../lib/types";
import { useLimits } from "../lib/useLimits";

const CHART_W = 300;
const CHART_H = 120;

/**
 * Costruisce una curva morbida passando per tutti i punti.
 * I punti di controllo stanno a un terzo dell'intervallo orizzontale,
 * che e' il compromesso usuale fra morbidezza e fedelta' al dato.
 */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const third = (current.x - previous.x) / 3;
    d += ` C ${previous.x + third},${previous.y} ${current.x - third},${current.y} ${current.x},${current.y}`;
  }
  return d;
}

export default function StatsScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { monthlyOverall, reload: reloadLimits } = useLimits();

  const limitAmount = monthlyOverall
    ? Number(monthlyOverall.limit.amount)
    : null;

  const month = useMemo(() => new Date(), []);

  async function load() {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

    const { data } = await supabase
      .from("payments")
      .select("*")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: true });

    if (data) setPayments(data as Payment[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Spesa cumulata giorno per giorno, che e' la lettura utile per capire
  // se il mese sta andando piu' veloce del solito.
  const cumulative = useMemo(() => {
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();
    const today = new Date();
    const lastDay =
      today.getFullYear() === month.getFullYear() &&
      today.getMonth() === month.getMonth()
        ? today.getDate()
        : daysInMonth;

    const perDay = new Array(daysInMonth + 1).fill(0);
    for (const payment of payments) {
      const day = new Date(payment.occurred_at).getDate();
      perDay[day] += Number(payment.amount);
    }

    const points: { x: number; y: number }[] = [];
    let running = 0;
    // La scala deve contenere anche il limite, altrimenti la sua linea
    // finirebbe fuori dall'area disegnata.
    const max = Math.max(total, limitAmount ?? 0) || 1;

    for (let day = 1; day <= lastDay; day++) {
      running += perDay[day];
      points.push({
        x: ((day - 1) / Math.max(lastDay - 1, 1)) * CHART_W,
        y: CHART_H - (running / max) * (CHART_H - 12),
      });
    }
    return points;
  }, [payments, total, month, limitAmount]);

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of payments) {
      map.set(
        payment.category_id,
        (map.get(payment.category_id) ?? 0) + Number(payment.amount)
      );
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), reloadLimits()]);
    setRefreshing(false);
  }

  const chartMax = Math.max(total, limitAmount ?? 0) || 1;
  const limitY =
    limitAmount !== null
      ? CHART_H - (limitAmount / chartMax) * (CHART_H - 12)
      : null;

  const line = smoothPath(cumulative);
  const area =
    cumulative.length > 1
      ? `${line} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`
      : "";
  const last = cumulative[cumulative.length - 1];

  return (
    <ScrollView
      style={{ backgroundColor: palette.ground }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={[styles.title, { color: palette.ink }]}>Statistiche</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>
            Andamento cumulato
          </Text>
          <Text style={[styles.cardMeta, { color: palette.ink3 }]}>
            {monthName(month)}
          </Text>
        </View>

        {cumulative.length > 1 ? (
          <>
            <Svg
              width="100%"
              height={CHART_H + 8}
              viewBox={`0 0 ${CHART_W} ${CHART_H + 8}`}
            >
              <Defs>
                <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={palette.accent} stopOpacity="0.24" />
                  <Stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {limitY !== null && (
                <>
                  <Line
                    x1={0}
                    y1={limitY}
                    x2={CHART_W}
                    y2={limitY}
                    stroke={palette.limit}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.55}
                  />
                  <SvgText
                    x={CHART_W}
                    y={Math.max(limitY - 4, 8)}
                    textAnchor="end"
                    fontSize={8.5}
                    fill={palette.limit}
                  >
                    {`LIMITE ${formatAmount(limitAmount as number)}`}
                  </SvgText>
                </>
              )}

              <Path d={area} fill="url(#fill)" />
              <Path
                d={line}
                fill="none"
                stroke={palette.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {last && (
                <>
                  <Circle cx={last.x} cy={last.y} r={5} fill={palette.surface} />
                  <Circle cx={last.x} cy={last.y} r={3.2} fill={palette.accent} />
                </>
              )}
            </Svg>

            <View style={styles.axis}>
              <Text style={[styles.axisLabel, { color: palette.ink3 }]}>
                1 {monthName(month).slice(0, 3)}
              </Text>
              <Text style={[styles.axisLabel, { color: palette.ink3 }]}>
                {formatAmount(total)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Servono almeno due giorni di spese per disegnare l'andamento.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>
            Per categoria
          </Text>
          <Text style={[styles.cardMeta, { color: palette.ink3 }]}>
            {formatAmount(total)}
          </Text>
        </View>

        {byCategory.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessuna spesa in questo mese.
          </Text>
        )}

        {byCategory.map(({ id, amount }) => {
          const category = categoryById(id);
          const color = category
            ? categoryColor(category.color, dark)
            : palette.uncategorized;
          const pct = total > 0 ? (amount / total) * 100 : 0;

          return (
            <View key={id ?? "none"} style={styles.catRow}>
              <View style={styles.catHead}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Text style={[styles.catName, { color: palette.ink2 }]}>
                  {category?.name ?? "Da categorizzare"}
                </Text>
                <Text style={[styles.catValue, { color: palette.ink }]}>
                  {formatAmount(amount)}
                </Text>
                <Text style={[styles.catPct, { color: palette.ink3 }]}>
                  {Math.round(pct)}%
                </Text>
              </View>
              <View
                style={[styles.barTrack, { backgroundColor: palette.surface2 }]}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  title: { ...type.title },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { ...type.bodyMedium, fontSize: 12.5 },
  cardMeta: { ...type.small, textTransform: "capitalize" },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { ...type.small, fontSize: 10 },
  catRow: { gap: 6 },
  catHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  catName: { ...type.caption, flex: 1 },
  catValue: { ...type.caption, fontWeight: "500", fontVariant: ["tabular-nums"] },
  catPct: {
    ...type.caption,
    width: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  barTrack: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 6, borderRadius: radius.pill },
  empty: { ...type.caption, lineHeight: 19 },
});
