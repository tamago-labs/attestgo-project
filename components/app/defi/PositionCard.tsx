"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatUnits } from "ethers";
import type { DefiMarket } from "@/lib/defi/markets";
import type { MarketData, UserData } from "@/lib/defi/read";

export default function PositionCard({ market, marketData, userData }: { market: DefiMarket; marketData: MarketData | null; userData: UserData | null }) {
  const dec = market.loan.decimals;
  const fmt = (v: string) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const supplied = userData ? fmt(formatUnits(userData.suppliedAssets, dec)) : "—";
  const collateral = userData && userData.collateral > 0n ? fmt(formatUnits(userData.collateral, 18)) : null;
  const borrowed = userData && userData.borrowedAssets > 0n ? fmt(formatUnits(userData.borrowedAssets, dec)) : null;
  const borrowable = userData ? fmt(formatUnits(userData.borrowableAssets, dec)) : "—";
  const ratio = userData?.borrowLimitRatio ?? 0;
  const risk = ratio >= 0.9 ? "high" : ratio >= 0.7 ? "elevated" : "safe";

  return (
    <div className="border border-border rounded-xl bg-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Your position</h3>
        {userData?.authorized ? null : <span className="text-[10px] text-muted">CoreVault not authorized yet</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-canvas border border-border p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">Supplied</div>
          <div className="mt-1 font-mono text-sm text-white">{supplied} <span className="text-white/40 text-xs">{market.loan.symbol}</span></div>
          {marketData && userData && userData.suppliedAssets > 0n && (
            <div className="mt-0.5 text-[11px] text-emerald-300 font-mono">+{(marketData.supplyApy * 100).toFixed(2)}% APY</div>
          )}
        </div>
        <div className="rounded-lg bg-canvas border border-border p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">Collateral (from Sepolia)</div>
          <div className="mt-1 font-mono text-sm text-violet-300">{collateral ?? "0"} <span className="text-white/40 text-xs">{market.collateral.symbol}</span></div>
          {marketData && collateral && (
            <div className="mt-0.5 text-[11px] text-muted font-mono">≈ {marketData.collateralPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })} {market.loan.symbol} / {market.collateral.symbol}</div>
          )}
        </div>
        <div className="rounded-lg bg-canvas border border-border p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">Borrowed</div>
          <div className="mt-1 font-mono text-sm text-white">{borrowed ?? "0"} <span className="text-white/40 text-xs">{market.loan.symbol}</span></div>
          {marketData && borrowed && (
            <div className="mt-0.5 text-[11px] text-muted font-mono">{(marketData.borrowApy * 100).toFixed(2)}% APR</div>
          )}
        </div>
        <div className="rounded-lg bg-canvas border border-border p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">Borrowable</div>
          <div className="mt-1 font-mono text-sm text-white">{borrowable} <span className="text-white/40 text-xs">{market.loan.symbol}</span></div>
        </div>
      </div>

      {/* health bar */}
      {borrowed && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">Borrow limit used</span>
            <span className={`font-mono ${risk === "high" ? "text-red-300" : risk === "elevated" ? "text-amber" : "text-emerald-300"}`}>{(ratio * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${risk === "high" ? "bg-red-400" : risk === "elevated" ? "bg-amber" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted">
            {risk === "high" ? <ShieldAlert size={10} className="text-red-300" /> : <ShieldCheck size={10} className="text-emerald-300" />}
            LTV {(Number(market.lltv) / 1e18 * 100).toFixed(0)}% · keep usage below 90% to stay safe from liquidation
          </div>
        </div>
      )}

      <Link
        href={collateral ? `/app/defi/${market.slug}/borrow` : `/app/defi/${market.slug}/borrow`}
        className="w-full py-2.5 rounded-lg bg-violet-400/15 border border-violet-400/30 text-violet-200 text-sm font-medium hover:bg-violet-400/25 inline-flex justify-center items-center gap-2 group"
      >
        {collateral ? "Manage borrow" : "Borrow with locked RWA"}
        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
