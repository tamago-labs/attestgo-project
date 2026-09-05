"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { MARKETS, type DefiMarket } from "@/lib/defi/markets";
import { fmtPct, fmtUsd } from "@/lib/defi/format";
import { useDefiMarkets, useUserData } from "@/lib/defi/useDefiData";
import { formatUnits } from "ethers";

const WAD = 10n ** 18n;

function LaneBanner({
  tone,
  title,
  subtitle,
  badge,
}: {
  tone: "violet" | "amber";
  title: string;
  subtitle: string;
  badge: string;
}) {
  const v = tone === "violet";
  return (
    <div
      className={`rounded-xl px-5 py-3 mb-4 flex items-center justify-between ${
        v
          ? "bg-violet-400/10 border border-violet-400/25"
          : "bg-amber/10 border border-amber/25"
      }`}
    >
      <div className="min-w-0">
        <span className={`font-bold ${v ? "text-violet-300" : "text-amber"}`}>{title}</span>
        <span className="text-muted text-sm ml-2 hidden sm:inline">{subtitle}</span>
      </div>
      <span
        className={`text-[10px] font-mono px-2.5 py-1 rounded-full shrink-0 ${
          v ? "text-violet-300 bg-canvas/40" : "text-amber bg-canvas/40"
        }`}
      >
        {badge}
      </span>
    </div>
  );
}

function SupplyCard({
  market,
  data,
  address,
  isConnected,
}: {
  market: DefiMarket;
  data: {
    supplyApy: number;
    utilization: number;
    state: { totalSupplyAssets: bigint };
  } | null;
  address: string | null;
  isConnected: boolean;
}) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const total = data ? formatUnits(data.state.totalSupplyAssets, market.loan.decimals) : null;
  const yours = user && user.suppliedAssets > 0n ? formatUnits(user.suppliedAssets, market.loan.decimals) : null;

  return (
    <div className="bg-panel border border-border rounded-xl p-5 hover:border-violet-400/40 transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold text-base text-white">{market.name} Pool</div>
          <div className="text-muted text-sm mt-0.5">Supply {market.loan.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-muted text-[11px] uppercase tracking-widest">Supply APY</div>
          <div className="font-mono font-bold text-2xl text-violet-300">
            {data ? (
              fmtPct(data.supplyApy)
            ) : (
              <Loader2 size={18} className="animate-spin text-white/30 ml-auto" />
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-sm text-muted mb-4 pt-4 border-t border-border">
        <span>
          Supplied
          <br />
          <span className="text-white font-semibold font-mono">
            {total ? `${total} ${market.loan.symbol}` : "—"}
          </span>
        </span>
        <span className="text-right">
          Utilization
          <br />
          <span className="text-white font-semibold font-mono">
            {data ? fmtPct(data.utilization, 1) : "—"}
          </span>
        </span>
      </div>
      {yours && (
        <div className="text-[11px] text-muted mb-3">
          Your supply:{" "}
          <span className="text-violet-300 font-mono">
            {yours} {market.loan.symbol}
          </span>
        </div>
      )}
      <Link
        href={`/app/defi/${market.slug}`}
        className="block w-full bg-violet-400 text-canvas font-bold text-sm py-2.5 rounded-xl text-center hover:opacity-90 transition"
      >
        Supply {market.loan.symbol}
      </Link>
    </div>
  );
}

function BorrowCard({
  market,
  data,
  address,
  isConnected,
}: {
  market: DefiMarket;
  data: { borrowApy: number } | null;
  address: string | null;
  isConnected: boolean;
}) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const ltvPct = Number((market.lltv * 100n) / WAD);
  const borrowable =
    user && user.borrowableAssets > 0n ? formatUnits(user.borrowableAssets, market.loan.decimals) : null;

  return (
    <div className="bg-panel border border-border rounded-xl p-5 hover:border-amber/40 transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold text-base text-white">{market.collateral.symbol}</div>
          <div className="text-muted text-sm mt-0.5">{market.sub}</div>
        </div>
        <div className="text-right">
          <div className="text-muted text-[11px] uppercase tracking-widest">Borrow APY</div>
          <div className="font-mono font-bold text-2xl text-amber">
            {data ? (
              fmtPct(data.borrowApy)
            ) : (
              <Loader2 size={18} className="animate-spin text-white/30 ml-auto" />
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-sm text-muted mb-4 pt-4 border-t border-border">
        <span>
          Max LTV
          <br />
          <span className="text-white font-semibold font-mono">{ltvPct}%</span>
        </span>
        <span className="text-right">
          Borrow up to
          <br />
          <span className="text-white font-semibold font-mono">
            {borrowable ? `${borrowable} ${market.loan.symbol}` : "—"}
          </span>
        </span>
      </div>
      <Link
        href={`/app/defi/${market.slug}/borrow`}
        className="block w-full bg-amber text-canvas font-bold text-sm py-2.5 rounded-xl text-center hover:opacity-90 transition"
      >
        Lock {market.collateral.symbol} &amp; Borrow
      </Link>
    </div>
  );
}

export default function DeFiPage() {
  const { address, isConnected } = useWallet();
  const { rows, error } = useDefiMarkets(MARKETS);

  let totalSupplied = 0;
  let totalBorrowed = 0;
  let loaded = 0;
  for (const r of rows) {
    if (r.data) {
      totalSupplied += Number(formatUnits(r.data.state.totalSupplyAssets, r.market.loan.decimals));
      totalBorrowed += Number(formatUnits(r.data.state.totalBorrowAssets, r.market.loan.decimals));
      loaded++;
    }
  }

  return (
    <div className="w-full">
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">Total supplied</div>
          <div className="font-mono text-lg font-semibold text-white">{loaded === rows.length ? fmtUsd(totalSupplied) : "—"}</div>
        </div>
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">Total borrowed</div>
          <div className="font-mono text-lg font-semibold text-white">{loaded === rows.length ? fmtUsd(totalBorrowed) : "—"}</div>
        </div>
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">Markets</div>
          <div className="font-mono text-lg font-semibold text-white">{MARKETS.length}</div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
          Failed to load markets: {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
        {/* Supply column */}
        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-4">
          <LaneBanner
            tone="violet"
            title="Supply"
            subtitle="deposit stablecoins on Creditcoin, earn yield"
            badge="no bridging"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {rows.map((r) => (
              <SupplyCard
                key={`supply-${r.market.slug}`}
                market={r.market}
                data={
                  r.data
                    ? { supplyApy: r.data.supplyApy, utilization: r.data.utilization, state: r.data.state }
                    : null
                }
                address={address}
                isConnected={isConnected}
              />
            ))}
          </div>
        </div>

        {/* Borrow column */}
        <div className="rounded-2xl border border-amber/20 bg-amber/[0.04] p-4">
          <LaneBanner
            tone="amber"
            title="Borrow"
            subtitle="lock RWA collateral on Sepolia, borrow stablecoins"
            badge="Sepolia → attested"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {rows.map((r) => (
              <BorrowCard
                key={`borrow-${r.market.slug}`}
                market={r.market}
                data={r.data ? { borrowApy: r.data.borrowApy } : null}
                address={address}
                isConnected={isConnected}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
