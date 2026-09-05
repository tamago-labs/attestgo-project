"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { MARKETS } from "@/lib/defi/markets";
import { fmtPct, fmtUsd } from "@/lib/defi/format";
import { useDefiMarkets, useUserData } from "@/lib/defi/useDefiData";
import { CREDITCOIN_CHAIN_ID, SEPOLIA_CHAIN_ID } from "@/lib/defi/markets";
import { formatUnits } from "ethers";

function ChainBadge({ chainId }: { chainId: number }) {
  const label = chainId === CREDITCOIN_CHAIN_ID ? "Creditcoin" : "Sepolia";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${chainId === CREDITCOIN_CHAIN_ID ? "border-amber/25 bg-amber/10 text-amber" : "border-violet-400/25 bg-violet-400/10 text-violet-300"}`}>
      {label}
    </span>
  );
}

function TokenIcon({ symbol, tone }: { symbol: string; tone: "loan" | "collateral" }) {
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-mono border shrink-0 ${tone === "loan" ? "bg-amber/15 border-amber/25 text-amber" : "bg-violet-400/15 border-violet-400/25 text-violet-300"}`}>
      {symbol.slice(0, 4)}
    </span>
  );
}

export default function DeFiPage() {
  const { address, isConnected } = useWallet();
  const { rows, refresh, error } = useDefiMarkets(MARKETS);
  const [refreshing, setRefreshing] = useState(false);

  const totals = rows.reduce(
    (acc, r) => {
      if (r.data) {
        acc.liquidity += Number(r.data.state.totalSupplyAssets - r.data.state.totalBorrowAssets);
        acc.supplied += Number(r.data.state.totalSupplyAssets);
      }
      return acc;
    },
    { liquidity: 0, supplied: 0 }
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="w-full space-y-5">
      {/* summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-xl bg-panel p-4">
          <div className="text-xs text-muted uppercase tracking-widest">Total liquidity</div>
          <div className="mt-1 font-mono text-lg text-white">{totals.supplied ? fmtUsd(totals.liquidity) : <Loader2 size={16} className="animate-spin text-white/30" />}</div>
        </div>
        <div className="border border-border rounded-xl bg-panel p-4">
          <div className="text-xs text-muted uppercase tracking-widest">Total supplied</div>
          <div className="mt-1 font-mono text-lg text-white">{totals.supplied ? fmtUsd(totals.supplied) : <Loader2 size={16} className="animate-spin text-white/30" />}</div>
        </div>
        <div className="border border-border rounded-xl bg-panel p-4">
          <div className="text-xs text-muted uppercase tracking-widest">Markets</div>
          <div className="mt-1 font-mono text-lg text-white">{MARKETS.length}</div>
        </div>
      </div>

      {/* market table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-amber rounded" />
            <h3 className="text-lg font-semibold text-white">Markets</h3>
            <span className="text-emerald-300 text-xs font-mono">live on Creditcoin testnet</span>
          </div>
          <button onClick={handleRefresh} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white px-2 py-1 rounded-lg border border-border hover:border-white/20">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">Failed to load markets: {error}</div>
        )}

        <div className="border border-border rounded-xl overflow-hidden bg-panel">
          <div className="hidden sm:grid grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr_1.4fr_24px] gap-2 px-4 py-2.5 text-[11px] uppercase tracking-widest text-white/40 border-b border-border">
            <span>Market</span>
            <span className="text-right">Supply APY</span>
            <span className="text-right">Borrow APY</span>
            <span className="text-right">Total Supplied</span>
            <span className="text-right">Utilization</span>
            <span className="text-right">Your Position</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <MarketRowView key={r.market.slug} market={r.market} data={r.data} address={address} isConnected={isConnected} />
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted px-1">
          Supply directly on Creditcoin. Borrow requires locking RWA collateral on Sepolia — collateral is never moved, it is proven to Creditcoin via block attestations.
        </p>
      </div>
    </div>
  );
}

function MarketRowView({ market, data, address, isConnected }: { market: (typeof MARKETS)[number]; data: { borrowApy: number; supplyApy: number; state: { totalSupplyAssets: bigint; totalBorrowAssets: bigint }; utilization: number; collateralPriceUsd: number } | null; address: string | null; isConnected: boolean }) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasPosition = user && (user.suppliedAssets > 0n || user.borrowedAssets > 0n || user.collateral > 0n);

  return (
    <Link href={`/app/defi/${market.slug}`} className="block hover:bg-white/[0.03] transition-colors">
      <div className="grid sm:grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr_1.4fr_24px] gap-2 items-center px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <TokenIcon symbol={market.name.replace("GO-", "")} tone="collateral" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-white truncate">
              {market.name}
              <ArrowUpRight size={12} className="text-white/25 shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ChainBadge chainId={SEPOLIA_CHAIN_ID} />
              <span className="text-white/20 text-[10px]">→</span>
              <ChainBadge chainId={CREDITCOIN_CHAIN_ID} />
              <span className="text-muted text-[10px] truncate ml-0.5">{market.sub}</span>
            </div>
          </div>
        </div>
        <div className="text-right font-mono text-sm text-emerald-300">{data ? fmtPct(data.supplyApy) : <Loader2 size={13} className="inline animate-spin text-white/30" />}</div>
        <div className="text-right font-mono text-sm text-white">{data ? fmtPct(data.borrowApy) : <Loader2 size={13} className="inline animate-spin text-white/30" />}</div>
        <div className="text-right font-mono text-sm text-white/80 sm:block hidden">
          {data ? `${formatUnits(data.state.totalSupplyAssets, market.loan.decimals)} ${market.loan.symbol}` : "—"}
        </div>
        <div className="text-right font-mono text-sm text-white/80">
          {data ? (
            <span className="inline-flex items-center gap-1.5">
              {fmtPct(data.utilization, 1)}
              <span className="w-10 h-1 rounded-full bg-white/10 overflow-hidden inline-block align-middle">
                <span className="block h-full bg-amber rounded-full" style={{ width: `${Math.min(100, data.utilization * 100)}%` }} />
              </span>
            </span>
          ) : (
            "—"
          )}
        </div>
        <div className="text-right">
          {hasPosition ? (
            <span className="font-mono text-xs text-white/80">
              {mounted && user ? `${formatUnits(user.suppliedAssets, market.loan.decimals)} ${market.loan.symbol}` : "—"}
              {user && user.borrowedAssets > 0n ? ` · ${formatUnits(user.borrowedAssets, market.loan.decimals)} owed` : ""}
              {user && user.collateral > 0n ? ` · ${formatUnits(user.collateral, 18)} ${market.collateral.symbol}` : ""}
            </span>
          ) : (
            <span className="text-xs text-white/25">—</span>
          )}
        </div>
        <span className="text-white/25 hidden sm:block">›</span>
      </div>
    </Link>
  );
}
