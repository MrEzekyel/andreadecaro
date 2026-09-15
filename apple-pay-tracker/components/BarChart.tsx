import React, { useRef, useState } from "react";
import { LayoutChangeEvent, ScrollView, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { Bucket } from "../lib/aggregate";
import { compactAmount } from "../lib/format";

/**
 * Larghezza di ripiego per il primo fotogramma, prima che `onLayout` abbia
 * detto quanto e' larga la scheda che ospita il grafico.
 */
const FALLBACK_WIDTH = 320;
/** Colonna riservata alle etichette dell'asse y. */
const GUTTER = 26;
/** Aria sopra le colonne, per i valori scritti sulle cime. */
const TOP = 16;
const PLOT_H = 100;
const BASE = TOP + PLOT_H;
const AXIS_H = 15;
const HEIGHT = BASE + AXIS_H;
const GAP = 4;
const RADIUS = 3;

type Props = {
  buckets: Bucket[];
  /** 'amount' disegna la spesa, 'count' il numero di transazioni. */
  metric: "amount" | "count";
  color: string;
  /** Chiave della colonna in evidenza; le altre restano smorzate. */
  selectedKey?: string | null;
  onSelect?: (bucket: Bucket) => void;
  /** Valore della linea tratteggiata di riferimento (media). */
  average?: number | null;
  /** Colore delle colonne sotto lo zero; serve solo ai grafici con negativi. */
  negativeColor?: string;
  /**
   * Larghezza voluta per colonna, quando il grafico ne ha una propria.
   *
   * Fa due cose, e servono entrambe. Se i periodi non ci stanno, il grafico
   * smette di comprimersi e scorre in orizzontale: oltre una decina di periodi
   * le etichette sotto le colonne si sovrappongono fino a diventare
   * illeggibili, e stringere le barre non risolve, sposta solo il problema.
   * Se invece ci stanno tutti, resta il **tetto** della colonna: lo spazio
   * avanzato diventa aria fra una colonna e l'altra, non barre piu' grasse.
   *
   * Il tetto e' arrivato dopo: senza, le settimane su iPad si spalmavano
   * comunque su tutta la scheda ed erano larghe il doppio delle mensili —
   * «le colonne dovevano rimanere strette» (Andrea). Chi non passa niente
   * (i mesi) continua a dividersi la larghezza per intero, com'e' sempre
   * stato.
   */
  minColumnWidth?: number;
};

/** Passo "tondo" piu' vicino a `raw`: 1, 2, 2.5 o 5 per decade. */
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function BarChart({
  buckets,
  metric,
  color,
  selectedKey,
  onSelect,
  average,
  negativeColor,
  minColumnWidth,
}: Props) {
  const { palette } = useTheme();

  /**
   * Larghezza vera del contenitore, non un valore fisso.
   *
   * Con il viewBox fermo a 320 il grafico non si allargava su una scheda piu'
   * larga: restava a grandezza naturale al centro, perche' con
   * `preserveAspectRatio` di default era l'altezza a decidere la scala.
   * Misurandola, il disegno resta in scala 1:1 e le colonne occupano tutto lo
   * spazio che hanno.
   */
  const [boxWidth, setBoxWidth] = useState(FALLBACK_WIDTH);
  const scroller = useRef<ScrollView>(null);

  const values = buckets.map((b) => (metric === "amount" ? b.total : b.count));
  const peak = Math.max(...values, 0);
  const trough = Math.min(...values, 0);

  // Con l'asse a valori tondi gli estremi del grafico sono le tacche, non i
  // valori osservati: altrimenti la colonna piu' alta tocca il bordo e le
  // tacche cadono a quote arbitrarie.
  const span = peak - trough;
  const rawStep = metric === "count" ? Math.max(span / 3, 1) : span / 3;
  const step =
    metric === "count" ? Math.max(1, Math.round(niceStep(rawStep))) : niceStep(rawStep);

  const chartMax = peak > 0 ? Math.ceil(peak / step) * step : 0;
  const chartMin = trough < 0 ? Math.floor(trough / step) * step : 0;
  // Con soli zeri servirebbe comunque un'altezza: una scala degenere
  // dividerebbe per zero.
  const range = chartMax - chartMin || step;

  const ticks: number[] = [];
  for (let value = chartMin; value <= chartMax + step / 100; value += step) {
    if (Math.abs(value) > step / 100) ticks.push(value);
  }

  // Scorrendo, l'asse dei valori esce dal disegno e viene ridisegnato fermo
  // accanto: se scorresse via anche lui le colonne resterebbero senza scala.
  const scorre =
    minColumnWidth != null &&
    GUTTER + buckets.length * minColumnWidth > boxWidth;
  const gutter = scorre ? 0 : GUTTER;
  const width = scorre ? buckets.length * minColumnWidth! : boxWidth;

  const plotWidth = width - gutter;
  // Ogni periodo ha la sua fetta di larghezza (`slot`) e la colonna ci sta
  // dentro centrata, lasciando il `GAP` come aria. Ragionare per fetta invece
  // che per "larghezza totale diviso il numero di barre" e' cio' che permette a
  // una colonna di essere piu' STRETTA della fetta che le tocca: quando c'e' un
  // `minColumnWidth` quella e' anche la larghezza massima, quindi lo spazio in
  // piu' allarga la distanza fra le colonne e non le colonne.
  const slot = plotWidth / Math.max(buckets.length, 1);
  const barWidth = Math.max(
    Math.min(slot - GAP, (minColumnWidth ?? Infinity) - GAP),
    2
  );
  const xOf = (index: number) => gutter + index * slot + (slot - barWidth) / 2;

  const yOf = (value: number) => BASE - ((value - chartMin) / range) * PLOT_H;
  /** Quota dello zero: coincide con la base finche' non ci sono negativi. */
  const zeroY = yOf(0);

  const averageY =
    average != null &&
    average !== 0 &&
    average >= chartMin &&
    average <= chartMax
      ? yOf(average)
      : null;

  const tickLabel = (value: number) =>
    metric === "amount" ? compactAmount(value) : String(Math.round(value));

  const disegno = (
    <Svg
        width={scorre ? width : "100%"}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
      >
        {ticks.map((value) => {
          const y = yOf(value);
          return (
            <React.Fragment key={`tick-${value}`}>
              <Line
                x1={gutter}
                y1={y}
                x2={width}
                y2={y}
                stroke={palette.hairline}
                strokeWidth={1}
                opacity={0.7}
              />
              <SvgText
                x={gutter - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={8}
                fill={palette.ink3}
              >
                {tickLabel(value)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Lo zero e' sempre marcato: con i negativi non e' piu' il fondo del
            grafico, ed e' la linea rispetto a cui si legge il segno. */}
        <Line
          x1={gutter}
          y1={zeroY}
          x2={width}
          y2={zeroY}
          stroke={palette.hairline}
          strokeWidth={1}
        />

        {buckets.map((bucket, index) => {
          const value = values[index];
          const x = xOf(index);
          const valueY = yOf(value);

          // Un periodo a zero resta visibile come traccia: distinguere
          // "niente speso" da "periodo assente" e' il punto del grafico.
          const drawn = Math.max(Math.abs(valueY - zeroY), 2);
          const negative = value < 0;
          const top = negative ? zeroY : zeroY - drawn;

          const selected = selectedKey == null || bucket.key === selectedKey;
          const label =
            metric === "amount"
              ? compactAmount(value)
              : value > 0
                ? String(value)
                : "";

          const fill =
            value === 0
              ? palette.hairline
              : negative
                ? negativeColor ?? palette.over
                : color;

          return (
            <React.Fragment key={bucket.key}>
              <Rect
                x={x}
                y={top}
                width={barWidth}
                height={drawn}
                rx={RADIUS}
                fill={fill}
                fillOpacity={value !== 0 && !selected ? 0.32 : 1}
              />

              {label !== "" && (
                <SvgText
                  x={x + barWidth / 2}
                  // Sopra le colonne positive, sotto quelle negative: dentro
                  // la colonna il testo sparirebbe sul proprio fondo.
                  y={negative ? top + drawn + 8 : top - 4}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight={bucket.key === selectedKey ? "600" : "400"}
                  fill={bucket.key === selectedKey ? palette.ink : palette.ink3}
                >
                  {label}
                </SvgText>
              )}

              <SvgText
                x={x + barWidth / 2}
                y={BASE + 11}
                textAnchor="middle"
                fontSize={8}
                fontWeight={bucket.key === selectedKey ? "600" : "400"}
                fill={bucket.key === selectedKey ? palette.ink : palette.ink3}
              >
                {bucket.label}
              </SvgText>

              {/* Bersaglio a tutta altezza e a tutta fetta, non largo quanto la
                  barra: la colonna da sola sarebbe impossibile da centrare
                  quando il valore e' basso, e da quando le settimane sono
                  strette 30 px una barra sarebbe anche troppo sottile per il
                  dito. L'aria fra due colonne appartiene a quella piu' vicina. */}
              {onSelect && (
                <Rect
                  x={gutter + index * slot}
                  y={0}
                  width={slot}
                  height={BASE + AXIS_H}
                  fill="transparent"
                  onPress={() => onSelect(bucket)}
                />
              )}
            </React.Fragment>
          );
        })}

        {averageY !== null && (
          <Line
            x1={gutter}
            y1={averageY}
            x2={width}
            y2={averageY}
            stroke={palette.limit}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.75}
          />
        )}
    </Svg>
  );

  const misura = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    // Il confronto evita il ciclo re-render -> layout -> re-render.
    if (measured > 0 && measured !== boxWidth) setBoxWidth(measured);
  };

  if (!scorre) return <View onLayout={misura}>{disegno}</View>;

  return (
    <View
      onLayout={misura}
      style={{ flexDirection: "row", alignItems: "flex-start" }}
    >
      {/* L'asse dei valori sta fuori dallo scorrimento: e' il riferimento
          rispetto a cui si leggono le colonne, e seguirle scivolando via lo
          renderebbe inutile proprio mentre serve. */}
      <Svg width={GUTTER} height={HEIGHT}>
        {ticks.map((value) => (
          <SvgText
            key={`axis-${value}`}
            x={GUTTER - 6}
            y={yOf(value) + 3}
            textAnchor="end"
            fontSize={8}
            fill={palette.ink3}
          >
            {tickLabel(value)}
          </SvgText>
        ))}
      </Svg>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Si parte dal periodo piu' recente: e' quello che si vuole vedere
        // aprendo la schermata, non il piu' vecchio.
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {disegno}
      </ScrollView>
    </View>
  );
}
