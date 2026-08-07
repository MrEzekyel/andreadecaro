import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { DistributionBar } from "../components/DistributionBar";
import { Icon } from "../components/Icon";
import { LetterToggle, LetterOption } from "../components/LetterToggle";
import { ScrubChart } from "../components/ScrubChart";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import {
  GroupSummary,
  MANUAL_PRICE_STALE_DAYS,
  Position,
  RANGES,
  RangeKey,
  daysSince,
  groupXirr,
  monthlyContributions,
  periodPriceGain,
  sliceSeries,
} from "../lib/portfolio";
import { Asset, Investment } from "../lib/types";
import { usePortfolioSeries } from "../lib/usePortfolio";
import { radius, space, tint, type } from "../lib/theme";

/** Stessa famiglia calda del resto dell'app, un colore per titolo. */
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

/** Come ordinare i titoli: per quanto pesano, o per come stanno andando. */
type Ordine = "valore" | "rendimento";

const ORDINE_OPTIONS: LetterOption<Ordine>[] = [
  { value: "valore", letter: "V", label: "Ordina per valore" },
  { value: "rendimento", letter: "R", label: "Ordina per rendimento" },
];

type Props = {
  group: GroupSummary;
  assets: Asset[];
  investments: Investment[];
  onOpenAsset: (p: Position) => void;
  onBack: () => void;
};

/**
 * La sezione vista per intero: andamento, ripartizione, rendimento e titoli.
 *
 * Nell'elenco principale la sezione aperta mostra solo i titoli, perche' li'
 * serve il colpo d'occhio. Qui c'e' lo spazio per il resto senza comprimere
 * niente, e il grafico sta in cima perche' e' la prima domanda che ci si fa
 * aprendo un gruppo.
 */
export default function GroupDetailScreen({
  group,
  assets,
  investments,
  onOpenAsset,
  onBack,
}: Props) {
  const { palette, dark } = useTheme();

  const [range, setRange] = useState<RangeKey>("1y");
  const [scrub, setScrub] = useState<number | null>(null);
  const [ordine, setOrdine] = useState<Ordine>("valore");
  const [meseScelto, setMeseScelto] = useState<string | null>(null);

  const series = usePortfolioSeries({ group: group.group });
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

  const period = useMemo(() => {
    if (visible.length < 2) return null;
    const upTo = scrub === null ? visible : visible.slice(0, scrub + 1);
    return periodPriceGain(upTo, group.investedBasis);
  }, [visible, scrub, group.investedBasis]);

  const rendimento = useMemo(
    () => groupXirr(investments, assets, group.group, group.value),
    [investments, assets, group.group, group.value]
  );

  const versamenti = useMemo(
    () => monthlyContributions(investments, assets, group.group),
    [investments, assets, group.group]
  );

  // Riferimento sul grafico: la mediana, non la media. Un mese fuori scala
  // basta a spostare la media sopra ogni mese normale — qui e' successo con
  // ottobre 2025, quando il disinvestimento del monetario e' rientrato tutto
  // insieme — e una riga che nessun mese tocca non descrive niente.
  const versamentoTipico = useMemo(() => {
    if (versamenti.length === 0) return null;
    const ordinati = versamenti.map((b) => b.total).sort((a, b) => a - b);
    return ordinati[Math.floor(ordinati.length / 2)];
  }, [versamenti]);

  // Il rendimento e' quello che rende confrontabili titoli di taglia diversa:
  // una posizione da 50 euro che fa +20% dice qualcosa che il suo valore, in
  // fondo all'elenco ordinato per importo, non farebbe mai vedere.
  const titoli = useMemo(() => {
    const copia = [...group.positions];
    if (ordine === "rendimento") {
      return copia.sort(
        (a, b) => (b.priceGainPct ?? -Infinity) - (a.priceGainPct ?? -Infinity)
      );
    }
    return copia.sort((a, b) => b.value - a.value);
  }, [group.positions, ordine]);

  const heroValue = at ? at.value_eur : group.value;
  const amount = splitAmount(heroValue);
  const gainAmount = period?.amount ?? group.priceGain;
  const gainPct = period?.pct ?? group.priceGainPct;
  const positive = gainAmount >= 0;
  const gainColor = positive ? palette.good : palette.over;

  const slices = group.positions.map((p, i) => ({
    id: p.asset.id,
    label: p.asset.name,
    value: p.value,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));

  // I fondi senza prezzo pubblico vivono di valori inseriti a mano: sapere
  // quanto sono vecchi conta quanto il valore stesso.
  const manuali = group.positions.filter(
    (p) => p.asset.price_source === "manual"
  );

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
          <Text style={[styles.title, { color: palette.ink }]}>{group.label}</Text>
          <Text style={[styles.subtitle, { color: palette.ink3 }]}>
            {group.positions.length}{" "}
            {group.positions.length === 1 ? "titolo" : "titoli"}
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
              {positive ? "+" : "−"}
              {formatAmount(Math.abs(gainAmount))}
            </Text>
            {gainPct !== null && (
              <Text style={[styles.gain, { color: gainColor }]}>
                {positive ? "+" : "−"}
                {Math.abs(gainPct * 100).toFixed(1)}%
              </Text>
            )}
            <Text style={[styles.heroMeta, { color: palette.ink3 }]}>
              {at ? formatDate(at.on_date) : `su ${formatAmount(group.investedBasis)} versati`}
            </Text>
          </View>
        </View>

        <View style={styles.chartBlock}>
          <ScrubChart points={points} color={palette.accent} onScrub={setScrub} />
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

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Ripartizione</Text>
          <DistributionBar
            slices={slices}
            onSelect={(slice) => {
              const found = group.positions.find((p) => p.asset.id === slice.id);
              if (found) onOpenAsset(found);
            }}
          />
        </View>

        {versamenti.length > 1 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Versamenti al mese
            </Text>
            <BarChart
              buckets={versamenti}
              metric="amount"
              color={palette.accent}
              average={versamentoTipico}
              selectedKey={meseScelto}
              onSelect={(b) =>
                setMeseScelto((corrente) => (corrente === b.key ? null : b.key))
              }
            />
          </View>
        )}

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Numeri</Text>
          <Fact label="Valore" value={formatAmount(group.value)} />
          <Fact label="Capitale versato" value={formatAmount(group.investedBasis)} />
          <Fact
            label="Guadagno"
            value={`${group.priceGain >= 0 ? "+" : "−"}${formatAmount(Math.abs(group.priceGain))}`}
          />
          {group.gain !== group.priceGain && (
            <Fact
              label="Guadagno con dividendi"
              value={`${group.gain >= 0 ? "+" : "−"}${formatAmount(Math.abs(group.gain))}`}
            />
          )}
          {rendimento !== null && (
            <Fact label="Rendimento annuo" value={`${(rendimento * 100).toFixed(2)}%`} />
          )}
          {group.pending > 0 && (
            <Fact label="In esecuzione" value={formatAmount(group.pending)} />
          )}
        </View>

        {rendimento !== null && (
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Il rendimento annuo tiene conto di quando sono entrati i soldi in
            questa sezione: senza, una fetta entrata sei mesi fa e una entrata
            due anni fa sembrerebbero andare uguale.
          </Text>
        )}

        {manuali.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Ultimo valore noto
            </Text>
            {manuali.map((p) => {
              const giorni = p.priceDate ? daysSince(p.priceDate) : null;
              const vecchio = giorni === null || giorni > MANUAL_PRICE_STALE_DAYS;
              return (
                <TouchableOpacity
                  key={p.asset.id}
                  style={styles.navRow}
                  onPress={() => onOpenAsset(p)}
                >
                  <Text style={[styles.navName, { color: palette.ink }]} numberOfLines={1}>
                    {p.asset.name}
                  </Text>
                  <Text
                    style={[
                      styles.navDate,
                      { color: vecchio ? palette.over : palette.ink3 },
                    ]}
                  >
                    {p.priceDate
                      ? `${formatDate(p.priceDate)} · ${giorni} gg fa`
                      : "mai aggiornato"}
                  </Text>
                  <Icon name="chevron-right" size={14} color={palette.ink3} />
                </TouchableOpacity>
              );
            })}
            <Text style={[styles.note, { color: palette.ink3 }]}>
              Questi fondi non hanno un prezzo pubblico: il valore resta quello
              che inserisci tu da Trade Republic.
            </Text>
          </View>
        )}

        <View>
          <View style={styles.listHead}>
            <Text
              style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}
            >
              Titoli
            </Text>
            {group.positions.length > 1 && (
              <LetterToggle
                options={ORDINE_OPTIONS}
                value={ordine}
                onChange={setOrdine}
              />
            )}
          </View>
          {titoli.map((position) => {
            const pos = position.priceGain >= 0;
            return (
              <TouchableOpacity
                key={position.asset.id}
                style={styles.assetRow}
                onPress={() => onOpenAsset(position)}
              >
                <View style={styles.assetMain}>
                  <Text
                    style={[styles.assetName, { color: palette.ink }]}
                    numberOfLines={1}
                  >
                    {position.asset.name}
                  </Text>
                  <Text style={[styles.assetMeta, { color: palette.ink3 }]}>
                    {position.quantity.toFixed(position.quantity < 10 ? 4 : 2)} quote
                    {position.avgPrice
                      ? ` · carico ${formatAmount(position.avgPrice)}`
                      : ""}
                  </Text>
                </View>
                <View style={styles.assetNumbers}>
                  <Text style={[styles.assetValue, { color: palette.ink }]}>
                    {formatAmount(position.value)}
                  </Text>
                  {position.priceGainPct !== null && (
                    <Text
                      style={[
                        styles.assetGain,
                        { color: pos ? palette.good : palette.over },
                      ]}
                    >
                      {pos ? "+" : "−"}
                      {Math.abs(position.priceGainPct * 100).toFixed(1)}%
                    </Text>
                  )}
                </View>
                <Icon name="chevron-right" size={14} color={palette.ink3} />
              </TouchableOpacity>
            );
          })}
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
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
  },
  navName: { ...type.body, flex: 1 },
  navDate: { ...type.small },
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
