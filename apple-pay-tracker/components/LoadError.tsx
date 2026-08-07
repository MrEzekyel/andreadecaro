import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { describeLoadError } from "../lib/loadError";
import { radius, space, type } from "../lib/theme";

type Props = {
  /** Messaggio tecnico originale: viene tradotto e mostrato in piccolo sotto. */
  message: string;
  onRetry?: () => void;
  /** `inline` per il posto di un blocco dentro una schermata che continua. */
  variant?: "screen" | "inline";
};

/**
 * Quello che si mostra al posto di un dato che non siamo riusciti a leggere.
 *
 * Va messo **al posto** del contenuto, mai accanto: un totale a zero con
 * accanto un avviso resta un totale a zero, e l'occhio legge prima il numero.
 */
export function LoadError({ message, onRetry, variant = "screen" }: Props) {
  const { palette } = useTheme();

  return (
    <View style={variant === "screen" ? styles.screen : styles.inline}>
      <Icon name="circle-alert" size={22} color={palette.ink3} />

      <Text style={[styles.headline, { color: palette.ink }]}>
        {describeLoadError(message)}
      </Text>

      <Text style={[styles.detail, { color: palette.ink3 }]} numberOfLines={3}>
        {message}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={[styles.retry, { borderColor: palette.hairline }]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Icon name="rotate-cw" size={14} color={palette.accent} />
          <Text style={[styles.retryText, { color: palette.accent }]}>
            Riprova
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  inline: {
    alignItems: "center",
    paddingVertical: space.xl,
    gap: space.sm,
  },
  headline: { ...type.body, textAlign: "center", lineHeight: 21 },
  detail: { ...type.small, textAlign: "center", lineHeight: 15 },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginTop: space.xs,
  },
  retryText: { ...type.caption, fontWeight: "500" },
});
