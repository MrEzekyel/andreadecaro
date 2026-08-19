import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { Coherence, CoherenceFix } from "../lib/savings";
import { radius, space, type } from "../lib/theme";
import { Icon } from "./Icon";

type Props = {
  items: Coherence[];
  /** Applica una correzione gia' calcolata. */
  onApply: (fix: CoherenceFix) => void;
  /** Disabilita i tasti mentre il salvataggio e' in volo. */
  busy?: boolean;
};

/**
 * I conflitti fra limiti e obiettivo, con la correzione gia' calcolata.
 *
 * Il valore non e' l'avviso ma **il numero accanto**: "limite e obiettivo non
 * tornano" lascia all'utente il compito di rifare i conti, e il conto e'
 * proprio la parte che nessuno fa. Con "Limite a 1.000 €" la correzione e' un
 * tocco, quindi la coerenza si ripristina invece di restare un cartello
 * rosso che si impara a ignorare.
 *
 * Le combinazioni incoerenti restano **salvabili**: bloccarle costringerebbe
 * a rifare i conti prima di poter salvare, e un limite in conflitto e'
 * comunque piu' utile di nessun limite.
 */
export function CoherenceNotice({ items, onApply, busy }: Props) {
  const { palette } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const conflict = item.severity === "conflict";
        // Ambra e non rosso: e' un'impostazione che non torna, non un budget
        // sforato. Il rosso qui competerebbe con "limite superato", che e'
        // una cosa che sta succedendo davvero ai soldi.
        const tone = conflict ? palette.warn : palette.ink3;

        return (
          <View
            key={item.key}
            style={[
              styles.item,
              {
                backgroundColor: conflict
                  ? `${palette.warn}1f`
                  : palette.surface,
                borderColor: conflict ? "transparent" : palette.hairline,
                borderWidth: conflict ? 0 : 1,
              },
            ]}
          >
            <View style={styles.head}>
              <Icon
                name={conflict ? "triangle-alert" : "info"}
                size={15}
                color={tone}
              />
              <Text style={[styles.title, { color: palette.ink }]}>
                {item.title}
              </Text>
            </View>

            <Text style={[styles.body, { color: palette.ink2 }]}>
              {item.body}
            </Text>

            {item.fixes.length > 0 && (
              <View style={styles.fixes}>
                {item.fixes.map((fix) => (
                  <TouchableOpacity
                    key={`${item.key}:${fix.label}`}
                    style={[styles.fix, { borderColor: palette.hairline }]}
                    onPress={() => onApply(fix)}
                    disabled={busy}
                  >
                    <Text style={[styles.fixText, { color: palette.accent }]}>
                      {fix.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  item: { borderRadius: radius.card, padding: space.md, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { ...type.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  body: { ...type.small, lineHeight: 17 },
  fixes: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  fix: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  fixText: { ...type.small, fontWeight: "500" },
});
