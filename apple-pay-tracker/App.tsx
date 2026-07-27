import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import AuthScreen from "./screens/AuthScreen";
import PaymentsScreen from "./screens/PaymentsScreen";
import StatsScreen from "./screens/StatsScreen";

type Tab = "payments" | "stats";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return <View style={styles.center} />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {tab === "stats" ? "Statistiche" : "Pagamenti"}
        </Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logout}>Esci</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {tab === "stats" ? <StatsScreen /> : <PaymentsScreen />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setTab("stats")}
        >
          <Text style={[styles.tabLabel, tab === "stats" && styles.tabLabelActive]}>
            Statistiche
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setTab("payments")}
        >
          <Text
            style={[styles.tabLabel, tab === "payments" && styles.tabLabelActive]}
          >
            Pagamenti
          </Text>
        </TouchableOpacity>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  logout: { color: "#c00", fontSize: 14 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 14, color: "#999" },
  tabLabelActive: { color: "#111", fontWeight: "700" },
});
