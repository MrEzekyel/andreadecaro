import { Asset, AssetGroup, Investment } from "./types";

export const GROUP_LABEL: Record<AssetGroup, string> = {
  conto_titoli: "Conto titoli",
  crypto: "Crypto",
  private_market: "Private market",
};

/**
 * Oltre questa distanza dall'ultimo valore noto un fondo a prezzo manuale
 * merita un promemoria. Presa dal ritmo reale dei NAV di Apollo/EQT nello
 * storico importato: aggiornano ogni 28-35 giorni, quindi 35 e' il punto in
 * cui il silenzio smette di essere normale e comincia a essere un dato
 * vecchio.
 */
export const MANUAL_PRICE_STALE_DAYS = 35;

export function daysSince(dateIso: string) {
  const ms = Date.now() - new Date(dateIso + "T00:00:00Z").getTime();
  return Math.floor(ms / 86_400_000);
}

export const GROUP_ORDER: AssetGroup[] = [
  "conto_titoli",
  "crypto",
  "private_market",
];

export type Position = {
  asset: Asset;
  /** Quote possedute oggi: acquisti eseguiti meno vendite. */
  quantity: number;
  /** Capitale versato negli acquisti eseguiti, commissioni escluse. */
  invested: number;
  /** Incassi da vendite. */
  sold: number;
  dividends: number;
  fees: number;
  /**
   * Denaro uscito dal conto e non ancora diventato quote: ordini che il broker
   * deve eseguire, piu' le rate previste dai piani in attesa dell'estratto.
   */
  pending: number;
  price: number | null;
  priceDate: string | null;
  /** Solo le quote possedute, al prezzo di oggi. */
  marketValue: number;
  /** Quanto vale la posizione in totale, ordini in esecuzione compresi. */
  value: number;
  /** Capitale netto dentro le quote: versato meno disinvestito. */
  investedBasis: number;
  /** Capitale impegnato in tutto, ordini in esecuzione compresi. */
  costBasis: number;
  /** Prezzo medio di carico: quanto e' costata in media una quota. */
  avgPrice: number | null;
  /** Solo il movimento del prezzo: e' il rendimento che mostra il broker. */
  priceGain: number;
  priceGainPct: number | null;
  /** Rendimento vero: comprende i dividendi incassati. */
  gain: number;
  gainPct: number | null;
  /** Una posizione chiusa resta nello storico ma sparisce dall'allocazione. */
  closed: boolean;
};

export type LatestPrice = { close_eur: number; on_date: string };

/**
 * Le operazioni contano dal giorno in cui il denaro si muove davvero. Sui fondi
 * private market fra l'addebito e l'assegnazione delle quote passano settimane,
 * e in mezzo quei soldi non sono ancora esposti al mercato.
 */
export function effectiveDay(op: Investment) {
  return op.settled_on ?? op.occurred_at.slice(0, 10);
}

export function buildPositions(
  assets: Asset[],
  investments: Investment[],
  prices: Record<string, LatestPrice | undefined>
): Position[] {
  const byAsset = new Map<string, Investment[]>();
  for (const op of investments) {
    if (!op.asset_id) continue;
    const list = byAsset.get(op.asset_id);
    if (list) list.push(op);
    else byAsset.set(op.asset_id, [op]);
  }

  return assets.map((asset) => {
    const ops = byAsset.get(asset.id) ?? [];

    let quantity = 0;
    let invested = 0;
    let sold = 0;
    let dividends = 0;
    let fees = 0;
    let pending = 0;

    for (const op of ops) {
      // Senza quote e senza prezzo un'operazione non puo' entrare nel prezzo
      // medio ne' nel rendimento: sarebbe un acquisto mai avvenuto a un prezzo
      // mai pagato. Vale il suo importo e basta.
      if (op.status !== "settled") {
        pending += Number(op.amount);
        continue;
      }
      fees += Number(op.fee ?? 0);
      if (op.kind === "buy") {
        invested += Number(op.amount);
        quantity += Number(op.quantity ?? 0);
      } else if (op.kind === "sell") {
        sold += Number(op.amount);
        quantity -= Number(op.quantity ?? 0);
      } else {
        dividends += Number(op.amount);
      }
    }

    const latest = prices[asset.id];
    const price = latest ? Number(latest.close_eur) : null;
    // Le quote in virgola mobile non tornano mai esattamente a zero.
    const closed = quantity < 1e-9;
    const marketValue = closed || price === null ? 0 : quantity * price;
    const investedBasis = invested - sold;

    // Gli ordini addebitati e non ancora eseguiti restano nel saldo: non sono
    // esposti al mercato, ma nemmeno spariti. E' anche cio' che fa il broker.
    const value = marketValue + pending;

    // Il rendimento si misura sulle sole quote: contarci dentro anche il
    // denaro in transito, che per definizione non si e' ancora mosso,
    // diluirebbe la percentuale verso lo zero.
    const priceGain = marketValue - investedBasis;

    return {
      asset,
      quantity: closed ? 0 : quantity,
      invested,
      sold,
      dividends,
      fees,
      pending,
      price,
      priceDate: latest?.on_date ?? null,
      marketValue,
      value,
      investedBasis,
      costBasis: investedBasis + pending,
      avgPrice: closed || quantity <= 0 ? null : invested / quantity,
      priceGain,
      priceGainPct: investedBasis > 0 ? priceGain / investedBasis : null,
      gain: priceGain + dividends,
      gainPct: investedBasis > 0 ? (priceGain + dividends) / investedBasis : null,
      closed,
    };
  });
}

export type PortfolioTotals = {
  value: number;
  marketValue: number;
  costBasis: number;
  investedBasis: number;
  dividends: number;
  pending: number;
  fees: number;
  priceGain: number;
  gain: number;
  gainPct: number | null;
};

export function sumPositions(positions: Position[]): PortfolioTotals {
  const t = positions.reduce(
    (acc, p) => ({
      value: acc.value + p.value,
      marketValue: acc.marketValue + p.marketValue,
      costBasis: acc.costBasis + p.costBasis,
      investedBasis: acc.investedBasis + p.investedBasis,
      dividends: acc.dividends + p.dividends,
      pending: acc.pending + p.pending,
      fees: acc.fees + p.fees,
    }),
    {
      value: 0,
      marketValue: 0,
      costBasis: 0,
      investedBasis: 0,
      dividends: 0,
      pending: 0,
      fees: 0,
    }
  );

  const priceGain = t.marketValue - t.investedBasis;
  const gain = priceGain + t.dividends;
  return {
    ...t,
    priceGain,
    gain,
    gainPct: t.investedBasis > 0 ? gain / t.investedBasis : null,
  };
}

export type CashFlow = { date: string; amount: number };

/** Flussi di cassa nel formato che serve all'XIRR: negativi in uscita. */
export function cashFlows(investments: Investment[]): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const op of investments) {
    if (op.status !== "settled") continue;
    const date = effectiveDay(op);
    const amount = Number(op.amount);
    if (op.kind === "buy") flows.push({ date, amount: -amount });
    else flows.push({ date, amount });
  }
  return flows.sort((a, b) => a.date.localeCompare(b.date));
}

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Rendimento annualizzato che tiene conto di *quando* sono entrati i soldi.
 *
 * Su un piano di accumulo il classico (valore − versato) / versato e'
 * fuorviante: i 250 euro di due anni fa hanno lavorato per due anni, quelli del
 * mese scorso per un mese, ma quel calcolo li tratta uguali. L'XIRR e' il tasso
 * annuo che rende i flussi equivalenti al valore di oggi, ed e' l'unico numero
 * confrontabile con il rendimento dichiarato di qualunque altra cosa.
 *
 * Si risolve per bisezione invece che con Newton: piu' lenta, ma non diverge
 * mai — e su poche decine di flussi la differenza non si percepisce.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;

  const t0 = new Date(flows[0].date).getTime();
  const years = (d: string) => (new Date(d).getTime() - t0) / YEAR_MS;

  const npv = (rate: number) =>
    flows.reduce((sum, f) => sum + f.amount / (1 + rate) ** years(f.date), 0);

  let low = -0.9999;
  let high = 10;
  const atLow = npv(low);
  const atHigh = npv(high);
  // Fuori da questo intervallo non c'e' radice: meglio niente che un numero
  // inventato in cima alla schermata.
  if (!Number.isFinite(atLow) || !Number.isFinite(atHigh)) return null;
  if (atLow * atHigh > 0) return null;

  for (let i = 0; i < 120; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

/** XIRR del portafoglio: i flussi passati piu' il valore di oggi come uscita. */
export function portfolioXirr(
  investments: Investment[],
  currentValue: number,
  today = new Date().toISOString().slice(0, 10)
): number | null {
  if (currentValue <= 0) return null;
  return xirr([...cashFlows(investments), { date: today, amount: currentValue }]);
}

export type GroupSummary = {
  group: AssetGroup;
  label: string;
  value: number;
  /** Capitale nelle quote, senza gli ordini ancora in esecuzione. */
  investedBasis: number;
  costBasis: number;
  pending: number;
  priceGain: number;
  priceGainPct: number | null;
  gain: number;
  share: number;
  positions: Position[];
};

export function groupPositions(
  positions: Position[],
  total: number
): GroupSummary[] {
  return GROUP_ORDER.map((group) => {
    const inGroup = positions.filter((p) => p.asset.asset_group === group);
    const sum = (pick: (p: Position) => number) =>
      inGroup.reduce((s, p) => s + pick(p), 0);

    const investedBasis = sum((p) => p.investedBasis);
    const priceGain = sum((p) => p.priceGain);
    const value = sum((p) => p.value);

    return {
      group,
      label: GROUP_LABEL[group],
      value,
      investedBasis,
      costBasis: sum((p) => p.costBasis),
      pending: sum((p) => p.pending),
      priceGain,
      priceGainPct: investedBasis > 0 ? priceGain / investedBasis : null,
      gain: priceGain + sum((p) => p.dividends),
      share: total > 0 ? value / total : 0,
      positions: inGroup.sort((a, b) => b.value - a.value),
    };
  }).filter((g) => g.positions.length > 0);
}

export type SeriesPoint = { on_date: string; value_eur: number; invested_eur: number };

export const RANGES = [
  { key: "1m", label: "1M", days: 30 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1A", days: 365 },
  { key: "all", label: "Tutto", days: null },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function sliceSeries(series: SeriesPoint[], range: RangeKey): SeriesPoint[] {
  const spec = RANGES.find((r) => r.key === range);
  if (!spec?.days || series.length === 0) return series;
  const cutoff = new Date(series[series.length - 1].on_date);
  cutoff.setDate(cutoff.getDate() - spec.days);
  const iso = cutoff.toISOString().slice(0, 10);
  const cut = series.filter((p) => p.on_date >= iso);
  // Con meno di due punti non c'e' una linea da disegnare.
  return cut.length >= 2 ? cut : series;
}

/**
 * Guadagno di prezzo fra il primo e l'ultimo punto di una serie, al netto dei
 * versamenti fatti nel frattempo.
 *
 * Senza togliere i versamenti, un mese in cui e' entrata una rata sembrerebbe
 * sempre "in guadagno" anche a prezzi fermi, perche' il valore sale per il
 * denaro nuovo e non per il mercato. Si isola il movimento di prezzo con la
 * stessa logica del rendimento totale (`priceGain`): quanto valeva la
 * posizione a inizio periodo e' il capitale esposto al mercato in quel
 * momento, quindi e' anche il denominatore giusto per la percentuale.
 */
export function periodPriceGain(points: SeriesPoint[]) {
  if (points.length < 2) return { amount: 0, pct: null as number | null };
  const first = points[0];
  const last = points[points.length - 1];
  const contributed = last.invested_eur - first.invested_eur;
  const amount = last.value_eur - first.value_eur - contributed;
  return {
    amount,
    pct: first.value_eur > 0 ? amount / first.value_eur : null,
  };
}

/**
 * Proiezione a interesse composto del piano attuale.
 *
 * Volutamente non estrapola il rendimento passato: due anni di storia non
 * bastano a prevederne venti, e un numero derivato dai dati sembrerebbe piu'
 * affidabile di quanto sia. Il tasso resta un'ipotesi dichiarata di chi guarda.
 */
export function project(
  startValue: number,
  monthly: number,
  annualRate: number,
  years: number
) {
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  const points: { month: number; value: number; contributed: number }[] = [];
  let value = startValue;

  for (let month = 0; month <= years * 12; month++) {
    if (month > 0) value = value * (1 + monthlyRate) + monthly;
    points.push({ month, value, contributed: startValue + monthly * month });
  }
  return points;
}
