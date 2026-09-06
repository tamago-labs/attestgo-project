"use client";

import { ExternalLink, ChevronDown } from "lucide-react";
import { getExplorerAddressUrl } from "@/lib/chains";
import { bitmapToCountries, formatUnits, fmtUsd, type UnifiedRow } from "@/lib/send";
import { DEFAULT_TOKENS } from "@/lib/defaultTokens";
import TokenIcon from "./TokenIcon";

export default function TokenRow({
  row,
  bal,
  loadingBal,
  address,
  openMenu,
  setOpenMenu,
  setFaucetToken,
  setSendRow,
  priceMap,
}: {
  row: UnifiedRow;
  bal: bigint | undefined;
  loadingBal: boolean;
  address: string | null;
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  setFaucetToken: (t: (typeof DEFAULT_TOKENS)[number] | null) => void;
  setSendRow: (r: UnifiedRow) => void;
  priceMap?: Record<string, number>;
}) {
  const balText = !address ? `— ${row.symbol}` : loadingBal ? "…" : `${formatUnits(bal ?? BigInt(0), row.decimals)} ${row.symbol}`;
  const usdText = !address ? "$0.00" : loadingBal ? "…" : fmtUsd(bal ?? BigInt(0), row.decimals, row.symbol, priceMap);
  return (
    <div className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
      <div className="flex items-center gap-3 min-w-0">
        <TokenIcon icon={row.icon} symbol={row.symbol} />
        <div className="min-w-0">
          <p className="font-medium text-white text-sm truncate">{row.name}</p>
          <p className="text-white/30 text-xs font-mono truncate flex items-center gap-1.5 flex-wrap">
            {balText}
            {row.source !== "default" && (row.ruleMinTier !== undefined || row.ruleBitmap !== undefined) && (
              <>
                {row.ruleMinTier !== undefined && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/60">Tier ≥{row.ruleMinTier}</span>}
                {row.ruleBitmap !== undefined && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/60">{bitmapToCountries(row.ruleBitmap)}</span>}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 relative">
        <p className="font-mono text-sm text-white">{usdText}</p>
        <button onClick={() => setSendRow(row)} className="text-amber text-xs hover:text-white transition-colors">
          Send
        </button>
        <button onClick={() => setOpenMenu(openMenu === row.key ? null : row.key)} className="text-amber hover:text-white transition-colors flex items-center" aria-label="More">
          <ChevronDown size={14} className={`transition-transform ${openMenu === row.key ? "rotate-180" : ""}`} />
        </button>
        {openMenu === row.key && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
            <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-canvas shadow-xl overflow-hidden">
              {row.source === "default" && (
                <button onClick={() => { setFaucetToken(DEFAULT_TOKENS.find((t) => t.address.toLowerCase() === row.address.toLowerCase() && t.chainId === row.chainId) || null); setOpenMenu(null); }} className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors text-left">
                  Faucet
                </button>
              )}
              <a href={getExplorerAddressUrl(row.chainId, row.address)} target="_blank" rel="noreferrer" onClick={() => setOpenMenu(null)} className="flex items-center justify-between px-3 py-2.5 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors">
                View contract <ExternalLink size={12} />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
