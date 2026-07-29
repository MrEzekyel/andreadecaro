import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { Icon } from "./Icon";

const ROW_H = 56;

type Props = {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  /** Chiamato a trascinamento concluso, col nuovo ordine gia' scritto sul database. */
  onReordered: () => void;
};

/**
 * Elenco categorie riordinabile trascinando la maniglia a destra.
 *
 * Niente librerie di drag&drop: con righe di altezza fissa il calcolo della
 * posizione bersaglio e' una semplice divisione (spostamento diviso altezza
 * riga), e PanResponder/Animated di React Native bastano. L'ordine sullo
 * schermo si aggiorna in tempo reale trascinando tramite un ref (letto dagli
 * stessi gestori di gesto, che altrimenti vedrebbero closure ferme al
 * momento in cui sono stati creati); l'`sort_order` sul database si scrive
 * tutto insieme al rilascio, non ad ogni scambio.
 */
export function DraggableCategoryList({
  categories,
  onEdit,
  onDelete,
  onReordered,
}: Props) {
  const { palette, dark } = useTheme();
  const [order, setOrder] = useState(categories);
  const orderRef = useRef(categories);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndexRef = useRef(0);

  // Fuori dal trascinamento la lista segue le props: dopo un'aggiunta o una
  // cancellazione altrimenti si vedrebbe l'elenco vecchio.
  useEffect(() => {
    if (draggingId) return;
    orderRef.current = categories;
    setOrder(categories);
  }, [categories, draggingId]);

  function applyOrder(next: Category[]) {
    orderRef.current = next;
    setOrder(next);
  }

  // Un PanResponder per categoria, ricreato solo quando cambia l'insieme
  // delle categorie: ricrearlo a ogni scambio durante il trascinamento
  // scambierebbe l'istanza sotto al dito a meta' gesto.
  const panResponders = useMemo(() => {
    const map = new Map<string, ReturnType<typeof PanResponder.create>>();

    for (const category of categories) {
      map.set(
        category.id,
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            const index = orderRef.current.findIndex((c) => c.id === category.id);
            startIndexRef.current = index === -1 ? 0 : index;
            dragY.setValue(0);
            setDraggingId(category.id);
          },
          onPanResponderMove: (
            _evt: GestureResponderEvent,
            gesture: PanResponderGestureState
          ) => {
            dragY.setValue(gesture.dy);

            const shift = Math.round(gesture.dy / ROW_H);
            const target = Math.min(
              Math.max(startIndexRef.current + shift, 0),
              categories.length - 1
            );
            const current = orderRef.current;
            const from = current.findIndex((c) => c.id === category.id);
            if (from === -1 || from === target) return;

            const next = current.slice();
            const [moved] = next.splice(from, 1);
            next.splice(target, 0, moved);
            applyOrder(next);
          },
          onPanResponderRelease: async () => {
            setDraggingId(null);
            dragY.setValue(0);

            const finalOrder = orderRef.current;
            await Promise.all(
              finalOrder.map((c, i) =>
                supabase
                  .from("categories")
                  .update({ sort_order: i * 10 })
                  .eq("id", c.id)
              )
            );
            onReordered();
          },
        })
      );
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const list = draggingId ? order : categories;

  return (
    <View style={{ height: list.length * ROW_H }}>
      {list.map((category, index) => {
        const resolved = categoryColor(category.color, dark);
        const dragging = draggingId === category.id;
        const responder = panResponders.get(category.id);

        return (
          <Animated.View
            key={category.id}
            style={[
              styles.row,
              {
                top: index * ROW_H,
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                transform: dragging ? [{ translateY: dragY }] : [],
                zIndex: dragging ? 10 : 1,
                elevation: dragging ? 4 : 0,
                shadowOpacity: dragging ? 0.18 : 0,
              },
            ]}
          >
            <TouchableOpacity style={styles.main} onPress={() => onEdit(category)}>
              <View style={[styles.icon, { backgroundColor: tint(resolved, dark) }]}>
                <Icon name={category.icon} size={16} color={resolved} />
              </View>
              <Text style={[styles.name, { color: palette.ink }]}>
                {category.name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDelete(category)}
              accessibilityLabel={`Elimina ${category.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Icon name="trash-2" size={16} color={palette.ink3} />
            </TouchableOpacity>

            <View
              {...(responder?.panHandlers ?? {})}
              style={styles.handle}
              accessibilityLabel={`Sposta ${category.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Icon name="grip-vertical" size={16} color={palette.ink3} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  main: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...type.body },
  handle: { padding: 4 },
});
