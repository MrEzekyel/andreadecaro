import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { ScrubChart } from "../components/ScrubChart";
import { Sheet } from "../components/Sheet";
import { StatTiles } from "../components/StatTiles";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount, formatDate, splitAmount } from "../lib/format";
import {
  GROUP_LABEL,
  MANUAL_PRICE_STALE_DAYS,
  Position,
  RANGES,
  RangeKey,
  assetReturn,
  daysSince,
  effectiveDay,
  returnTile,
  sliceSeries,
} from "../lib/portfolio";
import { supabase } from "../lib/supabase";
import { Investment } from "../lib/types";
import { usePortfolioSeries } from "../lib/usePortfolio";
import { radius, space, tint, type } from "../lib/theme";

function parseAmountInput(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const KIND_LABEL: Record<Investment["kind"], string> = {
  buy: "Acquisto",
  sell: "Vendita",
  dividend: "Dividendo",
};

type Props = {
  position: Position;
  investments: Investment[];
  /** Valore di tutto il portafoglio, per il peso di questa posizione. */
  portfolioValue: number;
  onBack: () => void;
  /** Ricarica il portafoglio dopo un aggiornamento manuale del valore. */
  onSaved: () => void;
};

export default function AssetDetailScreen({
  position,
  investments,
  portfolioValue,
  onBack,
  onSaved,
}: Props) {
  const { palette, dark } = useTheme();
  const { series } = usePortfolioSeries({ assetId: position.asset.id });

  // Come nella schermata principale: un anno racconta gia' un andamento
  // senza schiacciare gli ultimi mesi contro il bordo.
  const [range, setRange] = useState<RangeKey>("1y");
  const [scrub, setScrub] = useState<number | null>(null);

  const [valueSheet, setValueSheet] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const [saving, setSaving] = useState(false);

  const isManual = position.asset.price_source === "manual";
  const stale =
    isManual &&
    (!position.priceDate || daysSince(position.priceDate) > MANUAL_PRICE_STALE_DAYS);

  function openValueSheet() {
    setValueInput(position.value > 0 ? String(position.value.toFixed(2)).replace(".", ",") : "");
    setValueSheet(true);
  }

  async function saveValue() {
    const parsed = parseAmountInput(valueInput);
    if (parsed === null) {
      Alert.alert("Valore non valido", "Inserisci un importo maggiore di zero.");
      return;
    }
    if (position.quantity <= 0) {
      Alert.alert(
        "Nessuna quota registrata",
        "Non risultano ancora versamenti su questo fondo."
      );
      return;
    }

    // Trade Republic mostra il valore totale della posizione, mai un prezzo
    // per quota: si chiede quello, e si ricava il prezzo dividendo per le
    // quote gia' possedute, cosi' il resto dell'app puo' continuare a
    // ragionare in quote*prezzo senza saperlo.
    const price = parsed / position.quantity;

    setSaving(true);
    const { error } = await supabase.from("asset_prices").upsert(
      {
        asset_id: position.asset.id,
        on_date: new Date().toISOString().slice(0, 10),
        close_eur: Number(price.toFixed(8)),
        source: "manual",
      },
      { onConflict: "asset_id,on_date" }
    );
    setSaving(false);

    if (error) {
      Alert.alert("Non salvato", error.message);
      return;
    }
    setValueSheet(false);
    onSaved();
  }

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
  const heroBasis = at ? at.invested_eur : position.investedBasis;
  const heroGain = at ? at.value_eur - at.invested_eur : position.gain;
  // Stessa formula dell'hero di Investimenti e del dettaglio di gruppo: qui
  // mancava del tutto, e c'era solo il guadagno in euro — che da solo non
  // dice se e' tanto o poco senza sapere quanto era stato versato.
  const heroPct = heroBasis > 0 ? heroGain / heroBasis : null;
  const amount = splitAmount(heroValue);
  const gainColor = heroGain >= 0 ? palette.investUp : palette.over;

  // Rendimento di questo solo titolo — mancava anche questo:
  // `priceGainPct`/`gainPct` dicono quanto ha reso *da quando l'hai
  // comprato*, non se e' tanto o poco per l'anno. Stessa formula di
  // `groupReturn`/`portfolioReturn`, ristretta a `position.asset.id`, e
  // sempre su `marketValue`: il denaro degli ordini in esecuzione non e'
  // ancora esposto al mercato, contarlo nel valore senza contarlo nei flussi
  // farebbe comparire un guadagno che non c'e'.
  const rendimento = useMemo(
    () => assetReturn(investments, position.asset.id, position.marketValue),
    [investments, position.asset.id, position.marketValue]
  );

  // Quanto pesa questa posizione sul totale investito: senza un riferimento,
  // il valore da solo non dice se e' una scommessa piccola o gran parte del
  // portafoglio.
  const weight =
    portfolioValue > 0 ? position.value / portfolioValue : null;

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
            {heroPct !== null && (
              <Text style={[styles.gain, { color: gainColor }]}>
                {heroGain >= 0 ? "+" : "−"}
                {Math.abs(heroPct * 100).toFixed(1)}%
              </Text>
            )}
            <Text style={[styles.heroMeta, { color: palette.ink3 }]}>
              {at ? formatDate(at.on_date) : "da inizio piano"}
            </Text>
          </View>
        </View>

        <View style={styles.chartBlock}>
          <ScrubChart
            points={points}
            color={palette.invest}
            onScrub={setScrub}
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
                    active && { backgroundColor: tint(palette.invest, dark) },
                  ]}
                >
                  <Text
                    style={[
                      styles.rangeLabel,
                      { color: active ? palette.invest : palette.ink3 },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stessi "quadratini" del dettaglio di gruppo e della schermata
            Investimenti: prima qui c'erano solo righe di testo, e mancavano
            del tutto il rendimento annualizzato e il peso sul portafoglio —
            l'unico modo di sapere se una posizione e' una scommessa piccola
            o gran parte di quello che possiedi. */}
        <StatTiles
          goodColor={palette.investUp}
          tiles={[
            ...(rendimento !== null ? [returnTile(rendimento)] : []),
            ...(weight !== null
              ? [{
                  label: "Peso nel portafoglio",
                  value: `${(weight * 100).toFixed(1)}%`,
                  hint: "quota sul valore totale investito",
                }]
              : []),
            ...(position.dividends > 0
              ? [{
                  label: "Dividendi incassati",
                  value: formatAmount(position.dividends),
                  hint: "fuori dal prezzo, gia' sul conto",
                  tone: "good" as const,
                }]
              : []),
            ...(position.pending > 0
              ? [{
                  label: "In esecuzione",
                  value: formatAmount(position.pending),
                  hint: "non ancora convertiti in quote",
                }]
              : []),
          ]}
        />

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
          {isManual && (
            <TouchableOpacity style={styles.updateRow} onPress={openValueSheet}>
              <Icon
                name={stale ? "circle-alert" : "pencil"}
                size={14}
                color={stale ? palette.over : palette.invest}
              />
              <Text
                style={[
                  styles.updateText,
                  { color: stale ? palette.over : palette.invest },
                ]}
              >
                {position.priceDate
                  ? `Aggiorna valore · fermo da ${daysSince(position.priceDate)} giorni`
                  : "Inserisci il valore attuale"}
              </Text>
            </TouchableOpacity>
          )}
          <Fact label="Capitale versato" value={formatAmount(position.invested)} />
          {position.sold > 0 && (
            <Fact label="Disinvestito" value={formatAmount(position.sold)} />
          )}
          {/* Dividendi e In esecuzione sono nei quadratini qui sopra; questa
              coppia resta come riga perche' e' un dettaglio in piu' del solo
              titolo, non uno dei numeri generali che si ripetono a ogni
              livello — il rendimento di prezzo e' quello che mostra il
              broker, ma su un titolo che distribuisce racconta meta' storia:
              le cedole escono dal prezzo e finiscono sul conto. */}
          {position.dividends > 0 && (
            <>
              <Fact
                label="Rendimento di prezzo"
                value={signedPct(position.priceGainPct)}
              />
              <Fact
                label="Rendimento totale"
                value={signedPct(position.gainPct)}
              />
            </>
          )}
          {position.fees > 0 && (
            <Fact label="Commissioni" value={formatAmount(position.fees)} />
          )}
        </View>

        {isManual && (
          <Text style={[styles.note, { color: palette.ink3 }]}>
            Questo fondo non ha un prezzo pubblico: nessuna fonte automatica
            esiste per un ELTIF cosi'. Il valore resta quello dell'ultimo
            versamento finche' non lo aggiorni tu da Trade Republic — "Aggiorna
            valore" qui sopra.
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
                  {op.status === "estimated" ? " · rata prevista" : ""}
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
                      op.kind === "buy" && op.status === "settled"
                        ? palette.ink
                        : op.kind === "buy"
                          ? palette.ink3
                          : palette.investUp,
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

      <Sheet
        visible={valueSheet}
        onClose={() => setValueSheet(false)}
        title="Aggiorna valore"
      >
        <Text style={[styles.sheetHint, { color: palette.ink3 }]}>
          Apri Trade Republic e guarda quanto vale oggi {position.asset.name}.
          Non un prezzo per quota — quello non lo mostra nemmeno TR per questo
          fondo — il valore totale della posizione, cosi' com'e' scritto li'.
        </Text>
        <TextInput
          value={valueInput}
          onChangeText={setValueInput}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          autoFocus
          style={[
            styles.input,
            {
              backgroundColor: palette.surface2,
              color: palette.ink,
              borderColor: palette.hairline,
            },
          ]}
        />
        <TouchableOpacity
          style={[styles.save, { backgroundColor: palette.invest }]}
          onPress={saveValue}
          disabled={saving}
        >
          <Text style={[styles.saveText, { color: palette.onAccent }]}>
            {saving ? "Salvo…" : "Salva"}
          </Text>
        </TouchableOpacity>
      </Sheet>
    </SwipeBack>
  );
}

function signedPct(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(2)}%`;
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
  updateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  updateText: { ...type.small, fontWeight: "500" },
  sheetHint: { ...type.caption, lineHeight: 18, marginBottom: space.md },
  input: {
    borderRadius: radius.field,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    ...type.body,
  },
  save: {
    marginTop: space.lg,
    paddingVertical: 14,
    borderRadius: radius.button,
    alignItems: "center",
  },
  saveText: { ...type.body, fontWeight: "500" },
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
