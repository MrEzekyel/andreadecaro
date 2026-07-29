import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, tint, type } from "../lib/theme";
import { Icon } from "./Icon";

const SIZE = 128;
const R_OUTER = 62;
const R_INNER = 38;

export type DonutSlice = {
  id: string | null;
  label: string;
  value: number;
  color: string;
  icon: string;
};

type Props = {
  slices: DonutSlice[];
  onSelect?: (slice: DonutSlice) => void;
  /** Testo sotto il totale al centro. */
  centerLabel?: string;
};

/** Spicchio di corona circolare, con lo zero a ore 12 e verso orario. */
function arcPath(cx: number, cy: number, start: number, end: number): string {
  const point = (r: number, angle: number) => [
    cx + r * Math.sin(angle),
    cy - r * Math.cos(angle),
  ];

  const [x1, y1] = point(R_OUTER, start);
  const [x2, y2] = point(R_OUTER, end);
  const [x3, y3] = point(R_INNER, end);
  const [x4, y4] = point(R_INNER, start);
  const large = end - start > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/**
 * Ripartizione con l'anello a sinistra e le categorie a destra.
 *
 * L'anello resta un riferimento visivo puro — quanto e' grande ogni fetta
 * rispetto alle altre — mentre l'elenco a destra e' dove si legge il
 * dettaglio: icona di categoria al posto del colore, importo, percentuale
 * piccola accanto. Colore e forma bastano a distinguere le fette nell'anello;
 * ripeterli identici nell'elenco non aggiungerebbe informazione.
 */
export function CategoryDonut({ slices, onSelect, centerLabel }: Props) {
  const { palette, dark } = useTheme();

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return (
      <Text style={[styles.empty, { color: palette.ink3 }]}>
        Nessuna spesa da ripartire in questo periodo.
      </Text>
    );
  }

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const share = slice.value / total;
    const start = cursor * Math.PI * 2;
    cursor += share;
    const end = cursor * Math.PI * 2;
    return { slice, share, start, end };
  });

  const single = arcs.length === 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <G>
            {single ? (
              <Circle
                cx={cx}
                cy={cy}
                r={(R_OUTER + R_INNER) / 2}
                fill="none"
                stroke={arcs[0].slice.color}
                strokeWidth={R_OUTER - R_INNER}
                onPress={() => onSelect?.(arcs[0].slice)}
              />
            ) : (
              arcs.map(({ slice, start, end }) => {
                // Un filo di distacco fra gli spicchi, cosi' due colori
                // vicini non sembrano un blocco unico. Sugli spicchi
                // sottilissimi il distacco si riduce, altrimenti li
                // cancellerebbe del tutto.
                const gap = Math.min(0.012, (end - start) * 0.25);
                return (
                  <Path
                    key={slice.id ?? "none"}
                    d={arcPath(cx, cy, start, end - gap)}
                    fill={slice.color}
                    onPress={() => onSelect?.(slice)}
                  />
                );
              })
            )}
          </G>
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.centerValue, { color: palette.ink }]}>
            {formatAmount(total)}
          </Text>
          {centerLabel && (
            <Text style={[styles.centerLabel, { color: palette.ink3 }]}>
              {centerLabel}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.list}>
        {slices.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <TouchableOpacity
              key={slice.id ?? "none"}
              style={styles.row}
              onPress={() => onSelect?.(slice)}
              accessibilityRole="button"
              accessibilityLabel={`${slice.label}, ${formatAmount(
                slice.value
              )}, ${Math.round(pct)} percento`}
            >
              <View
                style={[styles.iconWrap, { backgroundColor: tint(slice.color, dark) }]}
              >
                <Icon name={slice.icon} size={14} color={slice.color} />
              </View>

              <Text
                style={[styles.rowLabel, { color: palette.ink2 }]}
                numberOfLines={1}
              >
                {slice.label}
              </Text>

              <Text style={[styles.rowValue, { color: palette.ink }]}>
                {formatAmount(slice.value)}
              </Text>
              <Text style={[styles.rowPct, { color: palette.ink3 }]}>
                {pct >= 1 ? Math.round(pct) : pct.toFixed(1)}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { position: "absolute", alignItems: "center" },
  centerValue: {
    ...type.bodyMedium,
    fontSize: 13.5,
    fontVariant: ["tabular-nums"],
  },
  centerLabel: { ...type.small, fontSize: 9.5, marginTop: 2 },
  list: { flex: 1, gap: 10, paddingTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...type.caption, flex: 1 },
  rowValue: {
    ...type.caption,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  rowPct: {
    ...type.small,
    width: 34,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  empty: { ...type.caption, lineHeight: 19, paddingVertical: space.sm },
});
