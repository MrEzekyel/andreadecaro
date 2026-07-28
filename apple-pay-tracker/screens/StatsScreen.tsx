import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { Icon } from "../components/Icon";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, splitAmount } from "../lib/format";
import {
  bucketCount,
  bucketOf,
  bucketsElapsed,
  buildPeriod,
  PeriodKind,
} from "../lib/period";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Merchant, Payment } from "../lib/types";
import { useLimits } from "../lib/useLimits";
import DetailScreen, { DetailTarget } from "./DetailScreen";

const CHART_W = 300;
const CHART_H = 120;

const PERIOD_LABEL: Record<PeriodKind, string> = {
  week: "Settimana",
  month: "Mese",
  year: "Anno",
};

/**
 * Curva morbida che passa per tutti i punti. I punti di controllo stanno a un
 * terzo dell'intervallo orizzontale: e' il compromesso usuale fra morbidezza
 * e fedelta' al dato.
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
  const { monthlyOverall, reload: reloadLimits } = useLimits();

  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const period = useMemo(() => buildPeriod(kind, offset), [kind, offset]);

  const load = useCallback(async () => {
    const [paymentsResult, merchantsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", period.start.toISOString())
        .lt("occurred_at", period.end.toISOString())
        .order("occurred_at"),
      supabase.from("merchants").select("*"),
    ]);

    if (paymentsResult.data) setPayments(paymentsResult.data as Payment[]);
    if (merchantsResult.data) setMerchants(merchantsResult.data as Merchant[]);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const total = payments.reduce((sum, p) => sum + Number(p.effective_amount), 0);

  // Il limite mensile ha senso come riferimento solo sul mese corrente.
  const limitAmount =
    kind === "month" && offset === 0 && monthlyOverall
      ? Number(monthlyOverall.limit.amount)
      : null;

  const cumulative = useMemo(() => {
    const buckets = new Array(bucketCount(period)).fill(0);
    for (const payment of payments) {
      buckets[bucketOf(period, payment.occurred_at)] += Number(
        payment.effective_amount
      );
    }

    const elapsed = Math.max(bucketsElapsed(period), 1);
    const max = Math.max(total, limitAmount ?? 0) || 1;

    const points: { x: number; y: number }[] = [];
    let running = 0;
    for (let i = 0; i < elapsed; i++) {
      running += buckets[i];
      points.push({
        x: (i / Math.max(elapsed - 1, 1)) * CHART_W,
        y: CHART_H - (running / max) * (CHART_H - 12),
      });
    }
    return points;
  }, [payments, period, total, limitAmount]);

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of payments) {
      map.set(
        payment.category_id,
        (map.get(payment.category_id) ?? 0) + Number(payment.effective_amount)
      );
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const byMerchant = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const payment of payments) {
      if (!payment.merchant_id) continue;
      const current = map.get(payment.merchant_id);
      map.set(payment.merchant_id, {
        amount: (current?.amount ?? 0) + Number(payment.effective_amount),
        count: (current?.count ?? 0) + 1,
      });
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({
        id,
        ...value,
        name: merchants.find((m) => m.id === id)?.display_name ?? "Sconosciuto",
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [payments, merchants]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), reloadLimits()]);
    setRefreshing(false);
  }

  if (detail) {
    return <DetailScreen target={detail} onBack={() => setDetail(null)} />;
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
  const amount = splitAmount(total);

  return (
    <ScrollView
      style={{ backgroundColor: palette.ground }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={[styles.title, { color: palette.ink }]}>Statistiche</Text>

      <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
        {(Object.keys(PERIOD_LABEL) as PeriodKind[]).map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => {
              setKind(option);
              setOffset(0);
            }}
            style={[
              styles.segmentOption,
              kind === option && { backgroundColor: palette.surface },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === option }}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: kind === option ? palette.ink : palette.ink3 },
              ]}
            >
              {PERIOD_LABEL[option]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.periodNav}>
        <TouchableOpacity
          onPress={() => setOffset((o) => o - 1)}
          accessibilityLabel="Periodo precedente"
        >
          <Icon name="chevron-left" size={18} color={palette.ink3} />
        </TouchableOpacity>
        <Text style={[styles.periodLabel, { color: palette.ink }]}>
          {period.label}
        </Text>
        <TouchableOpacity
          onPress={() => setOffset((o) => Math.min(o + 1, 0))}
          disabled={offset >= 0}
          accessibilityLabel="Periodo successivo"
        >
          <Icon
            name="chevron-right"
            size={18}
            color={offset >= 0 ? palette.hairline : palette.ink3}
          />
        </TouchableOpacity>
      </View>

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>Totale</Text>
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

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <Text style={[styles.cardTitle, { color: palette.ink }]}>
          Andamento cumulato
        </Text>

        {cumulative.length > 1 ? (
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
        <Text style={[styles.cardTitle, { color: palette.ink }]}>
          Per categoria
        </Text>

        {byCategory.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessuna spesa in questo periodo.
          </Text>
        )}

        {byCategory.map(({ id, amount: value }) => {
          const category = categoryById(id);
          const color = category
            ? categoryColor(category.color, dark)
            : palette.uncategorized;
          const pct = total > 0 ? (value / total) * 100 : 0;

          return (
            <TouchableOpacity
              key={id ?? "none"}
              style={styles.catRow}
              onPress={() =>
                setDetail({
                  kind: "category",
                  id,
                  title: category?.name ?? "Da categorizzare",
                })
              }
            >
              <View style={styles.catHead}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Text style={[styles.catName, { color: palette.ink2 }]}>
                  {category?.name ?? "Da categorizzare"}
                </Text>
                <Text style={[styles.catValue, { color: palette.ink }]}>
                  {formatAmount(value)}
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
            </TouchableOpacity>
          );
        })}
      </View>

      {byMerchant.length > 0 && (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <Text style={[styles.cardTitle, { color: palette.ink }]}>
            Dove spendi di più
          </Text>

          {byMerchant.map((merchant) => (
            <TouchableOpacity
              key={merchant.id}
              style={styles.merchantRow}
              onPress={() =>
                setDetail({
                  kind: "merchant",
                  id: merchant.id,
                  title: merchant.name,
                })
              }
            >
              <View
                style={[
                  styles.merchantIcon,
                  { backgroundColor: tint(palette.accent, dark) },
                ]}
              >
                <Text style={[styles.merchantInitial, { color: palette.accent }]}>
                  {merchant.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.merchantName, { color: palette.ink }]}
                  numberOfLines={1}
                >
                  {merchant.name}
                </Text>
                <Text style={[styles.merchantMeta, { color: palette.ink3 }]}>
                  {merchant.count} {merchant.count === 1 ? "spesa" : "spese"}
                </Text>
              </View>

              <Text style={[styles.catValue, { color: palette.ink }]}>
                {formatAmount(merchant.amount)}
              </Text>
              <Icon name="chevron-right" size={14} color={palette.ink3} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  title: { ...type.title },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  periodNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodLabel: { ...type.bodyMedium, textTransform: "capitalize" },
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
  merchantRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  merchantIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantInitial: { ...type.bodyMedium, fontSize: 13 },
  merchantName: { ...type.body },
  merchantMeta: { ...type.small, marginTop: 1 },
  empty: { ...type.caption, lineHeight: 19 },
});
