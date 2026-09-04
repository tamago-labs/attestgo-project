"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, ExternalLink } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";

export default function BuyDrawer({ open, onClose, symbol, tokenAddress, chainId, payToken }: { open: boolean; onClose: () => void; symbol: string; tokenAddress: string; chainId: number; payToken?: string }) {
  const { address } = useWallet();
  const [amount, setAmount] = useState("100");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const explorer = chainId === 11155111 ? "https://sepolia.etherscan.io" : "https://explorer.creditcoin.xyz";
  const handleBuy = async () => {
    if (!address) return;
    setLoading(true);
    // demo: simulate mint — in prod call GToken.mint via ethers
    await new Promise((r) => setTimeout(r, 1200));
    setTxHash(`0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`);
    setLoading(false);
  };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[420px] max-w-[95vw] h-full bg-white border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <p className="text-xs font-mono text-slate-400">Buy {symbol}</p>
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"><X size={14} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-slate-600 leading-relaxed">Mint {symbol} with {payToken || "USDC"} to your wallet. GO Pass tier ≥10 required. Eligible regions enforced on transfer.</p>
              <div>
                <label className="text-xs font-medium text-slate-700">Amount ({payToken || "USDC"})</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-900" placeholder="100" />
              </div>
              {!address && <p className="text-xs text-amber-600">Connect wallet in AttestGO to buy.</p>}
              {txHash && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-mono text-emerald-700 break-all">{txHash}</p>
                  <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 underline mt-1">View on explorer <ExternalLink size={10} /></a>
                </div>
              )}
              <div className="text-xs text-slate-500 break-all">Token {tokenAddress} · {chainId === 11155111 ? "Sepolia" : chainId}</div>
            </div>
            <div className="border-t border-slate-200 p-4">
              <button onClick={handleBuy} disabled={loading || !address} className="w-full py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium hover:bg-black disabled:opacity-40 inline-flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : null} {txHash ? "Mint again" : `Buy ${symbol} with ${payToken || "USDC"}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
