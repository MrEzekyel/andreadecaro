import { useCallback, useEffect, useMemo, useState } from "react";
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

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
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
    setError(failure);

    // Le righe vecchie restano finche' non arriva una lettura riuscita: chi
    // guarda vede l'errore al loro posto, e al "Riprova" ritrova i suoi dati
    // invece di una schermata che nel frattempo si e' svuotata.
    if (!failure) {
      setPayments((current.data ?? []) as Payment[]);
      setPrevious((earlier.data ?? []) as Payment[]);
    }
    setLoading(false);
  }, [month]);

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

  return { payments, total, previousTotal, loading, error, reload: load };
}
