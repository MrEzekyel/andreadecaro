import { useCallback, useEffect, useState } from "react";
import { describeAge, readCache, writeCache } from "./cache";
import { firstError } from "./loadError";
import { supabase } from "./supabase";
import {
  LatestPrice,
  MoneyWeightedReturn,
  Position,
  PortfolioTotals,
  SeriesPoint,
  buildPositions,
  portfolioReturn,
  sumPositions,
} from "./portfolio";
import { Asset, AssetGroup, Investment, InvestmentRule } from "./types";

const CACHE_KEY = "portfolio";

/**
 * Copia locale del portafoglio: i dati **grezzi**, non le posizioni calcolate.
 *
 * `buildPositions` e `sumPositions` sono funzioni pure, quindi ricalcolare
 * costa niente e tiene la cache indipendente dalla logica: se domani cambia
 * il modo di contare le quote non eseguite, la copia salvata ieri non resta
 * congelata sul conteggio vecchio.
 */
type PortfolioCache = {
  assets: Asset[];
  investments: Investment[];
  rules: InvestmentRule[];
  prices: Record<string, LatestPrice>;
  series: SeriesPoint[];
};

type State = {
  assets: Asset[];
  investments: Investment[];
  /** I piani di accumulo: quanto entra ogni mese, e su quale asset. */
  rules: InvestmentRule[];
  positions: Position[];
  totals: PortfolioTotals;
  series: SeriesPoint[];
  annualReturn: MoneyWeightedReturn | null;
  loading: boolean;
  /** Messaggio dell'ultima lettura fallita, `null` quando l'ultima e' riuscita. */
  error: string | null;
  /** Quando risale la copia mostrata, `null` se i dati sono freschi. */
  staleAt: string | null;
  staleReason: string | null;
};

const EMPTY_TOTALS: PortfolioTotals = {
  value: 0,
  marketValue: 0,
  costBasis: 0,
  investedBasis: 0,
  dividends: 0,
  pending: 0,
  fees: 0,
  priceGain: 0,
  gain: 0,
  gainPct: null,
};

/**
 * Tutto cio' che serve alla sezione investimenti, in una lettura sola.
 *
 * La serie giornaliera arriva gia' calcolata dal database: ricostruirla qui
 * vorrebbe dire scaricare il prezzo di ogni asset per ognuno dei ~700 giorni
 * di storia a ogni apertura della schermata.
 */
/** Da dati grezzi a stato pronto da mostrare: usato sia dalla rete sia dalla cache. */
function build(
  raw: PortfolioCache,
  stale: { at: string; reason: string } | null
): State {
  const positions = buildPositions(raw.assets, raw.investments, raw.prices);
  const totals = sumPositions(positions);

  // Stesso perimetro delle `positions`, non tutte le `investments`.
  //
  // `raw.assets` arriva gia' filtrato su `archived = false`, ma
  // `raw.investments` no: e' una lettura separata. Passando la lista intera
  // a `portfolioReturn`, l'uscita di un asset archiviato (i soldi versati)
  // resta nel calcolo mentre il suo valore di oggi — escluso da `totals.value`
  // perche' l'asset non e' piu' fra i `positions` — sparisce dall'altro
  // lato. Il risultato e' un rendimento drammaticamente falsato in negativo:
  // l'XIRR legge quei soldi come spariti, non come "nascosti dal cruscotto
  // ma ancora tuoi". Verificato: archiviare Bitcoin (−34% ma tutt'altro che
  // sparito) da solo bastava a portare il rendimento annuo da positivo a
  // −50%.
  const assetIds = new Set(raw.assets.map((a) => a.id));
  const visibleInvestments = raw.investments.filter(
    (op) => op.asset_id !== null && assetIds.has(op.asset_id)
  );

  return {
    assets: raw.assets,
    investments: raw.investments,
    rules: raw.rules,
    positions,
    totals,
    series: raw.series,
    // `marketValue` e non `value`: gli ordini in esecuzione stanno nel saldo
    // ma i loro flussi non entrano in `cashFlows`, e passarli qui li
    // farebbe leggere come guadagno venuto dal nulla.
    annualReturn: portfolioReturn(visibleInvestments, totals.marketValue),
    loading: false,
    error: null,
    staleAt: stale?.at ?? null,
    staleReason: stale?.reason ?? null,
  };
}

export function usePortfolio() {
  const [state, setState] = useState<State>({
    assets: [],
    investments: [],
    rules: [],
    positions: [],
    totals: EMPTY_TOTALS,
    series: [],
    annualReturn: null,
    loading: true,
    error: null,
    staleAt: null,
    staleReason: null,
  });

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? null;

    const [assetsRes, opsRes, rulesRes, pricesRes, seriesRes] = await Promise.all([
      supabase.from("assets").select("*").eq("archived", false).order("sort_order"),
      supabase.from("investments").select("*").order("occurred_at"),
      supabase.from("investment_rules").select("*").order("amount", { ascending: false }),
      supabase.rpc("latest_asset_prices"),
      supabase.rpc("portfolio_daily"),
    ]);

    const failure = firstError(assetsRes, opsRes, rulesRes, pricesRes, seriesRes);
    if (failure) {
      // Un portafoglio calcolato su liste vuote direbbe "valore 0,00 €", che
      // e' l'unica frase peggiore di "non ho letto" su una schermata di
      // investimenti. Prima si guarda se c'e' una copia locale: il valore di
      // stamattina e' vero, era il valore di stamattina — basta dirlo.
      const cached = userId
        ? await readCache<PortfolioCache>(userId, CACHE_KEY)
        : null;

      if (cached) {
        const restored = build(cached.value, { at: cached.at, reason: failure });
        setState(restored);
        return restored;
      }

      // Senza copia locale lo stato precedente resta com'e'.
      setState((previous) => ({ ...previous, loading: false, error: failure }));
      return null;
    }

    const assets = (assetsRes.data ?? []) as Asset[];
    const investments = (opsRes.data ?? []) as Investment[];

    const prices: Record<string, LatestPrice> = {};
    for (const row of (pricesRes.data ?? []) as LatestPrice[] & { asset_id: string }[]) {
      prices[row.asset_id] = { close_eur: Number(row.close_eur), on_date: row.on_date };
    }

    const series = ((seriesRes.data ?? []) as SeriesPoint[]).map((p) => ({
      on_date: p.on_date,
      value_eur: Number(p.value_eur),
      invested_eur: Number(p.invested_eur),
    }));

    const raw: PortfolioCache = {
      assets,
      investments,
      rules: (rulesRes.data ?? []) as InvestmentRule[],
      prices,
      series,
    };

    const next = build(raw, null);
    setState(next);
    if (userId) writeCache<PortfolioCache>(userId, CACHE_KEY, raw);
    // Restituite anche direttamente: chi ha in mano una posizione presa da uno
    // stato precedente (es. la schermata di dettaglio aperta) altrimenti la
    // ritroverebbe aggiornata solo al render successivo, mai in questo stesso
    // giro — lo stato di React non e' pronto subito dopo averlo impostato.
    return next;
  }, []);

  useEffect(() => {
    let vivo = true;

    // Prima si mostra quello che c'e' gia' — la schermata deve aprirsi subito —
    // poi si chiede la quotazione del momento e si ridisegna se e' cambiata.
    // Il contrario (aspettare i prezzi per poi disegnare) farebbe pagare a ogni
    // apertura il tempo di una chiamata di rete per uno scarto di frazioni di
    // punto percentuale.
    load().then(() => {
      if (!vivo) return;
      refreshQuotes().then((cambiati) => {
        if (vivo && cambiati) load();
      });
    });

    return () => {
      vivo = false;
    };
  }, [load]);

  /** Ricarica chiedendo prima le quotazioni aggiornate (tira-per-aggiornare). */
  const reload = useCallback(async () => {
    await refreshQuotes();
    return load();
  }, [load]);

  return {
    ...state,
    staleLabel: state.staleAt ? describeAge(state.staleAt) : null,
    reload,
  };
}

/**
 * Chiede i prezzi del momento e dice se ne ha scritto qualcuno.
 *
 * Il broker mostra la quotazione di adesso: leggere un valore fermo alla
 * chiusura precedente fa apparire scarti che sembrano errori di calcolo
 * mentre sono solo due istantanee prese in momenti diversi.
 *
 * Un errore qui non deve impedire di vedere il portafoglio: senza rete si
 * continua a leggere l'ultimo prezzo salvato, che e' esattamente cio' che
 * serve in quel momento.
 */
async function refreshQuotes(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("refresh-quotes");
    if (error) return false;
    return Number((data as { aggiornati?: number })?.aggiornati ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Serie giornaliera di una fetta di portafoglio: un singolo asset o un intero
 * gruppo. Si carica alla prima apertura della sezione e non prima, cosi' una
 * schermata con quattro sezioni chiuse non fa quattro interrogazioni inutili.
 */
export function usePortfolioSeries(
  scope: { assetId?: string; group?: AssetGroup } | null
) {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [failed, setFailed] = useState(false);
  const key = scope ? `${scope.assetId ?? ""}|${scope.group ?? ""}` : null;

  useEffect(() => {
    if (!scope) return;
    let alive = true;

    supabase
      .rpc("portfolio_daily", {
        p_asset: scope.assetId ?? null,
        p_group: scope.group ?? null,
      })
      .then(({ data, error }) => {
        if (!alive) return;
        // Una serie vuota non e' neutra: senza punti il calcolo sul periodo
        // scelto non si puo' fare e la percentuale ripiega su quella di
        // sempre, restando pero' stampata sotto l'etichetta "1M" o "6M". Un
        // rendimento vero riferito a un altro arco di tempo e' piu' insidioso
        // di uno zero, perche' e' plausibile.
        setFailed(Boolean(error));
        if (error) return;
        setSeries(
          ((data ?? []) as SeriesPoint[]).map((p) => ({
            on_date: p.on_date,
            value_eur: Number(p.value_eur),
            invested_eur: Number(p.invested_eur),
          }))
        );
      });

    return () => {
      alive = false;
    };
    // Le due chiavi bastano a identificare la fetta: l'oggetto `scope` cambia
    // identita' a ogni render e rilancerebbe la query all'infinito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // `failed` distingue "questa fetta non ha ancora storia" da "la storia non
  // l'ho letta": nel primo caso il grafico vuoto e' la verita', nel secondo
  // ogni numero calcolato sul periodo sarebbe inventato.
  return { series, failed };
}
