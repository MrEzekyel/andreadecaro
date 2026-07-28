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
import { BarChart } from "../components/BarChart";
import { ChartCarousel, ChartPage } from "../components/ChartCarousel";
import { useExplorer } from "../components/Explorer";
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
import { bucketize, Grain } from "../lib/aggregate";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Merchant, Payment } from "../lib/types";
import { useLimits } from "../lib/useLimits";
import { DetailTarget } from "./DetailScreen";

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
  const [rankable, setRankable] = useState<Payment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [grain, setGrain] = useState<Grain>("month");
  /** null = tutte le categorie. */
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const period = useMemo(() => buildPeriod(kind, offset), [kind, offset]);

  const load = useCallback(async () => {
    // `rankable_payments` esclude gia' cio' che hai tolto dalle classifiche.
    // I totali restano su `payments`, perche' mutuo e rate sono spese vere.
    const [paymentsResult, rankableResult, merchantsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", period.start.toISOString())
        .lt("occurred_at", period.end.toISOString())
        .order("occurred_at"),
      supabase
        .from("rankable_payments")
        .select("*")
        .gte("occurred_at", period.start.toISOString())
        .lt("occurred_at", period.end.toISOString())
        .order("occurred_at"),
      supabase.from("merchants").select("*"),
    ]);

    if (paymentsResult.data) setPayments(paymentsResult.data as Payment[]);
    if (rankableResult.data) setRankable(rankableResult.data as Payment[]);
    if (merchantsResult.data) setMerchants(merchantsResult.data as Merchant[]);
  }, [period]);

  const explorer = useExplorer(load);

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
    for (const payment of rankable) {
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
  }, [rankable, merchants]);

  // Le classifiche rispettano il filtro di categoria; i totali no, perche'
  // il numero grande in cima deve restare il totale del periodo.
  const rankedPool = useMemo(
    () =>
      filterCategory === null
        ? rankable
        : rankable.filter((p) => p.category_id === filterCategory),
    [rankable, filterCategory]
  );

  const topCategories = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of rankable) {
      map.set(
        payment.category_id,
        (map.get(payment.category_id) ?? 0) + Number(payment.effective_amount)
      );
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [rankable]);

  const topMerchants = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const payment of rankedPool) {
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
      .slice(0, 5);
  }, [rankedPool, merchants]);

  const buckets = useMemo(
    () => bucketize(rankedPool, grain, grain === "week" ? 10 : 8),
    [rankedPool, grain]
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), reloadLimits()]);
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  const grainToggle = (
    <View style={[styles.grainSegment, { backgroundColor: palette.surface2 }]}>
      {(["week", "month"] as Grain[]).map((option) => (
        <TouchableOpacity
          key={option}
          onPress={() => setGrain(option)}
          style={[
            styles.grainOption,
            grain === option && { backgroundColor: palette.surface },
          ]}
        >
          <Text
            style={[
              styles.grainLabel,
              { color: grain === option ? palette.ink : palette.ink3 },
            ]}
          >
            {option === "week" ? "Settimana" : "Mese"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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

      <View>
        <View style={styles.filterHead}>
          <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
            Classifiche
          </Text>
          <Text style={[styles.filterNote, { color: palette.ink3 }]}>
            esclusi i costi fissi
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            onPress={() => setFilterCategory(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterCategory === null ? palette.accent : palette.surface,
                borderColor:
                  filterCategory === null ? palette.accent : palette.hairline,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    filterCategory === null ? palette.onAccent : palette.ink2,
                },
              ]}
            >
              Tutte
            </Text>
          </TouchableOpacity>

          {topCategories.map(({ id }) => {
            const category = categoryById(id);
            if (!category) return null;
            const selected = filterCategory === id;
            const color = categoryColor(category.color, dark);

            return (
              <TouchableOpacity
                key={id ?? "none"}
                onPress={() => setFilterCategory(selected ? null : id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? tint(color, dark) : palette.surface,
                    borderColor: selected ? color : palette.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selected ? color : palette.ink2 },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {rankedPool.length > 0 && (
        <ChartCarousel
          pages={[
            {
              key: "spend",
              title: "Quanto spendi",
              subtitle:
                filterCategory === null
                  ? "tutte le categorie"
                  : categoryById(filterCategory)?.name,
              content: (
                <>
                  {grainToggle}
                  <BarChart buckets={buckets} metric="amount" color={palette.accent} />
                </>
              ),
            },
            {
              key: "count",
              title: "Quante volte",
              subtitle: "numero di transazioni",
              content: (
                <>
                  {grainToggle}
                  <BarChart buckets={buckets} metric="count" color={palette.accent} />
                </>
              ),
            },
            {
              key: "top-categories",
              title: "Dove spendi di più",
              subtitle: "categorie",
              content: (
                <View style={{ gap: 10 }}>
                  {topCategories.map(({ id, amount: value }) => {
                    const category = categoryById(id);
                    const color = category
                      ? categoryColor(category.color, dark)
                      : palette.uncategorized;
                    const max = topCategories[0]?.amount || 1;

                    return (
                      <TouchableOpacity
                        key={id ?? "none"}
                        style={{ gap: 5 }}
                        onPress={() =>
                          explorer.openDetail({
                            kind: "category",
                            id,
                            title: category?.name ?? "Da categorizzare",
                          })
                        }
                      >
                        <View style={styles.catHead}>
                          <Text style={[styles.catName, { color: palette.ink2 }]}>
                            {category?.name ?? "Da categorizzare"}
                          </Text>
                          <Text style={[styles.catValue, { color: palette.ink }]}>
                            {formatAmount(value)}
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
                              {
                                width: `${(value / max) * 100}%`,
                                backgroundColor: color,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ),
            },
            {
              key: "top-merchants",
              title: "Dove spendi di più",
              subtitle:
                filterCategory === null
                  ? "esercenti"
                  : `esercenti · ${categoryById(filterCategory)?.name}`,
              content: (
                <View style={{ gap: 10 }}>
                  {topMerchants.length === 0 && (
                    <Text style={[styles.empty, { color: palette.ink3 }]}>
                      Nessun esercente in classifica per questo filtro.
                    </Text>
                  )}
                  {topMerchants.map((merchant) => {
                    const max = topMerchants[0]?.amount || 1;
                    return (
                      <TouchableOpacity
                        key={merchant.id}
                        style={{ gap: 5 }}
                        onPress={() =>
                          explorer.openDetail({
                            kind: "merchant",
                            id: merchant.id,
                            title: merchant.name,
                          })
                        }
                      >
                        <View style={styles.catHead}>
                          <Text
                            style={[styles.catName, { color: palette.ink2 }]}
                            numberOfLines={1}
                          >
                            {merchant.name}
                          </Text>
                          <Text style={[styles.catValue, { color: palette.ink }]}>
                            {formatAmount(merchant.amount)}
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
                              {
                                width: `${(merchant.amount / max) * 100}%`,
                                backgroundColor: palette.accent,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ),
            },
          ]}
        />
      )}

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
                explorer.openDetail({
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
                explorer.openDetail({
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
  filterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  filterNote: { ...type.small, fontSize: 10.5 },
  filterRow: { gap: 7, paddingRight: space.lg },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipText: { ...type.caption, fontWeight: "500" },
  grainSegment: { flexDirection: "row", gap: 4, borderRadius: 10, padding: 3 },
  grainOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 7,
  },
  grainLabel: { ...type.small, fontSize: 11, fontWeight: "500" },
});
