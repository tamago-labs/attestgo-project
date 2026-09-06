"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { getChainById } from "@/lib/chains";
import { useWallet } from "@/components/app/WalletContext";
import { MARKETS, type DefiMarket } from "@/lib/defi/markets";
import { fmtPct, fmtUsd } from "@/lib/defi/format";
import { useDefiMarkets, useUserData } from "@/lib/defi/useDefiData";
import { fetchPriceMap } from "@/lib/defi/prices";
import { formatUnits } from "ethers";

const WAD = 10n ** 18n;

function fmt2(v: string | null): string {
  if (v === null) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TokenIcon({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setErr(true)}
        className="rounded-lg object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-mono text-white/60 shrink-0"
    >
      {symbol.slice(0, 4)}
    </div>
  );
}

function ListHeader({ accent, title, badge }: { accent: "amber" | "violet"; title: string; badge: string }) {
  const color = accent === "violet" ? "bg-[#8B7CF0]" : "bg-amber";
  const badgeColor = accent === "violet" ? "text-violet-300 bg-[#8B7CF0]/10" : "text-amber bg-amber/10";
  const ccChain = getChainById(102031)!;
  const sepChain = getChainById(11155111)!;
  return (
    <div className="pb-2 mb-3 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="relative text-base font-semibold text-white">
            {title}
            <span className={`absolute bottom-[-9px] left-0 h-0.5 w-10 ${color}`} />
          </h3>
          <div className="flex items-center gap-1 ml-1">
            {accent === "amber" ? (
              <img src={ccChain.icon} alt={ccChain.shortName} width={20} height={20} className="rounded-full" />
            ) : (
              <>
                <img src={sepChain.icon} alt={sepChain.shortName} width={20} height={20} className="rounded-full" />
                <ArrowRight size={10} className="text-white/25" />
                <img src={ccChain.icon} alt={ccChain.shortName} width={20} height={20} className="rounded-full" />
              </>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${badgeColor}`}>{badge}</span>
      </div>
    </div>
  );
}

function EarnRow({
  market,
  data,
  address,
  isConnected,
}: {
  market: DefiMarket;
  data: { supplyApy: number; utilization: number; state: { totalSupplyAssets: bigint } } | null;
  address: string | null;
  isConnected: boolean;
}) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const total = data ? formatUnits(data.state.totalSupplyAssets, market.loan.decimals) : null;
  const yours = user && user.suppliedAssets > 0n ? formatUnits(user.suppliedAssets, market.loan.decimals) : null;

  return (
    <Link href={`/app/defi/${market.slug}`} className="block hover:bg-white/[0.03] transition">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-3">
        <TokenIcon src={market.loan.icon} symbol={market.loan.symbol} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{market.loan.symbol}</div>
          <div className="text-xs text-muted truncate">{market.loan.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-white">{data ? `${fmtPct(data.supplyApy)}` : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">APY</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-mono text-sm text-white">{total ? fmt2(total) : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">supplied</div>
        </div>
        <div className="text-right w-16">
          {yours ? (
            <>
              <div className="font-mono text-sm text-violet-300">{fmt2(yours)}</div>
              <div className="text-[10px] text-muted uppercase tracking-wide">yours</div>
            </>
          ) : (
            <span className="text-white/20">›</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BorrowRow({
  market,
  data,
  address,
  isConnected,
}: {
  market: DefiMarket;
  data: { borrowApy: number; collateralPriceUsd: number; utilization: number } | null;
  address: string | null;
  isConnected: boolean;
}) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const borrowable = user && user.borrowableAssets > 0n ? formatUnits(user.borrowableAssets, market.loan.decimals) : null;

  return (
    <Link href={`/app/defi/${market.slug}/borrow`} className="block hover:bg-white/[0.03] transition">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-3">
        <TokenIcon src={market.collateral.icon} symbol={market.collateral.symbol} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{market.name}</div>
          <div className="text-xs text-muted truncate">{market.collateral.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-white">{data ? fmtPct(data.utilization, 1) : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">Util</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-mono text-sm text-white">{data ? `${fmtPct(data.borrowApy)}` : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">APR</div>
        </div>
        <div className="text-right w-16">
          {borrowable ? (
            <>
              <div className="font-mono text-sm text-amber">{fmt2(borrowable)}</div>
              <div className="text-[10px] text-muted uppercase tracking-wide">borrowable</div>
            </>
          ) : (
            <span className="text-white/20">›</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function DeFiPage() {
  const { address, isConnected } = useWallet();
  const { rows, error } = useDefiMarkets(MARKETS);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<"rwa" | "tbill" | "nikkei">("rwa");

  useEffect(() => {
    fetchPriceMap().then(setPriceMap);
  }, []);

  const filterLabel = "RWA Lending";

  let totalSupplied = 0;
  let totalBorrowed = 0;
  let bestApy = 0;
  let loaded = 0;
  for (const r of rows) {
    if (r.data) {
      const loanSym = r.market.loan.symbol;
      const price = priceMap[loanSym] ?? 0;
      const supplied = Number(formatUnits(r.data.state.totalSupplyAssets, r.market.loan.decimals));
      const borrowed = Number(formatUnits(r.data.state.totalBorrowAssets, r.market.loan.decimals));
      totalSupplied += supplied * price;
      totalBorrowed += borrowed * price;
      if (r.data.supplyApy > bestApy) bestApy = r.data.supplyApy;
      loaded++;
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2"><span className="w-1 h-4 bg-amber rounded" /><span className="font-mono text-xs font-medium text-white">DeFi for Pass Holders</span></div>
        <div className="relative">
          <button onClick={() => setFilterOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-panel text-xs font-medium text-white hover:bg-white/[0.04]">
            {filterLabel} <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>
          {filterOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-panel shadow-lg overflow-hidden z-20">
              <button onClick={() => { setFilter("rwa"); setFilterOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] ${filter === "rwa" ? "text-white bg-white/[0.04]" : "text-muted"}`}>RWA Lending</button>
            </div>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">Total supplied</div>
          <div className="font-mono text-lg font-semibold text-white">{loaded === rows.length ? fmtUsd(totalSupplied) : "—"}</div>
        </div>
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">TVL</div>
          <div className="font-mono text-lg font-semibold text-white">{loaded === rows.length ? fmtUsd(totalSupplied - totalBorrowed) : "—"}</div>
        </div>
        <div className="bg-panel border border-border rounded-2xl px-5 py-4">
          <div className="text-muted text-xs uppercase tracking-widest mb-1">Best APY</div>
          <div className="font-mono text-lg font-semibold text-white">{loaded === rows.length ? fmtPct(bestApy) : "—"}</div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
          Failed to load markets: {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Earn */}
        <div className="space-y-3">
          <ListHeader
            accent="amber"
            title="Earn"
            badge="earn yield on Creditcoin"
          />
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            {rows.map((r) => (
              <EarnRow
                key={`earn-${r.market.slug}`}
                market={r.market}
                data={r.data ? { supplyApy: r.data.supplyApy, utilization: r.data.utilization, state: r.data.state } : null}
                address={address}
                isConnected={isConnected}
              />
            ))}
          </div>
        </div>

        {/* Borrow — RWA collateral */}
        <div className="space-y-3">
          <ListHeader
            accent="violet"
            title="Borrow"
            badge="lock on Sepolia · borrow on Creditcoin"
          />
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            {rows.map((r) => (
              <BorrowRow
                key={`borrow-${r.market.slug}`}
                market={r.market}
                data={r.data ? { borrowApy: r.data.borrowApy, collateralPriceUsd: r.data.collateralPriceUsd, utilization: r.data.utilization } : null}
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
