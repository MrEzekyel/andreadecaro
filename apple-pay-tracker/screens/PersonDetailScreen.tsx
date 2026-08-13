import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native";
import { ChartCarousel, ChartPage } from "../components/ChartCarousel";
import { GroupedBarChart } from "../components/GroupedBarChart";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, splitAmount } from "../lib/format";
import {
  groupEventsByMonth,
  monthlySplitBuckets,
  SplitEvent,
} from "../lib/splits";
import { space, tint, type } from "../lib/theme";

type Props = {
  personId: string;
  personName: string;
  events: SplitEvent[];
  onBack: () => void;
};

/**
 * Il dettaglio delle divisioni con una persona — stessa impalcatura di
 * `DetailScreen` (categorie/esercenti nelle spese): totale, carosello di
 * grafici, elenco raggruppato per mese con "Vedi tutte". Qui il grafico ha
 * due serie invece di una (ricevuto/inviato) perche' con una persona il
 * denaro si muove in due direzioni, non una sola.
 */
export default function PersonDetailScreen({
  personId,
  personName,
  events,
  onBack,
}: Props) {
  const { palette, dark } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const mine = useMemo(
    () => events.filter((e) => e.personId === personId),
    [events, personId]
  );

  const totalReceived = mine
    .filter((e) => e.direction === "credit")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalSent = mine
    .filter((e) => e.direction === "debt")
    .reduce((sum, e) => sum + e.amount, 0);
  const net = totalReceived - totalSent;

  const buckets = useMemo(() => monthlySplitBuckets(mine, 6), [mine]);
  const months = useMemo(() => groupEventsByMonth(mine), [mine]);
  const visibleMonths = showAll ? months : months.slice(0, 1);

  const amount = splitAmount(Math.abs(net));

  const pages: ChartPage[] = [
    {
      key: "amount",
      title: "Quanto dividete",
      subtitle: "per mese",
      content: (
        <GroupedBarChart
          groups={buckets.map((b) => ({
            key: b.key,
            label: b.label,
            values: [b.received, b.sent],
          }))}
          colors={[palette.good, palette.over]}
          formatValue={(v) => formatAmount(v)}
        />
      ),
    },
    {
      key: "count",
      title: "Quante volte",
      subtitle: "divisioni per mese",
      content: (
        <GroupedBarChart
          groups={buckets.map((b) => ({
            key: b.key,
            label: b.label,
            values: [b.receivedCount, b.sentCount],
          }))}
          colors={[palette.good, palette.over]}
          formatValue={(v) => String(Math.round(v))}
        />
      ),
    },
  ];

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.back}
            hitSlop={backHitSlop}
            accessibilityLabel="Indietro"
          >
            <Icon name="chevron-left" size={20} color={palette.ink} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
            {personName}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: palette.ink2 }]}>
                Diviso in tutto
              </Text>
              <Text style={[styles.totalValue, { color: palette.ink }]}>
                {formatAmount(totalReceived + totalSent)}
              </Text>
            </View>

            <Text style={[styles.label, { color: palette.ink3 }]}>
              {net === 0 ? "Siete pari" : net > 0 ? "Ti deve" : "Le/gli devi"}
            </Text>
            <Text
              style={[
                styles.hero,
                { color: net === 0 ? palette.ink : net > 0 ? palette.good : palette.over },
              ]}
            >
              {net === 0 ? "0" : amount.whole}
              {net !== 0 && (
                <Text style={[styles.heroCents, { color: palette.ink3 }]}>
                  {amount.cents}
                </Text>
              )}
            </Text>

            <View style={styles.legend}>
              <LegendDot color={palette.good} label={`ricevuto ${formatAmount(totalReceived)}`} />
              <LegendDot color={palette.over} label={`inviato ${formatAmount(totalSent)}`} />
            </View>
          </View>

          {mine.length > 0 && <ChartCarousel pages={pages} />}

          <View>
            <View style={styles.listHead}>
              <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
                {showAll ? "Tutte le divisioni" : months[0]?.label ?? "Divisioni"}
              </Text>
              {months.length > 1 && (
                <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
                  <Text style={[styles.link, { color: palette.accent }]}>
                    {showAll ? "Mostra meno" : "Vedi tutte"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {visibleMonths.map((group) => (
              <View key={group.key}>
                {showAll && (
                  <Text style={[styles.monthLabel, { color: palette.ink3 }]}>
                    {group.label}
                  </Text>
                )}
                {group.data.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </View>
            ))}

            {mine.length === 0 && (
              <Text style={[styles.empty, { color: palette.ink3 }]}>
                Nessuna divisione ancora con {personName}.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </SwipeBack>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: palette.ink2 }]}>{label}</Text>
    </View>
  );
}

function EventRow({ event }: { event: SplitEvent }) {
  const { palette, dark } = useTheme();
  const credit = event.direction === "credit";
  const color = credit ? palette.good : palette.over;

  const state =
    event.direction === "debt"
      ? null
      : event.status === "pending"
        ? "In attesa"
        : event.status === "declined"
          ? "Rifiutata"
          : event.settled
            ? "Saldata"
            : null;

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: tint(color, dark) }]}>
        <Icon name={credit ? "arrow-down-left" : "arrow-up-right"} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowMerchant, { color: palette.ink }]} numberOfLines={1}>
          {event.merchant}
        </Text>
        <Text style={[styles.rowMeta, { color: palette.ink3 }]}>
          {new Date(event.occurredAt).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "short",
          })}
          {state ? ` · ${state}` : ""}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color }]}>
        {credit ? "+" : "−"}
        {formatAmount(event.amount)}
      </Text>
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
  back: { padding: 12, marginLeft: -8 },
  title: { ...type.title, flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  totalLabel: { ...type.caption },
  totalValue: { ...type.bodyMedium, fontVariant: ["tabular-nums"] },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  legend: { flexDirection: "row", gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.small },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  link: { ...type.caption, fontWeight: "500" },
  monthLabel: { ...type.label, marginTop: space.md, marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  rowIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rowMerchant: { ...type.body },
  rowMeta: { ...type.small, marginTop: 1 },
  rowAmount: { ...type.amount, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, textAlign: "center", marginTop: space.lg },
});
