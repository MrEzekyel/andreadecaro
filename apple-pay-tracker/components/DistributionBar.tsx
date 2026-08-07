import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { space, type } from "../lib/theme";

const WIDTH = 300;
const HEIGHT = 26;
const GAP = 1.5;

export type DistributionSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: DistributionSlice[];
  onSelect?: (slice: DistributionSlice) => void;
  empty?: string;
};

/**
 * Ripartizione di un insieme: una barra sola, ogni fetta con il suo colore e
 * la sua percentuale.
 *
 * Fratello di `ShareBar`, non una sua variante: quella risponde a "quanto pesa
 * QUESTO" e tiene apposta tutto il resto in grigio, qui invece contano tutte
 * le fette allo stesso modo. Sono due domande diverse e mescolarle avrebbe
 * significato un componente con un parametro che ne ribalta il senso.
 *
 * Su pochi elementi una barra batte un anello: le fette si confrontano lungo
 * una retta invece che per angoli, e le etichette stanno in colonna leggibili
 * invece di rincorrere gli spicchi.
 */
export function DistributionBar({
  slices,
  onSelect,
  empty = "Niente da ripartire.",
}: Props) {
  const { palette } = useTheme();

  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const ordered = [...visible].sort((a, b) => b.value - a.value);
  let cursor = 0;

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {ordered.map((slice) => {
          const width = (slice.value / total) * WIDTH;
          const x = cursor;
          cursor += width;
          // Una fetta sottilissima sparirebbe del tutto sotto il distacco.
          const drawn = Math.max(width - GAP, 1);

          return (
            <Rect
              key={slice.id}
              x={x}
              y={0}
              width={drawn}
              height={HEIGHT}
              rx={3}
              fill={slice.color}
            />
          );
        })}
      </Svg>

      <View style={styles.legend}>
        {ordered.map((slice) => {
          const share = (slice.value / total) * 100;
          return (
            <TouchableOpacity
              key={slice.id}
              style={styles.row}
              disabled={!onSelect}
              onPress={() => onSelect?.(slice)}
            >
              <View style={[styles.dot, { backgroundColor: slice.color }]} />
              <Text
                style={[styles.name, { color: palette.ink }]}
                numberOfLines={1}
              >
                {slice.label}
              </Text>
              <Text style={[styles.value, { color: palette.ink3 }]}>
                {formatAmount(slice.value)}
              </Text>
              <Text style={[styles.share, { color: palette.ink }]}>
                {share >= 10 ? share.toFixed(1) : share.toFixed(2)}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 9,
  },
  dot: { width: 9, height: 9, borderRadius: 2 },
  name: { ...type.body, flex: 1 },
  value: { ...type.caption, fontVariant: ["tabular-nums"] },
  share: {
    ...type.amount,
    width: 62,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  empty: { ...type.caption, lineHeight: 19 },
});
