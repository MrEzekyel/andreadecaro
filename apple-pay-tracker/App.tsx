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
import { AddIncomeSheet } from "./components/AddIncomeSheet";
import { AddPaymentSheet } from "./components/AddPaymentSheet";
import { Icon } from "./components/Icon";
import { LockCover, LockScreen } from "./components/LockScreen";
import { AppLockProvider, useAppLock } from "./lib/AppLockContext";
import { DataProvider, useData } from "./lib/DataContext";
import { NavProvider, SettingsPage } from "./lib/NavContext";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { supabase } from "./lib/supabase";
import { radius, space, type } from "./lib/theme";
import { MoneyMode } from "./lib/moneyMode";
import AuthScreen, { RECOVERY_FLAG } from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import MovementsScreen from "./screens/MovementsScreen";
import PortfolioScreen from "./screens/PortfolioScreen";
import SettingsScreen from "./screens/SettingsScreen";
import StatsScreen from "./screens/StatsScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

type Tab = "home" | "movements" | "stats" | "portfolio" | "settings";

// Impostazioni non e' piu' una scheda: ci si arriva dall'ingranaggio in Home.
// Le quattro schede restano tutte destinazioni che si guardano, non si
// configurano.
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "house" },
  { key: "movements", label: "Movimenti", icon: "arrow-left-right" },
  { key: "stats", label: "Statistiche", icon: "chart-pie" },
  { key: "portfolio", label: "Investimenti", icon: "trending-up" },
];

function Shell() {
  const { palette, dark } = useTheme();
  const { reload } = useData();

  const [tab, setTab] = useState<Tab>("home");
  // Uscite/Entrate, condiviso fra Home e Movimenti invece che locale a
  // ciascuna: e' lo stesso interruttore concettuale in entrambe le
  // schermate, e il tasto centrale della tabbar deve saperlo leggere da
  // qualunque delle due si stia guardando per decidere cosa aggiunge.
  const [moneyMode, setMoneyMode] = useState<MoneyMode>("uscite");
  const [adding, setAdding] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);
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

  const openAddIncome = useCallback(() => setAddingIncome(true), []);

  // Il tasto centrale segue quello che si sta guardando su Home o su
  // Movimenti: su Entrate aggiunge un introito, altrimenti una spesa. Sulle
  // altre schede (Statistiche, Investimenti) non c'e' un Uscite/Entrate da
  // seguire, quindi resta il comportamento di sempre: aggiunge una spesa.
  const addingIncomeTarget =
    (tab === "home" || tab === "movements") && moneyMode === "entrate";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.ground }]}>
      <NavProvider value={{ openSettings, openAddIncome }}>
        <View style={styles.content} key={reloadKey}>
          {tab === "home" && (
            <HomeScreen mode={moneyMode} onModeChange={setMoneyMode} />
          )}
          {tab === "movements" && (
            <MovementsScreen mode={moneyMode} onModeChange={setMoneyMode} />
          )}
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
            style={[
              styles.fab,
              { backgroundColor: addingIncomeTarget ? palette.good : palette.accent },
            ]}
            onPress={() =>
              addingIncomeTarget ? setAddingIncome(true) : setAdding(true)
            }
            accessibilityLabel={
              addingIncomeTarget ? "Aggiungi introito" : "Aggiungi spesa"
            }
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

      <AddIncomeSheet
        visible={addingIncome}
        onClose={() => setAddingIncome(false)}
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
    <LockGate>
      <DataProvider key={session.user.id}>
        <FirstRunGate>
          <Shell />
        </FirstRunGate>
      </DataProvider>
    </LockGate>
  );
}

/**
 * Il benvenuto, una volta sola, appena l'account e' verificato.
 *
 * Il discriminante e' `profiles.display_name` nullo e non un flag su disco:
 * un flag locale si perde cambiando telefono e rifarebbe comparire il
 * benvenuto a chi l'ha gia' fatto, mentre il nome mancante e' la stessa cosa
 * che la schermata esiste per raccogliere.
 *
 * Se il profilo non si riesce a leggere si tira dritto: un errore di rete
 * all'avvio non deve poter bloccare fuori dall'app chi ci e' gia' dentro.
 */
function FirstRunGate({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  const [state, setState] = useState<
    { status: "loading" } | { status: "welcome"; handle: string } | { status: "ready" }
  >({ status: "loading" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("handle, display_name")
        .maybeSingle();

      if (error || !data || data.display_name || !data.handle) {
        setState({ status: "ready" });
        return;
      }
      setState({ status: "welcome", handle: data.handle });
    })();
  }, []);

  if (state.status === "loading") {
    return <View style={{ flex: 1, backgroundColor: palette.ground }} />;
  }

  if (state.status === "welcome") {
    return (
      <WelcomeScreen
        handle={state.handle}
        onDone={() => setState({ status: "ready" })}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Tiene l'app coperta finche' il blocco non e' superato.
 *
 * Sta dentro la sessione e non fuori: senza dati a cui accedere non c'e'
 * niente da proteggere, e chiedere il volto sulla schermata di accesso
 * sarebbe un ostacolo davanti a una porta gia' chiusa.
 */
function LockGate({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  const { enabled, locked, covered, unlock } = useAppLock();

  // Preferenza non ancora letta da disco: si aspetta invece di mostrare.
  // Disegnare l'app e coprirla un istante dopo l'avrebbe comunque mostrata,
  // ed e' esattamente il fotogramma che qualcuno potrebbe voler leggere.
  if (enabled === null) {
    return <View style={{ flex: 1, backgroundColor: palette.ground }} />;
  }

  if (locked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      {covered && <LockCover />}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppLockProvider>
        <Root />
      </AppLockProvider>
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
