import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../components/Icon";
import { useData } from "../lib/DataContext";
import { SettingsPage } from "../lib/NavContext";
import { ThemePreference, useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { useLimits } from "../lib/useLimits";
import { useSubscription } from "../lib/useSubscription";
import AutomationsScreen from "./AutomationsScreen";
import CategoriesScreen from "./CategoriesScreen";
import ExportScreen from "./ExportScreen";
import IncomeScreen from "./IncomeScreen";
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

  if (page === "categories") {
    return <CategoriesScreen onBack={() => setPage("root")} />;
  }

  if (page === "limits") {
    return <LimitsScreen onBack={() => setPage("root")} />;
  }

  if (page === "recurring") {
    return <RecurringScreen onBack={() => setPage("root")} />;
  }

  if (page === "people") {
    return <OwedScreen onBack={() => setPage("root")} />;
  }

  if (page === "automations") {
    return <AutomationsScreen onBack={() => setPage("root")} />;
  }

  if (page === "income") {
    return <IncomeScreen onBack={() => setPage("root")} />;
  }

  if (page === "export") {
    return <ExportScreen onBack={() => setPage("root")} />;
  }

  if (page === "subscription") {
    return <SubscriptionScreen onBack={() => setPage("root")} />;
  }

  if (page === "referral") {
    return <ReferralScreen onBack={() => setPage("root")} />;
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
          icon="wallet"
          label="Introiti"
          value="Gestisci"
          onPress={() => setPage("income")}
        />
        <View style={[styles.divider, { backgroundColor: palette.hairline }]} />
        <SettingRow
          icon="file-down"
          label="Esporta i dati"
          value="CSV"
          onPress={() => setPage("export")}
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
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  muted?: boolean;
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
  settingValue: { ...type.caption },
  logout: { alignItems: "center", paddingVertical: space.md },
  logoutText: { ...type.body },
});
