import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * Il semicerchio della Home, copiato nel widget "Quanto resta".
 *
 * Il widget non legge Supabase: i dati stanno dietro al login, e una seconda
 * sessione accanto a quella dell'app si contenderebbe il refresh token. L'app
 * scrive qui gli stessi numeri che disegna, in un App Group che il widget
 * legge. Il prezzo: una spesa arrivata dalla Shortcut ad app chiusa compare
 * nel widget solo alla prossima apertura — il widget lo dichiara con l'ora
 * dell'ultimo aggiornamento quando i dati invecchiano.
 *
 * `requireOptionalNativeModule`, mai un import diretto: un `eas update`
 * raggiunge anche le build installate prima che il modulo esistesse, e li'
 * un require diretto manderebbe in crash l'app all'avvio.
 */
type ExtensionStorage = {
  setObject(key: string, value: object, suite: string): boolean;
  reloadWidget(kind?: string): void;
};

const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<ExtensionStorage>("ExtensionStorage")
    : null;

const APP_GROUP = "group.com.andreadecaro.clinck";
const WIDGET_KIND = "RemainingWidget";
const REFRESH_MS = 10 * 60 * 1000;

export type WidgetGauge = {
  /** "2026-09": il widget scarta un mese che non e' piu' quello in corso. */
  month: string;
  /** Fondo scala dell'arco. */
  limit: number;
  /** Il vincolo su cui si conta quanto resta (vedi `gauge` in HomeScreen). */
  binding: number;
  spent: number;
  /** Speso oggi, per il riquadro "Oggi". */
  today: number;
  /** Il limite di spesa del mese, se impostato. */
  spendLimit: number | null;
  /** Quanto si puo' spendere rispettando l'obiettivo di risparmio, se c'e'. */
  goalLimit: number | null;
  /** Costi fissi del mese, rate ancora da addebitare comprese; `null` se non lette. */
  fixed: number | null;
  /** Il riferimento e' il guadagnato del mese, non un limite impostato. */
  synthetic: boolean;
};

let lastKey = "";
let lastWrite = 0;

export function publishWidgetGauge(gauge: WidgetGauge) {
  if (!native) return;
  const key = JSON.stringify(gauge);
  const now = Date.now();
  // Stessi numeri scritti da poco: niente da dire al widget. Riscriverli
  // ogni tanto serve lo stesso, per rinfrescare l'ora dell'ultimo dato.
  if (key === lastKey && now - lastWrite < REFRESH_MS) return;
  try {
    native.setObject("gauge", { ...gauge, updatedAt: now }, APP_GROUP);
    native.reloadWidget(WIDGET_KIND);
    lastKey = key;
    lastWrite = now;
  } catch {
    // Il widget e' un di piu': un suo guasto non deve arrivare alla Home.
  }
}
