import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Payment } from "./types";

/** Primo e ultimo istante del mese contenente `date`. */
export function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function usePayments(month: Date) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: false });

    if (!error && data) setPayments(data as Payment[]);
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

  return { payments, loading, reload: load };
}
