"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DefiMarket } from "./markets";
import { fetchMarketData, fetchUserData, type MarketData, type UserData } from "./read";

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number, deps: unknown[]): { data: T | null; error: string | null; refresh: () => void; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    fnRef
      .current()
      .then((d) => {
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    if (intervalMs <= 0) return;
    const t = setInterval(run, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, refresh: run, loading };
}

export type MarketRow = { market: DefiMarket; data: MarketData | null };

export function useDefiMarkets(markets: DefiMarket[]): { rows: MarketRow[]; refresh: () => void; error: string | null } {
  const [rows, setRows] = useState<MarketRow[]>(markets.map((market) => ({ market, data: null })));
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      markets.map(async (market) => {
        try {
          return { market, data: await fetchMarketData(market) };
        } catch {
          return { market, data: null };
        }
      })
    );
    setRows(results);
    setError(null);
  }, [markets]);

  useEffect(() => {
    fetchAll().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    const t = setInterval(() => fetchAll().catch(() => {}), 20_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  return { rows, refresh: fetchAll, error };
}

export function useMarketData(market: DefiMarket): { data: MarketData | null; error: string | null; refresh: () => void; loading: boolean } {
  return usePoll(
    () => fetchMarketData(market),
    15_000,
    [market.slug]
  );
}

export function useUserData(market: DefiMarket, address: string | null): { data: UserData | null; error: string | null; refresh: () => void; loading: boolean } {
  return usePoll(
    async () => (address ? fetchUserData(market, address) : null),
    address ? 12_000 : 0,
    [market.slug, address]
  );
}
