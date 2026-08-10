import { useCallback, useEffect, useId, useState } from "react";
import { describeAge, readCache, writeCache } from "./cache";
import { firstError } from "./loadError";
import { supabase } from "./supabase";
import { Profile } from "./types";

const CACHE_KEY = "profile";

/**
 * Stato di trial/abbonamento dell'utente corrente.
 *
 * Riga singola, non elenco: stesso schema di `usePayments` (rete → cache →
 * errore) ma senza il confronto col periodo precedente, che qui non ha senso.
 *
 * Il verdetto sull'automazione lo da' `ingest-payment` quando la Shortcut
 * scatta davvero: questo hook serve solo a mostrarlo in anticipo dentro
 * l'app, cosi' un utente non scopre il blocco dalla notifica di errore della
 * Shortcut ma da un avviso leggibile prima che gli capiti.
 */
export function useSubscription() {
  /**
   * Un nome di canale per **istanza**, non per hook.
   *
   * Questo hook vive in piu' punti contemporaneamente: Impostazioni lo tiene
   * montato mentre mostra Abbonamento o Invita un amico, che lo montano a
   * loro volta. Con un nome fisso le due istanze aprivano due canali sullo
   * stesso topic, e la seconda `subscribe()` sollevava un'eccezione — che nel
   * bundle di produzione non apre nessuna schermata rossa: smonta l'albero e
   * lascia la pagina vuota, senza un motivo scritto da nessuna parte.
   */
  const channelId = useId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    // `getSession` legge da AsyncStorage, funziona anche offline — vedi la
    // stessa scelta in `usePayments`.
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? null;
    if (!userId) {
      setLoading(false);
      return;
    }

    const result = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const failure = firstError(result);

    if (!failure) {
      const row = (result.data as Profile | null) ?? null;
      setProfile(row);
      setError(null);
      setStaleAt(null);
      setStaleReason(null);
      if (row) writeCache(userId, CACHE_KEY, row);
      setLoading(false);
      return;
    }

    const cached = await readCache<Profile>(userId, CACHE_KEY);
    if (cached) {
      setProfile(cached.value);
      setError(null);
      setStaleAt(cached.at);
      setStaleReason(failure);
    } else {
      setError(failure);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();

    const channel = supabase
      .channel(`profile-live:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, channelId]);

  const trialEndsAt = profile ? new Date(profile.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)
    : null;

  // Senza una lettura riuscita non si presume ne' un blocco ne' un via
  // libera: solo quando il profilo e' arrivato (fresco o in cache) si puo'
  // dire qualcosa di vero sull'automazione.
  const automationActive = profile
    ? profile.subscription_status === "active" ||
      (trialEndsAt !== null && trialEndsAt.getTime() > Date.now())
    : null;

  return {
    profile,
    loading,
    error,
    staleAt,
    staleLabel: staleAt ? describeAge(staleAt) : null,
    staleReason,
    trialDaysLeft,
    automationActive,
    reload: load,
  };
}
