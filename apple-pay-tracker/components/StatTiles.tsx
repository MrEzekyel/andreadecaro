import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

export type Tile = {
  label: string;
  value: string;
  /** Riga piccola sotto al numero: unita' di misura o contesto. */
  hint?: string;
  /** Tinta del numero, quando il segno conta. */
  tone?: "neutral" | "good" | "bad";
};

type Props = { tiles: Tile[] };

/**
 * Numeri secondari come riquadri affiancati invece che come righe di elenco.
 *
 * Un elenco di coppie etichetta-valore si legge tutto o niente: l'occhio
 * scorre in verticale e nessun numero emerge. Affiancati, ognuno diventa una
 * cosa sola da guardare, e i due o tre che contano si vedono in un colpo.
 *
 * E' un fondo pieno e non un bordo: il design del resto dell'app tiene i bordi
 * per cio' che si tocca o per gli elenchi lunghi, e qui non serve delimitare,
 * serve raggruppare.
 */
export function StatTiles({ tiles }: Props) {
  const { palette } = useTheme();

  const colore = (tone: Tile["tone"]) =>
    tone === "good" ? palette.good : tone === "bad" ? palette.over : palette.ink;

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          style={[styles.tile, { backgroundColor: palette.surface2 }]}
        >
          <Text style={[styles.label, { color: palette.ink3 }]} numberOfLines={1}>
            {tile.label}
          </Text>
          <Text style={[styles.value, { color: colore(tile.tone) }]}>
            {tile.value}
          </Text>
          {tile.hint && (
            <Text style={[styles.hint, { color: palette.ink3 }]} numberOfLines={1}>
              {tile.hint}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    // Due per riga: con tre i numeri lunghi andrebbero a capo su schermi
    // stretti, e un importo spezzato in due righe non si legge piu'.
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: 3,
  },
  label: { ...type.small, fontSize: 10.5 },
  value: { fontSize: 21, fontWeight: "500", letterSpacing: -0.3 },
  hint: { ...type.small, fontSize: 10 },
});
