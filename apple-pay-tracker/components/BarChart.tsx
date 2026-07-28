import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { Bucket } from "../lib/aggregate";
import { formatAmount } from "../lib/format";
import { space, type } from "../lib/theme";

const WIDTH = 300;
const HEIGHT = 110;
const GAP = 4;
/** Estremita' arrotondate come le altre superfici del sistema. */
const RADIUS = 3;

type Props = {
  buckets: Bucket[];
  /** 'amount' disegna la spesa, 'count' il numero di transazioni. */
  metric: "amount" | "count";
  color: string;
};

export function BarChart({ buckets, metric, color }: Props) {
  const { palette } = useTheme();

  const values = buckets.map((b) => (metric === "amount" ? b.total : b.count));
  const max = Math.max(...values, metric === "amount" ? 0.01 : 1);

  const barWidth = Math.max(
    (WIDTH - GAP * (buckets.length - 1)) / Math.max(buckets.length, 1),
    2
  );

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {buckets.map((bucket, index) => {
          const value = values[index];
          const height = (value / max) * (HEIGHT - 4);
          const x = index * (barWidth + GAP);

          // Un periodo a zero resta visibile come traccia: distinguere
          // "niente speso" da "periodo assente" e' il punto del grafico.
          const drawn = Math.max(height, 2);

          return (
            <Rect
              key={bucket.key}
              x={x}
              y={HEIGHT - drawn}
              width={barWidth}
              height={drawn}
              rx={RADIUS}
              fill={value > 0 ? color : palette.hairline}
            />
          );
        })}
      </Svg>

      <View style={styles.axis}>
        {buckets.map((bucket, index) => (
          <Text
            key={bucket.key}
            style={[
              styles.axisLabel,
              {
                color: palette.ink3,
                // Con molte colonne le etichette si sovrappongono: ne mostro
                // una ogni due, tenendo sempre l'ultima.
                opacity:
                  buckets.length > 8 &&
                  index % 2 !== 0 &&
                  index !== buckets.length - 1
                    ? 0
                    : 1,
              },
            ]}
            numberOfLines={1}
          >
            {bucket.label}
          </Text>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footText, { color: palette.ink3 }]}>
          massimo{" "}
          {metric === "amount"
            ? formatAmount(max)
            : `${Math.round(max)} ${max === 1 ? "spesa" : "spese"}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  axisLabel: { ...type.small, fontSize: 9.5, flex: 1, textAlign: "center" },
  footer: { marginTop: space.sm },
  footText: { ...type.small, fontSize: 10.5 },
});
