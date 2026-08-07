import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";

/**
 * Chiavi locali, sempre legate all'utente.
 *
 * Senza il suffisso, cambiando account sullo stesso telefono il nuovo utente
 * erediterebbe le scelte del precedente: la domanda spenta da uno non
 * arriverebbe mai all'altro.
 */
const optOutKey = (userId: string) => `controllo-mensile-off:${userId}`;
const rivistoKey = (userId: string, iso: string) =>
  `controllo-mensile-rivisto:${userId}:${iso}`;

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/**
 * La domanda che trasforma una perdita invisibile in una visibile.
 *
 * L'ingestione da Shortcut non ritenta mai: se il telefono era offline alla
 * cassa, la spesa non arriva e nessuno se ne accorge — il totale del mese
 * resta sbagliato in difetto e sembra corretto. Non esiste una sorgente di
 * verita' contro cui riconciliare in automatico, perche' l'app non parla con
 * la banca: l'unica cosa onesta e' chiederlo, una volta, a chi l'estratto
 * conto ce l'ha.
 *
 * Deve pero' restare **un aiuto e non un lavoro**: compare solo a mese chiuso,
 * si risponde con un tocco, e si spegne per sempre da qui senza passare dalle
 * impostazioni.
 */
export function MonthCheck({ onReview }: { onReview: (month: Date) => void }) {
  const { palette } = useTheme();

  const [month, setMonth] = useState<Date | null>(null);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [hidden, setHidden] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    if (await AsyncStorage.getItem(optOutKey(userId))) return;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

    // Chiave locale del "l'ho gia' guardato": HomeScreen viene smontata a ogni
    // cambio di scheda, quindi uno stato in memoria farebbe ricomparire la
    // domanda a ogni ritorno in Home. Un promemoria che non si chiude e' il
    // contrario di quello che questa scheda deve essere.
    if (await AsyncStorage.getItem(rivistoKey(userId, iso))) return;

    const [già, spese] = await Promise.all([
      supabase.from("month_checks").select("id").eq("month", iso).maybeSingle(),
      supabase
        .from("payments")
        .select("effective_amount")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
    ]);

    // Errore di lettura: non si chiede niente. Domandare "il totale corrisponde?"
    // mostrando un totale che non abbiamo letto sarebbe la stessa bugia che
    // questo controllo esiste per scoprire.
    if (già.error || spese.error || già.data) return;

    const righe = spese.data ?? [];
    // Un mese senza nessuna spesa non ha niente da riconciliare, e chiederlo
    // sembrerebbe un rimprovero per non aver usato l'app.
    if (righe.length === 0) return;

    setMonth(start);
    setCount(righe.length);
    setTotal(righe.reduce((sum, r) => sum + Number(r.effective_amount), 0));
    setHidden(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function conferma() {
    if (!month) return;
    const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    // `user_id` e' `not null` e senza default: come ogni altro insert dell'app
    // va passato esplicitamente, altrimenti la riga viene rifiutata.
    const { error } = await supabase.from("month_checks").insert({
      user_id: auth.user?.id,
      month: iso,
      confirmed_total: total,
    });
    setSaving(false);

    // La scheda si chiude solo se la risposta e' stata registrata davvero.
    // Chiuderla comunque lascerebbe l'utente convinto di aver risposto mentre
    // la domanda tornera' per sempre — la stessa perdita silenziosa che questo
    // controllo esiste per scoprire, spostata di un livello.
    if (error) {
      Alert.alert(
        "Risposta non salvata",
        "Non è stato possibile registrare il controllo. Riprova fra poco."
      );
      return;
    }
    setHidden(true);
  }

  async function rivedi() {
    if (!month) return;
    const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await AsyncStorage.setItem(rivistoKey(auth.user.id, iso), "1");
    setHidden(true);
    onReview(month);
  }

  async function nonChiedere() {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await AsyncStorage.setItem(optOutKey(auth.user.id), "1");
    setHidden(true);
  }

  if (hidden || !month) return null;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface2 }]}>
      <View style={styles.head}>
        <Icon name="circle-check" size={16} color={palette.ink2} />
        <Text style={[styles.title, { color: palette.ink }]}>
          Controllo di {MESI[month.getMonth()]}
        </Text>
      </View>

      <Text style={[styles.body, { color: palette.ink2 }]}>
        A {MESI[month.getMonth()]} risultano {count}{" "}
        {count === 1 ? "spesa" : "spese"} per {formatAmount(total)}. Corrisponde
        all'estratto conto?
      </Text>

      <Text style={[styles.why, { color: palette.ink3 }]}>
        L'automazione non vede contanti, bonifici e addebiti diretti, e una
        spesa può sfuggire se il telefono era offline al momento del pagamento.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: palette.accent }]}
          onPress={conferma}
          disabled={saving}
          accessibilityRole="button"
        >
          {/* Non "Torna": in un riquadro che si puo' congedare si leggerebbe
              come "chiudi", mentre questo tocco registra un'affermazione sui
              soldi che verra' usata come riferimento. */}
          <Text style={[styles.primaryText, { color: palette.onAccent }]}>
            {saving ? "Salvo…" : "Sì, corrisponde"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondary, { borderColor: palette.hairline }]}
          onPress={rivedi}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryText, { color: palette.ink2 }]}>
            Manca qualcosa
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={nonChiedere} style={styles.optOut}>
        <Text style={[styles.optOutText, { color: palette.ink3 }]}>
          Non chiedermelo più
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { ...type.bodyMedium },
  body: { ...type.caption, lineHeight: 19 },
  why: { ...type.small, lineHeight: 15 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  primary: {
    borderRadius: radius.button,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryText: { ...type.caption, fontWeight: "500" },
  secondary: {
    borderRadius: radius.button,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryText: { ...type.caption, fontWeight: "500" },
  optOut: { alignSelf: "flex-start", paddingTop: 2 },
  optOutText: { ...type.small, textDecorationLine: "underline" },
});
