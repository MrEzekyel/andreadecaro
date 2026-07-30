import React, { useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

/** Fascia sinistra entro cui il gesto vale come "torna indietro". */
const EDGE = 28;
/** Oltre questo trascinamento il ritorno e' confermato al rilascio. */
const THRESHOLD = 70;

type Props = {
  onBack: () => void;
  children: React.ReactNode;
};

/**
 * Ritorno indietro trascinando dal bordo sinistro, come nella navigazione
 * di sistema iOS.
 *
 * Il responder si attiva solo se il gesto NASCE entro i primi pochi punti
 * di schermo ed e' nettamente orizzontale verso destra: dentro queste
 * schermate ci sono liste verticali e caroselli di grafici che scorrono
 * lateralmente, e un responder piu' avido se li mangerebbe. La pagina segue
 * il dito mentre si trascina, cosi' il gesto si vede prima di completarlo
 * ed e' annullabile tornando indietro.
 */
export function SwipeBack({ onBack, children }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        event: GestureResponderEvent,
        gesture: PanResponderGestureState
      ) =>
        event.nativeEvent.pageX - gesture.dx <= EDGE &&
        gesture.dx > 8 &&
        gesture.dx > Math.abs(gesture.dy) * 1.8,

      onPanResponderMove: (_event, gesture) => {
        // Solo verso destra: trascinare a sinistra non deve staccare la
        // pagina dal proprio bordo.
        translateX.setValue(Math.max(gesture.dx, 0));
      },

      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx >= THRESHOLD) {
          Animated.timing(translateX, {
            toValue: width,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            onBack();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 2,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 2,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.fill, { transform: [{ translateX }] }]}
      {...pan.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/** Area di tocco generosa per le frecce "indietro", troppo piccole da sole. */
export const backHitSlop = { top: 14, bottom: 14, left: 16, right: 20 };
