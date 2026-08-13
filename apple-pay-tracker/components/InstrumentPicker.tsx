import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useData } from "../lib/DataContext";
import { searchInstrumentsOnline } from "../lib/instruments";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { Instrument, InstrumentCandidate } from "../lib/types";
import { Icon } from "./Icon";

export type PickedInstrument = {
  /** `null` = scelta manuale senza un simbolo verificabile. */
  symbol: string | null;
  name: string;
  currency: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick: (picked: PickedInstrument) => void;
  placeholder?: string;
};

const MAX = 6;

/** Minuscole e senza accenti: "S&P" si deve trovare scrivendo "sp". */
function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Ricerca ibrida di uno strumento: prima la lista curata (`instruments`,
 * migrazione 0040 — veloce, senza rete), poi Yahoo Finance se quella non
 * trova niente.
 *
 * Nessuno dei due risultati è già verificato: chi chiama (`AddAssetSheet`)
 * deve sempre passare da `probeInstrument` prima di salvare — qui si sceglie
 * *cosa cercare*, non si conferma che esista davvero.
 *
 * Cerca **per nome**, non per ISIN: è la richiesta esplicita, perché la
 * maggior parte di chi investe non sa dove trovare l'ISIN del proprio ETF.
 */
export function InstrumentPicker({ value, onChange, onPick, placeholder }: Props) {
  const { instruments } = useData();
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [online, setOnline] = useState<InstrumentCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const curated = useMemo(() => {
    const needle = fold(value);
    if (needle.length < 2) return [];

    const matches: { instrument: Instrument; startsWith: boolean }[] = [];
    for (const instrument of instruments) {
      const name = fold(instrument.name);
      const symbol = fold(instrument.symbol);
      const at = name.indexOf(needle);
      const atSymbol = symbol.indexOf(needle);
      if (at === -1 && atSymbol === -1) continue;
      matches.push({ instrument, startsWith: at === 0 || atSymbol === 0 });
    }

    matches.sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.instrument.name.localeCompare(b.instrument.name, "it");
    });

    return matches.slice(0, MAX).map((m) => m.instrument);
  }, [instruments, value]);

  // La ricerca online scatta solo quando quella curata non ha trovato
  // niente: e' il punto di tutto il sistema ibrido, rapido nel caso comune
  // e in rete solo quando serve davvero.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const needle = value.trim();
    if (!focused || needle.length < 2 || curated.length > 0 || picked === value) {
      setOnline([]);
      setSearchedFor(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchInstrumentsOnline(needle);
        setOnline(results);
      } catch {
        setOnline([]);
      } finally {
        setSearching(false);
        setSearchedFor(needle);
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, focused, curated.length, picked]);

  function chooseCurated(instrument: Instrument) {
    setPicked(instrument.name);
    onChange(instrument.name);
    setOnline([]);
    onPick({ symbol: instrument.symbol, name: instrument.name, currency: instrument.currency });
  }

  function chooseOnline(candidate: InstrumentCandidate) {
    setPicked(candidate.name);
    onChange(candidate.name);
    setOnline([]);
    onPick({ symbol: candidate.symbol, name: candidate.name, currency: candidate.currency });
  }

  function chooseManual() {
    const name = value.trim();
    if (!name) return;
    setPicked(name);
    onPick({ symbol: null, name, currency: null });
  }

  const nothingFound =
    focused &&
    value.trim().length >= 2 &&
    curated.length === 0 &&
    !searching &&
    searchedFor === value.trim() &&
    online.length === 0 &&
    picked !== value;

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(text) => {
          setPicked(null);
          onChange(text);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? "Es. MSCI World, S&P 500, Bitcoin…"}
        placeholderTextColor={palette.ink3}
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.hairline,
            color: palette.ink,
          },
        ]}
      />

      {focused && searching && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.ink3} />
          <Text style={[styles.loadingText, { color: palette.ink3 }]}>
            Cerco su Yahoo Finance…
          </Text>
        </View>
      )}

      {(curated.length > 0 || online.length > 0) && (
        <View
          style={[
            styles.list,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          {curated.map((instrument, index) => (
            <TouchableOpacity
              key={instrument.symbol}
              onPress={() => chooseCurated(instrument)}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline },
              ]}
              accessibilityRole="button"
            >
              <View style={styles.rowMain}>
                <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                  {instrument.name}
                </Text>
                <Text style={[styles.meta, { color: palette.ink3 }]}>
                  {instrument.symbol} · {instrument.currency}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {online.map((candidate, index) => (
            <TouchableOpacity
              key={`${candidate.symbol}-${index}`}
              onPress={() => chooseOnline(candidate)}
              style={[
                styles.row,
                (curated.length > 0 || index > 0) && {
                  borderTopWidth: 1,
                  borderTopColor: palette.hairline,
                },
              ]}
              accessibilityRole="button"
            >
              <View style={styles.rowMain}>
                <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                  {candidate.name}
                </Text>
                <Text style={[styles.meta, { color: palette.ink3 }]}>
                  {candidate.symbol}
                  {candidate.exchange ? ` · ${candidate.exchange}` : ""}
                </Text>
              </View>
              <Text style={[styles.onlineTag, { color: palette.ink3 }]}>Yahoo</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {nothingFound && (
        <View
          style={[
            styles.list,
            styles.emptyBox,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <Text style={[styles.emptyText, { color: palette.ink3 }]}>
            Nessuno strumento trovato con questo nome.
          </Text>
          <TouchableOpacity onPress={chooseManual} style={styles.manualButton}>
            <Icon name="pencil" size={13} color={palette.invest} />
            <Text style={[styles.manualText, { color: palette.invest }]}>
              Inserisci "{value.trim()}" a mano
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  loadingText: { ...type.small },
  list: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: radius.field,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  rowMain: { flex: 1, gap: 1 },
  name: { ...type.body },
  meta: { ...type.small },
  onlineTag: { ...type.small },
  emptyBox: { padding: space.md, gap: space.sm },
  emptyText: { ...type.small, lineHeight: 17 },
  manualButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  manualText: { ...type.small, fontWeight: "500" },
});
