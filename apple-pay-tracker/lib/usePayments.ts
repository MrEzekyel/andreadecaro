import { useCallback, useEffect, useMemo, useState } from "react";
import { describeAge, readCache, writeCache } from "./cache";
import { firstError } from "./loadError";
import { supabase } from "./supabase";
import { Payment } from "./types";

/** Primo e ultimo istante del mese contenente `date`. */
export function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function isCurrentMonth(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

/**
 * Ultimo giorno da includere nel confronto col mese precedente: oggi se il
 * mese e' in corso, altrimenti tutto il mese.
 */
export function comparisonCutoff(month: Date) {
  return isCurrentMonth(month)
    ? new Date().getDate()
    : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

export function usePayments(month: Date) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [previous, setPrevious] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Eta' dei dati mostrati quando arrivano dalla cache e non dalla rete.
   *
   * `null` = sono freschi. Quando c'e', la schermata lo dice invece di far
   * credere che siano di adesso: dati vecchi vanno bene, dati vecchi spacciati
   * per nuovi no.
   */
  const [staleAt, setStaleAt] = useState<string | null>(null);
  /**
   * Perche' stiamo mostrando dati vecchi.
   *
   * Non e' sempre "manca la rete": il progetto in pausa, un errore RLS o la
   * cache dello schema di PostgREST falliscono a rete perfettamente
   * funzionante. Dirlo come "senza connessione" manderebbe l'utente a
   * controllare il proprio telefono per un problema che non e' suo.
   */
  const [staleReason, setStaleReason] = useState<string | null>(null);

  const cacheKey = `payments:${month.getFullYear()}-${month.getMonth()}`;

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    // `getSession` legge da AsyncStorage; `getUser` interroga il server per
    // validare il JWT. Con `getUser` la cache non veniva mai consultata proprio
    // quando serve — offline quella chiamata fallisce, `userId` restava nullo,
    // e si finiva sull'errore a tutta schermata con la copia locale intatta a
    // due centimetri. La lettura offline non funzionava offline.
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? null;
    const previousStart = new Date(
      start.getFullYear(),
      start.getMonth() - 1,
      1,
      0,
      0,
      0,
      0
    );

    const [current, earlier] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", previousStart.toISOString())
        .lt("occurred_at", start.toISOString()),
    ]);

    const failure = firstError(current, earlier);

    if (!failure) {
      const righe = (current.data ?? []) as Payment[];
      setPayments(righe);
      setPrevious((earlier.data ?? []) as Payment[]);
      setError(null);
      setStaleAt(null);
      setStaleReason(null);
      if (userId) writeCache(userId, cacheKey, righe);
      setLoading(false);
      return;
    }

    // Lettura fallita: prima di dichiarare l'errore si guarda se c'e' una
    // copia locale. Mostrare i dati di stamattina, dicendo che sono di
    // stamattina, e' meglio sia di una schermata vuota sia di un errore — e
    // resta vero, che e' la condizione a cui tutto il resto e' tenuto.
    const cached = userId
      ? await readCache<Payment[]>(userId, cacheKey)
      : null;

    if (cached && cached.value.length > 0) {
      setPayments(cached.value);
      // Il confronto col mese precedente **non** e' in cache: tenere le righe
      // caricate per il mese visitato prima farebbe calcolare il delta di
      // settembre sui dati di luglio, sotto l'etichetta "su agosto". Un numero
      // vero riferito a un altro periodo, che e' cio' che si e' gia' deciso di
      // non fare mai.
      setPrevious([]);
      setError(null);
      setStaleAt(cached.at);
      setStaleReason(failure);
    } else {
      // Senza copia locale per QUESTO mese non si tiene niente di quello prima:
      // la Home stamperebbe "Settembre" sopra il totale di agosto. La regola
      // "sono vecchi, non falsi" regge finche' l'etichetta del periodo non
      // cambia; appena cambia, quei numeri diventano falsi.
      setPayments([]);
      setPrevious([]);
      // Le righe vecchie restano finche' non arriva una lettura riuscita: chi
      // guarda vede l'errore al loro posto, e al "Riprova" ritrova i suoi dati
      // invece di una schermata che nel frattempo si e' svuotata.
      setError(failure);
    }
    setLoading(false);
  }, [month, cacheKey]);

  useEffect(() => {
    setLoading(true);
    load();

    // La Shortcut scrive dal telefono mentre l'app e' aperta: senza il canale
    // realtime la spesa comparirebbe solo al refresh manuale.
    const channel = supabase
      .channel("payments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const total = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.effective_amount), 0),
    [payments]
  );

  /**
   * Totale del mese precedente ristretto agli stessi giorni gia' trascorsi.
   *
   * Confrontare un mese in corso con un mese intero direbbe sempre "stai
   * spendendo meno" fino all'ultimo giorno: il paragone ha senso solo a
   * parita' di giorni, quindi il 12 del mese si guarda al 1-12 precedente.
   */
  const previousTotal = useMemo(() => {
    const cutoff = comparisonCutoff(month);

    return previous
      .filter((payment) => new Date(payment.occurred_at).getDate() <= cutoff)
      .reduce((sum, payment) => sum + Number(payment.effective_amount), 0);
  }, [previous, month]);

  return {
    payments,
    total,
    previousTotal,
    loading,
    error,
    staleAt,
    staleLabel: staleAt ? describeAge(staleAt) : null,
    staleReason,
    reload: load,
  };
}
