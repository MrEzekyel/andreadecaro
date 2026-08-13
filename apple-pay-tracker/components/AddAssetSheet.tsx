import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { backfillAssetPrices, probeInstrument } from "../lib/instruments";
import { GROUP_LABEL, GROUP_ORDER } from "../lib/portfolio";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, tint, type } from "../lib/theme";
import { Asset, AssetGroup } from "../lib/types";
import { InstrumentPicker, PickedInstrument } from "./InstrumentPicker";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (asset: Asset) => void;
  assets: Asset[];
  defaultGroup?: AssetGroup;
};

/**
 * Crea un nuovo asset — il pezzo che prima mancava del tutto: `assets` si
 * poteva popolare solo scrivendo direttamente sul database.
 *
 * Per i fondi private market non c'e' ricerca: nessuna fonte automatica
 * esiste per un ELTIF come Apollo o EQT (verificato — vedi CLAUDE.md), quindi
 * si chiede solo il nome e l'asset nasce a valorizzazione manuale, come gli
 * altri due gia' in portafoglio.
 *
 * Per conto titoli e crypto, invece, **si salva solo dopo una verifica dal
 * vivo** del simbolo scelto (`probeInstrument`), anche se viene dalla lista
 * curata: un ticker che sembrava giusto ieri puo' essere stato delistato
 * oggi, e un asset creato sulla fiducia smetterebbe di aggiornarsi in
 * silenzio — un errore che si nota solo mesi dopo, guardando un grafico
 * fermo.
 */
export function AddAssetSheet({ visible, onClose, onCreated, assets, defaultGroup }: Props) {
  const { palette, dark } = useTheme();

  const [group, setGroup] = useState<AssetGroup>(defaultGroup ?? "conto_titoli");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<PickedInstrument | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);

  function reset() {
    setGroup(defaultGroup ?? "conto_titoli");
    setName("");
    setPicked(null);
    setSavingStep(null);
  }

  async function save() {
    const trimmedName = name.trim();

    if (group === "private_market") {
      if (!trimmedName) {
        Alert.alert("Nome mancante", "Scrivi il nome del fondo.");
        return;
      }
      await insertAsset({
        name: trimmedName,
        asset_group: group,
        price_source: "manual",
        price_symbol: null,
        quote_currency: "EUR",
      });
      return;
    }

    if (!picked || picked.name !== trimmedName) {
      Alert.alert(
        "Scegli uno strumento",
        "Seleziona un risultato dall'elenco, o tocca \"inserisci a mano\" se non lo trovi."
      );
      return;
    }

    if (picked.symbol === null) {
      await insertAsset({
        name: trimmedName,
        asset_group: group,
        price_source: "manual",
        price_symbol: null,
        quote_currency: "EUR",
      });
      return;
    }

    // Si riverifica sempre dal vivo, anche per un risultato della lista
    // curata: e' l'unico modo di essere certi che il simbolo esista ancora
    // *adesso*, non quando la lista e' stata scritta.
    setSaving(true);
    setSavingStep("Verifico il simbolo…");
    const probed = await probeInstrument(picked.symbol);
    if (!probed) {
      setSaving(false);
      setSavingStep(null);
      Alert.alert(
        "Simbolo non verificato",
        `Non risulta una quotazione per "${picked.symbol}" in questo momento. Riprova, oppure inserisci lo strumento a mano.`
      );
      return;
    }

    await insertAsset({
      name: trimmedName,
      asset_group: group,
      price_source: "yahoo",
      price_symbol: probed.symbol,
      quote_currency: probed.currency,
    });
  }

  async function insertAsset(fields: {
    name: string;
    asset_group: AssetGroup;
    price_source: "yahoo" | "manual";
    price_symbol: string | null;
    quote_currency: string;
  }) {
    setSaving(true);
    setSavingStep(null);

    const nextOrder = assets.reduce((max, a) => Math.max(max, a.sort_order), 0) + 1;

    const { data, error } = await supabase
      .from("assets")
      .insert({ ...fields, sort_order: nextOrder })
      .select()
      .single();

    if (error || !data) {
      setSaving(false);
      Alert.alert(
        "Non creato",
        error?.code === "23505"
          ? "Hai già un asset con questo nome."
          : error?.message ?? "Riprova."
      );
      return;
    }

    const asset = data as Asset;

    if (asset.price_source === "yahoo") {
      // Senza uno storico, il primo investimento manuale che si sta per
      // registrare non avrebbe un prezzo a cui agganciarsi: si aspetta qui,
      // invece di lasciare l'utente davanti a un asset appena nato e senza
      // ancora un numero.
      setSavingStep("Recupero lo storico prezzi…");
      await backfillAssetPrices(asset.id);
    }

    setSaving(false);
    setSavingStep(null);
    onCreated(asset);
    reset();
    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Nuovo asset"
      // Si apre sempre sopra un altro foglio (nuovo investimento, o il piano
      // di accumulo): senza il velo si vedrebbero due intestazioni impilate.
      dim
    >
      <Text style={styles.field}>Gruppo</Text>
      <View style={styles.chips}>
        {GROUP_ORDER.map((value) => {
          const selected = value === group;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => {
                setGroup(value);
                setName("");
                setPicked(null);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? tint(palette.invest, dark) : palette.surface2,
                  borderColor: selected ? palette.invest : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? palette.invest : palette.ink2 },
                ]}
              >
                {GROUP_LABEL[value]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {group === "private_market" ? (
        <>
          <Text style={styles.field}>Nome del fondo</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Es. Apollo Global Private Markets"
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
          <Text style={styles.note}>
            Nessuna fonte automatica esiste per un fondo private market:
            aggiornerai il valore a mano dal dettaglio, come per gli altri.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.field}>Nome</Text>
          <InstrumentPicker
            value={name}
            onChange={(text) => {
              setName(text);
              setPicked(null);
            }}
            onPick={(candidate) => {
              setName(candidate.name);
              setPicked(candidate);
            }}
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.save, { backgroundColor: palette.invest }]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={palette.onAccent} />
            {savingStep && (
              <Text style={[styles.saveText, { color: palette.onAccent }]}>
                {savingStep}
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.saveText, { color: palette.onAccent }]}>Crea asset</Text>
        )}
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { ...type.label, marginTop: space.md, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { ...type.small, fontWeight: "500" },
  input: {
    borderRadius: radius.field,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    ...type.body,
  },
  note: { ...type.small, lineHeight: 17, marginTop: space.sm },
  save: {
    marginTop: space.xl,
    paddingVertical: 14,
    borderRadius: radius.button,
    alignItems: "center",
  },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveText: { ...type.body, fontWeight: "500" },
});
