"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "./WalletContext";
import type { Wallet } from "@/lib/wallet";

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { wallets, discover, connect, isConnecting } = useWallet();
  const [busyRdns, setBusyRdns] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      discover();
      setError(null);
    }
  }, [open, discover]);

  const handleConnect = async (w: Wallet) => {
    setBusyRdns(w.info.rdns);
    setError(null);
    try {
      await connect(w);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyRdns(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.button
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-panel p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg">Connect wallet</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-white hover:bg-white/5 transition-colors">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">Choose from discovered EIP-6963 wallets.</p>

            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.06 } },
              }}
              className="mt-4 space-y-2 max-h-80 overflow-y-auto overflow-x-hidden -mx-1 px-1 py-1 [scrollbar-width:thin] [scrollbar-gutter:stable]"
            >
              {wallets.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-dashed border-border p-6 text-center"
                >
                  <p className="text-sm text-muted">No wallet found.</p>
                  <p className="text-xs text-muted mt-1">Install MetaMask, Rabby, Coinbase Wallet, OKX, Phantom, Trust Wallet, etc. then refresh.</p>
                  <button
                    onClick={() => discover()}
                    className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
                  >
                    Rescan
                  </button>
                </motion.div>
              ) : (
                wallets.map((w) => (
                  <motion.button
                    key={w.info.uuid}
                    onClick={() => handleConnect(w)}
                    disabled={isConnecting}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className="relative flex w-full items-center gap-3 rounded-xl border border-border bg-canvas px-4 py-3 text-left overflow-hidden group transition-colors disabled:opacity-50"
                  >
                    {/* gradient like app sidebar on hover */}
                    <span
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ background: "linear-gradient(135deg, rgba(253,183,80,0.18), rgba(139,124,240,0.18))" }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.info.icon}
                      alt={w.info.name}
                      className="relative z-10 h-8 w-8 rounded-lg bg-white object-contain p-0.5 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_rgba(253,183,80,0.45)]"
                    />
                    <div className="relative z-10 flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate group-hover:text-[#E2E8F0] transition-colors">{w.info.name}</div>
                      <div className="text-xs text-muted truncate">{w.info.rdns}</div>
                    </div>
                    <span className="relative z-10 text-xs text-muted group-hover:text-[#E2E8F0] transition-colors">
                      {busyRdns === w.info.rdns ? "Connecting…" : "Connect"}
                    </span>
                  </motion.button>
                ))
              )}
            </motion.div>

            {error && <p className="mt-3 text-xs text-red-400 break-words">{error}</p>}

            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
