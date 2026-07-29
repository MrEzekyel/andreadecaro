import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "../components/BarChart";
import { CategoryDonut, DonutSlice } from "../components/CategoryDonut";
import { ChartCarousel, ChartPage } from "../components/ChartCarousel";
import { useExplorer } from "../components/Explorer";
import { Icon } from "../components/Icon";
import { LetterToggle } from "../components/LetterToggle";
import { MonthWheel } from "../components/MonthWheel";
import { TrendChart, TrendPoint } from "../components/TrendChart";
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
import {
  Bucket,
  bucketAverage,
  bucketRange,
  bucketize,
  Grain,
  monthsBetween,
  paymentsIn,
  sameMonth,
} from "../lib/aggregate";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Merchant, Payment } from "../lib/types";
import { useLimits } from "../lib/useLimits";

const PERIOD_LABEL: Record<PeriodKind, string> = {
  week: "Settimana",
  month: "Mese",
  year: "Anno",
};

const MONTHS_SHORT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

const GRAIN_OPTIONS = [
  { value: "week" as Grain, letter: "W", label: "Per settimana" },
  { value: "month" as Grain, letter: "M", label: "Per mese" },
];

const DONUT_SCOPE_OPTIONS = [
  { value: "month" as const, letter: "M", label: "Un mese alla volta" },
  { value: "all" as const, letter: "A", label: "Tutto lo storico" },
];

export default function StatsScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();
  const { monthlyOverall, reload: reloadLimits } = useLimits();

  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  /** Storico lungo, indipendente dal periodo: alimenta i grafici a colonne. */
  const [history, setHistory] = useState<Payment[]>([]);
  /** Storico completo, per la ripartizione per categoria in modalita' M/ALL. */
  const [categoryHistory, setCategoryHistory] = useState<Payment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [grain, setGrain] = useState<Grain>("month");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /** null = tutte le categorie. */
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [donutScope, setDonutScope] = useState<"month" | "all">("month");
  const [donutMonthIndex, setDonutMonthIndex] = useState(0);
  // Le classifiche (colonne e "dove spendi di piu'") escludono di default
  // cio' che hai marcato come non rappresentativo — mutuo, rate: importi
  // fissi che schiaccerebbero il resto. Il toggle lo rende una scelta
  // invece di un comportamento fisso.
  const [excludeMarked, setExcludeMarked] = useState(true);
  // Diventa vero solo DOPO che l'indice e' stato corretto sull'ultimo mese:
  // senza questo cancello, la ghiera monterebbe nello stesso render in cui
  // i mesi diventano disponibili, con l'indice ancora a 0 (il primo mese),
  // e solo un istante dopo verrebbe corretta — visibile come uno scatto.
  const [donutMonthReady, setDonutMonthReady] = useState(false);

  const period = useMemo(() => buildPeriod(kind, offset), [kind, offset]);

  const load = useCallback(async () => {
    // I grafici a colonne confrontano periodi fra loro, quindi guardano
    // indietro oltre il periodo selezionato: con i soli dati del periodo
    // resterebbe una colonna piena e tutte le altre vuote, e toccarle per
    // cambiare mese non porterebbe da nessuna parte.
    const historyStart = new Date();
    historyStart.setMonth(historyStart.getMonth() - 9);
    historyStart.setDate(1);
    historyStart.setHours(0, 0, 0, 0);

    // I totali restano sempre su tutte le spese, perche' mutuo e rate sono
    // spese vere; l'esclusione si applica solo a valle, sulle classifiche,
    // con il filtro client-side controllato dal toggle.
    const [paymentsResult, historyResult, categoryHistoryResult, merchantsResult] =
      await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .gte("occurred_at", period.start.toISOString())
          .lt("occurred_at", period.end.toISOString())
          .order("occurred_at"),
        supabase
          .from("payments")
          .select("*")
          .gte("occurred_at", historyStart.toISOString())
          .order("occurred_at"),
        // Nessun limite di tempo: la ripartizione per categoria puo' guardare
        // a un mese qualunque da quando esiste il primo movimento, o a tutto
        // lo storico in blocco.
        supabase.from("payments").select("*").order("occurred_at"),
        supabase.from("merchants").select("*"),
      ]);

    if (paymentsResult.data) setPayments(paymentsResult.data as Payment[]);
    if (historyResult.data) setHistory(historyResult.data as Payment[]);
    if (categoryHistoryResult.data)
      setCategoryHistory(categoryHistoryResult.data as Payment[]);
    if (merchantsResult.data) setMerchants(merchantsResult.data as Merchant[]);
  }, [period]);

  const explorer = useExplorer(load);

  useEffect(() => {
    load();
  }, [load]);

  // Una spesa e' esclusa dalle classifiche se lo e' lei o il suo esercente:
  // la stessa regola che prima viveva nella vista `rankable_payments`, ora
  // qui perche' il toggle deve poterla accendere o spegnere a piacere.
  const excludedMerchantIds = useMemo(
    () => new Set(merchants.filter((m) => m.excluded_from_stats).map((m) => m.id)),
    [merchants]
  );

  const applyExclusion = useCallback(
    (list: Payment[]) => {
      if (!excludeMarked) return list;
      return list.filter(
        (p) =>
          !p.excluded_from_stats &&
          !(p.merchant_id && excludedMerchantIds.has(p.merchant_id))
      );
    },
    [excludeMarked, excludedMerchantIds]
  );

  const rankable = useMemo(
    () => applyExclusion(payments),
    [payments, applyExclusion]
  );

  const total = payments.reduce((sum, p) => sum + Number(p.effective_amount), 0);

  // Il limite mensile ha senso come riferimento solo sul mese corrente.
  const limitAmount =
    kind === "month" && offset === 0 && monthlyOverall
      ? Number(monthlyOverall.limit.amount)
      : null;

  /** Spesa cumulata lungo il periodo, un punto per intervallo trascorso. */
  const trend = useMemo<TrendPoint[]>(() => {
    const slots = new Array(bucketCount(period)).fill(0);
    for (const payment of payments) {
      slots[bucketOf(period, payment.occurred_at)] += Number(
        payment.effective_amount
      );
    }

    const elapsed = Math.max(bucketsElapsed(period), 1);
    const points: TrendPoint[] = [];
    let running = 0;

    for (let i = 0; i < elapsed; i++) {
      running += slots[i];
      const label =
        period.kind === "year"
          ? MONTHS_SHORT[i]
          : period.kind === "week"
            ? String(
                new Date(
                  period.start.getFullYear(),
                  period.start.getMonth(),
                  period.start.getDate() + i
                ).getDate()
              )
            : String(i + 1);
      points.push({ label, value: running });
    }
    return points;
  }, [payments, period]);

  /** Mesi disponibili per la ghiera della ripartizione, dal primo movimento a oggi. */
  const donutMonths = useMemo(() => {
    if (categoryHistory.length === 0) return [];
    const earliest = categoryHistory.reduce(
      (min, p) => (new Date(p.occurred_at) < min ? new Date(p.occurred_at) : min),
      new Date(categoryHistory[0].occurred_at)
    );
    return monthsBetween(earliest, new Date());
  }, [categoryHistory]);

  // Di default la ghiera sta sul mese corrente, l'ultimo della lista. Il
  // flag "pronta" scatta nello stesso aggiornamento che fissa l'indice,
  // cosi' la ghiera non monta mai con quello sbagliato.
  useEffect(() => {
    if (donutMonths.length === 0) return;
    setDonutMonthIndex(donutMonths.length - 1);
    setDonutMonthReady(true);
  }, [donutMonths.length]);

  // Cambiare il mese principale in cima alla pagina sposta anche la
  // ripartizione sullo stesso mese: due controlli che scelgono "il mese"
  // indipendentemente sarebbero una fonte costante di disallineamento.
  useEffect(() => {
    if (kind !== "month" || donutMonths.length === 0) return;
    const index = donutMonths.findIndex((m) => sameMonth(m, period.start));
    if (index !== -1) setDonutMonthIndex(index);
  }, [kind, period, donutMonths]);

  const donutPool = useMemo(() => {
    const scoped =
      donutScope === "all"
        ? categoryHistory
        : (() => {
            const month = donutMonths[donutMonthIndex];
            return month
              ? categoryHistory.filter((p) => sameMonth(new Date(p.occurred_at), month))
              : [];
          })();
    return applyExclusion(scoped);
  }, [categoryHistory, donutScope, donutMonths, donutMonthIndex, applyExclusion]);

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of donutPool) {
      map.set(
        payment.category_id,
        (map.get(payment.category_id) ?? 0) + Number(payment.effective_amount)
      );
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [donutPool]);

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

  /** Storico filtrato come le classifiche, per i grafici a colonne. */
  const historyPool = useMemo(() => {
    const excluded = applyExclusion(history);
    return filterCategory === null
      ? excluded
      : excluded.filter((p) => p.category_id === filterCategory);
  }, [history, filterCategory, applyExclusion]);

  const buckets = useMemo(
    () => bucketize(historyPool, grain, grain === "week" ? 10 : 8),
    [historyPool, grain]
  );

  const selected: Bucket | undefined =
    buckets.find((bucket) => bucket.key === selectedKey) ??
    buckets[buckets.length - 1];

  // Stessa sincronizzazione del mese principale, per il grafico a colonne:
  // cambiare mese in cima alla pagina sposta anche la colonna selezionata,
  // qualunque sia il grado (settimana/mese) scelto per quel grafico.
  useEffect(() => {
    if (kind !== "month") return;
    const match = buckets.find((bucket) => {
      const { start, end } = bucketRange(bucket, grain);
      return period.start >= start && period.start < end;
    });
    if (match) setSelectedKey(match.key);
  }, [kind, period, buckets, grain]);

  const selectedPayments = useMemo(
    () => (selected ? paymentsIn(historyPool, selected, grain) : []),
    [historyPool, selected, grain]
  );

  const selectedTotal = selectedPayments.reduce(
    (sum, p) => sum + Number(p.effective_amount),
    0
  );
  const biggest = selectedPayments.reduce(
    (max, p) => Math.max(max, Number(p.effective_amount)),
    0
  );
  const averagePerPayment = selectedPayments.length
    ? selectedTotal / selectedPayments.length
    : 0;

  const averageTotal = bucketAverage(buckets, "total");
  const averageCount = bucketAverage(buckets, "count");

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), reloadLimits()]);
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  const amount = splitAmount(total);

  const grainAside = (
    <LetterToggle options={GRAIN_OPTIONS} value={grain} onChange={setGrain} />
  );

  function statPair(
    first: { label: string; value: string },
    second: { label: string; value: string }
  ) {
    return (
      <View style={styles.statsRow}>
        {[first, second].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: palette.accent }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const pages: ChartPage[] = [
    {
      key: "spend",
      title: "Quanto spendi",
      subtitle:
        filterCategory === null
          ? "tutte le categorie"
          : categoryById(filterCategory)?.name,
      aside: (
        <View style={styles.asideStack}>
          {grainAside}
          <Text style={[styles.asideNote, { color: palette.ink3 }]}>
            media {formatAmount(averageTotal)}
          </Text>
        </View>
      ),
      content: (
        <>
          <BarChart
            buckets={buckets}
            metric="amount"
            color={palette.accent}
            selectedKey={selected?.key ?? null}
            onSelect={(bucket) => setSelectedKey(bucket.key)}
            average={averageTotal}
          />
          {statPair(
            {
              label: selectedPayments.length === 1 ? "spesa" : "spese",
              value: String(selectedPayments.length),
            },
            {
              label: "Media per transazione",
              value: formatAmount(averagePerPayment),
            }
          )}
        </>
      ),
    },
    {
      key: "count",
      title: "Quante volte",
      subtitle: "numero di transazioni",
      aside: (
        <View style={styles.asideStack}>
          {grainAside}
          <Text style={[styles.asideNote, { color: palette.ink3 }]}>
            media {averageCount.toFixed(1).replace(".", ",")}
          </Text>
        </View>
      ),
      content: (
        <>
          <BarChart
            buckets={buckets}
            metric="count"
            color={palette.accent}
            selectedKey={selected?.key ?? null}
            onSelect={(bucket) => setSelectedKey(bucket.key)}
            average={averageCount}
          />
          {statPair(
            { label: "Spesa media", value: formatAmount(averagePerPayment) },
            { label: "Spesa più alta", value: formatAmount(biggest) }
          )}
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
                  style={[styles.barTrack, { backgroundColor: palette.surface2 }]}
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
                  style={[styles.barTrack, { backgroundColor: palette.surface2 }]}
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
  ];

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

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>
          Andamento cumulato
        </Text>
        <TrendChart
          points={trend}
          limit={limitAmount}
          color={palette.accent}
          empty="Servono almeno due giorni di spese per disegnare l'andamento."
        />
      </View>

      <View>
        <View style={styles.filterHead}>
          <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
            Classifiche
          </Text>
          <TouchableOpacity
            style={styles.excludeToggle}
            onPress={() => setExcludeMarked((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: excludeMarked }}
          >
            <Text style={[styles.filterNote, { color: palette.ink3 }]}>
              escludi costi fissi
            </Text>
            <Switch
              value={excludeMarked}
              onValueChange={setExcludeMarked}
              trackColor={{ true: palette.accent, false: palette.hairline }}
            />
          </TouchableOpacity>
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
            const selectedChip = filterCategory === id;
            const color = categoryColor(category.color, dark);

            return (
              <TouchableOpacity
                key={id ?? "none"}
                onPress={() => setFilterCategory(selectedChip ? null : id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedChip
                      ? tint(color, dark)
                      : palette.surface,
                    borderColor: selectedChip ? color : palette.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedChip ? color : palette.ink2 },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {(historyPool.length > 0 || rankedPool.length > 0) && (
        <ChartCarousel pages={pages} />
      )}

      <View>
        <View style={styles.donutHead}>
          <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
            Per categoria
          </Text>
          <LetterToggle
            options={DONUT_SCOPE_OPTIONS}
            value={donutScope}
            onChange={setDonutScope}
          />
        </View>

        <CategoryDonut
          slices={slices}
          centerLabel={
            donutScope === "all"
              ? "tutto lo storico"
              : donutMonths[donutMonthIndex]?.toLocaleDateString("it-IT", {
                  month: "long",
                }) ?? ""
          }
          onSelect={(slice) =>
            explorer.openDetail({
              kind: "category",
              id: slice.id,
              title: slice.label,
            })
          }
        />

        {donutScope === "month" && donutMonthReady && (
          <MonthWheel
            months={donutMonths}
            value={donutMonthIndex}
            onChange={setDonutMonthIndex}
          />
        )}
      </View>

      {byMerchant.length > 0 && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
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
  asideStack: { alignItems: "flex-end", gap: 4 },
  asideNote: { ...type.small, fontSize: 10, fontVariant: ["tabular-nums"] },
  statsRow: { flexDirection: "row", gap: space.xxl, marginTop: space.sm },
  stat: { gap: 2 },
  statValue: { ...type.bodyMedium, fontSize: 15, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5 },
  catHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  catName: { ...type.caption, flex: 1 },
  catValue: { ...type.caption, fontWeight: "500", fontVariant: ["tabular-nums"] },
  barTrack: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 6, borderRadius: radius.pill },
  merchantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 8,
  },
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
  donutHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  filterNote: { ...type.small, fontSize: 10.5 },
  excludeToggle: { flexDirection: "row", alignItems: "center", gap: 7 },
  filterRow: { gap: 7, paddingRight: space.lg },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipText: { ...type.caption, fontWeight: "500" },
});
