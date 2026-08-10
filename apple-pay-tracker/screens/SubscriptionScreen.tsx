import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { useSubscription } from "../lib/useSubscription";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SubscriptionScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const { profile, loading, error, automationActive, trialDaysLeft, reload } =
    useSubscription();

  const status = profile?.subscription_status ?? null;

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={backHitSlop}>
            <Icon name="chevron-left" size={20} color={palette.ink} />
            <Text style={[styles.title, { color: palette.ink }]}>Abbonamento</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {error && !profile ? (
            <LoadError message={error} onRetry={reload} />
          ) : (
            <>
              <View
                style={[
                  styles.statusCard,
                  { backgroundColor: palette.surface, borderColor: palette.hairline },
                ]}
              >
                {loading && !profile ? (
                  <Text style={[styles.statusHeadline, { color: palette.ink2 }]}>
                    Sto leggendo il tuo stato…
                  </Text>
                ) : status === "active" ? (
                  <>
                    <Text style={[styles.statusHeadline, { color: palette.ink }]}>
                      Abbonamento attivo
                    </Text>
                    <Text style={[styles.statusDetail, { color: palette.ink2 }]}>
                      {profile?.subscription_plan === "annual" ? "Piano annuale" : "Piano mensile"}
                      {profile?.current_period_end
                        ? ` · si rinnova il ${formatDate(profile.current_period_end)}`
                        : ""}
                    </Text>
                  </>
                ) : automationActive ? (
                  <>
                    <Text style={[styles.statusHeadline, { color: palette.ink }]}>
                      Automazione gratis
                    </Text>
                    <Text style={[styles.statusDetail, { color: palette.ink2 }]}>
                      {trialDaysLeft !== null && trialDaysLeft > 0
                        ? `Ancora ${trialDaysLeft} giorn${trialDaysLeft === 1 ? "o" : "i"} di prova.`
                        : "Ultimo giorno di prova."}
                      {profile?.trial_ends_at
                        ? ` Finisce il ${formatDate(profile.trial_ends_at)}.`
                        : ""}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.statusHeadline, { color: palette.over }]}>
                      Prova scaduta
                    </Text>
                    <Text style={[styles.statusDetail, { color: palette.ink2 }]}>
                      L'automazione si è fermata: Wallet, Siri e la Shortcut
                      non registrano più spese da sole. Storico, statistiche,
                      spese manuali ed export restano come sempre.
                    </Text>
                  </>
                )}
              </View>

              <Text style={[styles.label, { color: palette.ink3 }]}>Piani</Text>

              <View style={styles.plans}>
                <View
                  style={[
                    styles.planCard,
                    { backgroundColor: palette.surface, borderColor: palette.hairline },
                  ]}
                >
                  <Text style={[styles.planName, { color: palette.ink }]}>Mensile</Text>
                  <Text style={[styles.planPrice, { color: palette.ink }]}>1,99 €</Text>
                  <Text style={[styles.planUnit, { color: palette.ink3 }]}>al mese</Text>
                </View>
                <View
                  style={[
                    styles.planCard,
                    { backgroundColor: palette.surface, borderColor: palette.hairline },
                  ]}
                >
                  <Text style={[styles.planName, { color: palette.ink }]}>Annuale</Text>
                  <Text style={[styles.planPrice, { color: palette.ink }]}>15 €</Text>
                  <Text style={[styles.planUnit, { color: palette.ink3 }]}>all'anno</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: palette.surface2 }]}
                disabled
              >
                <Text style={[styles.buttonText, { color: palette.ink3 }]}>
                  Abbonati — disponibile a breve
                </Text>
              </TouchableOpacity>

              <Text style={[styles.note, { color: palette.ink3 }]}>
                L'acquisto in-app tramite Apple arriverà con un prossimo
                aggiornamento. Solo l'automazione richiede l'abbonamento:
                storico, statistiche, spese manuali ed export restano
                disponibili comunque.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 18,
  },
  title: { ...type.title },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  statusCard: { borderRadius: radius.card, borderWidth: 1, padding: 14, gap: 6 },
  statusHeadline: { ...type.bodyMedium, fontSize: 16 },
  statusDetail: { ...type.caption, lineHeight: 18 },
  label: { ...type.label },
  plans: { flexDirection: "row", gap: space.sm },
  planCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 14,
    gap: 2,
  },
  planName: { ...type.caption },
  planPrice: { ...type.hero, fontSize: 22, marginTop: 2 },
  planUnit: { ...type.small },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  note: { ...type.small, lineHeight: 17, marginTop: space.sm },
});
