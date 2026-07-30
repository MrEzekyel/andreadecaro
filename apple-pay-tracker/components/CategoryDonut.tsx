import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, tint, type } from "../lib/theme";
import { Icon } from "./Icon";

const SIZE = 156;
const R_OUTER = 76;
const R_INNER = 47;

/** Oltre questa quota le categorie minori si raccolgono in "Altro". */
const MAX_VISIBLE = 5;
/** Segnaposto per lo spicchio aggregato: distinto dall'id null delle spese
 * senza categoria, che e' un valore legittimo e cliccabile. */
const OTHER_ID = "__other__";

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
  /**
   * Come scrivere i valori. Serve alle ripartizioni che non contano euro —
   * la provenienza conta spese, e formattarla in valuta direbbe una cosa
   * falsa.
   */
  formatValue?: (value: number) => string;
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
 * Oltre le prime 5 (l'elenco arriva gia' ordinato per importo) le categorie
 * minori si raccolgono in una voce "Altro": sia l'anello che l'elenco a
 * fianco restano leggibili anche con dieci categorie configurate, invece di
 * diluirsi in spicchi e righe troppo sottili per portare informazione.
 */
export function CategoryDonut({
  slices,
  onSelect,
  centerLabel,
  formatValue = formatAmount,
}: Props) {
  const { palette, dark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const hidden = slices.length > MAX_VISIBLE ? slices.slice(MAX_VISIBLE) : [];

  const display = useMemo(() => {
    if (slices.length <= MAX_VISIBLE) return slices;
    const visible = slices.slice(0, MAX_VISIBLE);
    const rest = slices.slice(MAX_VISIBLE);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    return [
      ...visible,
      {
        id: OTHER_ID,
        label: "Altro",
        value: otherValue,
        color: palette.ink3,
        icon: "ellipsis",
      },
    ];
  }, [slices, palette.ink3]);

  const total = display.reduce((sum, slice) => sum + slice.value, 0);

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
  const arcs = display.map((slice) => {
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
                    onPress={() =>
                      slice.id === OTHER_ID
                        ? setExpanded((v) => !v)
                        : onSelect?.(slice)
                    }
                  />
                );
              })
            )}
          </G>
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.centerValue, { color: palette.ink }]}>
            {formatValue(total)}
          </Text>
          {centerLabel && (
            <Text style={[styles.centerLabel, { color: palette.ink3 }]}>
              {centerLabel}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.list}>
        {display.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          const isOther = slice.id === OTHER_ID;

          return (
            <View key={slice.id ?? "none"}>
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  isOther ? setExpanded((v) => !v) : onSelect?.(slice)
                }
                accessibilityRole="button"
                accessibilityLabel={`${slice.label}, ${formatValue(
                  slice.value
                )}, ${Math.round(pct)} percento`}
              >
                <View
                  style={[styles.iconWrap, { backgroundColor: tint(slice.color, dark) }]}
                >
                  <Icon name={slice.icon} size={11} color={slice.color} />
                </View>

                <View style={styles.rowLabelWrap}>
                  <Text
                    style={[styles.rowLabel, { color: palette.ink2 }]}
                    numberOfLines={1}
                  >
                    {slice.label}
                  </Text>
                  <Text style={[styles.rowPct, { color: palette.ink3 }]}>
                    {pct >= 1 ? Math.round(pct) : pct.toFixed(1)}%
                  </Text>
                </View>

                <Text style={[styles.rowValue, { color: palette.ink }]}>
                  {formatValue(slice.value)}
                </Text>

                {isOther && (
                  <Icon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={13}
                    color={palette.ink3}
                  />
                )}
              </TouchableOpacity>

              {/* Le categorie oltre le prime 5, sbloccate dall'"Altro":
                  crescono da qui, non in un popover a parte, cosi' restano
                  dentro il normale flusso della pagina invece di doverlo
                  interrompere. */}
              {isOther && expanded && (
                <View
                  style={[styles.hiddenList, { borderLeftColor: palette.hairline }]}
                >
                  {hidden.map((h) => {
                    const hPct = total > 0 ? (h.value / total) * 100 : 0;
                    return (
                      <TouchableOpacity
                        key={h.id ?? "none"}
                        style={styles.row}
                        onPress={() => onSelect?.(h)}
                        accessibilityRole="button"
                        accessibilityLabel={`${h.label}, ${formatValue(
                          h.value
                        )}, ${Math.round(hPct)} percento`}
                      >
                        <View
                          style={[
                            styles.iconWrap,
                            { backgroundColor: tint(h.color, dark) },
                          ]}
                        >
                          <Icon name={h.icon} size={11} color={h.color} />
                        </View>
                        <View style={styles.rowLabelWrap}>
                          <Text
                            style={[styles.rowLabel, { color: palette.ink2 }]}
                            numberOfLines={1}
                          >
                            {h.label}
                          </Text>
                          <Text style={[styles.rowPct, { color: palette.ink3 }]}>
                            {hPct >= 1 ? Math.round(hPct) : hPct.toFixed(1)}%
                          </Text>
                        </View>
                        <Text style={[styles.rowValue, { color: palette.ink }]}>
                          {formatValue(h.value)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: space.md },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { position: "absolute", alignItems: "center" },
  centerValue: {
    ...type.bodyMedium,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  centerLabel: { ...type.small, fontSize: 9.5, marginTop: 2 },
  list: { flex: 1, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  hiddenList: {
    gap: 8,
    marginTop: 8,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabelWrap: { flex: 1, minWidth: 0 },
  rowLabel: { ...type.caption },
  rowPct: {
    ...type.small,
    fontSize: 10,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  rowValue: {
    ...type.caption,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  empty: { ...type.caption, lineHeight: 19, paddingVertical: space.sm },
});
