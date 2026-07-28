import React from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/**
 * Foglio modale ancorato in ALTO.
 *
 * La tastiera occupa la metà bassa dello schermo: un foglio ancorato in basso
 * finisce sotto i tasti e diventa impossibile da compilare. Ancorandolo in
 * cima, i campi restano sempre visibili sopra la tastiera senza bisogno di
 * spostamenti automatici, che su iOS sono fragili dentro una Modal.
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
        <SafeAreaView
          style={[styles.sheet, { backgroundColor: palette.ground }]}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
            {children}
          </ScrollView>

          <View style={[styles.grabber, { backgroundColor: palette.ink3 }]} />
        </SafeAreaView>

        {/* Tocca fuori dal foglio per chiudere. */}
        <Pressable style={styles.dim} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  sheet: {
    maxHeight: "80%",
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  title: { ...type.sheetTitle, marginBottom: space.xs },
  grabber: {
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    opacity: 0.3,
    alignSelf: "center",
    marginBottom: space.sm,
  },
  dim: { flex: 1, backgroundColor: "rgba(20,20,19,0.36)" },
});
