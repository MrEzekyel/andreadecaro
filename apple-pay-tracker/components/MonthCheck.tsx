import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";

/** Spegne il controllo per sempre, su questo dispositivo. */
const OPT_OUT = "controllo-mensile-disattivato";

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

  const load = useCallback(async () => {
    if (await AsyncStorage.getItem(OPT_OUT)) return;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

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
    setHidden(true);
    await supabase
      .from("month_checks")
      .insert({ month: iso, confirmed_total: total });
  }

  async function nonChiedere() {
    setHidden(true);
    await AsyncStorage.setItem(OPT_OUT, "1");
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
          accessibilityRole="button"
        >
          <Text style={[styles.primaryText, { color: palette.onAccent }]}>
            Torna
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondary, { borderColor: palette.hairline }]}
          onPress={() => {
            setHidden(true);
            onReview(month);
          }}
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
