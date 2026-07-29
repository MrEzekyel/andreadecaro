import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { Icon } from "./Icon";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
export function Sheet({ visible, onClose, title, children }: Props) {
  const { palette } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.wrap}>
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
          <SafeAreaView
            style={[styles.sheet, { backgroundColor: palette.ground }]}
          >
            <View style={[styles.grabber, { backgroundColor: palette.ink3 }]} />

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
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  avoider: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  grabber: {
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    opacity: 0.3,
    alignSelf: "center",
    marginTop: space.sm,
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
