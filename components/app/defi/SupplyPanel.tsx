"use client";

import { useEffect, useState } from "react";
import { Contract, parseUnits, formatUnits } from "ethers";
import { CheckCircle2, Droplets, ExternalLink, Loader2, Lock, Unlock } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import FaucetModal from "@/components/app/FaucetModal";
import { CREDITCOIN_CHAIN_ID, CORE_VAULT, type DefiMarket } from "@/lib/defi/markets";
import { CORE_ABI, ERC20_ABI, type MarketData, type UserData } from "@/lib/defi/read";
import { getExplorerAddressUrl } from "@/lib/chains";

type Stage = "idle" | "switching" | "approving" | "confirming" | "success" | "error";

export default function SupplyPanel({ market, marketData, userData, onDone }: { market: DefiMarket; marketData: MarketData | null; userData: UserData | null; onDone: () => void }) {
  const { address, signer, chainId, isConnected, switchNetwork } = useWallet();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [faucetOpen, setFaucetOpen] = useState(false);

  const wrongChain = isConnected && chainId !== CREDITCOIN_CHAIN_ID;
  const dec = market.loan.decimals;

  useEffect(() => {
    setAmount("");
    setStage("idle");
    setTxHash(null);
    setErr(null);
  }, [tab]);

  const max = tab === "deposit" ? userData?.walletBalance ?? 0n : userData?.suppliedAssets ?? 0n;
  const amt = (() => {
    try {
      return amount === "" ? 0n : parseUnits(amount, dec);
    } catch {
      return 0n;
    }
  })();
  const valid = amt > 0n && amt <= max;

  const needApprove = tab === "deposit" && userData ? userData.allowanceToCore < amt : false;

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
      const loan = new Contract(market.loan.address, ERC20_ABI, signer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = new Contract(CORE_VAULT, CORE_ABI, signer) as any;
      const mp = market.mp;
      if (tab === "deposit") {
        if (needApprove) {
          setStage("approving");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const atx = await (loan as any).approve(CORE_VAULT, amt);
          await atx.wait();
        }
        setStage("confirming");
        const tx = await core.supply(mp, amt, 0n, address);
        setTxHash(tx.hash);
        await tx.wait();
      } else {
        setStage("confirming");
        const tx = await core.withdraw(mp, amt, 0n, address);
        setTxHash(tx.hash);
        await tx.wait();
      }
      setStage("success");
      onDone();
      setAmount("");
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const busy = stage === "switching" || stage === "approving" || stage === "confirming";
  const label = wrongChain && stage !== "idle" ? "Switching network…" : stage === "approving" ? "Approving…" : stage === "confirming" ? tab === "deposit" ? "Supplying…" : "Withdrawing…" : wrongChain ? `Switch to ${getChainLabel(CREDITCOIN_CHAIN_ID)}` : needApprove ? `Approve ${market.loan.symbol}` : tab === "deposit" ? "Supply" : "Withdraw";

  return (
    <div className="border border-border rounded-xl bg-panel overflow-hidden">
      {/* tabs */}
      <div className="grid grid-cols-2 border-b border-border">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`py-3 text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${tab === t ? "text-white bg-white/[0.04] border-b-2 border-amber -mb-px" : "text-muted hover:text-white"}`}>
            {t === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{tab === "deposit" ? "Supply" : "Withdraw"} {market.loan.symbol}</span>
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
            <span className="font-mono text-sm text-white/60 shrink-0">{market.loan.symbol}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">{tab === "deposit" ? "Wallet" : "Supplied"}: {userData ? formatUnits(max, dec) : "—"} {market.loan.symbol}</span>
            <button onClick={() => setAmount(max === 0n ? "" : formatUnits(max, dec))} className="text-amber hover:text-white font-medium">MAX</button>
          </div>
        </div>

        {marketData && tab === "deposit" && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Supply APY</span>
            <span className="font-mono text-emerald-300">{(marketData.supplyApy * 100).toFixed(2)}%</span>
          </div>
        )}
        {marketData && tab === "withdraw" && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Available to withdraw</span>
            <span className="font-mono text-white/70">{userData ? formatUnits(userData.suppliedAssets, dec) : "—"} {market.loan.symbol}</span>
          </div>
        )}

        {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-all">{err}</div>}

        {stage === "success" ? (
          <div className="w-full py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium inline-flex justify-center items-center gap-2">
            <CheckCircle2 size={15} /> {tab === "deposit" ? "Supplied" : "Withdrawn"}
            {txHash && (
              <a href={`${getExplorerAddressUrl(CREDITCOIN_CHAIN_ID, CORE_VAULT)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] hover:text-white">
                tx <ExternalLink size={10} />
              </a>
            )}
          </div>
        ) : !isConnected ? (
          <div className="w-full py-2.5 rounded-lg border border-border text-muted text-sm text-center">Connect wallet to continue</div>
        ) : (
          <button onClick={run} disabled={!valid && !wrongChain || busy} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 inline-flex justify-center items-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />} {label}
          </button>
        )}

        <p className="text-[11px] text-muted">
          {tab === "deposit"
             ? `Funds are supplied to the ${market.name} market and start earning immediately.`
            : "Withdrawals are instant while the market has available liquidity."}
        </p>
      </div>

      <FaucetModal
        open={faucetOpen}
        onClose={() => setFaucetOpen(false)}
        token={{ address: market.loan.address as `0x${string}`, chainId: CREDITCOIN_CHAIN_ID, symbol: market.loan.symbol, name: market.loan.name, decimals: market.loan.decimals, icon: "" }}
        onMinted={onDone}
      />
    </div>
  );
}

function getChainLabel(chainId: number): string {
  return chainId === CREDITCOIN_CHAIN_ID ? "Creditcoin" : "Sepolia";
}
