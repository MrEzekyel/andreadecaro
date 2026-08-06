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
import { Asset, Investment } from "./types";

type State = {
  assets: Asset[];
  investments: Investment[];
  positions: Position[];
  totals: PortfolioTotals;
  series: SeriesPoint[];
  xirr: number | null;
  loading: boolean;
};

const EMPTY_TOTALS: PortfolioTotals = {
  value: 0,
  costBasis: 0,
  dividends: 0,
  pending: 0,
  fees: 0,
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
    positions: [],
    totals: EMPTY_TOTALS,
    series: [],
    xirr: null,
    loading: true,
  });

  const load = useCallback(async () => {
    const [assetsRes, opsRes, pricesRes, seriesRes] = await Promise.all([
      supabase.from("assets").select("*").eq("archived", false).order("sort_order"),
      supabase.from("investments").select("*").order("occurred_at"),
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

/** Serie giornaliera di un singolo asset, per la sua schermata di dettaglio. */
export function useAssetSeries(assetId: string) {
  const [series, setSeries] = useState<SeriesPoint[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.rpc("portfolio_daily", { p_asset: assetId }).then(({ data }) => {
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
  }, [assetId]);

  return series;
}
