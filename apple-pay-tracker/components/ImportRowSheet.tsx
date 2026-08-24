import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { formatAmount, formatDate } from "../lib/format";
import type { Decisione, RigaRivista } from "../lib/importReview";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { CategoryPicker } from "./CategoryPicker";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  riga: RigaRivista | null;
  decisione: Decisione;
  onClose: () => void;
  onSave: (decisione: Decisione) => void;
  /** Applica lo stesso nome a tutte le righe che oggi si chiamano cosi'. */
  onRenameAll: (daNome: string, aNome: string) => void;
  /** Quante altre righe porterebbero lo stesso nome. */
  quanteConQuestoNome: number;
};

function parseImporto(value: string): number | null {
  const pulito = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const numero = Number(pulito);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Le correzioni su una riga letta, prima che diventi una spesa.
 *
 * Include il **verso** insieme a esercente, categoria, data e importo, e non
 * per completezza: un'uscita letta come entrata inventa denaro dal nulla, e
 * finche' non c'era modo di correggerla l'unica via era importare, accorgersi
 * del totale sbagliato e cancellare a mano.
 */
export function ImportRowSheet({
  visible,
  riga,
  decisione,
  onClose,
  onSave,
  onRenameAll,
  quanteConQuestoNome,
}: Props) {
  const { palette } = useTheme();

  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [data, setData] = useState(new Date());
  const [direzione, setDirezione] = useState<"out" | "in">("out");
  const [categoriaId, setCategoriaId] = useState<string | null | undefined>();
  const [aTutte, setATutte] = useState(false);
  const [mostraData, setMostraData] = useState(false);

  useEffect(() => {
    if (!visible || !riga) return;
    setDescrizione(decisione.descrizione ?? riga.row.description);
    setImporto(String(decisione.importo ?? riga.row.amount).replace(".", ","));
    setData(decisione.data ?? riga.row.date);
    setDirezione(decisione.direzione ?? riga.row.direction);
    setCategoriaId(decisione.categoriaId);
    setATutte(false);
    setMostraData(false);
  }, [visible, riga, decisione]);

  if (!riga) return null;

  const nomeAttuale = decisione.descrizione ?? riga.row.description;
  const nuovoNome = descrizione.trim();
  const rinominata = nuovoNome !== "" && nuovoNome !== nomeAttuale;

  function salva() {
    if (!riga) return;
    const numero = parseImporto(importo);

    onSave({
      ...decisione,
      descrizione: nuovoNome || undefined,
      // Un importo illeggibile non diventa zero: si tiene quello del file.
      // Zero sarebbe una spesa sparita senza dirlo.
      importo: numero ?? undefined,
      data,
      direzione,
      categoriaId,
    });

    if (rinominata && aTutte) onRenameAll(nomeAttuale, nuovoNome);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Correggi la riga" dim>
      {riga.sospetti.length > 0 && (
        <View style={[styles.motivi, { borderColor: palette.hairline }]}>
          {riga.sospetti.map((s, i) => (
            <View key={i} style={styles.motivo}>
              <Icon name="circle-alert" size={13} color={palette.warn} />
              <Text style={[styles.motivoText, { color: palette.ink2 }]}>
                {s.motivo}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Esercente</Text>
        <TextInput
          value={descrizione}
          onChangeText={setDescrizione}
          placeholder="Nome"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.hairline,
              color: palette.ink,
            },
          ]}
        />
        {/* La riga della banca resta sempre leggibile: e' l'unico modo di
            capire se la pulizia ha mangiato qualcosa che serviva. */}
        {riga.row.rawDescription !== riga.row.description && (
          <Text style={[styles.raw, { color: palette.ink3 }]} numberOfLines={2}>
            dal file: {riga.row.rawDescription}
          </Text>
        )}

        {rinominata && quanteConQuestoNome > 1 && (
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setATutte((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aTutte }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={aTutte ? "square-check" : "square"}
              size={17}
              color={aTutte ? palette.accent : palette.ink3}
            />
            <Text style={[styles.checkText, { color: palette.ink2 }]}>
              Applica a tutte e {quanteConQuestoNome} le righe con questo nome
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Verso</Text>
        <View style={styles.versoRow}>
          {(["out", "in"] as const).map((v) => {
            const scelto = direzione === v;
            const colore = v === "out" ? palette.accent : palette.good;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setDirezione(v)}
                style={[
                  styles.verso,
                  {
                    borderColor: scelto ? colore : palette.hairline,
                    backgroundColor: scelto ? palette.surface : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: scelto }}
              >
                <Text
                  style={[
                    styles.versoText,
                    { color: scelto ? colore : palette.ink3 },
                  ]}
                >
                  {v === "out" ? "Uscita" : "Entrata"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.due}>
        <View style={styles.meta}>
          <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Importo</Text>
          <TextInput
            value={importo}
            onChangeText={setImporto}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                color: palette.ink,
              },
            ]}
          />
        </View>

        <View style={styles.meta}>
          <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Data</Text>
          <TouchableOpacity
            onPress={() => setMostraData(true)}
            style={[
              styles.input,
              styles.inputButton,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Text style={{ color: palette.ink, ...type.body }}>
              {formatDate(data.toISOString())}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {mostraData && (
        <DateTimePicker
          value={data}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_evento, scelta) => {
            if (Platform.OS !== "ios") setMostraData(false);
            if (scelta) setData(scelta);
          }}
        />
      )}

      {direzione === "out" && (
        <View>
          <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
            Categoria
          </Text>
          <CategoryPicker
            value={categoriaId ?? null}
            onChange={(id) => setCategoriaId(id)}
          />
          <Text style={[styles.raw, { color: palette.ink3 }]}>
            {categoriaId === undefined
              ? "Se non scegli, la decide l'esercente come sempre."
              : "Scelta a mano: batte quella dell'esercente."}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: palette.accent }]}
        onPress={salva}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>
          Salva la correzione
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghost}
        onPress={() => {
          onSave({ ...decisione, esclusa: !decisione.esclusa });
          onClose();
        }}
      >
        <Text
          style={[
            styles.ghostText,
            { color: decisione.esclusa ? palette.good : palette.over },
          ]}
        >
          {decisione.esclusa
            ? `Rimetti dentro (${formatAmount(riga.row.amount)})`
            : `Escludi dall'import (${formatAmount(riga.row.amount)})`}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.caption, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  inputButton: { justifyContent: "center" },
  raw: { ...type.small, lineHeight: 15, marginTop: 5 },
  motivi: { borderWidth: 1, borderRadius: radius.field, padding: 11, gap: 6 },
  motivo: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  motivoText: { ...type.small, lineHeight: 16, flex: 1 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  checkText: { ...type.small, flex: 1, lineHeight: 16 },
  versoRow: { flexDirection: "row", gap: 9 },
  verso: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingVertical: 11,
    alignItems: "center",
  },
  versoText: { ...type.caption, fontWeight: "500" },
  due: { flexDirection: "row", gap: 11 },
  meta: { flex: 1 },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
  ghost: { alignItems: "center", paddingVertical: 6 },
  ghostText: { ...type.caption, fontWeight: "500" },
});
