import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useExplorer } from "../components/Explorer";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { StaleNote } from "../components/StaleNote";
import { PaymentRow } from "../components/PaymentRow";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { dayKey, dayLabel, formatAmount, monthName } from "../lib/format";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Payment } from "../lib/types";
import { usePayments } from "../lib/usePayments";

export default function PaymentsScreen() {
  const { palette, dark } = useTheme();
  const { categories, categoryById } = useData();

  const [month, setMonth] = useState(() => new Date());
  const { payments, error, staleLabel, staleReason, reload } = usePayments(month);
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);

  const [query, setQuery] = useState("");
  /** null = tutte le categorie. */
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.filter((payment) => {
      if (needle && !payment.merchant_name.toLowerCase().includes(needle)) {
        return false;
      }
      if (filterCategory !== null && payment.category_id !== filterCategory) {
        return false;
      }
      return true;
    });
  }, [payments, query, filterCategory]);

  // Le spese arrivano gia' ordinate dal piu' recente: raggrupparle in
  // sequenza preserva l'ordine senza dover riordinare le sezioni.
  const sections = useMemo(() => {
    const groups: { title: string; total: number; data: Payment[] }[] = [];
    let currentKey: string | null = null;

    for (const payment of filtered) {
      const key = dayKey(payment.occurred_at);
      if (key !== currentKey) {
        groups.push({
          title: dayLabel(payment.occurred_at),
          total: 0,
          data: [],
        });
        currentKey = key;
      }
      const group = groups[groups.length - 1];
      group.data.push(payment);
      group.total += Number(payment.effective_amount);
    }

    return groups;
  }, [filtered]);

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
    await reload();
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  const filtering = query.trim() !== "" || filterCategory !== null;

  return (
    <>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>Spese</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              accessibilityLabel="Mese precedente"
            >
              <Icon name="chevron-left" size={16} color={palette.ink3} />
            </TouchableOpacity>
            <Text style={[styles.month, { color: palette.ink3 }]}>
              {monthName(month)}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              accessibilityLabel="Mese successivo"
            >
              <Icon name="chevron-right" size={16} color={palette.ink3} />
            </TouchableOpacity>
          </View>
        </View>

        {staleLabel && (
          <View style={styles.stale}>
            <StaleNote label={staleLabel} reason={staleReason} onRetry={reload} />
          </View>
        )}

        <View style={styles.filters}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Icon name="search" size={15} color={palette.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca per nome"
              placeholderTextColor={palette.ink3}
              style={[styles.searchInput, { color: palette.ink }]}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Icon name="x" size={15} color={palette.ink3} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <TouchableOpacity
              onPress={() => setFilterCategory(null)}
              style={[
                styles.chip,
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
                  styles.chipText,
                  {
                    color:
                      filterCategory === null ? palette.onAccent : palette.ink2,
                  },
                ]}
              >
                Tutte
              </Text>
            </TouchableOpacity>

            {categories.map((category) => {
              const selected = filterCategory === category.id;
              const color = categoryColor(category.color, dark);
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() =>
                    setFilterCategory(selected ? null : category.id)
                  }
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? tint(color, dark)
                        : palette.surface,
                      borderColor: selected ? color : palette.hairline,
                    },
                  ]}
                >
                  <Icon name={category.icon} size={13} color={color} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? palette.ink : palette.ink2 },
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={[styles.dayLabel, { color: palette.ink3 }]}>
                {section.title}
              </Text>
              <Text style={[styles.dayTotal, { color: palette.ink3 }]}>
                {formatAmount(section.total)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PaymentRow
              payment={item}
              category={categoryById(item.category_id)}
              onPress={() => explorer.openPayment(item)}
            />
          )}
          ListEmptyComponent={
            // "Nessuna spesa in agosto" e "non sono riuscito a leggere" sono
            // due cose diverse, e finivano entrambe in questa riga.
            error ? (
              <LoadError message={error} onRetry={reload} />
            ) : (
              <Text style={[styles.empty, { color: palette.ink3 }]}>
                {filtering
                  ? "Nessuna spesa corrisponde ai filtri."
                  : `Nessuna spesa in ${monthName(month)}.`}
              </Text>
            )
          }
        />
      </View>

      {explorer.overlay}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  title: { ...type.title },
  monthNav: { flexDirection: "row", alignItems: "center", gap: space.sm },
  month: { ...type.caption, fontWeight: "500", textTransform: "capitalize" },
  stale: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  filters: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, ...type.body, padding: 0 },
  chipRow: { gap: 7, paddingRight: space.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...type.caption, fontWeight: "500" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: space.md,
    marginBottom: 4,
  },
  dayLabel: { ...type.label },
  dayTotal: { ...type.small, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, textAlign: "center", marginTop: space.xxl },
});
