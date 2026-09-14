import React from "react";
import { StyleSheet, View } from "react-native";
import { LEFT_COLUMN, useWideLayout } from "../lib/layout";
import { space } from "../lib/theme";

type Props = {
  /** Lo stato: l'importo grande, i riquadri, cio' che si guarda per primo. */
  left: React.ReactNode;
  /** La lettura: grafici ed elenchi, cio' che si guarda per capire. */
  right: React.ReactNode;
  /**
   * Ordine da tenere in verticale, quando non e' semplicemente sinistra
   * seguita da destra.
   *
   * Serve dove la divisione in colonne non cade in mezzo all'elenco delle
   * sezioni ma le alterna: in Investimenti il grafico sta a destra, ma sul
   * telefono deve restare subito sotto l'importo, dov'e' sempre stato.
   * Senza questo, affiancare le colonne avrebbe riordinato anche la versione
   * verticale — cioe' cambiato una schermata che nessuno ha chiesto di
   * cambiare.
   */
  order?: React.ReactNode;
};

/**
 * Due colonne su schermo largo, una pila sola sul telefono.
 *
 * Sul telefono restituisce i due gruppi cosi' come sono, senza contenitori: il
 * `gap` della schermata che la ospita continua a spaziare le sezioni una per
 * una, esattamente come prima che questo componente esistesse. E' il motivo per
 * cui aggiungere le due colonne non ha richiesto di toccare il layout
 * verticale: in verticale questo componente non c'e'.
 */
export function TwoColumns({ left, right, order }: Props) {
  const wide = useWideLayout();

  if (!wide) {
    return (
      <>
        {order ?? (
          <>
            {left}
            {right}
          </>
        )}
      </>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.left}>{left}</View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.xl, alignItems: "flex-start" },
  left: { width: LEFT_COLUMN, gap: space.xl },
  // `minWidth: 0` non e' decorativo: senza, un elenco con un nome lungo allarga
  // la colonna oltre lo schermo invece di troncare il nome.
  right: { flex: 1, minWidth: 0, gap: space.xl },
});
