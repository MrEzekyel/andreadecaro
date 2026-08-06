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

    setState({
      assets,
      investments,
      rules: (rulesRes.data ?? []) as InvestmentRule[],
      positions,
      totals,
      series,
      xirr: portfolioXirr(investments, totals.value),
      loading: false,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
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
