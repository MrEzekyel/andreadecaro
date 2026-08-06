import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CategoryDonut } from "../components/CategoryDonut";
import { Icon } from "../components/Icon";
import { ScrubChart } from "../components/ScrubChart";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import {
  GROUP_LABEL,
  Position,
  RANGES,
  RangeKey,
  groupPositions,
  sliceSeries,
} from "../lib/portfolio";
import { AssetGroup } from "../lib/types";
import { usePortfolio } from "../lib/usePortfolio";
import { radius, space, tint, type } from "../lib/theme";
import AssetDetailScreen from "./AssetDetailScreen";

const GROUP_ICON: Record<AssetGroup, string> = {
  conto_titoli: "landmark",
  crypto: "bitcoin",
  private_market: "briefcase",
};

/** Colori dell'allocazione: stessa famiglia calda del resto dell'app. */
const SLICE_COLORS = [
  "#c2613f",
  "#7d8c6a",
  "#8a6f9e",
  "#c99b3f",
  "#5f8a94",
  "#a4574f",
  "#6d7f9c",
  "#94795a",
];

export default function PortfolioScreen() {
  const { palette, dark } = useTheme();
  const portfolio = usePortfolio();
  const { positions, totals, series, xirr, loading } = portfolio;

  const [range, setRange] = useState<RangeKey>("all");
  const [scrub, setScrub] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openAsset, setOpenAsset] = useState<Position | null>(null);

  const visible = useMemo(() => sliceSeries(series, range), [series, range]);

  const points = useMemo(
    () =>
      visible.map((p) => ({
        date: p.on_date,
        value: p.value_eur,
        baseline: p.invested_eur,
      })),
    [visible]
  );

  const open = positions.filter((p) => !p.closed);
  const groups = groupPositions(open, totals.value);

  // Trascinando sul grafico l'intestazione racconta quel giorno invece di oggi:
  // il numero grande e il punto sotto il dito devono dire la stessa cosa.
  const at = scrub === null ? null : visible[scrub];
  const heroValue = at ? at.value_eur : totals.value;
  const heroBasis = at ? at.invested_eur : totals.costBasis;
  const heroGain = at ? at.value_eur - at.invested_eur : totals.gain;
  const heroPct = heroBasis > 0 ? heroGain / heroBasis : null;
  const amount = splitAmount(heroValue);

  const slices = useMemo(() => {
    const ordered = [...open].sort((a, b) => b.value - a.value);
    return ordered
      .filter((p) => p.value > 0)
      .map((p, i) => ({
        id: p.asset.id,
        label: p.asset.name,
        value: p.value,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
        icon: GROUP_ICON[p.asset.asset_group],
      }));
  }, [open]);

  if (openAsset) {
    return (
      <AssetDetailScreen
        position={openAsset}
        investments={portfolio.investments.filter(
          (op) => op.asset_id === openAsset.asset.id
        )}
        onBack={() => setOpenAsset(null)}
      />
    );
  }

  const gainColor = heroGain >= 0 ? palette.good : palette.over;

  return (
    <ScrollView
      style={{ backgroundColor: palette.ground }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await portfolio.reload();
            setRefreshing(false);
          }}
          tintColor={palette.ink3}
        />
      }
    >
      <Text style={[styles.title, { color: palette.ink }]}>Investimenti</Text>

      <View>
        <Text style={[styles.hero, { color: palette.ink }]}>
          {amount.whole}
          <Text style={[styles.heroCents, { color: palette.ink2 }]}>
            {amount.cents}
          </Text>
        </Text>

        <View style={styles.gainRow}>
          <Text style={[styles.gain, { color: gainColor }]}>
            {heroGain >= 0 ? "+" : "−"}
            {formatAmount(Math.abs(heroGain))}
          </Text>
          {heroPct !== null && (
            <Text style={[styles.gain, { color: gainColor }]}>
              {heroGain >= 0 ? "+" : "−"}
              {Math.abs(heroPct * 100).toFixed(1)}%
            </Text>
          )}
          <Text style={[styles.heroMeta, { color: palette.ink3 }]}>
            {at ? formatDate(at.on_date) : `su ${formatAmount(heroBasis)} versati`}
          </Text>
        </View>
      </View>

      <View style={styles.chartBlock}>
        <ScrubChart
          points={points}
          color={palette.accent}
          onScrub={setScrub}
          baselineLabel="— — capitale versato"
        />

        <View style={styles.ranges}>
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => {
                  setRange(r.key);
                  setScrub(null);
                }}
                style={[
                  styles.rangeChip,
                  active && {
                    backgroundColor: tint(palette.accent, dark),
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.rangeLabel,
                    { color: active ? palette.accent : palette.ink3 },
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {xirr !== null && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Rendimento</Text>
          <View style={styles.metricRow}>
            <Text style={[styles.metricValue, { color: palette.ink }]}>
              {(xirr * 100).toFixed(2)}%
            </Text>
            <Text style={[styles.metricUnit, { color: palette.ink3 }]}>
              annuo
            </Text>
          </View>
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Tiene conto di quando sono entrati i soldi: le rate vecchie hanno
            lavorato piu' a lungo delle ultime, e un rendimento semplice le
            tratterebbe uguali.
          </Text>
        </View>
      )}

      {totals.pending > 0 && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            In esecuzione
          </Text>
          <View style={styles.pendingRow}>
            <Icon name="clock" size={16} color={palette.ink3} />
            <Text style={[styles.pendingText, { color: palette.ink2 }]}>
              {formatAmount(totals.pending)} addebitati e non ancora convertiti
              in quote. I fondi private market eseguono gli ordini a finestre,
              non il giorno stesso.
            </Text>
          </View>
        </View>
      )}

      {slices.length > 0 && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            Allocazione
          </Text>
          <CategoryDonut
            slices={slices}
            centerLabel="in portafoglio"
            onSelect={(slice) => {
              const found = open.find((p) => p.asset.id === slice.id);
              if (found) setOpenAsset(found);
            }}
          />
        </View>
      )}

      {groups.map((group) => (
        <View key={group.group}>
          <View style={styles.groupHead}>
            <Icon
              name={GROUP_ICON[group.group]}
              size={15}
              color={palette.ink3}
            />
            <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
              {group.label}
            </Text>
            <Text style={[styles.groupShare, { color: palette.ink3 }]}>
              {(group.share * 100).toFixed(0)}%
            </Text>
            <Text style={[styles.groupValue, { color: palette.ink2 }]}>
              {formatAmount(group.value)}
            </Text>
          </View>

          {group.positions.map((position) => (
            <AssetRow
              key={position.asset.id}
              position={position}
              onPress={() => setOpenAsset(position)}
            />
          ))}
        </View>
      ))}

      {!loading && open.length === 0 && (
        <Text style={[styles.note, { color: palette.ink3 }]}>
          Nessuna posizione aperta.
        </Text>
      )}

      {positions.some((p) => p.closed) && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Chiuse</Text>
          {positions
            .filter((p) => p.closed)
            .map((position) => (
              <AssetRow
                key={position.asset.id}
                position={position}
                onPress={() => setOpenAsset(position)}
              />
            ))}
        </View>
      )}
    </ScrollView>
  );
}

function AssetRow({
  position,
  onPress,
}: {
  position: Position;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const positive = position.gain >= 0;

  return (
    <TouchableOpacity style={styles.assetRow} onPress={onPress}>
      <View style={styles.assetMain}>
        <Text style={[styles.assetName, { color: palette.ink }]} numberOfLines={1}>
          {position.asset.name}
        </Text>
        <Text style={[styles.assetMeta, { color: palette.ink3 }]}>
          {position.closed
            ? "posizione chiusa"
            : `${position.quantity.toFixed(position.quantity < 10 ? 4 : 2)} quote · carico ${
                position.avgPrice ? formatAmount(position.avgPrice) : "—"
              }`}
        </Text>
      </View>

      <View style={styles.assetNumbers}>
        <Text style={[styles.assetValue, { color: palette.ink }]}>
          {formatAmount(position.closed ? position.gain : position.value)}
        </Text>
        {position.gainPct !== null && (
          <Text
            style={[
              styles.assetGain,
              { color: positive ? palette.good : palette.over },
            ]}
          >
            {positive ? "+" : "−"}
            {Math.abs(position.gainPct * 100).toFixed(1)}%
          </Text>
        )}
      </View>

      <Icon name="chevron-right" size={14} color={palette.ink3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  title: { ...type.title },
  hero: { ...type.hero },
  heroCents: { ...type.heroCents },
  gainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.sm,
    marginTop: 2,
  },
  gain: { ...type.bodyMedium },
  heroMeta: { ...type.caption },
  chartBlock: { gap: space.md },
  ranges: { flexDirection: "row", gap: space.xs },
  rangeChip: {
    paddingVertical: 5,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  rangeLabel: { ...type.small, fontWeight: "500" },
  label: { ...type.label, marginBottom: space.sm },
  metricRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  metricValue: { fontSize: 27, fontWeight: "400", letterSpacing: -0.3 },
  metricUnit: { ...type.caption },
  note: { ...type.caption, lineHeight: 18, marginTop: space.xs },
  pendingRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  pendingText: { ...type.caption, lineHeight: 18, flex: 1 },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  groupShare: { ...type.caption, flex: 1 },
  groupValue: { ...type.amount },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 11,
  },
  assetMain: { flex: 1, gap: 2 },
  assetName: { ...type.body },
  assetMeta: { ...type.small },
  assetNumbers: { alignItems: "flex-end", gap: 2 },
  assetValue: { ...type.amount },
  assetGain: { ...type.small, fontWeight: "500" },
});
