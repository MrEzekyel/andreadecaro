import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { GroupSummary, Position } from "../lib/portfolio";
import { AssetGroup } from "../lib/types";
import { radius, space, tint, type } from "../lib/theme";

const SIZE = 220;
const R_OUTER = 104;
const R_INNER = 62;
/** Distacco fra spicchi: senza, due colori vicini sembrano un blocco solo. */
const GAP = 0.018;

/**
 * Tavolozza dell'allocazione: una sola tinta declinata dal caldo al freddo,
 * come il resto dell'app. Il primo colore e' l'accento, cosi' la fetta piu'
 * grande e' anche quella che si riconosce subito.
 */
const COLORS = [
  "#c2613f",
  "#7d8c6a",
  "#8a6f9e",
  "#c99b3f",
  "#5f8a94",
  "#a4574f",
  "#6d7f9c",
  "#94795a",
];

type Slice = { id: string; label: string; value: number; color: string };

function arcPath(start: number, end: number) {
  const point = (r: number, a: number) => [
    SIZE / 2 + r * Math.sin(a),
    SIZE / 2 - r * Math.cos(a),
  ];
  const [x1, y1] = point(R_OUTER, start);
  const [x2, y2] = point(R_OUTER, end);
  const [x3, y3] = point(R_INNER, end);
  const [x4, y4] = point(R_INNER, start);
  const large = end - start > Math.PI ? 1 : 0;

  return [
    `M ${x1},${y1}`,
    `A ${R_OUTER},${R_OUTER} 0 ${large} 1 ${x2},${y2}`,
    `L ${x3},${y3}`,
    `A ${R_INNER},${R_INNER} 0 ${large} 0 ${x4},${y4}`,
    "Z",
  ].join(" ");
}

type Props = {
  positions: Position[];
  groups: GroupSummary[];
  total: number;
  onOpenAsset: (p: Position) => void;
  onBack: () => void;
};

/**
 * La ripartizione del portafoglio, in una schermata sua.
 *
 * Stava in fondo alla schermata principale stretta accanto al suo elenco: qui
 * l'anello puo' essere grande e la lista sta sotto, dove ogni riga ha lo
 * spazio per dire nome, valore e quota senza abbreviare.
 */
export default function AnalysisScreen({
  positions,
  groups,
  total,
  onOpenAsset,
  onBack,
}: Props) {
  const { palette, dark } = useTheme();
  const [scope, setScope] = useState<AssetGroup | null>(null);

  const slices: Slice[] = useMemo(() => {
    // Senza filtro si guardano i gruppi; scegliendone uno si entra dentro e si
    // vedono i suoi asset. Sono due domande diverse — "come sono ripartito" e
    // "cosa c'e' dentro questo gruppo" — e vale la pena poter fare entrambe.
    const source = scope
      ? positions
          .filter((p) => p.asset.asset_group === scope && p.value > 0)
          .map((p) => ({ id: p.asset.id, label: p.asset.name, value: p.value }))
      : groups
          .filter((g) => g.value > 0)
          .map((g) => ({ id: g.group, label: g.label, value: g.value }));

    return source
      .sort((a, b) => b.value - a.value)
      .map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }));
  }, [scope, positions, groups]);

  const shown = slices.reduce((sum, s) => sum + s.value, 0);

  const arcs = useMemo(() => {
    if (shown <= 0) return [];
    let angle = 0;
    return slices.map((slice) => {
      const sweep = (slice.value / shown) * Math.PI * 2;
      // Su una fetta sottilissima il distacco la mangerebbe del tutto.
      const inset = Math.min(GAP, sweep / 3);
      const path = arcPath(angle + inset, angle + sweep - inset);
      angle += sweep;
      return { slice, path };
    });
  }, [slices, shown]);

  return (
    <SwipeBack onBack={onBack}>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity onPress={onBack} hitSlop={backHitSlop} style={styles.back}>
          <Icon name="chevron-left" size={18} color={palette.ink2} />
          <Text style={[styles.backText, { color: palette.ink2 }]}>
            Investimenti
          </Text>
        </TouchableOpacity>

        <View>
          <Text style={[styles.title, { color: palette.ink }]}>Analisi</Text>
          <Text style={[styles.subtitle, { color: palette.ink3 }]}>
            {scope ? "dentro la sezione" : "come e' ripartito il portafoglio"}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="Tutto"
            active={scope === null}
            onPress={() => setScope(null)}
          />
          {groups.map((group) => (
            <Chip
              key={group.group}
              label={group.label}
              active={scope === group.group}
              onPress={() => setScope(group.group)}
            />
          ))}
        </ScrollView>

        {arcs.length === 0 ? (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Niente da ripartire in questa sezione.
          </Text>
        ) : (
          <>
            <View style={styles.donutWrap}>
              <Svg width={SIZE} height={SIZE}>
                <G>
                  {arcs.map(({ slice, path }) => (
                    <Path key={slice.id} d={path} fill={slice.color} />
                  ))}
                </G>
              </Svg>

              <View style={styles.center} pointerEvents="none">
                <Text style={[styles.centerValue, { color: palette.ink }]}>
                  {formatAmount(shown)}
                </Text>
                <Text style={[styles.centerLabel, { color: palette.ink3 }]}>
                  {scope
                    ? `${((shown / total) * 100).toFixed(0)}% del totale`
                    : "in portafoglio"}
                </Text>
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                {scope ? "Titoli" : "Sezioni"}
              </Text>

              {slices.map((slice) => {
                const position = positions.find((p) => p.asset.id === slice.id);
                return (
                  <TouchableOpacity
                    key={slice.id}
                    style={styles.row}
                    disabled={!position}
                    onPress={() => position && onOpenAsset(position)}
                  >
                    <View style={[styles.dot, { backgroundColor: slice.color }]} />
                    <View style={styles.rowMain}>
                      <Text
                        style={[styles.rowName, { color: palette.ink }]}
                        numberOfLines={1}
                      >
                        {slice.label}
                      </Text>
                      <Text style={[styles.rowValue, { color: palette.ink3 }]}>
                        {formatAmount(slice.value)}
                      </Text>
                    </View>
                    <Text style={[styles.rowShare, { color: palette.ink }]}>
                      {((slice.value / shown) * 100).toFixed(2)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SwipeBack>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { palette, dark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? tint(palette.accent, dark) : palette.surface2,
          borderColor: active ? palette.accent : "transparent",
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? palette.accent : palette.ink2 },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  back: { flexDirection: "row", alignItems: "center", gap: 3 },
  backText: { ...type.body },
  title: { ...type.title },
  subtitle: { ...type.caption, marginTop: 2 },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { ...type.body, fontWeight: "500" },
  donutWrap: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", gap: 2 },
  centerValue: { ...type.body, fontWeight: "500", fontSize: 16 },
  centerLabel: { ...type.small },
  label: { ...type.label, marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 12,
  },
  dot: { width: 11, height: 11, borderRadius: 6 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { ...type.body, fontWeight: "500" },
  rowValue: { ...type.small },
  rowShare: { ...type.amount },
  empty: { ...type.caption, lineHeight: 19 },
});
