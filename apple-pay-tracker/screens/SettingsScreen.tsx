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
import { useDetailMeasure } from "../lib/layout";
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
import FriendsScreen from "./FriendsScreen";
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
  /** Risale oltre la pagina d'ingresso: torna alla scheda da cui si e'
   *  aperto Impostazioni (vedi `App.tsx` → `settingsOrigin`). */
  onExit?: () => void;
};

export default function SettingsScreen({
  initialPage = "root",
  openNonce,
  onExit,
}: Props) {
  const { palette, preference, setPreference } = useTheme();
  const measure = useDetailMeasure();
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

  // Pila delle sotto-pagine visitate dentro questa apertura di Impostazioni,
  // radicata su `initialPage`. Non solo l'ultima pagina: se non si tenesse
  // la strada fatta, "Indietro" da una pagina raggiunta navigando (es.
  // Automazioni → Guida) non saprebbe dire se il passo precedente era
  // un'altra sotto-pagina o la scheda da cui si e' aperto Impostazioni.
  const [stack, setStack] = useState<SettingsPage[]>([initialPage]);
  const page = stack[stack.length - 1];

  // Il nonce distingue "sono arrivato qui da un'altra scheda" da "sto
  // navigando dentro Impostazioni": senza, tornare indietro dalla pagina dei
  // limiti la riaprirebbe subito. Ogni nuova apertura riparte da una pila
  // fresca, anche se la pagina di destinazione e' la stessa di prima.
  useEffect(() => {
    if (openNonce === undefined) return;
    setStack([initialPage]);
  }, [openNonce, initialPage]);

  const push = (next: SettingsPage) =>
    setStack((current) => [...current, next]);

  // Un passo indietro dentro la pila (es. dalla Guida ad Automazioni). Sceso
  // fino alla pagina d'ingresso, "Indietro" non ha piu' un gradino di
  // Impostazioni sotto di se': se ci si e' arrivati direttamente da un'altra
  // scheda (`initialPage !== "root"`, un ingresso laterale come "Prossimi
  // addebiti" in Home) si esce verso quella scheda invece di cadere sulla
  // radice di Impostazioni, che in quel percorso non e' mai stata vista.
  const back = () => {
    if (stack.length > 1) {
      setStack((current) => current.slice(0, -1));
      return;
    }
    if (page !== "root") onExit?.();
  };

  if (page !== "root") {
    // Ogni sottopagina passa dal boundary: se una cade, si vede il motivo e
    // si torna indietro, invece di restare davanti a una pagina vuota da cui
    // l'unica uscita e' chiudere l'app.
    const subpage = {
      categories: <CategoriesScreen onBack={back} />,
      limits: <LimitsScreen onBack={back} />,
      recurring: <RecurringScreen onBack={back} />,
      people: <OwedScreen onBack={back} />,
      profile: <FriendsScreen onBack={back} />,
      automations: (
        <AutomationsScreen onBack={back} onOpenGuide={() => push("guide")} />
      ),
      export: <ExportScreen onBack={back} />,
      subscription: <SubscriptionScreen onBack={back} />,
      referral: <ReferralScreen onBack={back} />,
      changelog: <ChangelogScreen onBack={back} />,
      guide: <GuideScreen onBack={back} />,
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
      contentContainerStyle={[styles.content, measure]}
    >
      <Text style={[styles.title, { color: palette.ink }]}>Impostazioni</Text>

      {/* Da sola, in cima: e' l'unica riga che parla di te invece che di una
          funzione dell'app, e mescolata con le altre si perderebbe. */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.hairline },
        ]}
      >
        <SettingRow
          icon="circle-user-round"
          label="Profilo"
          value={profile?.display_name ?? profile?.handle ?? "…"}
          onPress={() => push("profile")}
        />
      </View>

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

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>Spese</Text>
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
            onPress={() => push("categories")}
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
            onPress={() => push("limits")}
          />
          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
          <SettingRow
            icon="repeat"
            label="Spese ricorrenti"
            value="Gestisci"
            onPress={() => push("recurring")}
          />
          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
          <SettingRow
            icon="users"
            label="Dividi spese"
            value={
              people.length === 0
                ? "nessuno"
                : `${people.length} ${people.length === 1 ? "persona" : "persone"}`
            }
            onPress={() => push("people")}
          />
        </View>
      </View>

      <View>
        <Text style={[styles.label, { color: palette.ink3 }]}>Account</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <SettingRow
            icon="crown"
            label="Abbonamento"
            value={subscriptionValue}
            onPress={() => push("subscription")}
          />
          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
          <SettingRow
            icon="gift"
            label="Invita un amico"
            value="Gestisci"
            onPress={() => push("referral")}
          />
          <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
          <SettingRow
            icon="zap"
            label="Automazioni"
            value="Gestisci"
            onPress={() => push("automations")}
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
          icon="file-down"
          label="Esporta i dati"
          value="CSV"
          onPress={() => push("export")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="sparkles"
          label="Novità"
          value={unread ? "" : "Cosa è cambiato"}
          badge={unread}
          onPress={() => push("changelog")}
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
