import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { compactAmount, formatAmount } from "../lib/format";
import { type } from "../lib/theme";

const WIDTH = 320;
/** Colonna riservata alle etichette dell'asse y. */
const GUTTER = 30;
const TOP = 10;
const PLOT_H = 102;
const BASE = TOP + PLOT_H;
const AXIS_H = 15;
const HEIGHT = BASE + AXIS_H;

export type TrendPoint = {
  /** Etichetta sull'asse x: giorno del mese, mese, quello che serve. */
  label: string;
  /**
   * Valore cumulato a quel punto, `null` per i periodi non ancora arrivati.
   *
   * I punti futuri vanno passati lo stesso: sono loro a dare al grafico la
   * larghezza del mese intero. Senza, i giorni trascorsi si stiracchiano su
   * tutta la larghezza e il 7 del mese sembra gia' la fine — la linea deve
   * fermarsi dov'e' oggi e toccare il bordo destro solo all'ultimo giorno.
   */
  value: number | null;
};

type Props = {
  points: TrendPoint[];
  /** Limite di spesa da tracciare come riferimento, se ce n'e' uno. */
  limit?: number | null;
  /**
   * Come chiamare quella soglia, quando non e' un limite di spesa.
   *
   * Da quando esiste l'obiettivo di risparmio la retta puo' segnare un tetto
   * **derivato** (entrate meno obiettivo) invece di un limite impostato a
   * mano: chiamarlo "LIMITE" manderebbe a cercare in Limiti una riga che non
   * c'e'.
   */
  limitLabel?: string;
  /**
   * Valore da cui parte davvero la linea il primo giorno, se non e' zero.
   *
   * Quando i costi fissi restano nella linea, questa non parte da zero ma
   * gia' dal loro totale (mutuo e rate sono un impegno certo fin dall'inizio
   * del periodo). La retta di ritmo deve saperlo: confrontare un ritmo che
   * parte da zero con una linea che parte piu' in alto farebbe sembrare
   * l'utente sempre indietro, quando in realta' sta solo partendo da dove
   * i costi fissi lo hanno gia' messo.
   */
  baseline?: number;
  color: string;
  /**
   * Indici (0-based, come `points`) in cui inizia una nuova settimana —
   * il lunedi' di ogni settimana del periodo mostrato, tranne il primo
   * giorno del grafico stesso. Servono a disegnare il limite settimanale
   * sul totale, che altrimenti non avrebbe modo di comparire: un limite
   * settimanale non e' un'unica soglia fissa su un grafico mensile
   * cumulato, ma si rinnova ogni sette giorni.
   */
  weekBoundaries?: number[];
  /** Importo del limite settimanale sul totale, per l'etichetta. */
  weeklyLimit?: number | null;
  /** Quante etichette mostrare sull'asse x, estremi compresi. */
  xTicks?: number;
  empty?: string;
};

/** Passo "tondo" piu' vicino a `raw`: 1, 2, 5 per decade. */
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Curva morbida che passa per tutti i punti. I punti di controllo stanno a un
 * terzo dell'intervallo orizzontale: e' il compromesso usuale fra morbidezza
 * e fedelta' al dato.
 */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const third = (current.x - previous.x) / 3;
    d += ` C ${previous.x + third},${previous.y} ${current.x - third},${current.y} ${current.x},${current.y}`;
  }
  return d;
}

/**
 * Andamento cumulato con assi leggibili.
 *
 * Una spezzata senza riferimenti dice solo "sale": le tacche sull'asse y e le
 * date intermedie sull'asse x sono cio' che la rende misurabile.
 */
export function TrendChart({
  points,
  limit,
  limitLabel = "LIMITE",
  baseline = 0,
  color,
  weekBoundaries = [],
  weeklyLimit,
  xTicks = 5,
  empty = "Servono almeno due giorni di spese per disegnare l'andamento.",
}: Props) {
  const { palette } = useTheme();

  // Indice originale conservato: e' quello che posiziona il punto sull'asse
  // del mese intero, non la sua posizione fra i soli giorni gia' trascorsi.
  const noti = points
    .map((point, index) => ({ index, value: point.value }))
    .filter((p): p is { index: number; value: number } => p.value !== null);

  if (noti.length < 2) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const peak = Math.max(...noti.map((p) => p.value), limit ?? 0);
  const step = niceStep(Math.max(peak, 1) / 3);
  const chartMax = peak > 0 ? Math.ceil(peak / step) * step : step;

  const yTicks: number[] = [];
  for (let value = step; value <= chartMax + step / 100; value += step) {
    yTicks.push(value);
  }

  const plotWidth = WIDTH - GUTTER;
  const xOf = (index: number) =>
    GUTTER + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const yOf = (value: number) => BASE - (value / chartMax) * PLOT_H;

  const coords = noti.map((p) => ({ x: xOf(p.index), y: yOf(p.value) }));

  const line = smoothPath(coords);
  const area = `${line} L ${coords[coords.length - 1].x},${BASE} L ${GUTTER},${BASE} Z`;
  const last = coords[coords.length - 1];

  // Etichette x equidistanti, estremi inclusi: con una al giorno si
  // sovrapporrebbero, con due sole non si leggerebbe l'andamento nel mezzo.
  const labelCount = Math.min(xTicks, points.length);
  const labelIndexes = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / Math.max(labelCount - 1, 1)) * (points.length - 1))
  );

  const limitY =
    limit != null && limit > 0 && limit <= chartMax ? yOf(limit) : null;

  // Ritmo lineare: se da qui in poi si spendesse lo stesso importo ogni
  // giorno, si arriverebbe al limite esattamente l'ultimo giorno. Parte da
  // `baseline` e non da zero: se la linea gia' parte piu' in alto (i costi
  // fissi contati dal primo giorno), un ritmo che partisse da zero
  // farebbe sembrare l'utente sempre indietro rispetto a un riferimento che
  // non descrive la sua situazione vera. E' una retta sopra tutto il periodo
  // intero e non solo i giorni gia' trascorsi, altrimenti non sarebbe un
  // riferimento fisso ma si sposterebbe ogni giorno.
  const paceLine =
    limitY !== null
      ? { x1: xOf(0), y1: yOf(baseline), x2: xOf(points.length - 1), y2: limitY }
      : null;

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yTicks.map((value) => {
          const y = yOf(value);
          return (
            <React.Fragment key={`y-${value}`}>
              <Line
                x1={GUTTER}
                y1={y}
                x2={WIDTH}
                y2={y}
                stroke={palette.hairline}
                strokeWidth={1}
                opacity={0.7}
              />
              <SvgText
                x={GUTTER - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={8}
                fill={palette.ink3}
              >
                {compactAmount(value)}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line
          x1={GUTTER}
          y1={BASE}
          x2={WIDTH}
          y2={BASE}
          stroke={palette.hairline}
          strokeWidth={1}
        />

        {limitY !== null && (
          <>
            <Line
              x1={GUTTER}
              y1={limitY}
              x2={WIDTH}
              y2={limitY}
              stroke={palette.limit}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.65}
            />
            <SvgText
              x={WIDTH}
              y={Math.max(limitY - 4, 8)}
              textAnchor="end"
              fontSize={8}
              fill={palette.limit}
            >
              {`${limitLabel} ${formatAmount(limit as number)}`}
            </SvgText>
          </>
        )}

        {paceLine !== null && (
          <Line
            x1={paceLine.x1}
            y1={paceLine.y1}
            x2={paceLine.x2}
            y2={paceLine.y2}
            stroke={palette.limit}
            strokeWidth={1}
            strokeDasharray="1 3"
            strokeLinecap="round"
            opacity={0.5}
          />
        )}

        {/* Il limite settimanale non e' una soglia sola come quello mensile:
            si rinnova ogni lunedi', quindi diventa una linea verticale a
            ogni inizio settimana invece di una orizzontale — verticale e
            ambra apposta, per non confondersi con la soglia mensile
            (orizzontale, tratteggio piu' largo) o con il ritmo (diagonale). */}
        {weekBoundaries.map((index) => (
          <Line
            key={`week-${index}`}
            x1={xOf(index)}
            y1={TOP}
            x2={xOf(index)}
            y2={BASE}
            stroke={palette.warn}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            opacity={0.55}
          />
        ))}
        {weekBoundaries.length > 0 && weeklyLimit != null && weeklyLimit > 0 && (
          <SvgText
            x={xOf(weekBoundaries[0]) + 4}
            y={TOP + 8}
            fontSize={8}
            fill={palette.warn}
          >
            {`SETT. ${formatAmount(weeklyLimit)}`}
          </SvgText>
        )}

        <Path d={area} fill="url(#trendFill)" />
        <Path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={last.x} cy={last.y} r={5} fill={palette.surface} />
        <Circle cx={last.x} cy={last.y} r={3.2} fill={color} />

        {labelIndexes.map((index) => (
          <SvgText
            key={`x-${index}`}
            x={xOf(index)}
            y={BASE + 11}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize={8}
            fill={palette.ink3}
          >
            {points[index].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, lineHeight: 19 },
});
