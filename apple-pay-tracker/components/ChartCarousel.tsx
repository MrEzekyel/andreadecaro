import React, { useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

export type ChartPage = {
  key: string;
  title: string;
  subtitle?: string;
  /** Comandi allineati a destra nell'intestazione: il selettore W/M, la media. */
  aside?: React.ReactNode;
  content: React.ReactNode;
  /** Reso sotto la scheda, fuori dal riquadro. */
  footer?: React.ReactNode;
};

type Props = {
  pages: ChartPage[];
  /**
   * @deprecated Non serve piu' e viene ignorato: la larghezza della pagina non
   * si deduce piu' dalla finestra meno i margini, si misura. Resta accettato
   * solo per non rompere un chiamante che lo passi ancora.
   */
  horizontalPadding?: number;
};

/**
 * Carosello a scorrimento laterale con una pagina per grafico.
 *
 * La pagina e' larga quanto il **contenitore**, misurato con `onLayout`, non
 * quanto la finestra meno i margini della schermata. Era la seconda cosa: su
 * iPad in orizzontale, con il rail a sinistra e la Home a due colonne, il
 * carosello vive dentro una colonna molto piu' stretta dello schermo — ogni
 * pagina veniva disegnata larga quanto lo schermo intero, sbordava a destra e
 * `snapToInterval` agganciava su un passo che non era quello vero: per vedere
 * un grafico per intero bisognava scorrerlo, mentre lo scorrimento qui deve
 * servire solo a cambiare pagina.
 *
 * E' lo stesso schema di `TrendChart`, `BarChart` e `MonthBars`, guardrail
 * compreso: il confronto prima di `setState` evita il ciclo re-render →
 * layout → re-render. Finche' la misura non c'e' non si disegna nessuna
 * pagina, perche' una pagina di larghezza sbagliata al primo fotogramma
 * lascerebbe il carosello agganciato male finche' non lo si tocca.
 */
export function ChartCarousel({ pages }: Props) {
  const { palette } = useTheme();
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);

  function misura(event: LayoutChangeEvent) {
    const measured = Math.round(event.nativeEvent.layout.width);
    if (measured > 0 && measured !== pageWidth) setPageWidth(measured);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(next);
  }

  return (
    <View style={styles.wrap} onLayout={misura}>
      {pageWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageWidth}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {pages.map((page) => (
            <View key={page.key} style={{ width: pageWidth }}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <View style={styles.head}>
                  <View style={styles.heading}>
                    <Text style={[styles.title, { color: palette.ink }]}>
                      {page.title}
                    </Text>
                    {page.subtitle && (
                      <Text style={[styles.subtitle, { color: palette.ink3 }]}>
                        {page.subtitle}
                      </Text>
                    )}
                  </View>
                  {page.aside}
                </View>

                {page.content}
              </View>

              {page.footer}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.dots}>
        {pages.map((page, i) => (
          <View
            key={page.key}
            style={[
              styles.dot,
              {
                backgroundColor: i === index ? palette.accent : palette.hairline,
                width: i === index ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
    marginRight: space.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  heading: { flex: 1 },
  title: { ...type.bodyMedium, fontSize: 12.5 },
  subtitle: { ...type.small, marginTop: 2 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { height: 6, borderRadius: 3 },
});
