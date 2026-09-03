"use client";

import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { SUPPORTED_CHAINS, getChainById } from "@/lib/chains";
import { shortAddr, chainName } from "@/lib/send";

function countryFlag(code?: string) {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0) - 65, A + code.toUpperCase().charCodeAt(1) - 65);
}

export default function SendSidebar({
  address,
  walletChainId,
  totalUsd,
  balancesLoading,
  balancesCount,
  filter,
  setFilter,
  alloc,
  onRefresh,
  identity,
}: {
  address: string | null;
  walletChainId: number | null;
  totalUsd: number;
  balancesLoading: boolean;
  balancesCount: number;
  filter: number | "all";
  setFilter: (v: number | "all") => void;
  alloc: { by: Record<string, number>; total: number };
  onRefresh?: () => void;
  identity?: { status: "verified" | "pending" | "unverified" | "idle"; tier?: number; country?: string };
}) {
  return (
    <div className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0 bg-panel">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2 bg-panel">
        <span className="w-1 h-4 bg-amber rounded" />
        <h3 className="font-medium text-white text-sm">Send</h3>
      </div>
      <div className="p-4 overflow-y-auto">
        <p className="text-muted text-sm mb-1">Total balance</p>
        <p className="text-2xl font-semibold tracking-tight text-white mb-1">
          {address ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
        </p>
        {!address ? (
          <p className="text-xs text-amber/70 mb-4">Connect wallet to load balances</p>
        ) : (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs text-white/30 font-mono flex-1">{balancesCount} tokens in wallet</p>
            <button onClick={onRefresh} disabled={balancesLoading} className="w-6 h-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-40" aria-label="Refresh balances">
              <RefreshCw size={12} className={`text-muted ${balancesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}

        <div className="flex gap-1.5 mb-4">
          <button onClick={() => setFilter("all")} className={`px-2.5 py-1 rounded-full text-xs border ${filter === "all" ? "bg-white text-canvas border-white" : "bg-white/5 text-muted border-white/10 hover:text-white"}`}>
            All
          </button>
          {SUPPORTED_CHAINS.map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)} className={`px-2.5 py-1 rounded-full text-xs border ${filter === c.id ? "bg-white text-canvas border-white" : "bg-white/5 text-muted border-white/10 hover:text-white"}`}>
              {c.shortName}
            </button>
          ))}
        </div>

        <p className="text-white/30 text-xs uppercase tracking-wide mb-2">Allocation</p>
        <div className="h-2 rounded-full overflow-hidden flex mb-3 bg-canvas border border-border">
          {(() => {
            const dotColors = ["#fbbf24", "#a78bfa", "#34d399", "#38bdf8", "#f472b6"];
            const sorted = Object.entries(alloc.by).sort((a, b) => b[1] - a[1]);
            return sorted.map(([sym, v], i) => {
              const pct = (v / alloc.total) * 100;
              return <div key={sym} style={{ width: `${pct}%`, background: dotColors[i % dotColors.length] }} />;
            });
          })()}
          {Object.keys(alloc.by).length === 0 && <div className="bg-white/5 flex-1" />}
        </div>
        <ul className="space-y-2 text-sm">
          {Object.entries(alloc.by).length === 0 ? (
            <li className="text-xs text-muted border border-dashed border-white/10 rounded-lg p-2 text-center leading-relaxed">No balances yet — use <span className="text-white">Faucet</span> on a token or <span className="text-white">Add token</span> by address</li>
          ) : (
            Object.entries(alloc.by)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([sym, v], i) => {
                const pct = ((v / alloc.total) * 100).toFixed(1);
                const dotColors = ["#fbbf24", "#a78bfa", "#34d399", "#38bdf8", "#f472b6"];
                return (
                  <li key={sym} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="w-2 h-2 rounded-full" style={{ background: dotColors[i % dotColors.length] }} />
                      {sym}
                    </span>
                    <span className="font-mono text-white/40 text-xs">{pct}%</span>
                  </li>
                );
              })
          )}
        </ul>

        {address && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-white/30 text-xs mb-1">Identity</p>
            {identity?.status === "verified" ? (
              <p className="text-sm text-emerald-300">
                Verified · Tier {identity.tier ?? 10}
                {identity.country ? ` · ${countryFlag(identity.country)} ${identity.country.toUpperCase()}` : ""}
              </p>
            ) : identity?.status === "pending" ? (
              <p className="text-sm text-amber-300">
                Pending verification{identity.country ? ` · ${countryFlag(identity.country)} ${identity.country.toUpperCase()}` : ""}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted">
                  Not verified{identity?.country ? ` · ${countryFlag(identity.country)} ${identity.country.toUpperCase()}` : ""}
                </p>
                <Link href="/app/identity" className="text-xs px-2 py-0.5 rounded-full bg-white text-canvas hover:bg-white/90">Get GO Pass</Link>
              </div>
            )}
            <p className="text-xs font-mono text-muted truncate mt-1">{shortAddr(address)} · {walletChainId ? chainName(walletChainId) : chainName(SUPPORTED_CHAINS[0].id)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
