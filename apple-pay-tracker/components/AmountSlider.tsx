import React, { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, type } from "../lib/theme";
import { Icon } from "./Icon";

type Props = {
  /** Puo' stare fuori da [min, max] (es. un valore scritto a mano nel campo
   *  accanto): il pallino si ferma al bordo piu' vicino, non sparisce. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
  color: string;
  /** Etichetta sotto la tacca del minimo, es. "già investito". */
  floorLabel?: string;
};

/**
 * Slider a barra per l'obiettivo di risparmio, con il campo numerico accanto
 * che resta comunque scrivibile — questo e' solo un modo piu' rapido di
 * arrivare allo stesso numero, non lo sostituisce.
 *
 * Fatto a mano con `PanResponder`, stesso schema di `ScrubChart`: nessuna
 * libreria di slider in Expo Go, e la logica (posizione del dito → indice/
 * valore) e' la stessa identica, solo continua invece che a passi discreti.
 *
 * La barra parte sempre da 0, anche quando `min` e' piu' alto: il tratto fra
 * 0 e `min` resta visibile e spento, perche' e' quello il modo di mostrare
 * *perche'* il pallino non puo' scendere piu' in basso — un limite senza
 * riferimento visivo si scoprirebbe solo trascinando fino a li'.
 */
export function AmountSlider({
  value,
  min,
  max,
  onChange,
  step = 5,
  color,
  floorLabel,
}: Props) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const geom = useRef({ width: 0, min: 0, max: 0 });
  geom.current = { width, min, max };

  const report = useRef(onChange);
  report.current = onChange;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        setDragging(true);
        pick(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  function pick(x: number) {
    const { width: w, max: hi } = geom.current;
    if (w <= 0 || hi <= 0) return;
    const ratio = Math.min(Math.max(x / w, 0), 1);
    const raw = ratio * hi;
    const stepped = Math.round(raw / step) * step;
    // Il trascinamento non puo' portare sotto il minimo: e' li' che il
    // valore smette di avere senso, non solo di piacere.
    const clamped = Math.min(Math.max(stepped, geom.current.min), hi);
    report.current(clamped);
  }

  const shape = useMemo(() => {
    if (width <= 0 || max <= 0) return null;
    const xOf = (v: number) => (Math.min(Math.max(v, 0), max) / max) * width;
    return {
      floorX: xOf(min),
      valueX: xOf(value),
    };
  }, [width, max, min, value]);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.trackTouch}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: palette.hairline }]} />

        {shape && (
          <>
            {/* Il tratto spento da 0 al minimo: mostra il perche', non solo il dove. */}
            <View
              style={[
                styles.track,
                styles.floorZone,
                { width: shape.floorX, backgroundColor: palette.ink3, opacity: 0.28 },
              ]}
            />
            <View
              style={[
                styles.track,
                styles.fill,
                { width: shape.valueX, backgroundColor: color },
              ]}
            />
            {min > 0 && (
              <View
                style={[styles.floorTick, { left: shape.floorX - 1, backgroundColor: palette.ink2 }]}
              />
            )}
            <View
              style={[
                styles.thumb,
                {
                  left: shape.valueX - (dragging ? 13 : 10),
                  width: dragging ? 26 : 20,
                  height: dragging ? 26 : 20,
                  borderRadius: dragging ? 13 : 10,
                  backgroundColor: palette.surface,
                  borderColor: color,
                },
              ]}
            />
          </>
        )}
      </View>

      <View style={styles.scaleRow}>
        <Text style={[styles.scaleText, { color: palette.ink3 }]}>
          {formatAmount(0)}
        </Text>
        {min > 0 && floorLabel && (
          <View style={styles.floorLabelRow}>
            <Icon name="lock" size={10} color={palette.ink3} />
            <Text style={[styles.scaleText, { color: palette.ink3 }]}>
              {floorLabel} {formatAmount(min)}
            </Text>
          </View>
        )}
        <Text style={[styles.scaleText, { color: palette.ink3 }]}>
          {formatAmount(max)}
        </Text>
      </View>
    </View>
  );
}

const TRACK_HEIGHT = 8;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  trackTouch: { height: 32, justifyContent: "center" },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  floorZone: { right: undefined },
  fill: { right: undefined },
  floorTick: {
    position: "absolute",
    top: 4,
    width: 2,
    height: TRACK_HEIGHT + 8,
    borderRadius: 1,
  },
  thumb: {
    position: "absolute",
    borderWidth: 2.5,
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floorLabelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  scaleText: { ...type.small, fontSize: 10.5 },
});
