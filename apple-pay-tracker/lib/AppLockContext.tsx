import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

const LOCK_PREF = "blocco-app-attivo";

/**
 * Quanto puo' restare fuori l'app prima di richiedere di nuovo il volto.
 *
 * Non zero: il giro normale dell'automazione e' proprio uscire dall'app —
 * copiare il token, aprire Comandi Rapidi, tornare — e un blocco a ogni
 * passaggio renderebbe la funzione insopportabile invece che sicura. Mezzo
 * minuto copre il rimbalzo fra due app e non copre il telefono lasciato sul
 * tavolo.
 */
const LOCK_AFTER_MS = 30_000;

export type LockState = {
  /** `null` finche' la preferenza non e' stata letta da disco. */
  enabled: boolean | null;
  locked: boolean;
  /** L'app e' in secondo piano: serve a coprire l'anteprima nel selettore app. */
  covered: boolean;
  unlock: () => Promise<boolean>;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
};

/** Biometria presente **e** registrata: senza entrambe il blocco non si puo' attivare. */
export async function biometricsAvailable() {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

/**
 * Come si chiama il riconoscimento su **questo** telefono.
 *
 * Dice cosa supporta l'hardware, non se il permesso e' stato concesso: se
 * l'utente ha negato Face ID all'app contenitore (dentro Expo Go e' Expo Go
 * a chiederlo, non noi), iOS passa direttamente al codice senza segnalare
 * niente di distinguibile da qui.
 */
export async function biometricName(): Promise<"Face ID" | "Touch ID" | null> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "Face ID";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Touch ID";
  }
  return null;
}

async function authenticate() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Sblocca le tue spese",
    cancelLabel: "Annulla",
    // Non richiede una conferma dopo il riconoscimento: su Face ID
    // aggiungerebbe un tocco a ogni apertura per confermare una cosa gia'
    // decisa.
    requireConfirmation: false,
    // Il codice del telefono resta una via valida. Face ID sbaglia — occhiali
    // da sole, buio, un graffio sulla fotocamera — e senza ripiego l'unico
    // modo di rientrare nei propri dati sarebbe disinstallare l'app.
    disableDeviceFallback: false,
  });
  return result.success;
}

/**
 * Blocco locale dell'app dietro Face ID / Touch ID.
 *
 * Protegge da chi ha in mano il telefono gia' sbloccato, non i dati sul
 * server: quelli stanno dietro alla Row Level Security di Postgres e non
 * cambiano di una virgola con questo interruttore. E' comunque la differenza
 * fra "chiunque prenda il telefono vede quanto guadagno" e "no".
 */
function useLockState(): LockState {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  /** Istante in cui l'app e' passata in secondo piano. */
  const leftAt = useRef<number | null>(null);
  /**
   * La preferenza serve dentro al gestore di AppState, che viene registrato
   * una volta sola: leggerla dallo stato di React la congelerebbe al valore
   * che aveva al momento della registrazione.
   */
  const enabledRef = useRef<boolean | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Preferenza da disco. Finche' non e' letta l'app non mostra niente (vedi
  // `LockGate`): stampare i dati e coprirli un istante dopo li avrebbe
  // comunque mostrati.
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(LOCK_PREF);
      const on = saved === "1";
      setEnabled(on);
      setLocked(on);
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        // `inactive` e' anche il centro di controllo tirato giu' o una chiamata
        // in arrivo: non e' un'uscita, ma e' il momento in cui iOS scatta
        // l'anteprima per il selettore app, quindi la copertura parte da qui.
        setCovered(enabledRef.current === true && next !== "active");

        if (next === "background") {
          leftAt.current = Date.now();
          return;
        }

        if (next === "active" && enabledRef.current) {
          const since = leftAt.current;
          if (since !== null && Date.now() - since >= LOCK_AFTER_MS) {
            setLocked(true);
          }
          leftAt.current = null;
        }
      }
    );

    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) setLocked(false);
    return ok;
  }, []);

  const enable = useCallback(async () => {
    // Si prova subito, prima di salvare: attivare il blocco su un telefono
    // dove il volto non viene riconosciuto chiuderebbe l'utente fuori dai
    // propri dati al prossimo avvio, senza che nessuno glielo abbia chiesto.
    if (!(await biometricsAvailable())) return false;
    if (!(await authenticate())) return false;

    await AsyncStorage.setItem(LOCK_PREF, "1");
    setEnabled(true);
    return true;
  }, []);

  const disable = useCallback(async () => {
    // Nessuna seconda autenticazione: per arrivare qui il blocco e' gia' stato
    // superato, e chiederla di nuovo sarebbe cerimonia senza guadagno.
    await AsyncStorage.removeItem(LOCK_PREF);
    setEnabled(false);
    setLocked(false);
  }, []);

  return { enabled, locked, covered, unlock, enable, disable };
}

const AppLockContext = createContext<LockState>({
  enabled: false,
  locked: false,
  covered: false,
  unlock: async () => false,
  enable: async () => false,
  disable: async () => {},
});

/**
 * Uno stato solo per tutta l'app.
 *
 * Con due istanze separate dell'hook — una che copre l'app, una dietro
 * l'interruttore in Impostazioni — attivare il blocco non avrebbe effetto
 * fino al riavvio: chi lo accende esce, rientra, e trova l'app aperta come
 * prima. Sembrerebbe rotto, e in un certo senso lo sarebbe.
 */
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const value = useLockState();
  return (
    <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock() {
  return useContext(AppLockContext);
}
