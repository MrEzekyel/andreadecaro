import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
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

const WIDTH = 320;
/** Fascia a sinistra per i valori dell'asse: senza, la scala resta indovinata. */
const PAD_L = 30;
const TOP = 16;
const PLOT_H = 96;
const BASE = TOP + PLOT_H;
const HEIGHT = BASE + 15;

export type BalancePoint = {
  /** Giorno del mese, 1-based. */
  day: number;
  value: number;
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

  if (points.length < 2) {
    return <Text style={[styles.empty, { color: palette.ink3 }]}>{empty}</Text>;
  }

  const values = points.map((p) => p.value);
  const trueMax = Math.max(...values, 0);
  const trueMin = Math.min(...values);
  /**
   * Il fondo scende sotto zero SOLO se il saldo ci e' andato davvero (nota di
   * design invariata): quando resta sempre positivo il fondo segue il minimo
   * vero, non piu' sempre zero.
   *
   * Forzare lo zero come fondo scala anche quando il saldo non ci si avvicina
   * mai schiaccia le variazioni vere in una fascia minuscola: un introito
   * grande il giorno 1 (es. lo stipendio) porta subito il saldo in alto, e da
   * li' in poi tutta la spesa del mese — la parte che si vuole davvero
   * leggere — si muoveva in una fascia stretta vicino alla cima di una scala
   * alta il triplo di quanto serve. Il margine sotto al minimo vero (15%
   * dello scarto osservato) lascia respiro alla linea senza inventare un
   * fondo scala che i dati non giustificano.
   */
  const cushion = Math.max(trueMax - trueMin, 1) * 0.15;
  const floor = trueMin < 0 ? trueMin : Math.max(0, trueMin - cushion);
  const peak = trueMax;
  const span = Math.max(peak - floor, 1);

  const plotW = WIDTH - PAD_L;
  const xOf = (day: number) =>
    PAD_L + ((day - 1) / Math.max(days - 1, 1)) * plotW;
  const yOf = (value: number) => BASE - ((value - floor) / span) * PLOT_H;

  const coords = points.map((p) => ({ ...p, x: xOf(p.day), y: yOf(p.value) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L ${last.x},${BASE} L ${coords[0].x},${BASE} Z`;

  const zeroY = floor < 0 ? yOf(0) : null;

  /** Tre riferimenti sull'asse: fondo, meta' e cima della scala vera. */
  const ticks = [floor, floor + span / 2, peak];

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette.good} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={palette.good} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {ticks.map((tick, index) => (
          <React.Fragment key={`t-${index}`}>
            <Line
              x1={PAD_L}
              y1={yOf(tick)}
              x2={WIDTH}
              y2={yOf(tick)}
              stroke={palette.hairline}
              strokeWidth={1}
              opacity={index === 0 ? 1 : 0.55}
            />
            <SvgText
              x={PAD_L - 4}
              // Il riferimento piu' basso sta sopra la sua riga e non sotto:
              // sotto finirebbe addosso ai giorni dell'asse orizzontale.
              y={index === 0 ? yOf(tick) - 3 : yOf(tick) + 3}
              textAnchor="end"
              fontSize={8}
              fill={palette.ink3}
            >
              {/* `compactAmount(0)` e' vuoto apposta — sulle barre uno zero
                  scritto e' rumore. Su un asse invece e' il riferimento che
                  dice dove sta il fondo, e va scritto. */}
              {tick === 0 ? "0" : compactAmount(tick)}
            </SvgText>
          </React.Fragment>
        ))}

        {zeroY !== null && (
          <Line
            x1={PAD_L}
            y1={zeroY}
            x2={WIDTH}
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
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords
          .filter((c) => c.income && c.income > 0)
          .map((c) => (
            <React.Fragment key={`in-${c.day}`}>
              <Circle cx={c.x} cy={c.y} r={3.4} fill={palette.good} />
              <SvgText
                x={Math.min(c.x + 4, WIDTH - 4)}
                y={Math.max(c.y - 6, 9)}
                textAnchor={c.x > WIDTH - 50 ? "end" : "start"}
                fontSize={8}
                fill={palette.good}
              >
                {`+${compactAmount(c.income as number)}`}
              </SvgText>
            </React.Fragment>
          ))}

        {coords
          .filter((c) => c.invested && c.invested > 0)
          .map((c) => (
            <React.Fragment key={`inv-${c.day}`}>
              <Circle cx={c.x} cy={c.y} r={3.4} fill={palette.invest} />
              <SvgText
                x={Math.min(c.x + 4, WIDTH - 4)}
                y={Math.min(c.y + 12, BASE - 2)}
                textAnchor={c.x > WIDTH - 50 ? "end" : "start"}
                fontSize={8}
                fill={palette.invest}
              >
                {`−${compactAmount(c.invested as number)}`}
              </SvgText>
            </React.Fragment>
          ))}

        {/* I costi fissi scendono come qualunque altra spesa (mutuo e rate
            sono spesa vera, non vanno tolti dalla linea) ma prendono un
            segno diverso — un quadretto invece di un pallino, nello stesso
            ink neutro con cui SemiGauge segna i costi fissi qui in Home —
            cosi' fra tutte le altre discese si vede quale non e' una spesa
            nuova ma un impegno gia' preso dall'inizio del mese. */}
        {coords
          .filter((c) => c.fixedCost && c.fixedCost > 0)
          .map((c) => (
            <React.Fragment key={`fix-${c.day}`}>
              <Rect
                x={c.x - 3.2}
                y={c.y - 3.2}
                width={6.4}
                height={6.4}
                rx={1.5}
                fill={palette.ink}
              />
              <SvgText
                x={Math.min(c.x + 4, WIDTH - 4)}
                y={Math.min(c.y + 18, BASE - 2)}
                textAnchor={c.x > WIDTH - 50 ? "end" : "start"}
                fontSize={8}
                fill={palette.ink3}
              >
                {`−${compactAmount(c.fixedCost as number)} fisso`}
              </SvgText>
            </React.Fragment>
          ))}

        <Circle cx={last.x} cy={last.y} r={5} fill={palette.ground} />
        <Circle cx={last.x} cy={last.y} r={3.4} fill={palette.good} />

        <SvgText x={PAD_L} y={BASE + 11} fontSize={8} fill={palette.ink3}>
          1
        </SvgText>
        <SvgText
          x={WIDTH}
          y={BASE + 11}
          textAnchor="end"
          fontSize={8}
          fill={palette.ink3}
        >
          {String(days)}
        </SvgText>
      </Svg>

      <View style={styles.footRow}>
        <Text style={[styles.foot, { color: palette.ink2 }]}>
          Oggi ti restano{" "}
          <Text style={{ color: palette.good, fontWeight: "600" }}>
            {formatAmount(last.value)}
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
