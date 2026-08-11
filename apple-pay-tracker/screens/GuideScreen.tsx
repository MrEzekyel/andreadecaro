import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActionPreview } from "../components/ActionPreview";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { GUIDE_FLAT, GUIDE_STEPS, SHORTCUT_INSTALL_URL } from "../lib/guide";
import { GUIDE_IMAGES } from "../lib/guideImages";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";

const PROGRESS_KEY = "guida-passo";

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const [index, setIndex] = useState(0);
  const [tokenCopiato, setTokenCopiato] = useState(false);
  const scroller = useRef<ScrollView>(null);

  // Si riprende da dove si era rimasti: questa guida si fa passando avanti e
  // indietro fra due app, e ricominciare da capo a ogni ritorno sarebbe il
  // modo piu' rapido per farla abbandonare.
  useEffect(() => {
    AsyncStorage.getItem(PROGRESS_KEY).then((saved) => {
      const n = Number(saved);
      if (Number.isFinite(n) && n > 0 && n < GUIDE_STEPS) setIndex(n);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(PROGRESS_KEY, String(index));
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  const { chapter, step } = GUIDE_FLAT[index];
  const primo = index === 0;
  const ultimo = index === GUIDE_STEPS - 1;
  // Il comando rapido è l'unico dei due pezzi che si può condividere: chi ha
  // il link pronto può saltare tutto questo capitolo. L'automazione no —
  // Apple non permette di condividerla in nessun modo — quindi il salto si
  // ferma al primo passo del secondo capitolo, non oltre.
  const automazioneIndex = GUIDE_FLAT.findIndex(
    (item) => item.chapter.id === "automazione"
  );

  async function generaToken() {
    const { data, error } = await supabase.rpc("create_ingest_token", {
      p_label: "Inserisci pagamento",
    });
    if (error) {
      Alert.alert("Non è stato possibile generare la chiave", error.message);
      return;
    }
    await Clipboard.setStringAsync(data as string);
    setTokenCopiato(true);
    Alert.alert(
      "Chiave copiata",
      "È negli appunti. Incollala nel passo successivo: non potrai rivederla."
    );
  }

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={backHitSlop}>
            <Icon name="chevron-left" size={20} color={palette.ink} />
            <Text style={[styles.title, { color: palette.ink }]}>
              Come si configura
            </Text>
          </TouchableOpacity>
        </View>

        {/* L'avanzamento non è decorazione: dice che la procedura finisce, e
            quanto manca. Senza, dieci passi sembrano infiniti al terzo. */}
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: palette.accent,
                  width: `${((index + 1) / GUIDE_STEPS) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: palette.ink3 }]}>
            {index + 1} di {GUIDE_STEPS}
          </Text>
        </View>

        {chapter.id === "comando" && (
          <View style={[styles.shortcutBanner, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.shortcutBannerText, { color: palette.ink2 }]}>
              Hai già il link del comando pronto?
            </Text>
            <View style={styles.shortcutBannerActions}>
              <TouchableOpacity onPress={() => Linking.openURL(SHORTCUT_INSTALL_URL)}>
                <Text style={[styles.shortcutBannerLink, { color: palette.accent }]}>
                  Installalo
                </Text>
              </TouchableOpacity>
              <Text style={[styles.shortcutBannerText, { color: palette.ink3 }]}>·</Text>
              <TouchableOpacity onPress={() => setIndex(automazioneIndex)}>
                <Text style={[styles.shortcutBannerLink, { color: palette.accent }]}>
                  Vai al capitolo 2
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView ref={scroller} contentContainerStyle={styles.content}>
          <Text style={[styles.chapter, { color: palette.accent }]}>
            {chapter.title.toUpperCase()}
          </Text>

          <Text style={[styles.stepTitle, { color: palette.ink }]}>
            {step.title}
          </Text>

          <Text style={[styles.body, { color: palette.ink2 }]}>{step.body}</Text>

          {step.action === "open-install" && (
            <TouchableOpacity
              onPress={() => Linking.openURL(SHORTCUT_INSTALL_URL)}
              style={[styles.button, { backgroundColor: palette.accent }]}
            >
              <Text style={[styles.buttonText, { color: palette.onAccent }]}>
                Apri il link e installa
              </Text>
            </TouchableOpacity>
          )}

          {step.action === "copy-token" && (
            <TouchableOpacity
              onPress={generaToken}
              style={[styles.button, { backgroundColor: palette.accent }]}
            >
              <Text style={[styles.buttonText, { color: palette.onAccent }]}>
                {tokenCopiato ? "Generane un'altra" : "Genera e copia la chiave"}
              </Text>
            </TouchableOpacity>
          )}

          {step.blocks?.map((block) => (
            <ActionPreview key={block.action} block={block} />
          ))}

          {/* Lo screenshot vero quando c'e': si affianca alla riproduzione
              schematica invece di sostituirla, perche' l'immagine invecchia
              al primo aggiornamento di iOS e i nomi delle azioni no. */}
          {GUIDE_IMAGES[step.id] && (
            <Image
              source={GUIDE_IMAGES[step.id]}
              style={[styles.shot, { borderColor: palette.hairline }]}
              resizeMode="contain"
              accessibilityLabel={`Schermata di esempio: ${step.title}`}
            />
          )}

          {step.warning && (
            <View style={[styles.warning, { backgroundColor: palette.accentSoft }]}>
              <Icon name="info" size={14} color={palette.accent} />
              <Text style={[styles.warningText, { color: palette.ink2 }]}>
                {step.warning}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.nav, { borderTopColor: palette.hairline }]}>
          <TouchableOpacity
            style={[styles.navButton, primo && styles.navDisabled]}
            onPress={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={primo}
          >
            <Text style={[styles.navText, { color: palette.ink3 }]}>Indietro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navNext, { backgroundColor: palette.accent }]}
            onPress={() => (ultimo ? onBack() : setIndex((i) => i + 1))}
          >
            <Text style={[styles.navNextText, { color: palette.onAccent }]}>
              {ultimo ? "Ho finito" : "Avanti"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 18,
  },
  title: { ...type.title },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
  progressText: { ...type.small },
  shortcutBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  shortcutBannerText: { ...type.small },
  shortcutBannerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  shortcutBannerLink: { ...type.small, fontWeight: "500" },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  chapter: { ...type.small, fontWeight: "500", letterSpacing: 0.6 },
  stepTitle: { ...type.title, fontSize: 20, marginTop: -4 },
  body: { ...type.body, lineHeight: 22 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  shot: {
    width: "100%",
    height: 320,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  warning: {
    flexDirection: "row",
    gap: 9,
    borderRadius: radius.card,
    padding: 12,
  },
  warningText: { ...type.caption, flex: 1, lineHeight: 18 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navButton: { paddingVertical: 12, paddingHorizontal: 8 },
  navDisabled: { opacity: 0 },
  navText: { ...type.body },
  navNext: {
    borderRadius: radius.button,
    paddingVertical: 12,
    paddingHorizontal: 34,
  },
  navNextText: { ...type.bodyMedium, fontSize: 14.5 },
});
