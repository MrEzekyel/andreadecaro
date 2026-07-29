import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "../components/BarChart";
import { ChartCarousel, ChartPage } from "../components/ChartCarousel";
import { Icon } from "../components/Icon";
import { LetterToggle } from "../components/LetterToggle";
import { MonthWheel } from "../components/MonthWheel";
import { PaymentRow } from "../components/PaymentRow";
import { ShareBar, Slice } from "../components/ShareBar";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import {
  Bucket,
  bucketize,
  Grain,
  groupByMonth,
  paymentsIn,
} from "../lib/aggregate";
import { formatAmount, monthName, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, space, type } from "../lib/theme";
import { Merchant, Payment } from "../lib/types";

/** Dettaglio di un singolo esercente oppure di una singola categoria. */
export type DetailTarget =
  | { kind: "merchant"; id: string; title: string }
  | { kind: "category"; id: string | null; title: string };

type Props = {
  target: DetailTarget;
  onBack: () => void;
  onOpenPayment: (payment: Payment) => void;
};

type SiblingRow = {
  merchant_id: string | null;
  effective_amount: number;
  occurred_at: string;
};

const GRAIN_OPTIONS = [
  { value: "week" as Grain, letter: "W", label: "Per settimana" },
  { value: "month" as Grain, letter: "M", label: "Per mese" },
];

type ShareScope = "month" | "all";

const SCOPE_OPTIONS = [
  { value: "month" as ShareScope, letter: "M", label: "Un mese alla volta" },
  { value: "all" as ShareScope, letter: "A", label: "Tutto lo storico" },
];

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function DetailScreen({ target, onBack, onOpenPayment }: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [siblingRows, setSiblingRows] = useState<SiblingRow[]>([]);
  const [merchantNames, setMerchantNames] = useState<Map<string, string>>(
    new Map()
  );
  const [grain, setGrain] = useState<Grain>("month");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shareScope, setShareScope] = useState<ShareScope>("month");
  const [shareMonthIndex, setShareMonthIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
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
    const rows = (data ?? []) as Payment[];
    setPayments(rows);
    setLoading(false);

    if (target.kind !== "merchant") return;

    const { data: merchantRow } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", target.id)
      .maybeSingle();

    if (merchantRow) setMerchant(merchantRow as Merchant);

    // Per il peso nella categoria servono anche gli ALTRI esercenti della
    // stessa categoria: il confronto e' il senso stesso di quel grafico.
    const categoryId = rows[0]?.category_id ?? merchantRow?.category_id ?? null;
    if (!categoryId) {
      setSiblingRows([]);
      return;
    }

    const [{ data: categoryPayments }, { data: allMerchants }] =
      await Promise.all([
        supabase
          .from("payments")
          .select("merchant_id, effective_amount, occurred_at")
          .eq("category_id", categoryId),
        supabase.from("merchants").select("id, display_name"),
      ]);

    setSiblingRows((categoryPayments ?? []) as SiblingRow[]);
    setMerchantNames(
      new Map((allMerchants ?? []).map((m) => [m.id, m.display_name]))
    );
  }, [target]);

  useEffect(() => {
    load();
  }, [load]);

  const allTimeTotal = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.effective_amount), 0),
    [payments]
  );

  const months = useMemo(() => groupByMonth(payments), [payments]);
  const buckets = useMemo(
    () => bucketize(payments, grain, grain === "week" ? 10 : 8),
    [payments, grain]
  );

  // L'ultimo intervallo — quello in corso — e' la selezione naturale: la
  // schermata si apre su "adesso", non sul primo dato disponibile.
  const selected: Bucket | undefined =
    buckets.find((bucket) => bucket.key === selectedKey) ??
    buckets[buckets.length - 1];

  const selectedPayments = useMemo(
    () => (selected ? paymentsIn(payments, selected, grain) : []),
    [payments, selected, grain]
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

  /** Media per intervallo, tracciata come linea di riferimento nel grafico. */
  const averageTotal = buckets.length
    ? buckets.reduce((sum, b) => sum + b.total, 0) / buckets.length
    : 0;
  const averageCount = buckets.length
    ? buckets.reduce((sum, b) => sum + b.count, 0) / buckets.length
    : 0;

  /** Mesi disponibili per la ghiera del peso nella categoria, dal piu' vecchio. */
  const shareMonths = useMemo(() => {
    const keys = new Map<string, Date>();
    for (const row of siblingRows) {
      const date = new Date(row.occurred_at);
      const anchor = new Date(date.getFullYear(), date.getMonth(), 1);
      keys.set(`${anchor.getFullYear()}-${anchor.getMonth()}`, anchor);
    }
    return Array.from(keys.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [siblingRows]);

  // Di default la ghiera sta sull'ultimo mese con dati, non sul primo.
  useEffect(() => {
    if (shareMonths.length > 0) setShareMonthIndex(shareMonths.length - 1);
  }, [shareMonths.length]);

  const shareMonth = shareMonths[shareMonthIndex];

  const siblings = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of siblingRows) {
      if (!row.merchant_id) continue;
      if (
        shareScope === "month" &&
        shareMonth &&
        !sameMonth(new Date(row.occurred_at), shareMonth)
      ) {
        continue;
      }
      totals.set(
        row.merchant_id,
        (totals.get(row.merchant_id) ?? 0) + Number(row.effective_amount)
      );
    }

    return Array.from(totals.entries())
      .map(([merchantId, total]) => ({
        merchantId,
        total,
        name: merchantNames.get(merchantId) ?? "Sconosciuto",
      }))
      .sort((a, b) => b.total - a.total);
  }, [siblingRows, merchantNames, shareScope, shareMonth]);

  const accent =
    target.kind === "category"
      ? categoryById(target.id)
        ? categoryColor(categoryById(target.id)!.color, dark)
        : palette.uncategorized
      : palette.accent;

  const amount = splitAmount(selectedTotal);
  const visibleMonths = showAll ? months : months.slice(0, 1);

  /** "Nel mese corrente", oppure il periodo davvero selezionato. */
  const periodLabel = (() => {
    if (!selected) return "Nel mese corrente";
    const now = new Date();
    if (grain === "month") {
      return sameMonth(selected.start, now)
        ? "Nel mese corrente"
        : `In ${monthName(selected.start)} ${selected.start.getFullYear()}`;
    }
    const thisWeek = new Date(now);
    const weekday = thisWeek.getDay() === 0 ? 7 : thisWeek.getDay();
    thisWeek.setDate(thisWeek.getDate() - (weekday - 1));
    thisWeek.setHours(0, 0, 0, 0);
    return selected.start.getTime() === thisWeek.getTime()
      ? "In questa settimana"
      : `Settimana del ${selected.label}`;
  })();

  async function toggleExcluded(value: boolean) {
    if (!merchant) return;
    setMerchant({ ...merchant, excluded_from_stats: value });

    const { error } = await supabase
      .from("merchants")
      .update({ excluded_from_stats: value })
      .eq("id", merchant.id);

    if (error) setMerchant({ ...merchant, excluded_from_stats: !value });
  }

  const grainAside = (
    <View style={styles.aside}>
      <LetterToggle options={GRAIN_OPTIONS} value={grain} onChange={setGrain} />
    </View>
  );

  function statPair(
    first: { label: string; value: string },
    second: { label: string; value: string }
  ) {
    return (
      <View style={styles.statsRow}>
        {[first, second].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: accent }]}>{stat.value}</Text>
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
      subtitle: target.title,
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
            color={accent}
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
            color={accent}
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
  ];

  if (target.kind === "merchant" && siblingRows.length > 0) {
    pages.push({
      key: "share",
      title: "Peso nella categoria",
      subtitle: categoryById(payments[0]?.category_id ?? null)?.name,
      aside: (
        <LetterToggle
          options={SCOPE_OPTIONS}
          value={shareScope}
          onChange={setShareScope}
        />
      ),
      content: (
        <ShareBar
          slices={siblings.map<Slice>((s) => ({
            id: s.merchantId,
            label: s.name,
            value: s.total,
          }))}
          highlightId={target.id}
          highlightColor={palette.accent}
        />
      ),
      footer:
        shareScope === "month" && shareMonths.length > 0 ? (
          <View style={styles.wheel}>
            <MonthWheel
              months={shareMonths}
              value={shareMonthIndex}
              onChange={setShareMonthIndex}
            />
          </View>
        ) : shareScope === "all" ? (
          <Text style={[styles.wheelNote, { color: palette.ink3 }]}>
            tutto lo storico
          </Text>
        ) : null,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          accessibilityLabel="Indietro"
        >
          <Icon name="chevron-left" size={20} color={palette.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
          {target.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: palette.ink2 }]}>
              Totale speso
            </Text>
            <Text style={[styles.totalValue, { color: palette.ink }]}>
              {formatAmount(allTimeTotal)}
            </Text>
          </View>

          <Text style={[styles.label, { color: palette.ink3 }]}>
            {periodLabel}
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {amount.whole}
            <Text style={[styles.heroCents, { color: palette.ink3 }]}>
              {amount.cents}
            </Text>
          </Text>
        </View>

        {payments.length > 0 && <ChartCarousel pages={pages} />}

        <View>
          <View style={styles.listHead}>
            <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
              {showAll ? "Tutte le spese" : "Ultimo mese"}
            </Text>
            {months.length > 1 && (
              <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
                <Text style={[styles.link, { color: palette.accent }]}>
                  {showAll ? "Mostra meno" : "Vedi tutte le transazioni"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {visibleMonths.map((group) => (
            <View key={group.key}>
              <View style={styles.monthHead}>
                <Text style={[styles.monthLabel, { color: palette.ink3 }]}>
                  {group.label}
                </Text>
                <Text style={[styles.monthTotal, { color: palette.ink3 }]}>
                  {formatAmount(group.total)}
                </Text>
              </View>

              {group.data.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  category={categoryById(payment.category_id)}
                  onPress={() => onOpenPayment(payment)}
                />
              ))}
            </View>
          ))}

          {!loading && payments.length === 0 && (
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              Nessuna spesa registrata.
            </Text>
          )}
        </View>

        {merchant && (
          <View style={styles.excludeRow}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={[styles.excludeLabel, { color: palette.ink }]}>
                Escludi dalle classifiche
              </Text>
              <Text style={[styles.excludeHint, { color: palette.ink3 }]}>
                Tutte le spese di questo esercente restano nei totali ma non
                compaiono in "dove spendo di più".
              </Text>
            </View>
            <Switch
              value={merchant.excluded_from_stats}
              onValueChange={toggleExcluded}
              trackColor={{ true: palette.accent, false: palette.hairline }}
            />
          </View>
        )}
      </ScrollView>
    </View>
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
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  totalLabel: { ...type.caption },
  totalValue: {
    ...type.bodyMedium,
    fontVariant: ["tabular-nums"],
  },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  aside: { alignItems: "flex-end" },
  asideStack: { alignItems: "flex-end", gap: 4 },
  asideNote: { ...type.small, fontSize: 10, fontVariant: ["tabular-nums"] },
  statsRow: { flexDirection: "row", gap: space.xxl, marginTop: space.sm },
  stat: { gap: 2 },
  statValue: { ...type.bodyMedium, fontSize: 15, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5 },
  wheel: { marginTop: space.md },
  wheelNote: {
    ...type.small,
    fontSize: 10.5,
    textAlign: "center",
    marginTop: space.md,
  },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  link: { ...type.caption, fontWeight: "500" },
  monthHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: space.md,
    marginBottom: 2,
  },
  monthLabel: { ...type.label },
  monthTotal: { ...type.small, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, textAlign: "center", marginTop: space.lg },
  excludeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  excludeLabel: { ...type.caption },
  excludeHint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
});
