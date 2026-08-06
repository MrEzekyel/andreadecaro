import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../components/Icon";
import { ScrubChart } from "../components/ScrubChart";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import {
  GROUP_LABEL,
  Position,
  RANGES,
  RangeKey,
  effectiveDay,
  sliceSeries,
} from "../lib/portfolio";
import { Investment } from "../lib/types";
import { useAssetSeries } from "../lib/usePortfolio";
import { radius, space, tint, type } from "../lib/theme";

const KIND_LABEL: Record<Investment["kind"], string> = {
  buy: "Acquisto",
  sell: "Vendita",
  dividend: "Dividendo",
};

type Props = {
  position: Position;
  investments: Investment[];
  onBack: () => void;
};

export default function AssetDetailScreen({ position, investments, onBack }: Props) {
  const { palette, dark } = useTheme();
  const series = useAssetSeries(position.asset.id);

  const [range, setRange] = useState<RangeKey>("all");
  const [scrub, setScrub] = useState<number | null>(null);

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
  const heroValue = at ? at.value_eur : position.value;
  const heroGain = at ? at.value_eur - at.invested_eur : position.gain;
  const amount = splitAmount(heroValue);
  const gainColor = heroGain >= 0 ? palette.good : palette.over;

  const operazioni = useMemo(
    () =>
      [...investments].sort((a, b) =>
        effectiveDay(b).localeCompare(effectiveDay(a))
      ),
    [investments]
  );

  return (
    <SwipeBack onBack={onBack}>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={backHitSlop}
          style={styles.back}
        >
          <Icon name="chevron-left" size={18} color={palette.ink2} />
          <Text style={[styles.backText, { color: palette.ink2 }]}>
            Investimenti
          </Text>
        </TouchableOpacity>

        <View>
          <Text style={[styles.title, { color: palette.ink }]}>
            {position.asset.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.ink3 }]}>
            {GROUP_LABEL[position.asset.asset_group]}
            {position.asset.isin ? ` · ${position.asset.isin}` : ""}
          </Text>
        </View>

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
            <Text style={[styles.heroMeta, { color: palette.ink3 }]}>
              {at ? formatDate(at.on_date) : "da inizio piano"}
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
                    active && { backgroundColor: tint(palette.accent, dark) },
                  ]}
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

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Posizione</Text>
          <Fact
            label="Quote"
            value={position.closed ? "—" : position.quantity.toFixed(6)}
          />
          <Fact
            label="Prezzo medio di carico"
            value={position.avgPrice ? formatAmount(position.avgPrice) : "—"}
          />
          <Fact
            label="Prezzo attuale"
            value={
              position.price
                ? `${formatAmount(position.price)}${
                    position.priceDate ? ` · ${formatDate(position.priceDate)}` : ""
                  }`
                : "non disponibile"
            }
          />
          <Fact label="Capitale versato" value={formatAmount(position.invested)} />
          {position.sold > 0 && (
            <Fact label="Disinvestito" value={formatAmount(position.sold)} />
          )}
          {position.dividends > 0 && (
            <Fact label="Dividendi incassati" value={formatAmount(position.dividends)} />
          )}
          {position.pending > 0 && (
            <Fact label="In esecuzione" value={formatAmount(position.pending)} />
          )}
          {position.fees > 0 && (
            <Fact label="Commissioni" value={formatAmount(position.fees)} />
          )}
        </View>

        {position.asset.price_source === "manual" && (
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Questo fondo non ha un prezzo pubblico giornaliero: il valore si
            aggiorna quando il fondo esegue un ordine, e fra un'esecuzione e
            l'altra il grafico resta fermo invece di inventare una curva.
          </Text>
        )}

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Operazioni</Text>
          {operazioni.map((op) => (
            <View key={op.id} style={styles.opRow}>
              <View style={styles.opMain}>
                <Text style={[styles.opKind, { color: palette.ink }]}>
                  {KIND_LABEL[op.kind]}
                  {op.status === "pending" ? " · in esecuzione" : ""}
                </Text>
                <Text style={[styles.opMeta, { color: palette.ink3 }]}>
                  {formatDate(effectiveDay(op))}
                  {op.unit_price ? ` · ${formatAmount(op.unit_price)}` : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.opAmount,
                  {
                    color:
                      op.kind === "buy" && op.status !== "pending"
                        ? palette.ink
                        : op.kind === "buy"
                          ? palette.ink3
                          : palette.good,
                  },
                ]}
              >
                {op.kind === "buy" ? "" : "+"}
                {formatAmount(Number(op.amount))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SwipeBack>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: palette.ink3 }]}>{label}</Text>
      <Text style={[styles.factValue, { color: palette.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  back: { flexDirection: "row", alignItems: "center", gap: 3 },
  backText: { ...type.body },
  title: { ...type.title },
  subtitle: { ...type.caption, marginTop: 2 },
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
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    gap: space.md,
  },
  factLabel: { ...type.caption, flex: 1 },
  factValue: { ...type.amount },
  note: { ...type.caption, lineHeight: 18 },
  opRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 9,
  },
  opMain: { flex: 1, gap: 2 },
  opKind: { ...type.body },
  opMeta: { ...type.small },
  opAmount: { ...type.amount },
});
