"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Droplets, Loader2, ExternalLink } from "lucide-react";
import { ethers } from "ethers";
import { useWallet } from "@/components/app/WalletContext";
import { getChainById, getExplorerAddressUrl } from "@/lib/chains";
import type { DefaultToken } from "@/lib/defaultTokens";

const MINT_ABI = ["function mint(address to, uint256 amount) returns (bool)"] as const;
const PRESETS = ["10", "100", "1000", "10000"];

export default function FaucetModal({
  open,
  token,
  onClose,
  onMinted,
}: {
  open: boolean;
  token: DefaultToken | null;
  onClose: () => void;
  onMinted?: () => void;
}) {
  const { address, provider, signer, switchNetwork, chainId: walletChainId } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState<"idle" | "switching" | "minting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setAmount("1000");
      setStatus("idle");
      setTxHash(null);
      setErr(null);
    }
  }, [open, token]);

  if (!mounted || !token) return null;

  const chain = getChainById(token.chainId);
  const needSwitch = walletChainId !== null && walletChainId !== token.chainId;

  const handleMint = async () => {
    setErr(null);
    if (!address) {
      setErr("Connect wallet first");
      return;
    }
    const clean = amount.trim();
    if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) {
      setErr("Enter valid amount");
      return;
    }
    try {
      // switch chain if needed
      if (needSwitch) {
        setStatus("switching");
        await switchNetwork(token.chainId);
        // give wallet time to switch
        await new Promise((r) => setTimeout(r, 800));
      }
      setStatus("minting");
      // use signer from wallet context; if chain switched, provider may have new network — get fresh signer
      let s = signer;
      if (!s && provider) s = await provider.getSigner();
      if (!s) throw new Error("No signer");
      const c = new ethers.Contract(token.address, MINT_ABI, s);
      const parsed = ethers.parseUnits(clean, token.decimals);
      const tx: ethers.TransactionResponse = await (c as unknown as { mint(a: string, b: bigint): Promise<ethers.TransactionResponse> }).mint(address, parsed);
      setTxHash(tx.hash);
      await tx.wait(1);
      setStatus("success");
      onMinted?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.slice(0, 220));
      setStatus("error");
    }
  };

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-[420px] rounded-2xl border border-border bg-canvas shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <p className="font-medium text-white text-sm">Faucet — {token.symbol}</p>
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-panel">
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!address && <div className="text-xs text-amber-200/80 bg-amber/10 border border-amber/20 rounded-lg px-3 py-2">Connect wallet to mint</div>}
              {needSwitch && address && (
                <div className="text-xs text-sky-200/80 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">You are on {walletChainId ? getChainById(walletChainId)?.shortName : "unknown"} — will switch to {chain?.shortName}</div>
              )}
              {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">{err}</div>}
              {status === "success" && txHash && (
                <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                  <span>Minted!</span>
                  <a href={`${chain?.explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:text-white">
                    View tx <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Amount *</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" inputMode="decimal" className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {PRESETS.map((p) => (
                    <button key={p} onClick={() => setAmount(p)} className={`px-2.5 py-1 rounded-full text-xs border ${amount === p ? "bg-white text-canvas border-white" : "bg-white/5 text-muted border-white/10 hover:text-white"}`}>
                      {p}
                    </button>
                  ))}
                </div>

              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border bg-panel text-sm text-white hover:bg-white/5">
                  Close
                </button>
                <button
                  onClick={handleMint}
                  disabled={status === "minting" || status === "switching" || !address}
                  className="flex-1 py-2.5 rounded-lg bg-amber text-canvas text-sm font-medium hover:bg-amber/90 disabled:opacity-40 inline-flex justify-center items-center gap-2"
                >
                  {status === "minting" || status === "switching" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> {status === "switching" ? "Switching…" : "Minting…"}
                    </>
                  ) : (
                    <>Mint {amount || "0"} {token.symbol}</>
                  )}
                </button>
              </div>


            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return createPortal(content, document.body);
}
