import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Payment } from "../lib/types";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StatsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (!error && data) setPayments(data as Payment[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const thisMonth = monthKey(new Date().toISOString());
  const monthPayments = useMemo(
    () => payments.filter((p) => monthKey(p.occurred_at) === thisMonth),
    [payments, thisMonth]
  );

  const totalThisMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of monthPayments) {
      map.set(p.category, (map.get(p.category) ?? 0) + p.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthPayments]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Speso questo mese</Text>
        <Text style={styles.totalAmount}>{formatAmount(totalThisMonth)}</Text>
        <Text style={styles.totalMeta}>
          {monthPayments.length} pagament{monthPayments.length === 1 ? "o" : "i"}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Per categoria</Text>
      {byCategory.length === 0 && (
        <Text style={styles.empty}>Nessun dato per questo mese.</Text>
      )}
      {byCategory.map(([category, amount]) => {
        const pct = totalThisMonth > 0 ? (amount / totalThisMonth) * 100 : 0;
        return (
          <View key={category} style={styles.categoryRow}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{category}</Text>
              <Text style={styles.categoryAmount}>{formatAmount(amount)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  totalCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  totalLabel: { color: "#bbb", fontSize: 14 },
  totalAmount: { color: "#fff", fontSize: 32, fontWeight: "700", marginTop: 4 },
  totalMeta: { color: "#999", fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  categoryRow: { marginBottom: 14 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  categoryName: { fontSize: 15, fontWeight: "500" },
  categoryAmount: { fontSize: 15, color: "#444" },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#eee",
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: "#111" },
  empty: { textAlign: "center", marginTop: 20, color: "#888" },
});
