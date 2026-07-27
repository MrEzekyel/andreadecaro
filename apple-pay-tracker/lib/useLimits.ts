import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { Payment, SpendingLimit } from "./types";

/**
 * Inizio della settimana corrente, lunedi'.
 * getDay() restituisce 0 per domenica, che in Italia e' l'ultimo giorno:
 * va rimappato a 7 prima di sottrarre.
 */
export function weekStart(reference = new Date()) {
  const date = new Date(reference);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (weekday - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function monthStart(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
}

export type LimitStatus = {
  limit: SpendingLimit;
  spent: number;
  ratio: number;
  /** 'ok' sotto soglia · 'warn' oltre la percentuale di avviso · 'over' sforato */
  level: "ok" | "warn" | "over";
  remaining: number;
};

export function evaluateLimit(
  limit: SpendingLimit,
  payments: Payment[]
): LimitStatus {
  const start = limit.period === "weekly" ? weekStart() : monthStart();

  const spent = payments
    .filter((payment) => {
      if (new Date(payment.occurred_at) < start) return false;
      if (limit.category_id && payment.category_id !== limit.category_id) {
        return false;
      }
      return true;
    })
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const amount = Number(limit.amount);
  const ratio = amount > 0 ? spent / amount : 0;

  const level =
    ratio >= 1 ? "over" : ratio * 100 >= limit.warn_at_percent ? "warn" : "ok";

  return { limit, spent, ratio, level, remaining: amount - spent };
}

/**
 * Limiti attivi con il relativo avanzamento.
 *
 * Le spese vengono lette una volta sola a partire dalla piu' remota fra
 * inizio settimana e inizio mese, poi filtrate in memoria: un limite
 * settimanale a cavallo di due mesi resta corretto senza query aggiuntive.
 */
export function useLimits() {
  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(
      Math.min(weekStart().getTime(), monthStart().getTime())
    );

    const [limitsResult, paymentsResult] = await Promise.all([
      supabase
        .from("spending_limits")
        .select("*")
        .eq("active", true)
        .order("period", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", since.toISOString()),
    ]);

    if (limitsResult.data) setLimits(limitsResult.data as SpendingLimit[]);
    if (paymentsResult.data) setPayments(paymentsResult.data as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statuses = useMemo(
    () => limits.map((limit) => evaluateLimit(limit, payments)),
    [limits, payments]
  );

  /** Il limite complessivo del mese, quello mostrato in Home. */
  const monthlyOverall = useMemo(
    () =>
      statuses.find(
        (status) =>
          status.limit.period === "monthly" && status.limit.category_id === null
      ),
    [statuses]
  );

  /** Solo quelli che meritano un avviso, dal piu' grave. */
  const alerts = useMemo(
    () =>
      statuses
        .filter((status) => status.level !== "ok")
        .sort((a, b) => b.ratio - a.ratio),
    [statuses]
  );

  return { statuses, monthlyOverall, alerts, loading, reload: load };
}
