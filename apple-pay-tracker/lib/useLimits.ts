import { useCallback, useEffect, useMemo, useState } from "react";
import { describeAge, readCache, writeCache } from "./cache";
import { useData } from "./DataContext";
import { firstError } from "./loadError";
import { checkCoherence } from "./savings";
import { supabase } from "./supabase";
import { Payment, SavingsGoal, SpendingLimit } from "./types";

const CACHE_KEY = "limits";

/**
 * Copia locale dei limiti, con il periodo a cui si riferisce.
 *
 * I due istanti non sono un dettaglio: un limite e' sempre "quanto ho speso
 * *in questo* periodo", e `evaluateLimit` ricalcola l'inizio del periodo al
 * momento in cui gira. Una copia di lunedi' scorso, riletta oggi, verrebbe
 * filtrata su una settimana che nei dati salvati non c'e': il risultato non
 * sarebbe un numero vecchio ma "0,00 € spesi, 0% del budget" — un via libera
 * inventato, esattamente nel punto dell'app che esiste per fermare qualcuno.
 */
type LimitsCache = {
  limits: SpendingLimit[];
  payments: Payment[];
  goal: SavingsGoal | null;
  weekStart: string;
  monthStart: string;
};

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
    .reduce((sum, payment) => sum + Number(payment.effective_amount), 0);

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
  const { categoryById } = useData();
  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    const week = weekStart();
    const month = monthStart();
    const since = new Date(Math.min(week.getTime(), month.getTime()));

    // `getSession` legge da AsyncStorage e funziona anche offline, dove
    // `getUser` fallirebbe lasciando la copia locale inutilizzata proprio nel
    // momento in cui serve — vedi la stessa scelta in `usePayments`.
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? null;

    const [limitsResult, paymentsResult, goalResult] = await Promise.all([
      supabase
        .from("spending_limits")
        .select("*")
        .eq("active", true)
        .order("period", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .gte("occurred_at", since.toISOString()),
      // `maybeSingle`: la riga puo' non esserci (nessun obiettivo impostato),
      // e con `single` quel caso normale tornerebbe come errore facendo
      // scattare il ramo della cache per una lettura in realta' riuscita.
      supabase.from("savings_goals").select("*").eq("active", true).maybeSingle(),
    ]);

    const failure = firstError(limitsResult, paymentsResult, goalResult);

    // Un limite valutato su una lista di spese vuota direbbe "0% del budget"
    // proprio mentre non sappiamo quanto e' stato speso.
    if (!failure) {
      const righe = (limitsResult.data ?? []) as SpendingLimit[];
      const spese = (paymentsResult.data ?? []) as Payment[];
      const obiettivo = (goalResult.data ?? null) as SavingsGoal | null;
      setLimits(righe);
      setPayments(spese);
      setGoal(obiettivo);
      setError(null);
      setStaleAt(null);
      setStaleReason(null);
      if (userId) {
        writeCache<LimitsCache>(userId, CACHE_KEY, {
          limits: righe,
          payments: spese,
          goal: obiettivo,
          weekStart: week.toISOString(),
          monthStart: month.toISOString(),
        });
      }
      setLoading(false);
      return;
    }

    const cached = userId
      ? await readCache<LimitsCache>(userId, CACHE_KEY)
      : null;

    // Stesso periodo o niente: una copia di un'altra settimana o di un altro
    // mese non e' un dato vecchio da dichiarare, e' una risposta sbagliata a
    // una domanda diversa da quella che l'utente sta facendo.
    const stessoPeriodo =
      cached?.value.weekStart === week.toISOString() &&
      cached?.value.monthStart === month.toISOString();

    if (cached && stessoPeriodo) {
      setLimits(cached.value.limits);
      setPayments(cached.value.payments);
      // `?? null` e non `cached.value.goal`: le copie scritte prima che
      // l'obiettivo esistesse non hanno il campo, e `undefined` renderebbe
      // `goal` non piu' `SavingsGoal | null` a runtime.
      setGoal(cached.value.goal ?? null);
      setError(null);
      setStaleAt(cached.at);
      setStaleReason(failure);
    } else {
      setError(failure);
    }
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

  /** Il limite complessivo della settimana: prima non veniva letto da
   *  nessuna schermata, restava impostato ma invisibile in Home. */
  const weeklyOverall = useMemo(
    () =>
      statuses.find(
        (status) =>
          status.limit.period === "weekly" && status.limit.category_id === null
      ),
    [statuses]
  );

  /** Limiti su una singola categoria, qualunque sia il periodo: sono quelli
   *  che Home mostra come righe sotto il semicerchio, non come avviso. */
  const categoryLimits = useMemo(
    () =>
      statuses
        .filter((status) => status.limit.category_id !== null)
        .sort((a, b) => b.ratio - a.ratio),
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

  /**
   * I modi in cui limiti e obiettivo si contraddicono.
   *
   * Si calcola qui e non nelle schermate perche' lo leggono in due (Home per
   * l'avviso, Limiti per la sezione con le correzioni) e due copie della
   * stessa regola divergono: e' gia' successo con `resolve_merchant`, dove
   * tre copie della stessa logica creavano gruppi diversi secondo da dove
   * entrava la spesa.
   *
   * Non dipende dagli introiti del mese: le entrate di riferimento sono
   * congelate sull'obiettivo, quindi i conflitti sono gli stessi il 3 e il 28.
   */
  const conflicts = useMemo(
    () =>
      checkCoherence({
        goal,
        limits,
        categoryName: (id) => categoryById(id)?.name ?? "Categoria",
      }),
    [goal, limits, categoryById]
  );

  /** Le righe da segnare con l'icona di avviso, per un accesso diretto. */
  const conflictingLimitIds = useMemo(() => {
    const set = new Set<string>();
    for (const conflict of conflicts) {
      if (conflict.severity !== "conflict") continue;
      for (const id of conflict.limitIds) set.add(id);
    }
    return set;
  }, [conflicts]);

  return {
    statuses,
    monthlyOverall,
    weeklyOverall,
    categoryLimits,
    alerts,
    goal,
    conflicts,
    conflictingLimitIds,
    loading,
    error,
    staleAt,
    staleLabel: staleAt ? describeAge(staleAt) : null,
    staleReason,
    reload: load,
  };
}
