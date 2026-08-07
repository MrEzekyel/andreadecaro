import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { AddPaymentSheet } from "./components/AddPaymentSheet";
import { Icon } from "./components/Icon";
import { DataProvider, useData } from "./lib/DataContext";
import { NavProvider, SettingsPage } from "./lib/NavContext";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { supabase } from "./lib/supabase";
import { radius, space, type } from "./lib/theme";
import AuthScreen, { RECOVERY_FLAG } from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import PaymentsScreen from "./screens/PaymentsScreen";
import PortfolioScreen from "./screens/PortfolioScreen";
import SettingsScreen from "./screens/SettingsScreen";
import StatsScreen from "./screens/StatsScreen";

type Tab = "home" | "payments" | "stats" | "portfolio" | "settings";

// Impostazioni non e' piu' una scheda: ci si arriva dall'ingranaggio in Home.
// Le quattro schede restano tutte destinazioni che si guardano, non si
// configurano.
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "house" },
  { key: "payments", label: "Spese", icon: "list" },
  { key: "stats", label: "Statistiche", icon: "chart-pie" },
  { key: "portfolio", label: "Investimenti", icon: "trending-up" },
];

function Shell() {
  const { palette, dark } = useTheme();
  const { reload } = useData();

  const [tab, setTab] = useState<Tab>("home");
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("root");
  // Cambia a ogni richiesta di apertura, anche verso la stessa pagina: e' il
  // segnale che dice a Impostazioni "riapri", invece di restare dove sei.
  const [settingsNonce, setSettingsNonce] = useState(0);

  const openSettings = useCallback((page: SettingsPage) => {
    setSettingsPage(page);
    setSettingsNonce((value) => value + 1);
    setTab("settings");
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.ground }]}>
      <NavProvider value={{ openSettings }}>
        <View style={styles.content} key={reloadKey}>
          {tab === "home" && <HomeScreen />}
          {tab === "payments" && <PaymentsScreen />}
          {tab === "stats" && <StatsScreen />}
          {tab === "portfolio" && <PortfolioScreen />}
          {tab === "settings" && (
            <SettingsScreen initialPage={settingsPage} openNonce={settingsNonce} />
          )}
        </View>

        <View
          style={[
            styles.tabbar,
            { backgroundColor: palette.surface, borderTopColor: palette.hairline },
          ]}
        >
          {TABS.slice(0, 2).map((item) => (
            <TabButton
              key={item.key}
              item={item}
              active={tab === item.key}
              onPress={() => setTab(item.key)}
            />
          ))}

          <TouchableOpacity
            style={[styles.fab, { backgroundColor: palette.accent }]}
            onPress={() => setAdding(true)}
            accessibilityLabel="Aggiungi spesa"
          >
            <Icon name="plus" size={21} color={palette.onAccent} strokeWidth={1.9} />
          </TouchableOpacity>

          {TABS.slice(2).map((item) => (
            <TabButton
              key={item.key}
              item={item}
              active={tab === item.key}
              onPress={() => setTab(item.key)}
            />
          ))}
        </View>
      </NavProvider>

      <AddPaymentSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          reload();
          setReloadKey((value) => value + 1);
        }}
      />

      <StatusBar style={dark ? "light" : "dark"} />
    </SafeAreaView>
  );
}

function TabButton({
  item,
  active,
  onPress,
}: {
  item: { key: Tab; label: string; icon: string };
  active: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Icon
        name={item.icon}
        size={19}
        color={active ? palette.accent : palette.ink3}
        strokeWidth={1.6}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: active ? palette.accent : palette.ink3 },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

function Root() {
  const { palette } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Il recupero password apre una sessione a meta' strada, quando il codice
  // viene accettato ma la password nuova non e' ancora stata scritta. Senza
  // questo, l'app entrerebbe proprio li' in mezzo.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Una sessione trovata all'avvio non basta a fidarsi: potrebbe essere
    // quella aperta da `verifyOtp` e mai completata da `updateUser` (app
    // chiusa nel mezzo). Vale ancora la vecchia password, e l'utente crede di
    // averla cambiata — se ne accorgerebbe solo dal prossimo dispositivo.
    (async () => {
      const interrotto = await AsyncStorage.getItem(RECOVERY_FLAG);
      if (interrotto) {
        await AsyncStorage.removeItem(RECOVERY_FLAG);
        await supabase.auth.signOut();
        setSession(null);
        setLoading(false);
        Alert.alert(
          "Password non cambiata",
          "Il cambio password si è interrotto prima di essere salvato: vale ancora quella vecchia. Riprova da «Password dimenticata»."
        );
        return;
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => setSession(next)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: palette.ground }} />;
  }

  if (!session || recovering) {
    return <AuthScreen onRecoveringChange={setRecovering} />;
  }

  // Il provider dei dati vive dentro la sessione: al logout la cache delle
  // categorie viene smontata insieme a lui, senza restare appesa.
  return (
    <DataProvider key={session.user.id}>
      <Shell />
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    paddingBottom: 6,
    paddingHorizontal: space.md,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 9.5, fontWeight: "500" },
  fab: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
    marginHorizontal: space.sm,
  },
});
