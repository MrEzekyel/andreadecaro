import React, { useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { space, type } from "../lib/theme";
import { Icon } from "./Icon";

const SIZE = 168;
const R_OUTER = 84;
const R_INNER = 52;
/** Distanza dal centro a cui appoggiare le etichette. */
const R_LABEL = 104;
const HEIGHT = 246;
/** Sotto questa quota l'etichetta non ci sta senza accavallarsi. */
const MIN_LABEL_SHARE = 0.055;
const LABEL_W = 74;

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
function arcPath(
  cx: number,
  cy: number,
  start: number,
  end: number
): string {
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
 * Ripartizione a ciambella con le icone appoggiate accanto al proprio
 * spicchio.
 *
 * Le etichette stanno fuori dalla corona invece che in una legenda laterale:
 * cosi' il colore non deve essere ricordato: icona, percentuale e importo
 * sono gia' li' dove serve guardare. Gli spicchi troppo sottili per reggere
 * un'etichetta restano comunque toccabili sull'arco.
 */
export function CategoryDonut({ slices, onSelect, centerLabel }: Props) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  if (total <= 0) {
    return (
      <Text style={[styles.empty, { color: palette.ink3 }]}>
        Nessuna spesa da ripartire in questo periodo.
      </Text>
    );
  }

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Geometria degli spicchi, riusata sia per il disegno che per le etichette.
  let cursor = 0;
  const arcs = slices.map((slice) => {
    const share = slice.value / total;
    const start = cursor * Math.PI * 2;
    cursor += share;
    const end = cursor * Math.PI * 2;
    return { slice, share, start, end, mid: (start + end) / 2 };
  });

  const single = arcs.length === 1;

  return (
    <View style={[styles.wrap, { height: HEIGHT }]} onLayout={onLayout}>
      <View style={styles.canvas}>
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

      {width > 0 &&
        arcs.map(({ slice, share, mid }) => {
          if (share < MIN_LABEL_SHARE) return null;

          const x = width / 2 + R_LABEL * Math.sin(mid);
          const y = HEIGHT / 2 - R_LABEL * Math.cos(mid);

          // Le etichette restano dentro il riquadro: quelle sui fianchi
          // finirebbero altrimenti mezze fuori dalla scheda.
          const left = Math.min(
            Math.max(x - LABEL_W / 2, 0),
            Math.max(width - LABEL_W, 0)
          );

          return (
            <TouchableOpacity
              key={`label-${slice.id ?? "none"}`}
              style={[styles.label, { left, top: y - 20, width: LABEL_W }]}
              onPress={() => onSelect?.(slice)}
              accessibilityRole="button"
              accessibilityLabel={`${slice.label}, ${Math.round(
                share * 100
              )} percento, ${formatAmount(slice.value)}`}
            >
              <View style={styles.labelHead}>
                <Icon name={slice.icon} size={13} color={slice.color} />
                <Text style={[styles.labelPct, { color: palette.ink }]}>
                  {Math.round(share * 100)}%
                </Text>
              </View>
              <Text style={[styles.labelValue, { color: palette.ink3 }]}>
                {formatAmount(slice.value)}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", justifyContent: "center" },
  canvas: { alignItems: "center", justifyContent: "center", flex: 1 },
  center: { position: "absolute", alignItems: "center" },
  centerValue: {
    ...type.bodyMedium,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  centerLabel: { ...type.small, fontSize: 10, marginTop: 2 },
  label: { position: "absolute", alignItems: "center", gap: 1 },
  labelHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  labelPct: { ...type.caption, fontWeight: "600", fontVariant: ["tabular-nums"] },
  labelValue: {
    ...type.small,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  empty: { ...type.caption, lineHeight: 19, paddingVertical: space.sm },
});
