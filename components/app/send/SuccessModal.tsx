"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ExternalLink, X } from "lucide-react";

export default function SuccessModal({
  open,
  onClose,
  amount,
  symbol,
  recipient,
  txHash,
  chainId,
}: {
  open: boolean;
  onClose: () => void;
  amount: string;
  symbol: string;
  recipient: string;
  txHash: string | null;
  chainId: number;
}) {
  const explorerBase = chainId === 11155111 ? "https://sepolia.etherscan.io" : "https://creditcoin-testnet.blockscout.com";
  const explorerUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;
  const shortRecipient = recipient.slice(0, 6) + "…" + recipient.slice(-4);
  const shortTx = txHash ? txHash.slice(0, 10) + "…" + txHash.slice(-8) : "—";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-sm bg-canvas border border-border rounded-2xl p-6 space-y-5"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-white">
              <X size={18} />
            </button>

            {/* Checkmark */}
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
              >
                <CheckCircle2 size={28} className="text-emerald-400" />
              </motion.div>
            </div>

            {/* Amount */}
            <div className="text-center">
              <p className="text-lg font-semibold text-white">Success!</p>
              <p className="text-sm text-muted mt-1">
                You sent <span className="text-white font-medium">{amount} {symbol}</span>
              </p>
              <p className="text-xs text-muted mt-0.5">to {shortRecipient}</p>
            </div>

            {/* Details */}
            <div className="bg-white/[0.02] rounded-lg p-3 space-y-2">
              {txHash && explorerUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Transaction</span>
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-amber hover:text-white inline-flex items-center gap-1">
                    {shortTx} <ExternalLink size={10} />
                  </a>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Travel Rule</span>
                <span className="text-xs text-emerald-400">recorded ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Email</span>
                <span className="text-xs text-emerald-400">sent ✓</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => { window.location.href = "/app/inbox"; }}
                className="flex-1 py-2.5 rounded-lg bg-amber text-canvas text-sm font-medium hover:bg-amber/90 transition-colors"
              >
                View inbox
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
