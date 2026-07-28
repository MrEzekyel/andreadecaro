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
import { PaymentRow } from "../components/PaymentRow";
import { ShareBar, Slice } from "../components/ShareBar";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { bucketize, Grain, groupByMonth } from "../lib/aggregate";
import { formatAmount, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, type } from "../lib/theme";
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

export default function DetailScreen({ target, onBack, onOpenPayment }: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [siblings, setSiblings] = useState<
    { merchantId: string; name: string; total: number }[]
  >([]);
  const [grain, setGrain] = useState<Grain>("month");
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
      setSiblings([]);
      return;
    }

    const [{ data: categoryPayments }, { data: allMerchants }] =
      await Promise.all([
        supabase
          .from("payments")
          .select("merchant_id, effective_amount")
          .eq("category_id", categoryId),
        supabase.from("merchants").select("id, display_name"),
      ]);

    const totals = new Map<string, number>();
    for (const row of categoryPayments ?? []) {
      if (!row.merchant_id) continue;
      totals.set(
        row.merchant_id,
        (totals.get(row.merchant_id) ?? 0) + Number(row.effective_amount)
      );
    }

    setSiblings(
      Array.from(totals.entries())
        .map(([merchantId, total]) => ({
          merchantId,
          total,
          name:
            allMerchants?.find((m) => m.id === merchantId)?.display_name ??
            "Sconosciuto",
        }))
        .sort((a, b) => b.total - a.total)
    );
  }, [target]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.effective_amount), 0),
    [payments]
  );

  const months = useMemo(() => groupByMonth(payments), [payments]);
  const buckets = useMemo(
    () => bucketize(payments, grain, grain === "week" ? 10 : 8),
    [payments, grain]
  );

  const accent =
    target.kind === "category"
      ? categoryById(target.id)
        ? categoryColor(categoryById(target.id)!.color, dark)
        : palette.uncategorized
      : palette.accent;

  const amount = splitAmount(total);
  const visibleMonths = showAll ? months : months.slice(0, 1);

  async function toggleExcluded(value: boolean) {
    if (!merchant) return;
    setMerchant({ ...merchant, excluded_from_stats: value });

    const { error } = await supabase
      .from("merchants")
      .update({ excluded_from_stats: value })
      .eq("id", merchant.id);

    if (error) setMerchant({ ...merchant, excluded_from_stats: !value });
  }

  const grainToggle = (
    <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
      {(["week", "month"] as Grain[]).map((option) => (
        <TouchableOpacity
          key={option}
          onPress={() => setGrain(option)}
          style={[
            styles.segmentOption,
            grain === option && { backgroundColor: palette.surface },
          ]}
        >
          <Text
            style={[
              styles.segmentLabel,
              { color: grain === option ? palette.ink : palette.ink3 },
            ]}
          >
            {option === "week" ? "Settimana" : "Mese"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const pages: ChartPage[] = [
    {
      key: "spend",
      title: "Quanto spendi",
      subtitle: target.title,
      content: (
        <>
          {grainToggle}
          <BarChart buckets={buckets} metric="amount" color={accent} />
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
          <BarChart buckets={buckets} metric="count" color={accent} />
        </>
      ),
    },
  ];

  if (target.kind === "merchant" && siblings.length > 0) {
    pages.push({
      key: "share",
      title: "Peso nella categoria",
      subtitle: categoryById(payments[0]?.category_id ?? null)?.name,
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
              {formatAmount(months.length ? total / months.length : 0)}
            </Text>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>
              al mese
            </Text>
          </View>
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
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
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
  statValue: { ...type.bodyMedium, fontSize: 15, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5, textAlign: "center" },
  segment: { flexDirection: "row", gap: 4, borderRadius: 10, padding: 3 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 7,
  },
  segmentLabel: { ...type.small, fontSize: 11, fontWeight: "500" },
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
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  excludeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  excludeLabel: { ...type.caption },
  excludeHint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
});
