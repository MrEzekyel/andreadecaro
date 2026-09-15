import React, { useState } from "react";
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

/**
 * Larghezza di ripiego, usata solo per il primo fotogramma: dal secondo in poi
 * vale quella misurata. Serve perche' i punti si calcolano prima che
 * `onLayout` abbia detto quanto e' larga la scheda che ospita il grafico.
 */
const FALLBACK_WIDTH = 320;
/**
 * Rientro uguale a destra e a sinistra, non una colonna riservata all'asse y.
 *
 * Prima qui c'era `GUTTER = 34`: le etichette dei valori stavano in una colonna
 * loro, alla sinistra del disegno. Il grafico occupava tutta la larghezza della
 * scheda ma la linea cominciava 34 px piu' in dentro, quindi rispetto alla
 * scheda che lo contiene sembrava spostato a destra — la segnalazione di
 * Andrea, «avere i numeri dell'asse y sul lato lo rende decentrato».
 *
 * Fra le vie possibili — asse a destra, oppure un margine destro uguale al
 * gutter — si e' scelto di **sovrapporre le etichette al grafico**, appoggiate
 * sopra la propria linea di griglia a partire dal bordo sinistro. Le altre due
 * ricentrano il disegno pagandolo con 34 o 68 px di larghezza in meno, cioe'
 * togliendo spazio proprio alla parte che si guarda; questa non ne toglie
 * nemmeno uno, e i valori di riferimento sugli assi restano tutti (il design
 * system li richiede esplicitamente). E' anche il trattamento che l'etichetta
 * del limite ha gia' in questo stesso file, appoggiata sopra la sua retta in
 * alto a destra: ora le due si leggono allo stesso modo.
 *
 * Il rientro che resta e' minimo e simmetrico, e non serve all'asse: e' il
 * raggio del pallino di "dove sei adesso" (6,5 px), che sul bordo esatto
 * verrebbe tagliato a meta' dal viewBox.
 */
const EDGE = 7;
const TOP = 16;
// Grafico piu' alto (era 102): con piu' spazio verticale l'andamento si
// legge meglio, senza cambiare la tavolozza ne' il linguaggio visivo.
const PLOT_H = 150;
const BASE = TOP + PLOT_H;
const AXIS_H = 18;
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
  xTicks = 5,
  empty = "Servono almeno due giorni di spese per disegnare l'andamento.",
}: Props) {
  const { palette } = useTheme();

  /**
   * Il viewBox segue la larghezza vera del contenitore invece di restare
   * fisso a 320.
   *
   * Con un viewBox fisso e `preserveAspectRatio` di default, su una scheda
   * larga il grafico non si allargava: restava a grandezza naturale in mezzo
   * al vuoto, perche' l'altezza era il vincolo che decideva la scala. Ora il
   * viewBox coincide con la larghezza misurata, quindi il disegno e' sempre
   * in scala 1:1 — le etichette restano nitide alla loro dimensione vera e i
   * punti si distribuiscono su tutto lo spazio disponibile.
   */
  const [width, setWidth] = useState(FALLBACK_WIDTH);

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

  const plotWidth = Math.max(width - EDGE * 2, 1);
  const xOf = (index: number) =>
    EDGE + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const yOf = (value: number) => BASE - (value / chartMax) * PLOT_H;

  const coords = noti.map((p) => ({ x: xOf(p.index), y: yOf(p.value) }));

  const line = smoothPath(coords);
  const area = `${line} L ${coords[coords.length - 1].x},${BASE} L ${xOf(0)},${BASE} Z`;
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
    <View
      onLayout={(event) => {
        const measured = Math.round(event.nativeEvent.layout.width);
        // Il confronto evita il ciclo re-render -> layout -> re-render.
        if (measured > 0 && measured !== width) setWidth(measured);
      }}
    >
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
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
              {/* La griglia va da bordo a bordo: e' lei a dare al grafico la
                  larghezza piena della scheda, ora che non c'e' piu' una
                  colonna a sinistra a interromperla. */}
              <Line
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={palette.hairline}
                strokeWidth={1}
                opacity={0.7}
              />
              {/* Il valore sta SOPRA la sua linea di griglia, non accanto:
                  appoggiato li' resta attaccato alla riga che quota senza
                  coprirla, e nessuna quota puo' finire sotto il bordo del
                  disegno come succederebbe centrandola sulla linea. */}
              <SvgText
                x={0}
                y={y - 3}
                textAnchor="start"
                fontSize={9}
                fill={palette.ink3}
              >
                {compactAmount(value)}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line
          x1={0}
          y1={BASE}
          x2={width}
          y2={BASE}
          stroke={palette.hairline}
          strokeWidth={1}
        />

        {limitY !== null && (
          <>
            <Line
              x1={0}
              y1={limitY}
              x2={width}
              y2={limitY}
              stroke={palette.limit}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.65}
            />
            <SvgText
              x={width}
              y={Math.max(limitY - 5, 9)}
              textAnchor="end"
              fontSize={9}
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

        <Path d={area} fill="url(#trendFill)" />
        <Path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Punto finale evidenziato, come in ScrubChart: e' "dove sei
            adesso", il numero che conta di piu' su un grafico cumulato. */}
        <Circle cx={last.x} cy={last.y} r={6.5} fill={palette.surface} />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />

        {labelIndexes.map((index) => (
          <SvgText
            key={`x-${index}`}
            x={xOf(index)}
            y={BASE + 13}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize={9}
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
