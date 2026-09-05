"use client";

import { useState } from "react";
import { Contract, parseUnits, formatUnits } from "ethers";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { CREDITCOIN_CHAIN_ID, CORE_VAULT, SEPOLIA_CHAIN_ID, type DefiMarket } from "@/lib/defi/markets";
import { CORE_ABI, ERC20_ABI, UNLOCK_REQUESTED_EVENT_TOPIC, sepoliaProvider } from "@/lib/defi/read";
import type { UserData } from "@/lib/defi/read";

export default function RepayUnlock({ market, userData, onDone }: { market: DefiMarket; userData: UserData | null; onDone: () => void }) {
  const { address, signer, chainId, isConnected, switchNetwork } = useWallet();
  const [tab, setTab] = useState<"repay" | "unlock">("repay");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"idle" | "switching" | "confirming" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unlockable, setUnlockable] = useState<bigint | null>(null);

  const wrongChain = isConnected && chainId !== CREDITCOIN_CHAIN_ID;
  const dec = market.loan.decimals;
  const borrowed = userData?.borrowedAssets ?? 0n;
  const collateral = userData?.collateral ?? 0n;
  const amt = (() => {
    try {
      return amount === "" ? 0n : tab === "repay" ? parseUnits(amount, dec) : parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  })();
  const max = tab === "repay" ? borrowed : collateral;
  const valid = amt > 0n && amt <= max;

  const refreshUnlockable = async () => {
    if (!address) return;
    try {
      const p = sepoliaProvider();
      const v = new Contract(market.collateral.address, ERC20_ABI, p);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bal: bigint = await (v as any).balanceOf(address);
      setUnlockable(bal);
    } catch {}
  };

  const run = async () => {
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
      if (tab === "repay") {
        const loan = new Contract(market.loan.address, ERC20_ABI, signer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const l = loan as any;
        setStage("confirming");
        const allowance: bigint = await l.allowance(address, CORE_VAULT);
        if (allowance < amt) {
          const atx = await l.approve(CORE_VAULT, amt);
          await atx.wait();
        }
        const tx = await core.repay(market.mp, amt, 0n, address);
        setTxHash(tx.hash);
        await tx.wait();
      } else {
        setStage("confirming");
        const tx = await core.requestUnlock(market.mp, amt);
        setTxHash(tx.hash);
        const rc = await tx.wait();
        // sanity: UnlockRequested emitted
        try {
          const found = rc.logs.some((l: { topics: string[] }) => l.topics[0] === UNLOCK_REQUESTED_EVENT_TOPIC);
          if (!found) throw new Error("UnlockRequested not emitted");
        } catch {}
      }
      setStage("success");
      onDone();
      if (tab === "unlock") refreshUnlockable();
      setAmount("");
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const busy = stage === "switching" || stage === "confirming";
  const label = stage === "confirming" ? (tab === "repay" ? "Repaying…" : "Requesting unlock…") : wrongChain ? "Switch to Creditcoin" : tab === "repay" ? `Repay ${market.loan.symbol}` : "Request unlock";

  return (
    <div className="border border-border rounded-xl bg-panel overflow-hidden">
      <div className="grid grid-cols-2 border-b border-border">
        {(["repay", "unlock"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
              setStage("idle");
              setErr(null);
              if (t === "unlock") refreshUnlockable();
            }}
            className={`py-3 text-sm font-medium transition-colors ${tab === t ? "text-white bg-white/[0.04] border-b-2 border-amber -mb-px" : "text-muted hover:text-white"}`}
          >
            {t === "repay" ? "Repay debt" : "Unlock collateral"}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{tab === "repay" ? "Outstanding debt" : "Collateral held"}</span>
          <span className="font-mono text-white/70">
            {userData ? `${formatUnits(max, tab === "repay" ? dec : 18)} ${tab === "repay" ? market.loan.symbol : market.collateral.symbol}` : "—"}
          </span>
        </div>

        <div className="rounded-lg bg-canvas border border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              inputMode="decimal"
              className="flex-1 min-w-0 bg-transparent font-mono text-xl text-white outline-none placeholder:text-white/20"
            />
            <span className="font-mono text-sm text-white/60 shrink-0">{tab === "repay" ? market.loan.symbol : market.collateral.symbol}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">{tab === "repay" ? "Owed" : "Available"}</span>
            <button onClick={() => setAmount(max === 0n ? "" : formatUnits(max, tab === "repay" ? dec : 18))} className="text-amber hover:text-white font-medium">
              MAX
            </button>
          </div>
        </div>

        {tab === "unlock" && (
          <p className="text-[11px] text-muted">
            The unlock worker releases {market.collateral.symbol} back to your Sepolia wallet after you repay. Settlement usually completes within a few minutes.
            {unlockable !== null && unlockable > 0n ? ` Currently in wallet: ${formatUnits(unlockable, 18)}.` : ""}
          </p>
        )}
        {tab === "repay" && borrowed === 0n && collateral > 0n && (
          <p className="text-[11px] text-emerald-300/80">Debt fully repaid — you can unlock your collateral.</p>
        )}

        {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-all">{err}</div>}

        {stage === "success" ? (
          <div className="w-full py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium inline-flex justify-center items-center gap-2">
            <CheckCircle2 size={15} /> {tab === "repay" ? "Repaid" : "Unlock requested"}
            {txHash && (
              <a href={`${getChainLabelUrl(CREDITCOIN_CHAIN_ID)}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] hover:text-white">
                tx <ExternalLink size={10} />
              </a>
            )}
          </div>
        ) : !isConnected ? (
          <div className="w-full py-2.5 rounded-lg border border-border text-muted text-sm text-center">Connect wallet to continue</div>
        ) : (
          <button onClick={run} disabled={!valid && !wrongChain || busy || max === 0n} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 inline-flex justify-center items-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />} {label}
          </button>
        )}
      </div>
    </div>
  );
}

function getChainLabelUrl(chainId: number): string {
  return chainId === SEPOLIA_CHAIN_ID ? "https://sepolia.etherscan.io" : "https://creditcoin-testnet.blockscout.com";
}
