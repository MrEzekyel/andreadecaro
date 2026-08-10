import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { ActionBlock } from "../lib/guide";
import { radius, space, type } from "../lib/theme";

/**
 * Riproduzione schematica di un'azione dei Comandi Rapidi.
 *
 * Non e' uno screenshot ed e' una scelta: un'immagine di iOS invecchia al
 * primo aggiornamento che sposta un campo, e chi la guarda non capisce piu'
 * se sta sbagliando lui o se e' la guida a essere vecchia. Qui contano il
 * **nome esatto** dell'azione da cercare e i campi da riempire, che sono la
 * parte che non cambia.
 *
 * I valori evidenziati sono quelli da prendere dal selettore variabili e non
 * da digitare: e' l'errore piu' comune, e scriverlo a parole non basta.
 */
export function ActionPreview({ block }: { block: ActionBlock }) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.hairline },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.glyph, { backgroundColor: palette.accentSoft }]}>
          <Icon name="square-function" size={13} color={palette.accent} />
        </View>
        <Text style={[styles.action, { color: palette.ink }]}>
          {block.action}
        </Text>
      </View>

      {block.fields && block.fields.length > 0 && (
        <View style={styles.fields}>
          {block.fields.map((field) => (
            <View key={field.label} style={styles.field}>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                {field.label}
              </Text>
              <Text
                style={[
                  styles.value,
                  field.variable
                    ? {
                        color: palette.accent,
                        backgroundColor: palette.accentSoft,
                      }
                    : { color: palette.ink2 },
                ]}
              >
                {field.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {block.nested && block.nested.length > 0 && (
        <View style={[styles.nested, { borderLeftColor: palette.hairline }]}>
          {block.nested.map((child) => (
            <ActionPreview key={child.action} block={child} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12,
    gap: 9,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  action: { ...type.bodyMedium, fontSize: 13.5, flex: 1 },
  fields: { gap: 7 },
  field: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  label: { ...type.small, width: 96 },
  value: {
    ...type.small,
    flex: 1,
    lineHeight: 17,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  nested: {
    borderLeftWidth: 2,
    paddingLeft: space.sm,
    gap: space.sm,
    marginTop: 2,
  },
});
