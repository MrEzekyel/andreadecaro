import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { useTheme } from "../lib/ThemeContext";
import { setDisplayName } from "../lib/social";
import { radius, space, tint, type } from "../lib/theme";

type Props = {
  /** Il tag assegnato dal database alla creazione dell'account. */
  handle: string;
  onDone: () => void;
};

/**
 * Il primo schermo dopo la verifica dell'email.
 *
 * Chiede una cosa sola — come ti chiami — e ne consegna una: il tuo Clinck
 * Tag, gia' pronto, da copiare e mandare agli amici. Il tag **non** si sceglie:
 * lo assegna il database alla creazione dell'account (`generate_clinck_tag`),
 * perche' i nomi buoni finirebbero subito e perche' inventarsi un
 * identificativo e' un passo in piu' proprio nel momento in cui si vuole solo
 * entrare nell'app.
 *
 * Compare **una volta sola**, e il discriminante e' `profiles.display_name`
 * nullo: non un flag salvato sul telefono, che si perderebbe cambiando
 * dispositivo e rifarebbe comparire il benvenuto a chi ha gia' finito.
 */
export default function WelcomeScreen({ handle, onDone }: Props) {
  const { palette, dark } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await Clipboard.setStringAsync(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert(
        "Manca il nome",
        "Serve almeno un nome: è quello che vedono gli amici quando dividi una spesa con loro."
      );
      return;
    }

    setSaving(true);
    try {
      await setDisplayName(trimmed);
      onDone();
    } catch (e) {
      Alert.alert("Non salvato", e instanceof Error ? e.message : "Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.ground }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.ink }]}>
            Benvenuto in Clinck
          </Text>
          <Text style={[styles.subtitle, { color: palette.ink2 }]}>
            Manca solo come vuoi farti chiamare.
          </Text>
        </View>

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>Il tuo nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Es. Andrea"
            placeholderTextColor={palette.ink3}
            autoFocus
            maxLength={40}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                color: palette.ink,
              },
            ]}
          />
          <Text style={[styles.hint, { color: palette.ink3 }]}>
            È quello che vedono i tuoi amici quando dividi una spesa con loro.
          </Text>
        </View>

        {/* Il tag si consegna, non si chiede: e' gia' suo, e l'unica cosa da
            fare e' portarselo via. Per questo "Copia" e "Condividi" stanno
            qui e non nascosti in Impostazioni. */}
        <View
          style={[
            styles.tagCard,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <Text style={[styles.label, { color: palette.ink3, marginBottom: 2 }]}>
            Il tuo Clinck Tag
          </Text>
          <Text style={[styles.tag, { color: palette.ink }]}>{handle}</Text>
          <Text style={[styles.tagBody, { color: palette.ink3 }]}>
            Mandalo ai tuoi amici: chi ce l'ha può aggiungerti e dividere le
            spese con te. Le loro quote ti arrivano sull'app, e decidi tu se
            accettarle.
          </Text>

          <View style={styles.tagActions}>
            <TouchableOpacity
              style={[
                styles.pill,
                {
                  backgroundColor: copied ? tint(palette.good, dark) : palette.surface2,
                },
              ]}
              onPress={copy}
              accessibilityRole="button"
            >
              <Icon
                name={copied ? "check" : "copy"}
                size={14}
                color={copied ? palette.good : palette.ink2}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: copied ? palette.good : palette.ink2 },
                ]}
              >
                {copied ? "Copiato" : "Copia"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pill, { backgroundColor: palette.surface2 }]}
              onPress={() =>
                Share.share({
                  message: `Aggiungimi su Clinck, il mio tag è ${handle} — così dividiamo le spese senza rincorrerci.`,
                })
              }
              accessibilityRole="button"
            >
              <Icon name="share" size={14} color={palette.ink2} />
              <Text style={[styles.pillText, { color: palette.ink2 }]}>
                Condividi
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={palette.onAccent} />
          ) : (
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              Inizia
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footNote, { color: palette.ink3 }]}>
          Il tag lo trovi sempre in Impostazioni → Amici.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: space.lg,
    paddingTop: 90,
    gap: space.lg,
    paddingBottom: 60,
  },
  header: { gap: 6 },
  title: { ...type.title, fontSize: 26 },
  subtitle: { ...type.body },
  label: { ...type.caption, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 13,
    ...type.body,
  },
  hint: { ...type.small, marginTop: 6, lineHeight: 17 },
  tagCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: 4,
  },
  tag: { ...type.title, fontVariant: ["tabular-nums"] },
  tagBody: { ...type.small, lineHeight: 18, marginTop: 4 },
  tagActions: { flexDirection: "row", gap: 8, marginTop: space.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
  },
  pillText: { ...type.caption, fontWeight: "500" },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  footNote: { ...type.small, textAlign: "center" },
});
