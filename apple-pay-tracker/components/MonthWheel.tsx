import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { monthShort } from "../lib/format";
import { type } from "../lib/theme";

const ITEM_W = 104;
const HEIGHT = 40;

type Props = {
  /** Mesi in ordine crescente; l'ultimo e' il piu' recente. */
  months: Date[];
  /** Indice del mese selezionato dentro `months`. */
  value: number;
  onChange: (index: number) => void;
};

/**
 * Selettore del mese a ruota.
 *
 * Lo scorrimento e' continuo e legato al dito: opacita', scala e un leggero
 * abbassamento verso i lati sono interpolati sulla posizione esatta, non
 * commutati a scatti sull'elemento attivo. E' quello che da' l'impressione
 * della ghiera curva invece che di una lista che salta da una voce all'altra.
 */
export function MonthWheel({ months, value, onChange }: Props) {
  const { palette } = useTheme();
  const scrollX = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const positioned = useRef(false);

  const sidePad = width > 0 ? Math.max((width - ITEM_W) / 2, 0) : 0;

  // Il primo posizionamento avviene senza animazione (la ghiera deve aprirsi
  // gia' sul mese giusto, non farlo vedere e poi correggersi); i successivi
  // — per esempio quando si tocca una colonna del grafico — scorrono invece
  // in modo visibile. `useLayoutEffect` per evitare anche solo un fotogramma
  // nella posizione sbagliata.
  useLayoutEffect(() => {
    if (width === 0) return;
    const animated = positioned.current;
    positioned.current = true;
    const offset = value * ITEM_W;

    // scrollX guida opacita' e scala, ma si aggiorna solo tramite onScroll —
    // che uno scorrimento programmatico non emette in modo affidabile. Senza
    // allinearlo a mano la ghiera finisce nella posizione giusta ma illumina
    // la voce sbagliata (era il "mostra luglio ma si illumina maggio").
    scrollX.setValue(offset);
    ref.current?.scrollTo({ x: offset, animated });
  }, [value, width, scrollX]);

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_W);
    const clamped = Math.min(Math.max(index, 0), months.length - 1);
    if (clamped !== value) onChange(clamped);
  }

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {width > 0 && (
        // `ScrollView` e non `FlatList`: la ghiera copre al piu' qualche
        // decina di mesi, non ha bisogno di virtualizzazione, e un
        // `Animated.FlatList` orizzontale annidato in un carosello
        // orizzontale (`ChartCarousel`, stessa orientazione) e' esattamente
        // il caso che React Native avvisa di non fare — "VirtualizedLists
        // should never be nested inside plain ScrollViews with the same
        // orientation" — perche' puo' rompere il windowing di entrambi.
        <Animated.ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: sidePad }}
          onMomentumScrollEnd={onMomentumEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {months.map((month, index) => {
            const distance = Animated.divide(
              Animated.subtract(scrollX, index * ITEM_W),
              ITEM_W
            );

            const range = [-2, -1, 0, 1, 2];
            const opacity = distance.interpolate({
              inputRange: range,
              outputRange: [0.18, 0.45, 1, 0.45, 0.18],
              extrapolate: "clamp",
            });
            const scale = distance.interpolate({
              inputRange: range,
              outputRange: [0.78, 0.88, 1, 0.88, 0.78],
              extrapolate: "clamp",
            });
            // L'abbassamento ai lati e' cio' che curva la ghiera: le voci
            // lontane scendono come su un arco che si allontana.
            const translateY = distance.interpolate({
              inputRange: range,
              outputRange: [9, 4, 0, 4, 9],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={month.getTime()}
                style={[
                  styles.item,
                  { opacity, transform: [{ scale }, { translateY }] },
                ]}
              >
                <Animated.Text
                  style={[styles.label, { color: palette.ink }]}
                  numberOfLines={1}
                >
                  {monthShort(month)}
                </Animated.Text>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    width: ITEM_W,
    height: HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { ...type.bodyMedium, fontSize: 13.5 },
});
