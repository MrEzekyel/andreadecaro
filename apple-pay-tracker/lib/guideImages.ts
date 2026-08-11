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
  // installa: require("../assets/guida/installa.png"),
  // chiave: require("../assets/guida/chiave.png"),
  // apri: require("../assets/guida/apri.png"),
  // incolla: require("../assets/guida/incolla.png"),
  // cerca: require("../assets/guida/cerca.png"),
  // seleziona-tutto: require("../assets/guida/seleziona-tutto.png"),
  // scegli-comando: require("../assets/guida/scegli-comando.png"),
  // immediato: require("../assets/guida/immediato.png"),
};
