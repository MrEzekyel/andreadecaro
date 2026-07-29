import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
};

/**
 * Foglio minimo per creare al volo qualcosa che ha solo un nome: una
 * persona, un metodo di pagamento. Le categorie hanno colore e icona, quindi
 * usano il proprio foglio: qui basta un campo.
 */
export function NamePromptSheet({
  visible,
  title,
  placeholder,
  onClose,
  onSubmit,
}: Props) {
  const { palette } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSubmit(trimmed);
    setSaving(false);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        placeholderTextColor={palette.ink3}
        autoFocus
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.hairline,
            color: palette.ink,
          },
        ]}
      />
      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.accent }]}
        onPress={submit}
        disabled={saving}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>
          Aggiungi
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
