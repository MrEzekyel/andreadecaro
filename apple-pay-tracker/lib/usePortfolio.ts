import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  LatestPrice,
  Position,
  PortfolioTotals,
  SeriesPoint,
  buildPositions,
  portfolioXirr,
  sumPositions,
} from "./portfolio";
import { Asset, AssetGroup, Investment, InvestmentRule } from "./types";

type State = {
  assets: Asset[];
  investments: Investment[];
  /** I piani di accumulo: quanto entra ogni mese, e su quale asset. */
  rules: InvestmentRule[];
  positions: Position[];
  totals: PortfolioTotals;
  series: SeriesPoint[];
  xirr: number | null;
  loading: boolean;
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
export function usePortfolio() {
  const [state, setState] = useState<State>({
    assets: [],
    investments: [],
    rules: [],
    positions: [],
    totals: EMPTY_TOTALS,
    series: [],
    xirr: null,
    loading: true,
  });

  const load = useCallback(async () => {
    const [assetsRes, opsRes, rulesRes, pricesRes, seriesRes] = await Promise.all([
      supabase.from("assets").select("*").eq("archived", false).order("sort_order"),
      supabase.from("investments").select("*").order("occurred_at"),
      supabase.from("investment_rules").select("*").order("amount", { ascending: false }),
      supabase.rpc("latest_asset_prices"),
      supabase.rpc("portfolio_daily"),
    ]);

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

    const positions = buildPositions(assets, investments, prices);
    const totals = sumPositions(positions);

    const next: State = {
      assets,
      investments,
      rules: (rulesRes.data ?? []) as InvestmentRule[],
      positions,
      totals,
      series,
      xirr: portfolioXirr(investments, totals.value),
      loading: false,
    };
    setState(next);
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

  return { ...state, reload };
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
  const key = scope ? `${scope.assetId ?? ""}|${scope.group ?? ""}` : null;

  useEffect(() => {
    if (!scope) return;
    let alive = true;

    supabase
      .rpc("portfolio_daily", {
        p_asset: scope.assetId ?? null,
        p_group: scope.group ?? null,
      })
      .then(({ data }) => {
        if (!alive) return;
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

  return series;
}
