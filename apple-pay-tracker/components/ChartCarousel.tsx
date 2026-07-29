import React, { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  /** Margine orizzontale della schermata, per calcolare la larghezza pagina. */
  horizontalPadding?: number;
};

/**
 * Carosello a scorrimento laterale con una pagina per grafico.
 *
 * La larghezza pagina si calcola dalla finestra invece di essere fissa,
 * altrimenti l'aggancio (`snapToInterval`) sbaglia di qualche pixel a ogni
 * pagina e il carosello si disallinea scorrendo.
 */
export function ChartCarousel({ pages, horizontalPadding = 16 }: Props) {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const pageWidth = width - horizontalPadding * 2;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(next);
  }

  return (
    <View style={styles.wrap}>
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
