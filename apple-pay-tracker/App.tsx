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
import { useWideLayout } from "./lib/layout";
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
  const wide = useWideLayout();
  const { reload } = useData();

  const [tab, setTab] = useState<Tab>("home");
  // Uscite/Entrate, condiviso fra Home e Movimenti invece che locale a
  // ciascuna: e' lo stesso interruttore concettuale in entrambe le
  // schermate, e il tasto centrale della tabbar deve saperlo leggere da
  // qualunque delle due si stia guardando per decidere cosa aggiunge.
  const [moneyMode, setMoneyMode] = useState<MoneyMode>("uscite");
  const [adding, setAdding] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);
  // Il tasto centrale, quando si e' su Investimenti, non apre un foglio qui:
  // lo fa aprire dentro `PortfolioScreen`, che e' l'unico posto che ha gia'
  // gli asset caricati (`usePortfolio`). Cambia a ogni pressione, mai
  // `undefined`, cosi' lo schermo lo distingue da "non ho ancora premuto".
  const [investmentNonce, setInvestmentNonce] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("root");
  // Cambia a ogni richiesta di apertura, anche verso la stessa pagina: e' il
  // segnale che dice a Impostazioni "riapri", invece di restare dove sei.
  const [settingsNonce, setSettingsNonce] = useState(0);
  // La scheda da cui si e' aperto Impostazioni (dal tasto ingranaggio o da
  // un ingresso laterale come "Prossimi addebiti" in Home): e' dove il tasto
  // Indietro deve tornare una volta risalita la sua sotto-pagina, invece di
  // fermarsi alla radice di Impostazioni. Si aggiorna solo al primo ingresso
  // (quando non si e' gia' su "settings"): una seconda `openSettings` mentre
  // si e' gia' dentro Impostazioni non deve dimenticare da dove si era
  // partiti davvero.
  const [settingsOrigin, setSettingsOrigin] = useState<Tab>("home");

  const openSettings = useCallback(
    (page: SettingsPage) => {
      // Solo al primo ingresso: chiamata di nuovo mentre si e' gia' dentro
      // Impostazioni (es. da una seconda card laterale) non deve sovrascrivere
      // la scheda di partenza vera con "settings" stesso.
      if (tab !== "settings") setSettingsOrigin(tab);
      setSettingsPage(page);
      setSettingsNonce((value) => value + 1);
      setTab("settings");
    },
    [tab]
  );

  const exitSettings = useCallback(() => {
    setTab(settingsOrigin);
  }, [settingsOrigin]);

  const openAddIncome = useCallback(() => setAddingIncome(true), []);

  // Il tasto centrale segue quello che si sta guardando su Home o su
  // Movimenti: su Entrate aggiunge un introito, altrimenti una spesa. Su
  // Statistiche non c'e' un Uscite/Entrate da seguire, resta il
  // comportamento di sempre (aggiunge una spesa). Su Investimenti seguiva lo
  // stesso comportamento fino a quando l'inserimento manuale non e'
  // esistito: aprire "Nuova spesa" da quella scheda era un errore
  // categoriale, non solo un default poco specifico.
  const addingIncomeTarget =
    (tab === "home" || tab === "movements") && moneyMode === "entrate";
  const addingInvestmentTarget = tab === "portfolio";

  // Il tasto di aggiunta e' lo stesso nella tabbar e nel rail: cambia solo il
  // margine, che in verticale lo fa sporgere sopra la barra e in orizzontale
  // non serve.
  const addButton = (
    <TouchableOpacity
      style={[
        styles.fab,
        wide ? styles.fabRail : styles.fabBar,
        {
          backgroundColor: addingInvestmentTarget
            ? palette.invest
            : addingIncomeTarget
              ? palette.good
              : palette.accent,
        },
      ]}
      onPress={() => {
        if (addingInvestmentTarget) setInvestmentNonce((v) => v + 1);
        else if (addingIncomeTarget) setAddingIncome(true);
        else setAdding(true);
      }}
      accessibilityLabel={
        addingInvestmentTarget
          ? "Aggiungi investimento"
          : addingIncomeTarget
            ? "Aggiungi introito"
            : "Aggiungi spesa"
      }
    >
      <Icon name="plus" size={21} color={palette.onAccent} strokeWidth={1.9} />
    </TouchableOpacity>
  );

  const navItems = (
    <>
      {TABS.slice(0, 2).map((item) => (
        <TabButton
          key={item.key}
          item={item}
          active={tab === item.key}
          wide={wide}
          onPress={() => setTab(item.key)}
        />
      ))}

      {addButton}

      {TABS.slice(2).map((item) => (
        <TabButton
          key={item.key}
          item={item}
          active={tab === item.key}
          wide={wide}
          onPress={() => setTab(item.key)}
        />
      ))}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.ground }]}>
      <NavProvider value={{ openSettings, openAddIncome }}>
        {/* In orizzontale la barra ruota e diventa un rail a sinistra: su uno
            schermo largo e basso l'altezza e' la risorsa scarsa, e una barra in
            fondo la consuma proprio dove serve al contenuto. L'ordine delle
            voci resta lo stesso, cosi' la mano sa gia' dove andare. */}
        <View style={[styles.shell, wide && styles.shellWide]}>
          {wide && (
            <View
              style={[
                styles.rail,
                { backgroundColor: palette.surface, borderRightColor: palette.hairline },
              ]}
            >
              {navItems}
            </View>
          )}

          <View style={styles.content} key={reloadKey}>
            {tab === "home" && (
              <HomeScreen mode={moneyMode} onModeChange={setMoneyMode} />
            )}
            {tab === "movements" && (
              <MovementsScreen mode={moneyMode} onModeChange={setMoneyMode} />
            )}
            {tab === "stats" && <StatsScreen />}
            {tab === "portfolio" && <PortfolioScreen addNonce={investmentNonce} />}
            {tab === "settings" && (
              <SettingsScreen
                initialPage={settingsPage}
                openNonce={settingsNonce}
                onExit={exitSettings}
              />
            )}
          </View>

          {!wide && (
            <View
              style={[
                styles.tabbar,
                { backgroundColor: palette.surface, borderTopColor: palette.hairline },
              ]}
            >
              {navItems}
            </View>
          )}
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
  wide,
  onPress,
}: {
  item: { key: Tab; label: string; icon: string };
  active: boolean;
  wide: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        wide && styles.tabRail,
        wide && active && { backgroundColor: palette.accentSoft },
      ]}
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
  shell: { flex: 1 },
  shellWide: { flexDirection: "row" },
  content: { flex: 1, minWidth: 0 },
  rail: {
    width: 80,
    alignItems: "center",
    paddingVertical: 26,
    gap: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
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
  tabRail: {
    flex: 0,
    width: 64,
    paddingVertical: 9,
    borderRadius: radius.button,
  },
  tabLabel: { fontSize: 9.5, fontWeight: "500" },
  fab: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBar: { marginTop: -14, marginHorizontal: space.sm },
  fabRail: { marginVertical: space.sm },
});
