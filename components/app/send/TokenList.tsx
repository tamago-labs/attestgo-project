"use client";

import { Loader2 } from "lucide-react";
import type { UnifiedRow } from "@/lib/send";
import type { DefaultToken } from "@/lib/defaultTokens";
import TokenRow from "./TokenRow";

export default function TokenList({
  filtered,
  balances,
  address,
  loadingRegistry,
  filter,
  openMenu,
  setOpenMenu,
  setFaucetToken,
  priceMap,
}: {
  filtered: UnifiedRow[];
  balances: Record<string, bigint>;
  address: string | null;
  loadingRegistry: boolean;
  filter: number | "all";
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  setFaucetToken: (t: DefaultToken | null) => void;
  priceMap?: Record<string, number>;
}) {
  if (loadingRegistry && filtered.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading tokens
      </div>
    );
  }
  if (filtered.length === 0) {
    return <div className="p-8 text-center text-sm text-muted">No tokens{filter !== "all" ? " on this chain" : ""}</div>;
  }
  return (
    <>
      {filtered.map((r) => {
        const bal = balances[r.key];
        const loadingBal = !!address && bal === undefined;
        return <TokenRow key={r.key} row={r} bal={bal} loadingBal={loadingBal} address={address} openMenu={openMenu} setOpenMenu={setOpenMenu} setFaucetToken={setFaucetToken} priceMap={priceMap} />;
      })}
    </>
  );
}
