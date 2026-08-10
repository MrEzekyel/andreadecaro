import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { firstError } from "../lib/loadError";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { useSubscription } from "../lib/useSubscription";

const GOAL = 5;

export default function ReferralScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const { profile } = useSubscription();

  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    const result = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed");
    const failure = firstError(result);
    setError(failure);
    if (!failure) setConfirmed(result.count ?? 0);
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const code = profile?.referral_code ?? null;
  const bonusGranted = (profile?.bonus_months_granted ?? 0) > 0;

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert("Copiato", "Codice invito copiato negli appunti.");
  }

  async function share() {
    if (!code) return;
    await Share.share({
      message: `Uso Apple Pay Tracker per tenere traccia delle spese in automatico. Registrati con il mio codice invito ${code}: hai 2 mesi gratis per provarlo.`,
    });
  }

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={backHitSlop}>
            <Icon name="chevron-left" size={20} color={palette.ink} />
            <Text style={[styles.title, { color: palette.ink }]}>Invita un amico</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.intro, { color: palette.ink2 }]}>
            Invita 5 amici e falli partire con l'automazione: quando ognuno
            registra il suo primo pagamento in automatico, il referral si
            conferma. Arrivato a 5, sblocchi 2 mesi extra di automazione
            gratis.
          </Text>

          <Text style={[styles.label, { color: palette.ink3 }]}>
            Il tuo codice
          </Text>

          {code ? (
            <TouchableOpacity
              onPress={copy}
              style={[
                styles.codeBox,
                { backgroundColor: palette.surface, borderColor: palette.hairline },
              ]}
            >
              <Text style={[styles.code, { color: palette.ink }]}>{code}</Text>
              <Text style={[styles.hint, { color: palette.ink3 }]}>
                Tocca per copiare
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.hint, { color: palette.ink3 }]}>
              Il codice arriva appena il tuo profilo è pronto.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={share}
            disabled={!code}
          >
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              Condividi il codice
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.progressCard,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Text style={[styles.progressLabel, { color: palette.ink2 }]}>
              Referral confermati
            </Text>
            <Text style={[styles.progressValue, { color: palette.ink }]}>
              {confirmed ?? "—"} / {GOAL}
            </Text>
            {bonusGranted && (
              <Text style={[styles.bonusNote, { color: palette.accent }]}>
                Bonus dei 2 mesi già ottenuto
              </Text>
            )}
          </View>

          {error && (
            <LoadError message={error} onRetry={loadReferrals} variant="inline" />
          )}

          <Text style={[styles.note, { color: palette.ink3 }]}>
            Un referral si conferma solo al primo pagamento registrato
            davvero dall'automazione del tuo amico — non basta scaricare
            l'app o registrarsi.
          </Text>
        </ScrollView>
      </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  intro: { ...type.body, lineHeight: 21, marginBottom: space.xs },
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
  label: { ...type.label },
  codeBox: {
    borderRadius: radius.field,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  code: { ...type.hero, fontSize: 24, letterSpacing: 3 },
  hint: { ...type.small, fontSize: 10.5, marginTop: 5 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  progressCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  progressLabel: { ...type.caption },
  progressValue: { ...type.hero, fontSize: 22 },
  bonusNote: { ...type.small, fontWeight: "500", marginTop: 2 },
  note: { ...type.small, lineHeight: 17, marginTop: space.sm },
});
