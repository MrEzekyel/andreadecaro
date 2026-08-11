import { ImageSourcePropType } from "react-native";

/**
 * Screenshot veri dell'iPhone, uno per passo della guida.
 *
 * La chiave e' l'`id` del passo in `lib/guide.ts`. Sono il cuore della
 * guida — non un'aggiunta facoltativa: la didascalia sotto e' volutamente
 * corta, lo screenshot e' quello che spiega davvero cosa toccare.
 *
 * `ratio` e' `larghezza / altezza` del file **reale**, misurato a mano
 * (`file nome.jpg`) e non calcolato a runtime con `Image.resolveAssetSource`:
 * quella funzione si e' rivelata inaffidabile su questi file — restituiva un
 * valore che faceva ignorare a `Image` il vincolo `width: "100%"` e la
 * mostrava alla sua larghezza nativa (750px), molto piu' larga dello
 * schermo, tagliata a destra. Un numero scritto a mano non ha questo
 * problema. Se il file cambia, va ricalcolato il rapporto.
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
export type GuideImage = {
  source: ImageSourcePropType;
  /** larghezza / altezza del file reale, es. 750/441. */
  ratio: number;
};

export const GUIDE_IMAGES: Record<string, GuideImage> = {
  apri: { source: require("../assets/guida/apri.jpg"), ratio: 750 / 441 },
  espandi: { source: require("../assets/guida/espandi.jpg"), ratio: 750 / 993 },
  incolla: { source: require("../assets/guida/incolla.jpg"), ratio: 750 / 1053 },
  cerca: { source: require("../assets/guida/cerca.jpg"), ratio: 750 / 1391 },
  "scegli-comando": {
    source: require("../assets/guida/scegli-comando.jpg"),
    ratio: 750 / 894,
  },
  immediato: { source: require("../assets/guida/immediato.jpg"), ratio: 750 / 934 },
  // installa, chiave: schermate della nostra app, non serve uno screenshot.
  // seleziona-tutto: resta solo descritta, per scelta di Andrea.
  // prova: manca ancora, facoltativa.
};
