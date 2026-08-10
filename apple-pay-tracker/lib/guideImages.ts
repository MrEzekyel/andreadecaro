import { ImageSourcePropType } from "react-native";

/**
 * Screenshot veri dell'iPhone, uno per passo della guida.
 *
 * La chiave e' l'`id` del passo in `lib/guide.ts`. Quello che manca non
 * rompe niente: il passo mostra solo la riproduzione schematica dell'azione,
 * che da sola basta a capire cosa fare.
 *
 * I `require` devono restare **letterali**: Metro risolve le immagini a
 * compilazione e un percorso costruito a runtime non verrebbe incluso nel
 * bundle.
 *
 * Prima di aggiungerne uno: ritagliare la sola azione invece della schermata
 * intera (si legge su un telefono, non su un monitor), ridimensionare a
 * ~750px di larghezza e salvare in PNG. Uno screenshot a piena risoluzione
 * pesa qualche megabyte, e finirebbe tutto dentro l'aggiornamento che ogni
 * utente scarica a ogni apertura.
 */
export const GUIDE_IMAGES: Record<string, ImageSourcePropType> = {
  // merchant: require("../assets/guida/merchant.png"),
  // amount: require("../assets/guida/amount.png"),
  // richiesta: require("../assets/guida/richiesta.png"),
  // se: require("../assets/guida/se.png"),
  // salvataggio: require("../assets/guida/salvataggio.png"),
  // dizionario: require("../assets/guida/dizionario.png"),
  // esegui: require("../assets/guida/esegui.png"),
};
