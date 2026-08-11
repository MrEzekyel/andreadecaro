import { ImageSourcePropType } from "react-native";

/**
 * Screenshot veri dell'iPhone, uno per passo della guida.
 *
 * La chiave e' l'`id` del passo in `lib/guide.ts`. Sono il cuore della
 * guida — non un'aggiunta facoltativa: la didascalia sotto e' volutamente
 * corta, lo screenshot e' quello che spiega davvero cosa toccare.
 *
 * I `require` devono restare **letterali**: Metro risolve le immagini a
 * compilazione e un percorso costruito a runtime non verrebbe incluso nel
 * bundle.
 *
 * Prima di aggiungerne uno: ritagliare la sola azione invece della schermata
 * intera quando possibile, ridimensionare a ~750px di larghezza e salvare
 * in `assets/guida/`. A piena risoluzione peserebbero qualche megabyte,
 * e finirebbero tutti dentro l'aggiornamento che ogni utente scarica.
 */
export const GUIDE_IMAGES: Record<string, ImageSourcePropType> = {
  apri: require("../assets/guida/apri.jpg"),
  espandi: require("../assets/guida/espandi.jpg"),
  incolla: require("../assets/guida/incolla.jpg"),
  cerca: require("../assets/guida/cerca.jpg"),
  "scegli-comando": require("../assets/guida/scegli-comando.jpg"),
  // installa, chiave: schermate della nostra app, non serve uno screenshot.
  // seleziona-tutto, immediato, prova: mancano ancora.
};
