"use client";

import { useState } from "react";
import { Contract, parseUnits, formatUnits } from "ethers";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { CORE_ABI, MORPHO_ABI } from "@/lib/defi/read";
import { CREDITCOIN_CHAIN_ID, CORE_VAULT, MORPHO, type DefiMarket } from "@/lib/defi/markets";
import type { MarketData, UserData } from "@/lib/defi/read";

export default function StepBorrow({ market, marketData, userData, onDone }: { market: DefiMarket; marketData: MarketData | null; userData: UserData | null; onDone: () => void }) {
  const { address, signer, chainId, isConnected, switchNetwork } = useWallet();
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"idle" | "switching" | "authorizing" | "confirming" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrongChain = isConnected && chainId !== CREDITCOIN_CHAIN_ID;
  const dec = market.loan.decimals;
  const hasCollateral = !!userData && userData.collateral > 0n;
  const borrowable = userData?.borrowableAssets ?? 0n;
  const amt = (() => {
    try {
      return amount === "" ? 0n : parseUnits(amount, dec);
    } catch {
      return 0n;
    }
  })();
  const valid = amt > 0n && amt <= borrowable;
  const needsAuth = !!userData && !userData.authorized;

  const borrow = async () => {
    if (!signer || !address) return;
    setErr(null);
    setTxHash(null);
    try {
      if (wrongChain) {
        setStage("switching");
        await switchNetwork(CREDITCOIN_CHAIN_ID);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = new Contract(CORE_VAULT, CORE_ABI, signer) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const morpho = new Contract(MORPHO, MORPHO_ABI, signer) as any;
      if (needsAuth) {
        setStage("authorizing");
        const atx = await morpho.setAuthorization(CORE_VAULT, true);
        await atx.wait();
      }
      setStage("confirming");
      const tx = await core.borrow(market.mp, amt, address);
      setTxHash(tx.hash);
      await tx.wait();
      setStage("success");
      onDone();
      setAmount("");
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const busy = stage === "switching" || stage === "authorizing" || stage === "confirming";
  const label = stage === "authorizing" ? "Authorizing CoreVault…" : stage === "confirming" ? "Borrowing…" : wrongChain ? "Switch to Creditcoin" : needsAuth ? "Authorize & borrow" : `Borrow ${market.loan.symbol}`;

  return (
    <div className="border border-border rounded-xl bg-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-amber/15 border border-amber/30 text-amber text-[10px] font-mono flex items-center justify-center">3</span>
        <h3 className="text-sm font-semibold text-white">Borrow {market.loan.symbol} on Creditcoin</h3>
        <span className="ml-auto text-[11px] text-muted font-mono">
          max {userData ? formatUnits(borrowable, dec) : "—"} {market.loan.symbol}
        </span>
      </div>

      {!hasCollateral ? (
        <p className="text-xs text-muted">Collateral is not on Creditcoin yet — complete steps 1 and 2 first.</p>
      ) : (
        <>
          <div className="rounded-lg bg-canvas border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                className="flex-1 min-w-0 bg-transparent font-mono text-xl text-white outline-none placeholder:text-white/20"
              />
              <span className="font-mono text-sm text-white/60 shrink-0">{market.loan.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">Borrowable (62% LTV)</span>
              <button onClick={() => setAmount(borrowable > 0n ? formatUnits(borrowable, dec) : "")} className="text-amber hover:text-white font-medium">
                MAX
              </button>
            </div>
          </div>

          {marketData && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Borrow APR</span>
              <span className="font-mono text-white/70">{(marketData.borrowApy * 100).toFixed(2)}%</span>
            </div>
          )}
        </>
      )}

      {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-all">{err}</div>}

      {stage === "success" ? (
        <div className="w-full py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium inline-flex justify-center items-center gap-2">
          <CheckCircle2 size={15} /> Borrowed
          {txHash && (
            <a href={`${"https://creditcoin-testnet.blockscout.com"}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] hover:text-white">
              tx <ExternalLink size={10} />
            </a>
          )}
        </div>
      ) : !isConnected ? (
        <div className="w-full py-2.5 rounded-lg border border-border text-muted text-sm text-center">Connect wallet to continue</div>
      ) : (
        <button onClick={borrow} disabled={!hasCollateral || (!valid && !wrongChain) || busy} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 inline-flex justify-center items-center gap-2">
          {busy && <Loader2 size={15} className="animate-spin" />} {busy && <ShieldCheck size={14} />} {label}
        </button>
      )}

      <p className="text-[11px] text-muted">
        {needsAuth ? "One-time: authorize CoreVault to borrow on your behalf (Morpho authorization)." : "CoreVault borrows on your behalf — your collateral is proven, never moved."}
      </p>
    </div>
  );
}
