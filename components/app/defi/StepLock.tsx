"use client";

import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider, parseUnits, formatUnits, keccak256, AbiCoder } from "ethers";
import { ExternalLink, Loader2, Lock } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { SEPOLIA_CHAIN_ID, type DefiMarket } from "@/lib/defi/markets";
import { computeMarketId, ERC20_ABI, SOURCE_VAULT_ABI } from "@/lib/defi/read";
import { SOURCE_VAULT } from "@/lib/defi/markets";
import { createLockRecord } from "@/lib/defi/lockRecords";
import { getChainById } from "@/lib/chains";

export default function StepLock({ market, address, onLocked }: { market: DefiMarket; address: string | null; onLocked: () => void }) {
  const { signer, chainId, isConnected, switchNetwork } = useWallet();
  const sepoliaRpc = getChainById(SEPOLIA_CHAIN_ID)!.rpcUrl;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"idle" | "switching" | "approving" | "locking" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const p = new JsonRpcProvider(sepoliaRpc);
    const g = new Contract(market.collateral.address, ERC20_ABI, p);
    (g as unknown as { balanceOf: (a: string) => Promise<bigint> }).balanceOf(address).then(setBalance).catch(() => setBalance(null));
  }, [address, market.collateral.address, sepoliaRpc]);

  const wrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;
  const amt = (() => {
    try {
      return amount === "" ? 0n : parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  })();
  const valid = amt > 0n && balance !== null && amt <= balance;

  const lock = async () => {
    if (!signer || !address) return;
    if (!valid) {
      setErr(amt === 0n ? "Enter an amount to lock" : "Amount exceeds wallet balance");
      setStage("error");
      return;
    }
    setErr(null);
    try {
      if (wrongChain) {
        setStage("switching");
        await switchNetwork(SEPOLIA_CHAIN_ID);
        return;
      }
      const s = signer as never;
      const g = new Contract(market.collateral.address, ERC20_ABI, s);
      const vault = new Contract(SOURCE_VAULT, SOURCE_VAULT_ABI, s);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = vault as any;
      setStage("approving");
      const allowance: bigint = await (g as unknown as { allowance: (a: string, b: string) => Promise<bigint> }).allowance(address, SOURCE_VAULT);
      if (allowance < amt) {
        const atx = await (g as unknown as { approve: (a: string, b: bigint) => Promise<{ wait: () => Promise<unknown> }> }).approve(SOURCE_VAULT, amt);
        await atx.wait();
      }
      setStage("locking");
      const nonce: bigint = await v.nonce();
      const marketId = computeMarketId(market.mp);
      const tx = await v.lock(address, market.collateral.address, amt, marketId, nonce);
      setTxHash(tx.hash);
      const rc = await tx.wait();
      // derive lockId from the Locked event (fallback: recompute)
      let lockId: string = "";
      try {
        const iface = new AbiCoder();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = rc.logs.find((l: any) => l.address.toLowerCase() === SOURCE_VAULT.toLowerCase() && l.topics[1]);
        if (log) lockId = log.topics[1];
        else
          lockId = keccak256(
            iface.encode(
              ["uint256", "address", "address", "uint256", "bytes32", "uint256"],
              [SEPOLIA_CHAIN_ID, market.collateral.address, address, amt, marketId, nonce]
            )
          );
      } catch {
        lockId = "";
      }
      await createLockRecord({
        ownerWallet: address,
        marketSlug: market.slug,
        lockTxHash: tx.hash,
        blockNumber: rc.blockNumber,
        lockId: lockId,
        amount: formatUnits(amt, 18),
        nonce: Number(nonce),
      });
      setStage("success");
      onLocked();
      setAmount("");
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const busy = stage === "switching" || stage === "approving" || stage === "locking";
  const label = stage === "approving" ? "Approving…" : stage === "locking" ? "Locking…" : wrongChain ? "Switch to Sepolia" : `Lock ${market.collateral.symbol}`;

  return (
    <div className="border border-border rounded-xl bg-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-violet-400/15 border border-violet-400/30 text-violet-300 text-[10px] font-mono flex items-center justify-center">1</span>
        <h3 className="text-sm font-semibold text-white">Lock collateral on Sepolia</h3>
        <span className="ml-auto text-[11px] text-muted font-mono">{balance !== null ? `${formatUnits(balance, 18)} ${market.collateral.symbol}` : "—"}</span>
      </div>
      <p className="text-[11px] text-muted">
        Your {market.collateral.symbol} stays in the vault on Sepolia. Creditcoin verifies the lock via block attestation — nothing moves cross-chain.
      </p>

      <div className="rounded-lg bg-canvas border border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            inputMode="decimal"
            className="flex-1 min-w-0 bg-transparent font-mono text-xl text-white outline-none placeholder:text-white/20"
          />
          <span className="font-mono text-sm text-white/60 shrink-0">{market.collateral.symbol}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Wallet on Sepolia</span>
          <button onClick={() => setAmount(balance && balance > 0n ? formatUnits(balance, 18) : "")} className="text-amber hover:text-white font-medium">
            MAX
          </button>
        </div>
      </div>

      {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-all">{err}</div>}

      {stage === "success" ? (
        <div className="w-full py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium inline-flex justify-center items-center gap-2">
          Locked
          {txHash && (
            <a href={`${getChainById(SEPOLIA_CHAIN_ID)!.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] hover:text-white">
              tx <ExternalLink size={10} />
            </a>
          )}
        </div>
      ) : (
        <button onClick={lock} disabled={busy} className="w-full py-2.5 rounded-lg bg-violet-400 text-canvas text-sm font-semibold hover:bg-violet-300 disabled:opacity-60 inline-flex justify-center items-center gap-2">
          {busy && <Loader2 size={15} className="animate-spin" />} {busy && <Lock size={14} />} {label}
        </button>
      )}
    </div>
  );
}
