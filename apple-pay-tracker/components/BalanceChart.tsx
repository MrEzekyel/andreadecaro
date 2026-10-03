import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount, formatAmount } from "../lib/format";
import { type } from "../lib/theme";
import { useChartZoom } from "../lib/useChartZoom";
import { ZoomReset } from "./ZoomReset";

/**
 * Larghezza di ripiego per il primo fotogramma, prima che `onLayout` abbia
 * detto quanto e' larga la scheda che ospita il grafico — stesso schema di
 * TrendChart/BarChart/MonthBars: con un viewBox fisso e `preserveAspectRatio`
 * di default e' l'altezza a decidere la scala, quindi su una scheda larga il
 * grafico restava a grandezza naturale invece di allargarsi.
 */
const FALLBACK_WIDTH = 320;
/** Fascia a sinistra per i valori dell'asse: senza, la scala resta indovinata. */
const PAD_L = 34;
const TOP = 20;
// Grafico piu' alto (era 96): l'andamento del saldo si legge meglio con piu'
// spazio verticale, senza cambiare colori ne' tipografia.
const PLOT_H = 148;
const BASE = TOP + PLOT_H;
const HEIGHT = BASE + 18;

/** Lunghezze provate per il filo dei costi fissi, dalla piu' corta. */
const LEADER_STEPS = [18, 30, 42, 54, 66];

type Box = { x1: number; y1: number; x2: number; y2: number };

/** Larghezza stimata di un'etichetta a corpo 9: basta a evitare gli urti. */
function textWidth(text: string) {
  return text.length * 5.3;
}

function textBox(
  text: string,
  x: number,
  baseline: number,
  anchor: "start" | "middle" | "end"
): Box {
  const w = textWidth(text);
  const x1 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { x1, y1: baseline - 9, x2: x1 + w, y2: baseline + 2 };
}

function overlaps(a: Box, b: Box) {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/** Se la spezzata del saldo attraversa il riquadro. */
function hitsLine(verts: { x: number; y: number }[], box: Box) {
  for (let i = 1; i < verts.length; i++) {
    const p = verts[i - 1];
    const q = verts[i];
    if (q.x < box.x1 || p.x > box.x2) continue;
    let yA = p.y;
    let yB = q.y;
    if (q.x > p.x) {
      const at = (x: number) => p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x);
      yA = at(Math.max(box.x1, p.x));
      yB = at(Math.min(box.x2, q.x));
    }
    if (Math.max(yA, yB) >= box.y1 && Math.min(yA, yB) <= box.y2) return true;
  }
  return false;
}

export type BalancePoint = {
  /** Giorno del mese, 1-based. */
  day: number;
  value: number;
  /**
   * Il punto piu' alto toccato quel giorno, se sopra al saldo di chiusura:
   * l'introito arrivato prima delle uscite dello stesso giorno. Senza, il
   * picco del mese spariva dentro il saldo di fine giornata.
   */
  high?: number;
  /** Introito arrivato quel giorno, se c'e': disegna il gradino in salita. */
  income?: number;
  /** Investito quel giorno: scende come una spesa, ma non e' speso. */
  invested?: number;
  /**
   * Quanto di quel giorno era un costo fisso (mutuo, rate), se c'e'.
   *
   * La linea scende comunque di tutto l'importo speso quel giorno — i costi
   * fissi sono spesa vera, non vanno tolti dal saldo — ma senza un segno
   * proprio una rata sembra una discesa qualunque fra le altre, e non si
   * capisce quanto del calo del mese fosse gia' impegnato dall'inizio.
   */
  fixedCost?: number;
};

type Props = {
  points: BalancePoint[];
  /** Giorni totali del mese, per dare al grafico la larghezza giusta. */
  days: number;
  empty?: string;
};

/**
 * Il saldo del mese giorno per giorno: sale quando entra qualcosa, scende a
 * ogni spesa e a ogni investimento.
 *
 * E' l'andamento delle spese rovesciato, ed e' l'unico grafico che risponde a
 * "quanto mi e' rimasto" senza far fare sottrazioni: la linea **e'** quello
 * che resta. Gli investimenti scendono come le spese perche' quei soldi dal
 * conto sono usciti davvero — tenerli fuori faceva dire alla linea che c'era
 * piu' denaro disponibile di quanto ce ne fosse, che e' l'unico verso in cui
 * un errore qui e' pericoloso.
 *
 * I gradini sono etichettati con l'importo: senza, una salita improvvisa
 * sembrerebbe un errore di lettura del grafico.
 */
export function BalanceChart({
  points,
  days,
  empty = "Registra un introito per vedere il saldo del mese.",
}: Props) {
  const { palette } = useTheme();

  /**
   * Il viewBox segue la larghezza vera del contenitore invece di restare
   * fisso — stesso motivo di TrendChart/BarChart: senza, su una scheda larga
   * (iPad, colonna destra) il grafico restava piccolo in mezzo al vuoto.
   */
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const zoom = useChartZoom({
    minSpan: Math.min(1, 3 / Math.max(days - 1, 1)),
    resetKey: `${days}:${points[0]?.day}:${points[points.length - 1]?.value}`,
  });

  if (points.length < 2) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const plotW = width - PAD_L;
  zoom.setPlot(PAD_L, plotW);
  const { start, end } = zoom.view;
  const viewSpan = end - start;
  const fracOf = (day: number) => (day - 1) / Math.max(days - 1, 1);
  const xOf = (day: number) => PAD_L + ((fracOf(day) - start) / viewSpan) * plotW;

  /**
   * I punti che contano per la scala: tutti a grafico intero, quelli dentro
   * la finestra (piu' un vicino per lato, da cui la linea entra ed esce)
   * quando si e' ingranditi.
   */
  let first = 0;
  let lastIdx = points.length - 1;
  if (zoom.zoomed) {
    const inside = points
      .map((p, i) => ({ f: fracOf(p.day), i }))
      .filter(({ f }) => f >= start && f <= end)
      .map(({ i }) => i);
    if (inside.length > 0) {
      first = Math.max(inside[0] - 1, 0);
      lastIdx = Math.min(inside[inside.length - 1] + 1, points.length - 1);
    } else {
      const after = points.findIndex((p) => fracOf(p.day) > end);
      lastIdx = after === -1 ? points.length - 1 : after;
      first = Math.max(lastIdx - 1, 0);
    }
  }
  const values = points
    .slice(first, lastIdx + 1)
    .flatMap((p) => (p.high !== undefined ? [p.value, p.high] : [p.value]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  /**
   * A grafico intero il fondo e' sempre lo zero (o il minimo vero, se il
   * saldo e' andato sotto): richiesta di Andrea, la linea deve dire quanto
   * resta rispetto a niente, non rispetto al punto piu' basso del mese.
   * Ingranditi la scala si adatta alla finestra, come nelle app di trading:
   * e' il motivo per cui si ingrandisce, vedere le piccole spese da vicino.
   */
  let floor: number;
  let peak: number;
  if (zoom.zoomed) {
    const pad = Math.max(hi - lo, 1) * 0.12;
    floor = lo >= 0 ? Math.max(lo - pad, 0) : lo - pad;
    peak = hi + pad;
  } else {
    floor = Math.min(0, lo);
    peak = Math.max(hi, 0);
  }
  const span = Math.max(peak - floor, 1);
  const yOf = (value: number) => BASE - ((value - floor) / span) * PLOT_H;

  const coords = points.map((p) => ({
    ...p,
    x: xOf(p.day),
    y: yOf(p.value),
    // Dove disegnare il pallino dell'introito: in cima al gradino, non al
    // saldo di chiusura che le uscite dello stesso giorno hanno gia' abbassato.
    yHigh: yOf(p.high ?? p.value),
  }));
  // Un giorno con un picco passa prima dalla cima e poi scende al saldo di
  // chiusura, cosi' la linea tocca davvero il massimo del mese.
  const verts = coords.flatMap((c) =>
    c.high !== undefined
      ? [{ x: c.x, y: c.yHigh }, { x: c.x, y: c.y }]
      : [{ x: c.x, y: c.y }]
  );
  const line = verts.map((v, i) => `${i === 0 ? "M" : "L"} ${v.x},${v.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L ${last.x},${BASE} L ${coords[0].x},${BASE} Z`;
  const visible = (x: number) => x >= PAD_L - 4 && x <= width + 4;

  const zeroY = floor < 0 ? yOf(0) : null;

  /** Tre riferimenti sull'asse: fondo, meta' e cima della scala vera. */
  const ticks = [floor, floor + span / 2, peak];

  /**
   * Le etichette dei costi fissi non stanno piu' attaccate al quadretto:
   * finivano sopra la linea o sopra altre etichette. Ora sono appese a un
   * filo, sopra o sotto secondo dove c'e' piu' spazio, e il filo si allunga
   * finche' l'etichetta non trova un posto libero — ne' sulla linea ne'
   * sopra un'altra scritta.
   */
  const boxes: Box[] = [];
  const incomeLabels = coords
    .filter((c) => c.income && c.income > 0 && visible(c.x))
    .map((c) => {
      const text = `+${compactAmount(c.income as number)}`;
      const right = c.x > width - 60;
      const x = Math.min(c.x + 5, width - 4);
      const y = Math.max(c.yHigh - 7, 10);
      boxes.push(textBox(text, x, y, right ? "end" : "start"));
      return { c, text, x, y, anchor: right ? ("end" as const) : ("start" as const) };
    });
  const investLabels = coords
    .filter((c) => c.invested && c.invested > 0 && visible(c.x))
    .map((c) => {
      const text = `−${compactAmount(c.invested as number)}`;
      const right = c.x > width - 60;
      const x = Math.min(c.x + 5, width - 4);
      const y = Math.min(c.y + 14, BASE - 2);
      boxes.push(textBox(text, x, y, right ? "end" : "start"));
      return { c, text, x, y, anchor: right ? ("end" as const) : ("start" as const) };
    });
  const fixedLabels = coords
    .filter((c) => c.fixedCost && c.fixedCost > 0 && visible(c.x))
    .map((c) => {
      const text = `−${compactAmount(c.fixedCost as number)} fisso`;
      const half = textWidth(text) / 2;
      const x = Math.min(Math.max(c.x, PAD_L + half), width - half);
      const preferUp = c.y - TOP > BASE - c.y;
      const dirs = preferUp ? (["up", "down"] as const) : (["down", "up"] as const);

      type Spot = { dir: "up" | "down"; ty: number; box: Box };
      const spots: Spot[] = [];
      for (const dir of dirs) {
        for (const len of LEADER_STEPS) {
          const ty = dir === "up" ? c.y - len : c.y + len + 9;
          const box = textBox(text, x, ty, "middle");
          if (box.y1 < 0 || box.y2 > BASE) continue;
          spots.push({ dir, ty, box });
        }
      }
      const free = (s: Spot) => !boxes.some((b) => overlaps(b, s.box));
      const spot =
        spots.find((s) => free(s) && !hitsLine(verts, s.box)) ??
        spots.find(free) ??
        spots[0] ?? {
          dir: "up" as const,
          ty: c.y - LEADER_STEPS[0],
          box: textBox(text, x, c.y - LEADER_STEPS[0], "middle"),
        };
      boxes.push(spot.box);
      const y1 = spot.dir === "up" ? c.y - 5 : c.y + 5;
      const y2 = spot.dir === "up" ? spot.ty + 3 : spot.ty - 10;
      return { c, text, x, ty: spot.ty, y1, y2 };
    });

  const firstDay = Math.round(start * (days - 1)) + 1;
  const lastDay = Math.round(end * (days - 1)) + 1;

  return (
    <View>
      <View
        onLayout={(event) => {
          const measured = Math.round(event.nativeEvent.layout.width);
          // Il confronto evita il ciclo re-render -> layout -> re-render.
          if (measured > 0 && measured !== width) setWidth(measured);
        }}
        {...zoom.containerProps}
      >
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette.good} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={palette.good} stopOpacity="0" />
          </LinearGradient>
          {/* Ingranditi, la linea continua oltre la finestra: la si taglia
              all'area di disegno, o passerebbe sopra ai valori dell'asse. */}
          <ClipPath id="balClip">
            <Rect x={PAD_L} y={0} width={plotW} height={BASE + 1} />
          </ClipPath>
        </Defs>

        {ticks.map((tick, index) => (
          <React.Fragment key={`t-${index}`}>
            <Line
              x1={PAD_L}
              y1={yOf(tick)}
              x2={width}
              y2={yOf(tick)}
              stroke={palette.hairline}
              strokeWidth={1}
              opacity={index === 0 ? 1 : 0.55}
            />
            <SvgText
              x={PAD_L - 7}
              // Il riferimento piu' basso sta sopra la sua riga e non sotto:
              // sotto finirebbe addosso ai giorni dell'asse orizzontale.
              y={index === 0 ? yOf(tick) - 4 : yOf(tick) + 3}
              textAnchor="end"
              fontSize={9}
              fill={palette.ink3}
            >
              {/* `compactAmount(0)` e' vuoto apposta — sulle barre uno zero
                  scritto e' rumore. Su un asse invece e' il riferimento che
                  dice dove sta il fondo, e va scritto. */}
              {tick === 0 ? "0" : compactAmount(tick)}
            </SvgText>
          </React.Fragment>
        ))}

        <G clipPath="url(#balClip)">
          {zeroY !== null && (
            <Line
              x1={PAD_L}
              y1={zeroY}
              x2={width}
              y2={zeroY}
              stroke={palette.over}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.7}
            />
          )}

          <Path d={area} fill="url(#balFill)" />
          <Path
            d={line}
            fill="none"
            stroke={palette.good}
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {incomeLabels.map(({ c, text, x, y, anchor }) => (
            <React.Fragment key={`in-${c.day}`}>
              <Circle cx={c.x} cy={c.yHigh} r={3.6} fill={palette.good} />
              <SvgText x={x} y={y} textAnchor={anchor} fontSize={9} fill={palette.good}>
                {text}
              </SvgText>
            </React.Fragment>
          ))}

          {investLabels.map(({ c, text, x, y, anchor }) => (
            <React.Fragment key={`inv-${c.day}`}>
              <Circle cx={c.x} cy={c.y} r={3.6} fill={palette.invest} />
              <SvgText x={x} y={y} textAnchor={anchor} fontSize={9} fill={palette.invest}>
                {text}
              </SvgText>
            </React.Fragment>
          ))}

          {/* I costi fissi scendono come qualunque altra spesa (mutuo e rate
              sono spesa vera, non vanno tolti dalla linea) ma prendono un
              segno diverso — un quadretto invece di un pallino, nello stesso
              ink neutro con cui SemiGauge segna i costi fissi qui in Home —
              e la loro etichetta e' appesa a un filo, cosi' fra tutte le
              altre discese si vede quale non e' una spesa nuova ma un
              impegno gia' preso dall'inizio del mese. */}
          {fixedLabels.map(({ c, text, x, ty, y1, y2 }) => (
            <React.Fragment key={`fix-${c.day}`}>
              <Line
                x1={c.x}
                y1={y1}
                x2={c.x}
                y2={y2}
                stroke={palette.ink3}
                strokeWidth={1}
                opacity={0.7}
              />
              <Rect
                x={c.x - 3.2}
                y={c.y - 3.2}
                width={6.4}
                height={6.4}
                rx={1.5}
                fill={palette.ink}
              />
              <SvgText x={x} y={ty} textAnchor="middle" fontSize={9} fill={palette.ink3}>
                {text}
              </SvgText>
            </React.Fragment>
          ))}

          {visible(last.x) && (
            <>
              <Circle cx={last.x} cy={last.y} r={6.5} fill={palette.ground} />
              <Circle cx={last.x} cy={last.y} r={4} fill={palette.good} />
            </>
          )}
        </G>

        <SvgText x={PAD_L} y={BASE + 13} fontSize={9} fill={palette.ink3}>
          {String(firstDay)}
        </SvgText>
        <SvgText
          x={width}
          y={BASE + 13}
          textAnchor="end"
          fontSize={9}
          fill={palette.ink3}
        >
          {String(lastDay)}
        </SvgText>
      </Svg>
      {zoom.zoomed && <ZoomReset onPress={zoom.reset} />}
      </View>

      <View style={styles.footRow}>
        <Text style={[styles.foot, { color: palette.ink2 }]}>
          Oggi ti restano{" "}
          <Text style={{ color: palette.good, fontWeight: "600" }}>
            {formatAmount(points[points.length - 1].value)}
          </Text>
          , al netto di spese e investimenti
        </Text>

        {/* Legenda solo per il segno che da solo non si spiega — il pallino
            verde/azzurro dell'introito/investimento e' gia' accanto al suo
            importo, il quadretto dei costi fissi lo stesso, ma il colore
            (ink) e' condiviso con altro testo del grafico: un campione qui
            toglie ogni dubbio, come gia' fa la legenda dei costi fissi sotto
            il semicerchio Uscite. */}
        {coords.some((c) => c.fixedCost && c.fixedCost > 0) && (
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: palette.ink }]} />
            <Text style={[styles.legendText, { color: palette.ink3 }]}>
              costi fissi
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, lineHeight: 19 },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  foot: { ...type.caption, flexShrink: 1, fontVariant: ["tabular-nums"] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 7, height: 7, borderRadius: 1.5 },
  legendText: { ...type.small, fontSize: 10 },
});
