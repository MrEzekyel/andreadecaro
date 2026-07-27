import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (!error && data) setPayments(data as Payment[]);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("payments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nessun pagamento registrato ancora. Configura la Shortcut sul tuo
            iPhone per iniziare.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.merchant}>{item.merchant_name}</Text>
              <Text style={styles.meta}>
                {item.category} · {formatDate(item.occurred_at)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowLeft: { flexShrink: 1, paddingRight: 12 },
  merchant: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, color: "#888", marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 60, color: "#888", paddingHorizontal: 32 },
});
