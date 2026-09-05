"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/app/WalletContext";
import { MARKETS, type DefiMarket } from "@/lib/defi/markets";
import { fmtPct, fmtUsd } from "@/lib/defi/format";
import { useDefiMarkets, useUserData } from "@/lib/defi/useDefiData";
import { formatUnits } from "ethers";

const WAD = 10n ** 18n;

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
        className="rounded-lg object-cover border border-white/10 bg-white shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/60 shrink-0"
    >
      {symbol.slice(0, 4)}
    </div>
  );
}

function ListHeader({
  accent,
  title,
  badge,
  desc,
}: {
  accent: "amber" | "violet";
  title: string;
  badge: string;
  desc: string;
}) {
  return (
    <div className="border border-border rounded-xl bg-panel p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded" style={{ background: accent === "violet" ? "#8B7CF0" : "#FDB750" }} />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span className={`text-xs font-mono ${accent === "violet" ? "text-violet-300" : "text-emerald-300"}`}>{badge}</span>
      </div>
      <p className="text-muted text-sm">{desc}</p>
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
          <div className="text-sm font-medium text-white truncate">{market.name}</div>
          <div className="text-xs text-muted truncate">{market.loan.symbol} · {market.sub}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-white">{data ? `${fmtPct(data.supplyApy)}` : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">APY</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-mono text-sm text-white">{total ? `${total}` : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">supplied</div>
        </div>
        <div className="text-right w-16">
          {yours ? (
            <>
              <div className="font-mono text-sm text-violet-300">{yours}</div>
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
  data: { borrowApy: number; collateralPriceUsd: number } | null;
  address: string | null;
  isConnected: boolean;
}) {
  const { data: user } = useUserData(market, isConnected ? address : null);
  const ltvPct = Number((market.lltv * 100n) / WAD);
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
          <div className="font-mono text-sm text-white">{ltvPct}%</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">LTV</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-mono text-sm text-white">{data ? `${fmtPct(data.borrowApy)}` : "—"}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">APR</div>
        </div>
        <div className="text-right w-16">
          {borrowable ? (
            <>
              <div className="font-mono text-sm text-amber">{borrowable}</div>
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Earn */}
        <div className="space-y-3">
          <ListHeader
            accent="amber"
            title="Earn"
            badge="on Creditcoin"
            desc="Supply a verified asset and earn yield — attestation verifies the counterparty, not you."
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
            badge="collateral stays on source chain"
            desc="Lock RWA collateral where your assets already live, draw liquidity from Creditcoin."
          />
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            {rows.map((r) => (
              <BorrowRow
                key={`borrow-${r.market.slug}`}
                market={r.market}
                data={r.data ? { borrowApy: r.data.borrowApy, collateralPriceUsd: r.data.collateralPriceUsd } : null}
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
