import { formatAmount } from "./format";
import { monthlyEquivalent } from "./recurrence";
import { InvestmentRule, SavingsGoal, SpendingLimit } from "./types";

/**
 * Settimane in un mese medio: 365,25 / 12 / 7.
 *
 * Serve a mettere un limite settimanale e uno mensile sulla stessa scala.
 * Non e' 4: un mese ha 4 o 5 lunedi' secondo il mese, e arrotondare a 4
 * farebbe dichiarare coerenti due limiti che per otto mesi l'anno non lo
 * sono — un limite settimanale da 250 € vale 1.087 € al mese, non 1.000.
 */
export const WEEKS_PER_MONTH = 365.25 / 12 / 7;

/** Fuori da questa banda due limiti sullo stesso perimetro non si parlano. */
const TOLERANCE = 0.05;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Mediana, per proporre le entrate di riferimento.
 *
 * Non la media: una tredicesima o un rimborso una tantum la tirano su di
 * parecchio e proporrebbero entrate che in un mese normale non arrivano —
 * cioe' un tetto di spesa piu' largo del vero, il verso sbagliato in cui
 * sbagliare qui. E' la stessa ragione per cui il grafico dei versamenti
 * mensili usa la mediana invece della media.
 */
export function median(values: number[]): number | null {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Il tetto di spesa che l'obiettivo impone.
 *
 *   Entrate - Spese = Risparmio   =>   Spese <= Entrate - Obiettivo
 *
 * E' l'unica conversione della funzione, ed e' esatta: non e' una stima ne'
 * un'euristica. Tutto il resto (scala del semicerchio, conflitti, correzioni
 * suggerite) ci si appoggia sopra.
 */
export function goalCeiling(goal: SavingsGoal) {
  return Number(goal.reference_income) - Number(goal.amount);
}

export type GoalVerdict = {
  /** Entrate - Spese: gli investimenti contano come risparmio, non come spesa. */
  saved: number;
  met: boolean;
  /** Positivo = mancato di tanto. Negativo = superato di tanto. */
  missing: number;
  ratio: number;
};

/**
 * Com'e' andato un mese **chiuso** rispetto all'obiettivo.
 *
 * Solo su un mese chiuso: a meta' mese `income` sono gli introiti arrivati
 * finora (spesso zero fino al 27) e `saved` verrebbe negativo per chiunque,
 * un verdetto falso su un mese che non e' ancora finito. Sul mese in corso
 * si guarda il tetto di spesa (`goalCeiling`), che non dipende da quando
 * arriva lo stipendio.
 */
export function goalVerdict(
  goal: SavingsGoal,
  income: number,
  spent: number
): GoalVerdict {
  const target = Number(goal.amount);
  const saved = income - spent;
  return {
    saved,
    met: saved >= target,
    missing: target - saved,
    ratio: target > 0 ? saved / target : 0,
  };
}

/** Una correzione gia' calcolata, applicabile con un tocco. */
export type CoherenceFix = {
  label: string;
  amount: number;
  target: { kind: "goal" } | { kind: "limit"; id: string };
};

export type Coherence = {
  key: string;
  /** `conflict` = i due non possono essere veri insieme. `info` = uno dei due non servira' mai. */
  severity: "conflict" | "info";
  title: string;
  body: string;
  fixes: CoherenceFix[];
  /** Le righe da segnare con l'icona di avviso in `LimitsScreen`. */
  limitIds: string[];
  involvesGoal: boolean;
};

type Input = {
  goal: SavingsGoal | null;
  limits: SpendingLimit[];
  /**
   * Quanto va gia' in automatico verso i piani di accumulo ogni mese
   * (`monthlyEquivalent` sommato sulle regole attive) — vedi
   * `goal-vs-investments` piu' sotto.
   */
  monthlyInvestmentCommitment: number;
  /** Nome della categoria, per scrivere i messaggi. */
  categoryName: (id: string) => string;
};

/**
 * Tutti i modi in cui limiti, investimenti e obiettivo possono contraddirsi.
 *
 * Per i conflitti che coinvolgono l'obiettivo, il punto d'ingresso normale
 * non e' piu' questa funzione ma `validateGoalInput`: si blocca il salvataggio
 * dell'obiettivo finche' non torna coerente, cosi' uno stato incoerente non
 * nasce mai. Questa resta comunque necessaria per due motivi: primo, quei
 * conflitti possono ripresentarsi **dopo** — un limite modificato in
 * `LimitsScreen` o un piano di accumulo aggiunto in `PacScreen` non passano
 * da nessuna validazione sull'obiettivo, che quindi puo' tornare incoerente
 * senza che nessuno l'abbia toccato; secondo, i conflitti che non coinvolgono
 * l'obiettivo (settimanale contro mensile, categoria sopra il totale) restano
 * solo informativi per scelta — un limite settimanale da 500 € sotto un
 * mensile da 1.000 € non e' un errore da impedire, semplicemente non scatta
 * mai, ed e' comunque bene dirlo.
 */
export function checkCoherence({
  goal,
  limits,
  monthlyInvestmentCommitment,
  categoryName,
}: Input): Coherence[] {
  const out: Coherence[] = [];

  const overall = (period: SpendingLimit["period"]) =>
    limits.find((l) => l.period === period && l.category_id === null) ?? null;

  const monthly = overall("monthly");
  const weekly = overall("weekly");

  const ceiling = goal ? goalCeiling(goal) : null;
  const income = goal ? Number(goal.reference_income) : 0;

  // ── L'obiettivo da solo ──────────────────────────────────────────────
  // Un obiettivo pari o superiore alle entrate non lascia niente per
  // vivere: il tetto di spesa che ne deriva e' zero o negativo, e ogni
  // altro controllo qui sotto ne erediterebbe l'assurdita'.
  if (goal && ceiling !== null && ceiling <= 0) {
    out.push({
      key: "goal-impossible",
      severity: "conflict",
      title: "Obiettivo irraggiungibile",
      body: `Risparmiare ${formatAmount(Number(goal.amount))} su ${formatAmount(
        income
      )} di entrate non lascia niente per vivere. Abbassa l'obiettivo o correggi le entrate di riferimento.`,
      fixes: [],
      limitIds: [],
      involvesGoal: true,
    });
    return out;
  }

  // ── Obiettivo sotto quanto gia' investi in automatico ────────────────
  // Gli investimenti contano come risparmio (`goalCeiling`, `goalVerdict`):
  // un piano di accumulo che mette via 500 € al mese sta gia' risparmiando
  // 500 €, indipendentemente da qualunque spesa. Un obiettivo piu' basso di
  // quella cifra sarebbe gia' superato da solo, prima ancora di guardare una
  // spesa — non misura niente, e va impedito fin dall'inserimento.
  if (goal && monthlyInvestmentCommitment > Number(goal.amount)) {
    const floor = round2(monthlyInvestmentCommitment);
    out.push({
      key: "goal-vs-investments",
      severity: "conflict",
      title: "L'obiettivo è sotto quanto già investi",
      body: `I piani di accumulo attivi mettono via ${formatAmount(
        floor
      )} al mese in automatico, più dell'obiettivo di ${formatAmount(
        Number(goal.amount)
      )}. Gli investimenti contano come risparmio: lo staresti già superando senza guardare una sola spesa.`,
      fixes: [
        {
          label: `Obiettivo a ${formatAmount(floor)}`,
          amount: floor,
          target: { kind: "goal" },
        },
      ],
      limitIds: [],
      involvesGoal: true,
    });
  }

  // ── Obiettivo contro limite mensile complessivo ──────────────────────
  if (goal && ceiling !== null && monthly) {
    const limitAmount = Number(monthly.amount);
    if (limitAmount > ceiling) {
      const fixes: CoherenceFix[] = [
        {
          label: `Limite a ${formatAmount(round2(ceiling))}`,
          amount: round2(ceiling),
          target: { kind: "limit", id: monthly.id },
        },
      ];
      // Il secondo verso della correzione esiste solo se lascia un
      // obiettivo ancora positivo: "risparmia -200 €" non e' un consiglio.
      const loweredGoal = income - limitAmount;
      if (loweredGoal > 0) {
        fixes.push({
          label: `Obiettivo a ${formatAmount(round2(loweredGoal))}`,
          amount: round2(loweredGoal),
          target: { kind: "goal" },
        });
      }

      out.push({
        key: "goal-vs-monthly",
        severity: "conflict",
        title: "Limite e obiettivo non tornano",
        body: `Spendendo tutto il limite di ${formatAmount(
          limitAmount
        )} ti resterebbero ${formatAmount(
          round2(income - limitAmount)
        )}, meno dell'obiettivo di ${formatAmount(
          Number(goal.amount)
        )}. Su ${formatAmount(income)} di entrate i due sforano di ${formatAmount(
          round2(limitAmount - ceiling)
        )}.`,
        fixes,
        limitIds: [monthly.id],
        involvesGoal: true,
      });
    }
  }

  // ── Obiettivo contro limite settimanale, quando non c'e' il mensile ──
  // Con il mensile presente il collegamento passa gia' da lui (obiettivo ↔
  // mensile ↔ settimanale): ripetere il controllo qui darebbe due avvisi
  // per lo stesso difetto, e due avvisi che dicono la stessa cosa fanno
  // ignorare entrambi.
  if (goal && ceiling !== null && weekly && !monthly) {
    const projected = Number(weekly.amount) * WEEKS_PER_MONTH;
    if (projected > ceiling) {
      const fixes: CoherenceFix[] = [
        {
          label: `Settimanale a ${formatAmount(round2(ceiling / WEEKS_PER_MONTH))}`,
          amount: round2(ceiling / WEEKS_PER_MONTH),
          target: { kind: "limit", id: weekly.id },
        },
      ];
      const loweredGoal = income - projected;
      if (loweredGoal > 0) {
        fixes.push({
          label: `Obiettivo a ${formatAmount(round2(loweredGoal))}`,
          amount: round2(loweredGoal),
          target: { kind: "goal" },
        });
      }

      out.push({
        key: "goal-vs-weekly",
        severity: "conflict",
        title: "Il settimanale non protegge l'obiettivo",
        body: `${formatAmount(
          Number(weekly.amount)
        )} a settimana valgono ${formatAmount(
          round2(projected)
        )} al mese: rispettandolo ogni settimana risparmieresti ${formatAmount(
          round2(income - projected)
        )}, sotto l'obiettivo di ${formatAmount(Number(goal.amount))}.`,
        fixes,
        limitIds: [weekly.id],
        involvesGoal: true,
      });
    }
  }

  // ── Settimanale contro mensile, sullo stesso perimetro ───────────────
  // Vale sia per il complessivo sia per ogni categoria che ha entrambi.
  const perimeters: { id: string | null; label: string }[] = [
    { id: null, label: "complessivo" },
    ...Array.from(
      new Set(
        limits
          .filter((l) => l.category_id !== null)
          .map((l) => l.category_id as string)
      )
    ).map((id) => ({ id, label: categoryName(id) })),
  ];

  for (const perimeter of perimeters) {
    const w = limits.find(
      (l) => l.period === "weekly" && l.category_id === perimeter.id
    );
    const m = limits.find(
      (l) => l.period === "monthly" && l.category_id === perimeter.id
    );
    if (!w || !m) continue;

    const projected = Number(w.amount) * WEEKS_PER_MONTH;
    const monthlyAmount = Number(m.amount);
    const scope = perimeter.id === null ? "" : ` · ${perimeter.label}`;

    const fixes: CoherenceFix[] = [
      {
        label: `Settimanale a ${formatAmount(round2(monthlyAmount / WEEKS_PER_MONTH))}`,
        amount: round2(monthlyAmount / WEEKS_PER_MONTH),
        target: { kind: "limit", id: w.id },
      },
      {
        label: `Mensile a ${formatAmount(round2(projected))}`,
        amount: round2(projected),
        target: { kind: "limit", id: m.id },
      },
    ];

    if (projected > monthlyAmount * (1 + TOLERANCE)) {
      // Il verso pericoloso: si rispetta il settimanale tutte le settimane
      // e si sfora il mese lo stesso, senza che nessun avviso sia mai
      // scattato. Chi l'ha impostato si crede protetto e non lo e'.
      out.push({
        key: `weekly-loose-${perimeter.id ?? "all"}`,
        severity: "conflict",
        title: `Il settimanale non protegge il mensile${scope}`,
        body: `${formatAmount(Number(w.amount))} a settimana valgono ${formatAmount(
          round2(projected)
        )} al mese, oltre il limite mensile di ${formatAmount(
          monthlyAmount
        )}. Puoi rispettare ogni settimana e sforare il mese comunque.`,
        fixes,
        limitIds: [w.id, m.id],
        involvesGoal: false,
      });
    } else if (projected < monthlyAmount * (1 - TOLERANCE)) {
      // Meno grave: il mensile non scatta mai perche' il settimanale
      // ferma prima. Non e' un rischio, ma e' un limite che non fa niente
      // e che rende il numero in Home meno stretto di quanto sembri.
      out.push({
        key: `monthly-idle-${perimeter.id ?? "all"}`,
        severity: "info",
        title: `Il mensile non scatterà mai${scope}`,
        body: `Rispettando ${formatAmount(
          Number(w.amount)
        )} a settimana arriveresti a ${formatAmount(
          round2(projected)
        )} al mese, sotto il limite mensile di ${formatAmount(
          monthlyAmount
        )}: a fermarti è sempre il settimanale.`,
        fixes,
        limitIds: [w.id, m.id],
        involvesGoal: false,
      });
    }
  }

  // ── Una categoria sopra il complessivo dello stesso periodo ──────────
  for (const limit of limits) {
    if (limit.category_id === null) continue;
    const total = overall(limit.period);
    if (!total) continue;

    const categoryAmount = Number(limit.amount);
    const totalAmount = Number(total.amount);
    if (categoryAmount <= totalAmount) continue;

    out.push({
      key: `category-over-total-${limit.id}`,
      severity: "conflict",
      title: `${categoryName(limit.category_id)} sopra il totale`,
      body: `Il limite su ${categoryName(
        limit.category_id
      )} (${formatAmount(categoryAmount)}) supera il limite complessivo di ${formatAmount(
        totalAmount
      )}: una sola categoria potrebbe esaurire tutto il periodo restando "nei limiti".`,
      fixes: [
        {
          label: `${categoryName(limit.category_id)} a ${formatAmount(totalAmount)}`,
          amount: totalAmount,
          target: { kind: "limit", id: limit.id },
        },
      ],
      limitIds: [limit.id, total.id],
      involvesGoal: false,
    });
  }

  // ── Somma delle categorie oltre il complessivo ───────────────────────
  // Informativo e non conflitto: e' normale che le categorie non arrivino
  // mai tutte insieme al proprio tetto. Ma se la somma sfora, i limiti di
  // categoria da soli non bastano a garantire quello complessivo, e vale
  // la pena saperlo invece di scoprirlo il 28.
  for (const period of ["weekly", "monthly"] as const) {
    const total = overall(period);
    if (!total) continue;

    const perCategory = limits.filter(
      (l) => l.period === period && l.category_id !== null
    );
    if (perCategory.length < 2) continue;

    const sum = perCategory.reduce((acc, l) => acc + Number(l.amount), 0);
    const totalAmount = Number(total.amount);
    if (sum <= totalAmount) continue;

    out.push({
      key: `categories-sum-${period}`,
      severity: "info",
      title: `Le categorie sommano più del totale${
        period === "weekly" ? " · settimana" : " · mese"
      }`,
      body: `I ${perCategory.length} limiti di categoria valgono ${formatAmount(
        round2(sum)
      )} insieme, contro un totale di ${formatAmount(
        totalAmount
      )}: se arrivassero tutti al proprio tetto sforeresti di ${formatAmount(
        round2(sum - totalAmount)
      )}.`,
      fixes: [],
      limitIds: [total.id, ...perCategory.map((l) => l.id)],
      involvesGoal: false,
    });
  }

  // I conflitti veri prima: se la sezione si allunga, e' quello che va
  // letto per primo a dover stare in cima.
  return out.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "conflict" ? -1 : 1
  );
}

/** Somma di `monthlyEquivalent` sulle sole regole attive — le stesse che `PacScreen` mostra come "in corso". */
export function monthlyInvestmentCommitment(rules: InvestmentRule[]) {
  return rules
    .filter((rule) => rule.active)
    .reduce((sum, rule) => sum + monthlyEquivalent(rule), 0);
}

export type GoalRange = { min: number; max: number };

/**
 * L'intervallo di valori validi per l'obiettivo, dati entrate, limiti e
 * investimenti attuali. `null` = nessun obiettivo e' possibile in queste
 * condizioni (il tetto che i limiti impongono e' sceso sotto quanto gia'
 * si investe, o le entrate non bastano nemmeno per i soli investimenti).
 *
 * Guida sia lo slider di inserimento (che non puo' uscire da qui) sia
 * `validateGoalInput` (che qui dentro trova i due estremi da proporre).
 * Guarda solo il limite **complessivo** — mensile se c'e', altrimenti il
 * settimanale proiettato — mai quelli di categoria: stessa scelta gia'
 * fatta in `checkCoherence` per `goal-vs-monthly`/`goal-vs-weekly`.
 */
export function computeGoalRange(
  referenceIncome: number,
  limits: SpendingLimit[],
  investmentFloor: number
): GoalRange | null {
  if (referenceIncome <= 0) return null;

  const monthly = limits.find(
    (l) => l.period === "monthly" && l.category_id === null
  );
  const weekly = limits.find(
    (l) => l.period === "weekly" && l.category_id === null
  );

  let capFromLimit = referenceIncome;
  if (monthly) {
    capFromLimit = referenceIncome - Number(monthly.amount);
  } else if (weekly) {
    capFromLimit = referenceIncome - Number(weekly.amount) * WEEKS_PER_MONTH;
  }

  const max = round2(Math.min(referenceIncome, capFromLimit));
  const min = round2(Math.max(0, investmentFloor));

  if (min >= max) return null;
  return { min, max };
}

/**
 * Perche' nessun obiettivo e' possibile con questi numeri — usata solo
 * quando `computeGoalRange` torna `null`, per spiegarlo nel foglio invece di
 * limitarsi a nascondere lo slider senza dire perche'.
 */
export function goalRangeReason(
  referenceIncome: number,
  limits: SpendingLimit[],
  investmentFloor: number
): string {
  const floor = round2(Math.max(0, investmentFloor));

  if (floor >= referenceIncome) {
    return `I piani di accumulo attivi mettono già via ${formatAmount(
      floor
    )} al mese, pari o oltre le ${formatAmount(
      referenceIncome
    )} di entrate dichiarate. Alza le entrate, o riduci i piani da Investimenti → Piani di accumulo.`;
  }

  const monthly = limits.find(
    (l) => l.period === "monthly" && l.category_id === null
  );
  if (monthly) {
    return `Il limite mensile di ${formatAmount(
      Number(monthly.amount)
    )} lascia risparmiare al massimo ${formatAmount(
      round2(referenceIncome - Number(monthly.amount))
    )}, meno di quanto già investi in automatico (${formatAmount(
      floor
    )}). Alza il limite mensile da Impostazioni → Limiti, o riduci i piani di accumulo.`;
  }

  const weekly = limits.find(
    (l) => l.period === "weekly" && l.category_id === null
  );
  if (weekly) {
    const projected = round2(Number(weekly.amount) * WEEKS_PER_MONTH);
    return `${formatAmount(
      Number(weekly.amount)
    )} a settimana (${formatAmount(
      projected
    )} al mese) lasciano risparmiare meno di quanto già investi in automatico (${formatAmount(
      floor
    )}). Alza il limite settimanale da Impostazioni → Limiti, o riduci i piani di accumulo.`;
  }

  return "Con le entrate attuali non c'è margine per nessun obiettivo oltre ai piani di accumulo già attivi.";
}

export type GoalValidation = { ok: true } | { ok: false; reason: string };

/**
 * Controlla un obiettivo **prima** di salvarlo, con la motivazione esatta se
 * non va bene — e blocca, non avvisa dopo. Copre le stesse casistiche di
 * `checkCoherence` per l'obiettivo (irraggiungibile, sotto gli investimenti,
 * in conflitto col limite mensile o settimanale), riscritte come un unico
 * percorso in ordine di gravita' invece che come un elenco da filtrare: qui
 * serve una sola ragione di blocco, la piu' urgente, non tutte insieme.
 */
export function validateGoalInput(
  amount: number,
  referenceIncome: number,
  limits: SpendingLimit[],
  investmentFloor: number
): GoalValidation {
  if (referenceIncome <= 0) {
    return {
      ok: false,
      reason: "Servono le entrate mensili di riferimento per calcolare quanto puoi spendere restando dentro l'obiettivo.",
    };
  }

  if (amount >= referenceIncome) {
    return {
      ok: false,
      reason: `Risparmiare ${formatAmount(amount)} su ${formatAmount(
        referenceIncome
      )} di entrate non lascia niente per vivere. Abbassa l'obiettivo o correggi le entrate di riferimento.`,
    };
  }

  if (investmentFloor > amount) {
    const floor = round2(investmentFloor);
    return {
      ok: false,
      reason: `I piani di accumulo attivi mettono già via ${formatAmount(
        floor
      )} al mese in automatico. Gli investimenti contano come risparmio, quindi un obiettivo più basso sarebbe già superato senza guardare una spesa: alzalo ad almeno ${formatAmount(
        floor
      )}, o riduci i piani da Investimenti → Piani di accumulo.`,
    };
  }

  const ceiling = referenceIncome - amount;
  const monthly = limits.find(
    (l) => l.period === "monthly" && l.category_id === null
  );
  const weekly = limits.find(
    (l) => l.period === "weekly" && l.category_id === null
  );

  if (monthly && Number(monthly.amount) > ceiling) {
    const limitAmount = Number(monthly.amount);
    const maxGoal = round2(referenceIncome - limitAmount);
    return {
      ok: false,
      reason:
        maxGoal > 0
          ? `Il limite mensile di ${formatAmount(
              limitAmount
            )} lascia risparmiare al massimo ${formatAmount(
              maxGoal
            )}. Abbassa l'obiettivo a ${formatAmount(
              maxGoal
            )}, o alza il limite mensile da Impostazioni → Limiti.`
          : `Il limite mensile di ${formatAmount(
              limitAmount
            )} non lascia margine per nessun obiettivo su ${formatAmount(
              referenceIncome
            )} di entrate: va abbassato prima da Impostazioni → Limiti.`,
    };
  }

  if (weekly && !monthly) {
    const projected = Number(weekly.amount) * WEEKS_PER_MONTH;
    if (projected > ceiling) {
      const maxGoal = round2(referenceIncome - projected);
      return {
        ok: false,
        reason:
          maxGoal > 0
            ? `${formatAmount(
                Number(weekly.amount)
              )} a settimana valgono ${formatAmount(
                round2(projected)
              )} al mese: rispettandolo ogni settimana risparmieresti al massimo ${formatAmount(
                maxGoal
              )}. Abbassa l'obiettivo a ${formatAmount(
                maxGoal
              )}, o alza il limite settimanale da Impostazioni → Limiti.`
            : `${formatAmount(
                Number(weekly.amount)
              )} a settimana (${formatAmount(
                round2(projected)
              )} al mese) non lasciano margine per nessun obiettivo: va alzato prima da Impostazioni → Limiti.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Le due soglie di spesa del mese, gia' risolte per il semicerchio della Home.
 *
 * `scale` e' il fondo scala dell'arco e `binding` e' il vincolo che si sfora
 * per primo. Quando ce ne sono due, la scala e' il piu' **largo** (cosi'
 * l'arco non parte gia' pieno e la tacca ha dove stare) mentre "restano"
 * segue il piu' **stretto**: e' quello che si rompe per primo, e dare il
 * margine dell'altro sarebbe un via libera su un impegno gia' saltato.
 */
export type SpendingCeilings = {
  scale: number;
  binding: number;
  /** Da cosa viene il vincolo che stringe: serve a scriverlo accanto al numero. */
  bindingSource: "limit" | "goal";
  /** Posizione della tacca sull'arco (0-1), assente se i due coincidono. */
  markRatio: number | null;
  markLabel: string | null;
  /** Vero quando i due non possono essere rispettati insieme. */
  conflicting: boolean;
};

export function resolveCeilings(
  monthlyLimit: number | null,
  goal: SavingsGoal | null
): SpendingCeilings | null {
  const fromGoal = goal ? goalCeiling(goal) : null;
  const usableGoal = fromGoal !== null && fromGoal > 0 ? fromGoal : null;

  if (monthlyLimit === null && usableGoal === null) return null;

  if (monthlyLimit === null) {
    return {
      scale: usableGoal as number,
      binding: usableGoal as number,
      bindingSource: "goal",
      markRatio: null,
      markLabel: null,
      conflicting: false,
    };
  }

  if (usableGoal === null) {
    return {
      scale: monthlyLimit,
      binding: monthlyLimit,
      bindingSource: "limit",
      markRatio: null,
      markLabel: null,
      conflicting: false,
    };
  }

  const scale = Math.max(monthlyLimit, usableGoal);
  const binding = Math.min(monthlyLimit, usableGoal);
  const bindingSource = binding === usableGoal ? "goal" : "limit";

  return {
    scale,
    binding,
    bindingSource,
    // Se coincidono la tacca finirebbe sulla punta dell'arco, sopra il
    // fondo scala: due etichette sullo stesso punto, nessuna leggibile.
    markRatio: scale === binding ? null : binding / scale,
    markLabel:
      scale === binding
        ? null
        : bindingSource === "goal"
          ? `obiettivo ${formatAmount(binding)}`
          : `limite ${formatAmount(binding)}`,
    // Il conflitto e' esattamente "il limite lascia spendere piu' di quanto
    // l'obiettivo consenta": limite + obiettivo > entrate.
    conflicting: monthlyLimit > usableGoal,
  };
}
