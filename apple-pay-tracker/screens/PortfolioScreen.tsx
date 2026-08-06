import React, { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { ScrubChart } from "../components/ScrubChart";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import {
  GroupSummary,
  Position,
  RANGES,
  RangeKey,
  groupPositions,
  sliceSeries,
} from "../lib/portfolio";
import { AssetGroup } from "../lib/types";
import { usePortfolio, usePortfolioSeries } from "../lib/usePortfolio";
import { radius, space, tint, type } from "../lib/theme";
import AnalysisScreen from "./AnalysisScreen";
import AssetDetailScreen from "./AssetDetailScreen";
import PacScreen from "./PacScreen";

export const GROUP_ICON: Record<AssetGroup, string> = {
  conto_titoli: "landmark",
  crypto: "bitcoin",
  private_market: "briefcase",
};

/** Selettore di periodo, condiviso da tutti i grafici della sezione. */
function RangePicker({
  range,
  onChange,
}: {
  range: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  const { palette, dark } = useTheme();
  return (
    <View style={styles.ranges}>
      {RANGES.map((r) => {
        const active = r.key === range;
        return (
          <TouchableOpacity
            key={r.key}
            onPress={() => onChange(r.key)}
            style={[
              styles.rangeChip,
              active && { backgroundColor: tint(palette.accent, dark) },
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
  );
}

export default function PortfolioScreen() {
  const { palette } = useTheme();
  const portfolio = usePortfolio();
  const { positions, totals, series, xirr, rules, loading } = portfolio;

  // Un anno racconta gia' un andamento senza schiacciare gli ultimi mesi
  // contro il bordo, che e' quello che fa "Tutto" man mano che la storia
  // cresce.
  const [range, setRange] = useState<RangeKey>("1y");
  const [scrub, setScrub] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openAsset, setOpenAsset] = useState<Position | null>(null);
  const [page, setPage] = useState<"root" | "analysis" | "pac">("root");

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
  const monthlyPac = rules
    .filter((r) => r.frequency === "monthly")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // Trascinando sul grafico l'intestazione racconta quel giorno invece di oggi:
  // il numero grande e il punto sotto il dito devono dire la stessa cosa.
  const at = scrub === null ? null : visible[scrub];
  const heroValue = at ? at.value_eur : totals.value;
  const heroBasis = at ? at.invested_eur : totals.costBasis;
  const heroGain = at ? at.value_eur - at.invested_eur : totals.priceGain;
  const heroPct = heroBasis > 0 ? heroGain / heroBasis : null;
  const amount = splitAmount(heroValue);
  const gainColor = heroGain >= 0 ? palette.good : palette.over;

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

  if (page === "analysis") {
    return (
      <AnalysisScreen
        positions={open}
        groups={groups}
        total={totals.value}
        onOpenAsset={setOpenAsset}
        onBack={() => setPage("root")}
      />
    );
  }

  if (page === "pac") {
    return (
      <PacScreen
        rules={rules}
        assets={portfolio.assets}
        onBack={() => setPage("root")}
        onSaved={portfolio.reload}
      />
    );
  }

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
        <ScrubChart points={points} color={palette.accent} onScrub={setScrub} />
        <RangePicker
          range={range}
          onChange={(r) => {
            setRange(r);
            setScrub(null);
          }}
        />
      </View>

      <View>
        <LinkRow
          icon="chart-pie"
          label="Analisi"
          hint="ripartizione del portafoglio"
          onPress={() => setPage("analysis")}
        />
        <LinkRow
          icon="repeat"
          label="Piani di accumulo"
          hint={
            monthlyPac > 0
              ? `${formatAmount(monthlyPac)} al mese`
              : "nessun piano attivo"
          }
          onPress={() => setPage("pac")}
        />
      </View>

      {xirr !== null && (
        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Rendimento</Text>
          <View style={styles.metricRow}>
            <Text style={[styles.metricValue, { color: palette.ink }]}>
              {(xirr * 100).toFixed(2)}%
            </Text>
            <Text style={[styles.metricUnit, { color: palette.ink3 }]}>annuo</Text>
          </View>
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Tiene conto di quando sono entrati i soldi: le rate vecchie hanno
            lavorato piu' a lungo delle ultime, e un rendimento semplice le
            tratterebbe uguali.
          </Text>
        </View>
      )}

      {totals.pending > 0 && (
        <View style={styles.pendingRow}>
          <Icon name="clock" size={16} color={palette.ink3} />
          <Text style={[styles.pendingText, { color: palette.ink2 }]}>
            {formatAmount(totals.pending)} addebitati e non ancora convertiti in
            quote. I fondi private market eseguono gli ordini a finestre, non il
            giorno stesso.
          </Text>
        </View>
      )}

      {groups.map((group) => (
        <GroupSection
          key={group.group}
          group={group}
          onOpenAsset={setOpenAsset}
        />
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

/**
 * Sezione richiudibile: chiusa mostra il saldo e come sta andando, aperta il
 * suo grafico e le posizioni dentro.
 *
 * Chiuse di default perche' con quattro gruppi aperti la schermata diventa un
 * muro da scorrere, e il saldo di ogni gruppo e' gia' nell'intestazione.
 */
function GroupSection({
  group,
  onOpenAsset,
}: {
  group: GroupSummary;
  onOpenAsset: (p: Position) => void;
}) {
  const { palette } = useTheme();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>("1y");
  const [scrub, setScrub] = useState<number | null>(null);

  // La serie si scarica solo quando la sezione viene aperta la prima volta.
  const series = usePortfolioSeries(open ? { group: group.group } : null);
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

  const at = scrub === null ? null : visible[scrub];
  const positive = group.priceGain >= 0;

  return (
    <View>
      <TouchableOpacity
        style={styles.groupHead}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Icon
          name={open ? "chevron-down" : "chevron-right"}
          size={15}
          color={palette.ink3}
        />
        <Icon name={GROUP_ICON[group.group]} size={15} color={palette.ink3} />

        <View style={styles.groupTitles}>
          <Text style={[styles.groupName, { color: palette.ink }]}>
            {group.label}
          </Text>
          <Text style={[styles.groupMeta, { color: palette.ink3 }]}>
            versato {formatAmount(group.investedBasis)}
            {group.pending > 0
              ? ` · ${formatAmount(group.pending)} in esecuzione`
              : ""}
          </Text>
        </View>

        <View style={styles.groupNumbers}>
          <Text style={[styles.groupValue, { color: palette.ink }]}>
            {formatAmount(group.value)}
          </Text>
          {group.priceGainPct !== null && (
            <Text
              style={[
                styles.groupGain,
                { color: positive ? palette.good : palette.over },
              ]}
            >
              {positive ? "+" : "−"}
              {Math.abs(group.priceGainPct * 100).toFixed(1)}%
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.groupBody}>
          <View style={styles.chartBlock}>
            <ScrubChart
              points={points}
              color={palette.accent}
              onScrub={setScrub}
              height={140}
            />
            <View style={styles.groupChartFoot}>
              <RangePicker
                range={range}
                onChange={(r) => {
                  setRange(r);
                  setScrub(null);
                }}
              />
              {at && (
                <Text style={[styles.scrubDate, { color: palette.ink2 }]}>
                  {formatAmount(at.value_eur)} · {formatDate(at.on_date)}
                </Text>
              )}
            </View>
          </View>

          {group.positions.map((position) => (
            <AssetRow
              key={position.asset.id}
              position={position}
              onPress={() => onOpenAsset(position)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress}>
      <Icon name={icon} size={17} color={palette.ink2} />
      <Text style={[styles.linkLabel, { color: palette.ink }]}>{label}</Text>
      <Text style={[styles.linkHint, { color: palette.ink3 }]}>{hint}</Text>
      <Icon name="chevron-right" size={14} color={palette.ink3} />
    </TouchableOpacity>
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
  // In elenco si mostra il rendimento di prezzo, lo stesso che mostra il
  // broker: e' il numero che verra' confrontato con la sua app. I dividendi
  // sono guadagno vero ma non stanno nel prezzo, e compaiono nel dettaglio.
  const pct = position.priceGainPct;
  const positive = position.priceGain >= 0;

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
        {pct !== null && !position.closed && (
          <Text
            style={[
              styles.assetGain,
              { color: positive ? palette.good : palette.over },
            ]}
          >
            {positive ? "+" : "−"}
            {Math.abs(pct * 100).toFixed(1)}%
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 12,
  },
  linkLabel: { ...type.body, flex: 1 },
  linkHint: { ...type.caption },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
  },
  groupTitles: { flex: 1, gap: 2, marginLeft: 2 },
  groupName: { ...type.bodyMedium },
  groupMeta: { ...type.small },
  groupNumbers: { alignItems: "flex-end", gap: 2 },
  groupValue: { ...type.amount },
  groupGain: { ...type.small, fontWeight: "500" },
  groupBody: { paddingLeft: space.xl, gap: space.md, paddingBottom: space.sm },
  groupChartFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  scrubDate: { ...type.small, fontWeight: "500" },
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
