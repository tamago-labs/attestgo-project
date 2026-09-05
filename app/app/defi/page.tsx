"use client";

import Link from "next/link";
import { useWallet } from "@/components/app/WalletContext";
import { MARKETS, type DefiMarket } from "@/lib/defi/markets";
import { fmtPct, fmtUsd } from "@/lib/defi/format";
import { useDefiMarkets } from "@/lib/defi/useDefiData";
import { formatUnits } from "ethers";

const WAD = 10n ** 18n;

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

function EarnRow({ market, data }: { market: DefiMarket; data: { supplyApy: number } | null }) {
  return (
    <Link href={`/app/defi/${market.slug}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition">
      <span className="flex items-center gap-3 text-sm text-white">
        <span className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/60">
          {market.loan.symbol.slice(0, 2)}
        </span>
        {market.name}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm text-white">{data ? `${fmtPct(data.supplyApy)} APY` : "—"}</span>
        <span className="text-white/25">›</span>
      </span>
    </Link>
  );
}

function BorrowRow({ market, data }: { market: DefiMarket; data: { borrowApy: number } | null }) {
  const ltvPct = Number((market.lltv * 100n) / WAD);
  return (
    <Link href={`/app/defi/${market.slug}/borrow`} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition">
      <span className="flex items-center gap-3 text-sm text-white">
        <span className="w-6 h-6 rounded-full bg-amber/15 border border-amber/20 flex items-center justify-center text-[10px] font-mono text-amber">
          {market.name.slice(3, 5)}
        </span>
        <span>
          <span className="block text-sm font-medium text-white">{market.name}</span>
          <span className="block text-xs text-muted">{market.sub}</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-white text-right">
          LTV {ltvPct}%<br />{data ? `${fmtPct(data.borrowApy)} APR` : "—"}
        </span>
        <span className="text-white/25">›</span>
      </span>
    </Link>
  );
}

export default function DeFiPage() {
  const { address } = useWallet();
  void address;
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
              <EarnRow key={`earn-${r.market.slug}`} market={r.market} data={r.data ? { supplyApy: r.data.supplyApy } : null} />
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
              <BorrowRow key={`borrow-${r.market.slug}`} market={r.market} data={r.data ? { borrowApy: r.data.borrowApy } : null} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
