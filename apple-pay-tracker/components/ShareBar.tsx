import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, type } from "../lib/theme";

const WIDTH = 300;
const HEIGHT = 26;
const GAP = 1.5;

export type Slice = {
  id: string;
  label: string;
  value: number;
};

type Props = {
  slices: Slice[];
  /** L'elemento da mettere in evidenza; gli altri restano in grigio. */
  highlightId: string;
  highlightColor: string;
};

/**
 * Barra che mostra il peso di un elemento dentro un insieme.
 *
 * Tutti gli altri elementi sono in scala di grigi: colorarli tutti creerebbe
 * una gara di attenzione, mentre qui l'unica domanda e' "quanto pesa questo".
 */
export function ShareBar({ slices, highlightId, highlightColor }: Props) {
  const { palette, dark } = useTheme();

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <Text style={[styles.empty, { color: palette.ink3 }]}>
        Nessuna spesa da confrontare in questo periodo.
      </Text>
    );
  }

  const highlighted = slices.find((s) => s.id === highlightId);
  const share = highlighted ? (highlighted.value / total) * 100 : 0;

  // Scala di grigi che alterna leggermente, cosi' le fette adiacenti restano
  // distinguibili senza rubare attenzione a quella evidenziata.
  const greys = dark
    ? ["#3a3a36", "#4a4a45", "#2f2f2c", "#565650"]
    : ["#d6d4cc", "#c4c2b9", "#e0ded6", "#b3b1a8"];

  let cursor = 0;

  return (
    <View>
      <View style={styles.headline}>
        <Text style={[styles.share, { color: highlightColor }]}>
          {share >= 1 ? Math.round(share) : share.toFixed(1)}%
        </Text>
        <Text style={[styles.headlineLabel, { color: palette.ink2 }]}>
          di {formatAmount(total)} nella categoria
        </Text>
      </View>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {slices.map((slice, index) => {
          const width = (slice.value / total) * WIDTH;
          const x = cursor;
          cursor += width;

          const isHighlight = slice.id === highlightId;
          const drawn = Math.max(width - GAP, 0.5);

          return (
            <Rect
              key={slice.id}
              x={x}
              y={0}
              width={drawn}
              height={HEIGHT}
              rx={3}
              fill={isHighlight ? highlightColor : greys[index % greys.length]}
            />
          );
        })}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View
            style={[styles.dot, { backgroundColor: highlightColor }]}
          />
          <Text style={[styles.legendName, { color: palette.ink }]} numberOfLines={1}>
            {highlighted?.label ?? "—"}
          </Text>
          <Text style={[styles.legendValue, { color: palette.ink }]}>
            {formatAmount(highlighted?.value ?? 0)}
          </Text>
        </View>

        <Text style={[styles.legendNote, { color: palette.ink3 }]}>
          {slices.length - 1} altri esercenti in questa categoria
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginBottom: space.md,
  },
  share: { ...type.hero, fontSize: 28, fontVariant: ["tabular-nums"] },
  headlineLabel: { ...type.caption, flex: 1 },
  legend: { marginTop: space.md, gap: 5 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 2 },
  legendName: { ...type.caption, flex: 1 },
  legendValue: {
    ...type.caption,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  legendNote: { ...type.small, fontSize: 10.5, marginLeft: 17 },
  empty: { ...type.caption, lineHeight: 19 },
});
