import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Category } from "../lib/types";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { Icon } from "./Icon";

type Props = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

/** Minuscole e senza accenti: cercando "farm" deve comparire anche "Farmacia". */
function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Oltre questa larghezza il popup smette di leggersi come "fluttante". */
const POPUP_MAX_WIDTH = 320;
/** Pagina che resta comunque scoperta di fianco al popup, in orizzontale. */
const POPUP_SIDE_CLEARANCE = 72;
/** Margine minimo fra il popup e il bordo dello schermo. */
const POPUP_MARGIN = space.lg;
/** Aria fra il bordo basso del popup e la cima della tastiera. */
const POPUP_GAP = space.sm;
/** Pagina che resta scoperta sopra il popup, quando c'e' spazio per darla. */
const POPUP_TOP_CLEARANCE = 80;
/**
 * Tetto d'altezza: sotto questo l'elenco scorre invece di allungare il
 * popup. Con la chrome interna (intestazione + campo ≈ 102) lascia ~258 px
 * di elenco, cioe' 5 righe piene da 44 e la sesta che sbuca — abbastanza per
 * scegliere senza scorrere nel caso normale, e la riga tagliata dice da sola
 * che sotto ce n'e' dell'altro.
 */
const POPUP_MAX_HEIGHT = 360;
/**
 * Frazione dello spazio sopra la tastiera che il popup non prende mai.
 *
 * Serve sugli schermi corti (SE, e il telefono in orizzontale) dove
 * `POPUP_TOP_CLEARANCE` in pixel si mangerebbe quasi tutto quello che resta:
 * li' il margine si stringe in proporzione invece di sparire, cosi' la regola
 * "non occupa l'intera pagina" vale su ogni formato e non solo sui telefoni
 * grandi.
 */
const POPUP_TOP_RATIO = 0.2;

/**
 * Striscia orizzontale di categorie, con "Cerca" fisso a sinistra.
 *
 * "Cerca" non scorre con le altre: è il primo ovale, sempre nella stessa
 * posizione, e apre un popup separato invece di essere un'altra scelta
 * nella striscia — su una lista lunga scorrerla per trovare un nome è più
 * lento che scriverlo. Il resto (categorie, "Nessuna", "Nuova") scorre come
 * prima.
 *
 * Il popup di ricerca filtra per **prefisso** del nome, non per
 * contenuto: scrivendo "F" deve comparire "Farmacia", non una categoria che
 * ha una "f" in mezzo al nome — altrimenti con una manciata di lettere la
 * lista non si accorcia quasi mai.
 *
 * ## Perche' un popup e non un pannello
 *
 * Prima era un cassetto ancorato al bordo sinistro, alto quanto lo schermo:
 * un gesto che nell'app non esiste da nessun'altra parte (tutto il resto sono
 * fogli che salgono dal basso) e che per scegliere una voce copriva la spesa
 * che si stava scrivendo. Ora e' un riquadro che galleggia **sopra la
 * tastiera**, ancorato in orizzontale al chip "Cerca" che l'ha aperto: cosi'
 * si legge come conseguenza di quel tocco e non come una modale qualsiasi
 * comparsa al centro, e il campo importo, l'esercente e la striscia di chip
 * restano visibili tutt'intorno — si vede su cosa si sta scegliendo mentre lo
 * si sceglie.
 *
 * Il verso verticale e' l'unico fisso, e non per gusto: il campo di ricerca e'
 * in `autoFocus`, quindi la tastiera e' sempre su quando il popup compare.
 * Ancorare il popup al chip anche in verticale vorrebbe dire ritrovarselo
 * sotto la tastiera nella meta' dei casi, dato che la striscia di categorie
 * sta nella parte bassa di `AddPaymentSheet`.
 */
export function CategoryPicker({ value, onChange }: Props) {
  const { categories, reload } = useData();
  const { palette, dark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [anchorX, setAnchorX] = useState(POPUP_MARGIN);
  const chipRef = useRef<View>(null);
  // Le listener della tastiera leggono lo stato al momento dell'evento, non
  // quello del render in cui sono nate: serve un riferimento, non `searching`.
  const searchingRef = useRef(false);

  // L'altezza della tastiera si misura sempre, non solo a popup aperto: quando
  // si tocca "Cerca" con l'importo gia' a fuoco la tastiera e' gia' su e
  // nessun evento arriverebbe piu'. E' l'unico modo di saperla senza librerie
  // native, che qui non si possono usare (deve restare compatibile con Expo
  // Go).
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      // Aprire un `<Modal>` toglie il fuoco al campo sottostante e la tastiera
      // sparisce per un istante prima che l'`autoFocus` del campo di ricerca
      // la richiami: dando retta a quel "nascondi" il tetto d'altezza si
      // allargherebbe e si richiuderebbe a popup gia' in dissolvenza. A popup
      // aperto la tastiera non ha nessun altro modo di chiudersi, quindi
      // ignorarlo li' e' sicuro.
      if (!searchingRef.current) setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  async function onCreated(category: Category) {
    setCreating(false);
    await reload();
    onChange(category.id);
  }

  function openSearch() {
    // Misurato alla finestra e non al genitore: il popup vive dentro un
    // `<Modal>`, cioe' in un altro albero di layout, e le coordinate relative
    // al foglio non vorrebbero dire niente li' dentro.
    chipRef.current?.measureInWindow((x) => setAnchorX(x));
    setQuery("");
    searchingRef.current = true;
    setSearching(true);
  }

  function closeSearch() {
    searchingRef.current = false;
    setSearching(false);
    setQuery("");
  }

  function chooseFromSearch(category: Category) {
    onChange(category.id);
    closeSearch();
  }

  const filtered = useMemo(() => {
    const needle = fold(query);
    if (!needle) return categories;
    return categories.filter((category) => fold(category.name).startsWith(needle));
  }, [categories, query]);

  const popupWidth = Math.min(POPUP_MAX_WIDTH, windowWidth - POPUP_SIDE_CLEARANCE);
  // Parte dal bordo sinistro del chip e non va mai a sbattere contro quello
  // dello schermo: su iPad, dove il foglio non e' largo quanto la finestra, e'
  // quello che tiene il popup attaccato al foglio invece che al vetro.
  const popupLeft = Math.min(
    Math.max(anchorX, POPUP_MARGIN),
    Math.max(POPUP_MARGIN, windowWidth - popupWidth - POPUP_MARGIN)
  );
  const roomAboveKeyboard = windowHeight - keyboardHeight - POPUP_GAP;
  const popupMaxHeight = Math.min(
    POPUP_MAX_HEIGHT,
    roomAboveKeyboard -
      Math.min(POPUP_TOP_CLEARANCE, roomAboveKeyboard * POPUP_TOP_RATIO)
  );

  return (
    <View style={styles.row}>
      <TouchableOpacity
        ref={chipRef}
        onPress={openSearch}
        style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
        accessibilityRole="button"
        accessibilityLabel="Cerca categoria"
      >
        <Icon name="search" size={16} color={palette.accent} />
        <Text style={[styles.label, { color: palette.accent }]}>Cerca</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: palette.hairline }]} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripScroll}
      >
        {categories.map((category) => {
          const color = categoryColor(category.color, dark);
          const selected = value === category.id;

          return (
            <TouchableOpacity
              key={category.id}
              onPress={() => onChange(category.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? tint(color, dark) : palette.surface,
                  borderColor: selected ? color : palette.hairline,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Icon name={category.icon} size={16} color={color} />
              <Text
                style={[
                  styles.label,
                  { color: selected ? palette.ink : palette.ink2 },
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => onChange(null)}
          style={[
            styles.chip,
            {
              backgroundColor:
                value === null ? tint(palette.uncategorized, dark) : palette.surface,
              borderColor: value === null ? palette.uncategorized : palette.hairline,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === null }}
        >
          <Icon name="circle-help" size={16} color={palette.uncategorized} />
          <Text
            style={[
              styles.label,
              { color: value === null ? palette.ink : palette.ink2 },
            ]}
          >
            Nessuna
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCreating(true)}
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
          accessibilityRole="button"
          accessibilityLabel="Nuova categoria"
        >
          <Icon name="plus" size={16} color={palette.accent} />
          <Text style={[styles.label, { color: palette.accent }]}>Nuova</Text>
        </TouchableOpacity>
      </ScrollView>

      <CategoryFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        editing={null}
        onSaved={onCreated}
      />

      <Modal visible={searching} transparent animationType="fade" onRequestClose={closeSearch}>
        {/* Nessun velo scuro: quello che sta sotto deve restare leggibile
            tutt'intorno al popup — e' meta' del motivo per cui il popup e'
            piccolo. A separarlo dalla pagina bastano l'ombra e il filo di
            bordo. Il tocco fuori resta una via d'uscita, ma **in piu'** alla
            X dell'intestazione, mai al posto suo. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSearch}
          accessibilityLabel="Chiudi"
        />

        {/* Stesso schema di `Sheet.tsx`: dentro un `<Modal>` il
            `KeyboardAvoidingView` in `padding` e' l'unica cosa che qui si e'
            gia' vista funzionare, e sale in sincrono con la tastiera invece
            di scattare a fine animazione. L'altezza della tastiera letta a
            parte serve al solo `maxHeight`: se arrivasse tardi il popup
            sarebbe un po' piu' alto per un istante, non fuori posto. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.avoider}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.popup,
              {
                // `surface` e non `ground`: un foglio sta *sopra* la pagina e
                // puo' permettersi lo stesso fondo, un riquadro che galleggia
                // sopra un foglio dello stesso colore no — qui il fondo piu'
                // chiaro (piu' acceso in tema scuro) e' meta' del rilievo,
                // l'ombra e' l'altra meta'. Il campo dentro scende di
                // conseguenza a `surface2`, o sparirebbe nel popup.
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                width: popupWidth,
                maxHeight: popupMaxHeight,
                marginLeft: popupLeft,
              },
            ]}
          >
            <View style={styles.popupHead}>
              <Text style={[styles.popupTitle, { color: palette.ink }]} numberOfLines={1}>
                Cerca categoria
              </Text>
              <TouchableOpacity
                onPress={closeSearch}
                style={styles.popupClose}
                accessibilityRole="button"
                accessibilityLabel="Chiudi"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={18} color={palette.ink2} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nome della categoria…"
              placeholderTextColor={palette.ink3}
              autoFocus
              autoCorrect={false}
              style={[
                styles.input,
                { backgroundColor: palette.surface2, borderColor: palette.hairline, color: palette.ink },
              ]}
            />

            <ScrollView
              // Senza, il primo tocco su una riga chiude solo la tastiera e
              // non sceglie niente.
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.popupList}
            >
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: palette.ink3 }]}>
                  Nessuna categoria trovata.
                </Text>
              ) : (
                filtered.map((category) => {
                  const color = categoryColor(category.color, dark);
                  const selected = value === category.id;

                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => chooseFromSearch(category)}
                      style={styles.popupRow}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={[styles.popupIcon, { backgroundColor: tint(color, dark) }]}>
                        <Icon name={category.icon} size={15} color={color} />
                      </View>
                      <Text
                        style={[
                          styles.popupRowText,
                          { color: selected ? palette.ink : palette.ink2 },
                        ]}
                        numberOfLines={1}
                      >
                        {category.name}
                      </Text>
                      {selected && <Icon name="check" size={16} color={palette.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  stripScroll: { flex: 1 },
  strip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  divider: { width: 1, height: 22, marginHorizontal: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { ...type.body, fontWeight: "500" },

  // Il popup si appoggia in basso (sopra la tastiera, ci pensa il
  // KeyboardAvoidingView) e a sinistra, dove `marginLeft` lo porta sotto al
  // chip che l'ha aperto. `flex-start` in orizzontale e' quello che gli
  // lascia la larghezza sua invece di stirarlo da bordo a bordo.
  avoider: { flex: 1, justifyContent: "flex-end", alignItems: "flex-start" },
  popup: {
    marginBottom: POPUP_GAP,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: "hidden",
    // Un riquadro che galleggia deve staccarsi dalla pagina che lascia
    // visibile sotto di se': senza ombra, su fondo chiaro, i due piani si
    // confondono.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    shadowOpacity: 0.22,
    elevation: 8,
  },
  popupHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingTop: space.md,
  },
  popupTitle: { ...type.sheetTitle, flex: 1 },
  popupClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  input: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 11,
    paddingVertical: 9,
    ...type.body,
  },
  popupList: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    gap: 2,
  },
  popupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  popupIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  popupRowText: { ...type.body, flex: 1 },
  empty: { ...type.small, lineHeight: 17, paddingVertical: space.sm },
});
