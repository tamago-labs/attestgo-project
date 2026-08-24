"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_CHAINS, getChainById } from "@/lib/chains";
import { useWallet } from "./WalletContext";

export default function NetworkSwitcher() {
  const { chainId, switchNetwork, isConnected } = useWallet();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const current = chainId ? getChainById(chainId) : null;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSwitch = async (id: number) => {
    setSwitching(true);
    setError(null);
    try {
      await switchNetwork(id);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitching(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="flex items-center gap-2 rounded-lg border border-border bg-base px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
      >
        {current?.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.icon} alt={current.name} className="h-4 w-4 rounded-full object-contain shrink-0 bg-white" />
        ) : (
          <span className="h-4 w-4 rounded-full shrink-0 bg-white/10" />
        )}
        <span className="text-white hidden sm:inline">{current?.shortName ?? (chainId ? `Chain ${chainId}` : "Unknown")}</span>
        <span className="text-muted text-xs sm:hidden">{current?.shortName ?? "—"}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={14} className="text-muted" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-panel shadow-xl overflow-hidden z-40"
          >
            <div className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wide">Switch network</div>
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
              {SUPPORTED_CHAINS.map((c) => {
                const active = c.id === chainId;
                return (
                  <motion.button
                    key={c.id}
                    onClick={() => handleSwitch(c.id)}
                    disabled={switching || active}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-white/5 disabled:opacity-50 transition-colors ${active ? "bg-white/[0.04] text-white" : "text-muted hover:text-white"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt={c.name} className="h-5 w-5 rounded-full object-contain shrink-0 bg-white p-0.5" />
                    <span className="flex-1">{c.name}</span>
                    {active && <span className="text-xs text-amber">●</span>}
                  </motion.button>
                );
              })}
            </motion.div>
            {error && <div className="px-3 py-2 text-xs text-red-400 border-t border-border break-words">{error}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
