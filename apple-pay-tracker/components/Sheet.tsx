import React, { useEffect, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { Icon } from "./Icon";

/** Oltre questo trascinamento verso il basso la chiusura e' confermata al rilascio. */
const DRAG_THRESHOLD = 70;
/** In alternativa alla soglia: un rilascio abbastanza veloce chiude anche prima. */
const VELOCITY_THRESHOLD = 1.1;

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * Vela cio' che sta sotto.
   *
   * Serve solo ai fogli aperti **sopra un altro foglio**: senza, si vedono due
   * intestazioni impilate e non si capisce piu' quale delle due comanda. Sui
   * fogli normali resta spento — il fondo caldo dell'app dietro un foglio e'
   * parte di come e' fatta, e oscurarlo ovunque sarebbe un altro progetto.
   */
  dim?: boolean;
};

/**
 * Foglio modale ancorato in BASSO, che si alza sopra la tastiera.
 *
 * `KeyboardAvoidingView` aggiunge il padding necessario quando la tastiera si
 * apre, spingendo il foglio (ancorato in basso dentro di essa) verso l'alto;
 * lo `ScrollView` interno permette di raggiungere comunque i campi che
 * restassero coperti. Il tasto Indietro nell'intestazione e' l'unico modo
 * esplicito di annullare: toccare fuori dal foglio resta possibile ma non
 * deve essere l'unica via.
 */
export function Sheet({ visible, onClose, title, children, dim }: Props) {
  const { palette } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;

  // Un foglio riaperto dopo una chiusura trascinata deve ripartire da zero:
  // il valore resta spostato solo dentro l'animazione di chiusura, che lo
  // riporta a 0 subito dopo aver chiamato `onClose` (vedi sotto), ma un
  // riavvio da qui copre anche i casi in cui il foglio si chiude per altre
  // vie (tasto Indietro, tocco fuori) a meta' di un trascinamento annullato.
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _event: GestureResponderEvent,
        gesture: PanResponderGestureState
      ) => Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onPanResponderMove: (_event, gesture) => {
        // Solo verso il basso: trascinare in su non deve staccare il foglio
        // dal suo bordo naturale.
        translateY.setValue(Math.max(gesture.dy, 0));
      },

      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > DRAG_THRESHOLD || gesture.vy > VELOCITY_THRESHOLD) {
          Animated.timing(translateY, {
            toValue: windowHeight,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 2,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 2,
        }).start();
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.wrap, dim && styles.dimmed]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Chiudi"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.avoider}
          pointerEvents="box-none"
        >
          <AnimatedSafeAreaView
            style={[
              styles.sheet,
              { backgroundColor: palette.ground, transform: [{ translateY }] },
            ]}
          >
            <View style={styles.handleArea} {...pan.panHandlers}>
              <View style={[styles.grabber, { backgroundColor: palette.ink3 }]} />
            </View>

            <View style={styles.head}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.back}
                accessibilityLabel="Indietro"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="chevron-left" size={20} color={palette.ink} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.back} />
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {children}
            </ScrollView>
          </AnimatedSafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  dimmed: { backgroundColor: "rgba(0,0,0,0.32)" },
  avoider: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  // Area di trascinamento piu' generosa della sola maniglietta visibile
  // (34x4): senza, il gesto di chiusura sarebbe impossibile da agganciare
  // col dito.
  handleArea: {
    paddingTop: space.sm,
    paddingBottom: space.sm,
    alignItems: "center",
  },
  grabber: {
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    opacity: 0.3,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
  },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { ...type.sheetTitle, flex: 1, textAlign: "center" },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.md,
  },
});
