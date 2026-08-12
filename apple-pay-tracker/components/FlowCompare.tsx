import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, type } from "../lib/theme";

type Props = {
  income: number;
  spent: number;
  invested: number;
};

type Segment = { value: number; color: string };

/**
 * Introiti contro uscite su una scala sola.
 *
 * La lunghezza **e'** la grandezza: le due barre condividono lo stesso fondo
 * scala, che vale quanto il maggiore fra introiti e uscite. Se entrano 2000 e
 * ne escono 1000, la barra delle uscite e' lunga la meta'; se ne escono 4000,
 * e' quella degli introiti a essere lunga la meta'. Non c'e' niente da
 * leggere per capire chi vince.
 *
 * Le uscite sono spese **piu'** investimenti, disegnati come due tratti
 * consecutivi sulla stessa barra: l'investito riparte esattamente da dove
 * finisce lo speso, quindi la punta della barra e' l'impatto totale di
 * quello che esce, e la distanza fra le due punte e' quello che avanza — uno
 * spazio da guardare, non un numero da calcolare.
 *
 * Volutamente senza curve: un Sankey vero e un nastro con la piega sono stati
 * provati entrambi e scartati — belli da soli, ma o perdevano il confronto
 * di lunghezza (la grandezza finiva nello spessore) o restavano troppo
 * decorativi per una scheda che deve leggersi in un secondo. Restano solo il
 * riempimento traslucido e la punta piena, sopra due barre dritte.
 */
export function FlowCompare({ income, spent, invested }: Props) {
  const { palette } = useTheme();

  const outflow = spent + invested;
  const gap = income - outflow;
  const scale = Math.max(income, outflow, 1);
  const pct = (value: number): `${number}%` =>
    `${Math.max((value / scale) * 100, 0)}%`;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.key, { color: palette.ink3 }]}>INTROITI</Text>
        <Text style={[styles.val, { color: palette.ink2 }]}>
          {formatAmount(income)}
        </Text>
      </View>
      <Bar segments={[{ value: income, color: palette.good }]} pct={pct} />

      <View style={[styles.row, { marginTop: 9 }]}>
        <Text style={[styles.key, { color: palette.ink3 }]}>USCITE</Text>
        <Text style={[styles.val, { color: palette.ink2 }]}>
          {formatAmount(outflow)}
        </Text>
      </View>
      <Bar
        segments={[
          { value: spent, color: palette.accent },
          { value: invested, color: palette.invest },
        ]}
        pct={pct}
      />

      {/* Il numero sotto non ripete le barre: dice il verso del divario, che
          e' l'unica cosa che le lunghezze da sole non distinguono a colpo
          d'occhio quando sono quasi uguali. */}
      <Text
        style={[styles.gap, { color: gap >= 0 ? palette.good : palette.over }]}
      >
        {gap >= 0
          ? `Avanzano ${formatAmount(gap)}`
          : `Mancano ${formatAmount(-gap)}`}
      </Text>

      {/* Importi per intero e non abbreviati: "1,4k €" al posto di 1.364,34 €
          nasconde piu' di sessanta euro dentro un arrotondamento, ed e' la
          scheda che dovrebbe dire dove sono finiti i soldi. */}
      <View style={styles.legend}>
        <Legend color={palette.accent} label="Speso" value={spent} />
        {invested > 0 && (
          <Legend color={palette.invest} label="Investito" value={invested} />
        )}
      </View>
    </View>
  );
}

/**
 * Una barra dritta, i cui segmenti condividono il fondo traslucido e si
 * susseguono senza spazio fra loro. Solo l'ultimo segmento con valore vero
 * porta la punta piena: e' il segno che si guarda per confrontare le due
 * lunghezze, e traslucido si perderebbe.
 */
function Bar({
  segments,
  pct,
}: {
  segments: Segment[];
  pct: (value: number) => `${number}%`;
}) {
  const { palette } = useTheme();
  const drawn = segments.filter((segment) => segment.value > 0);
  const last = drawn[drawn.length - 1];
  const cumulative = drawn.reduce((sum, s) => sum + s.value, 0);

  return (
    <View style={[styles.track, { backgroundColor: palette.hairline }]}>
      <View style={styles.stack}>
        {drawn.map((segment, index) => (
          <View
            key={index}
            style={[
              styles.fill,
              { width: pct(segment.value), backgroundColor: segment.color, opacity: 0.45 },
            ]}
          />
        ))}
      </View>
      {last && (
        <View
          style={[
            styles.cap,
            { left: pct(cumulative), backgroundColor: last.color },
          ]}
        />
      )}
    </View>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendName, { color: palette.ink3 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.legendVal, { color: palette.ink2 }]}>
        {formatAmount(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  key: { fontSize: 9, fontWeight: "600", letterSpacing: 0.8 },
  val: { ...type.small, fontSize: 10.5, fontVariant: ["tabular-nums"] },
  track: {
    height: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: 4,
  },
  stack: { flexDirection: "row", height: 10 },
  fill: { height: 10 },
  cap: {
    position: "absolute",
    top: 0,
    width: 2.5,
    height: 10,
    marginLeft: -2.5,
  },
  gap: {
    ...type.small,
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 9,
    fontVariant: ["tabular-nums"],
  },
  legend: { marginTop: 6, gap: 3 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  legendName: { fontSize: 9.5, flex: 1 },
  legendVal: { fontSize: 9.5, fontVariant: ["tabular-nums"] },
});
