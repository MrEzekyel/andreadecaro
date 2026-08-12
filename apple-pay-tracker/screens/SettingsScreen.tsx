import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { ScreenBoundary } from "../components/ScreenBoundary";
import {
  biometricName,
  biometricsAvailable,
  useAppLock,
} from "../lib/AppLockContext";
import { useChangelog } from "../lib/changelog";
import { useData } from "../lib/DataContext";
import { SettingsPage } from "../lib/NavContext";
import { ThemePreference, useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { useLimits } from "../lib/useLimits";
import { useSubscription } from "../lib/useSubscription";
import AutomationsScreen from "./AutomationsScreen";
import CategoriesScreen from "./CategoriesScreen";
import ChangelogScreen from "./ChangelogScreen";
import ExportScreen from "./ExportScreen";
import GuideScreen from "./GuideScreen";
import LimitsScreen from "./LimitsScreen";
import OwedScreen from "./OwedScreen";
import RecurringScreen from "./RecurringScreen";
import ReferralScreen from "./ReferralScreen";
import SubscriptionScreen from "./SubscriptionScreen";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "light", label: "Chiaro", icon: "sun" },
  { value: "dark", label: "Scuro", icon: "moon" },
  { value: "system", label: "Sistema", icon: "smartphone" },
];

type Props = {
  /** Sottopagina su cui aprirsi, quando ci si arriva da un'altra scheda. */
  initialPage?: SettingsPage;
  /** Cambia a ogni richiesta di apertura, anche verso la stessa pagina. */
  openNonce?: number;
};

export default function SettingsScreen({ initialPage = "root", openNonce }: Props) {
  const { palette, preference, setPreference } = useTheme();
  const { categories, people } = useData();
  const { statuses } = useLimits();
  const { profile, automationActive, trialDaysLeft } = useSubscription();
  const lock = useAppLock();
  const { unread } = useChangelog();

  // Come si chiama il riconoscimento su questo telefono: chiamarlo "Face ID"
  // su un iPhone con Touch ID sarebbe sbagliato, e su uno senza biometria
  // prometterebbe una cosa che non arrivera' mai.
  const [biometria, setBiometria] = useState<"Face ID" | "Touch ID" | null>(null);
  useEffect(() => {
    biometricName().then(setBiometria);
  }, []);

  async function toggleLock(next: boolean) {
    if (!next) {
      await lock.disable();
      return;
    }

    if (!(await biometricsAvailable())) {
      Alert.alert(
        "Riconoscimento non disponibile",
        "Attiva Face ID o Touch ID nelle impostazioni di iOS, poi torna qui."
      );
      return;
    }

    // Se la prova non riesce non si attiva niente: un blocco acceso su un
    // telefono che non riconosce il volto chiuderebbe fuori dai propri dati
    // al prossimo avvio.
    if (!(await lock.enable())) {
      Alert.alert(
        "Blocco non attivato",
        "Il riconoscimento non è andato a buon fine. Riprova."
      );
    }
  }

  const subscriptionValue =
    profile?.subscription_status === "active"
      ? "attivo"
      : automationActive === false
        ? "scaduto"
        : trialDaysLeft !== null
          ? `${trialDaysLeft}g di prova`
          : "…";

  const [page, setPage] = useState<SettingsPage>(initialPage);

  // Il nonce distingue "sono arrivato qui da un'altra scheda" da "sto
  // navigando dentro Impostazioni": senza, tornare indietro dalla pagina dei
  // limiti la riaprirebbe subito.
  useEffect(() => {
    if (openNonce === undefined) return;
    setPage(initialPage);
  }, [openNonce, initialPage]);

  if (page !== "root") {
    const back = () => setPage("root");

    // Ogni sottopagina passa dal boundary: se una cade, si vede il motivo e
    // si torna indietro, invece di restare davanti a una pagina vuota da cui
    // l'unica uscita e' chiudere l'app.
    const subpage = {
      categories: <CategoriesScreen onBack={back} />,
      limits: <LimitsScreen onBack={back} />,
      recurring: <RecurringScreen onBack={back} />,
      people: <OwedScreen onBack={back} />,
      automations: (
        <AutomationsScreen onBack={back} onOpenGuide={() => setPage("guide")} />
      ),
      export: <ExportScreen onBack={back} />,
      subscription: <SubscriptionScreen onBack={back} />,
      referral: <ReferralScreen onBack={back} />,
      changelog: <ChangelogScreen onBack={back} />,
      guide: <GuideScreen onBack={() => setPage("automations")} />,
    }[page];

    return (
      <ScreenBoundary key={page} name={page} onBack={back}>
        {subpage}
      </ScreenBoundary>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.ground }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: palette.ink }]}>Impostazioni</Text>

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>Aspetto</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {THEME_OPTIONS.map((option) => {
            const active = preference === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={[
                  styles.segmentOption,
                  active && { backgroundColor: palette.surface },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Icon
                  name={option.icon}
                  size={14}
                  color={active ? palette.ink : palette.ink3}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? palette.ink : palette.ink3 },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <View style={styles.settingRow}>
          <Icon name="lock" size={17} color={palette.ink2} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lockName, { color: palette.ink }]}>
              {biometria ? `Blocco con ${biometria}` : "Blocco all'apertura"}
            </Text>
            <Text style={[styles.settingHint, { color: palette.ink3 }]}>
              {biometria
                ? `Chiede ${biometria} all'apertura e dopo mezzo minuto fuori dall'app. Se iOS chiede il codice invece del riconoscimento, controlla che Expo Go sia abilitato in Impostazioni › ${biometria} e codice › Altre app.`
                : "Chiede il codice del telefono all'apertura e dopo mezzo minuto fuori dall'app"}
            </Text>
          </View>
          <Switch
            value={lock.enabled === true}
            onValueChange={toggleLock}
            trackColor={{ true: palette.accent }}
          />
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <SettingRow
          icon="palette"
          label="Categorie"
          value={String(categories.length)}
          onPress={() => setPage("categories")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="gauge"
          label="Limiti di spesa"
          value={
            statuses.length === 0
              ? "nessuno"
              : `${statuses.length} attiv${statuses.length === 1 ? "o" : "i"}`
          }
          onPress={() => setPage("limits")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="repeat"
          label="Spese ricorrenti"
          value="Gestisci"
          onPress={() => setPage("recurring")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="users"
          label="Mi devono"
          value={
            people.length === 0
              ? "nessuno"
              : `${people.length} ${people.length === 1 ? "persona" : "persone"}`
          }
          onPress={() => setPage("people")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="zap"
          label="Automazioni"
          value="Gestisci"
          onPress={() => setPage("automations")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="crown"
          label="Abbonamento"
          value={subscriptionValue}
          onPress={() => setPage("subscription")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="gift"
          label="Invita un amico"
          value="Gestisci"
          onPress={() => setPage("referral")}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <SettingRow
          icon="file-down"
          label="Esporta i dati"
          value="CSV"
          onPress={() => setPage("export")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="sparkles"
          label="Novità"
          value={unread ? "" : "Cosa è cambiato"}
          badge={unread}
          onPress={() => setPage("changelog")}
        />
      </View>

      <TouchableOpacity
        style={styles.logout}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={[styles.logoutText, { color: palette.over }]}>Esci</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  muted,
  badge,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  muted?: boolean;
  /** Pallino d'accento: c'e' qualcosa di nuovo dietro questa riga. */
  badge?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Icon name={icon} size={17} color={muted ? palette.ink3 : palette.ink2} />
      <Text
        style={[styles.settingName, { color: muted ? palette.ink3 : palette.ink }]}
      >
        {label}
      </Text>
      {badge && <View style={[styles.badge, { backgroundColor: palette.accent }]} />}
      <Text style={[styles.settingValue, { color: palette.ink3 }]}>{value}</Text>
      {onPress && <Icon name="chevron-right" size={14} color={palette.ink3} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  title: { ...type.title },
  label: { ...type.label, marginBottom: space.sm },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 13,
  },
  settingName: { ...type.body, flex: 1 },
  lockName: { ...type.body },
  badge: { width: 7, height: 7, borderRadius: 3.5 },
  settingHint: { ...type.small, lineHeight: 15, marginTop: 2 },
  settingValue: { ...type.caption },
  logout: { alignItems: "center", paddingVertical: space.md },
  logoutText: { ...type.body },
});
