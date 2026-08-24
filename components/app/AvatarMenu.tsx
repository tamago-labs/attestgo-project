"use client";

import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Copy, ExternalLink, Check } from "lucide-react";
import { useWallet } from "./WalletContext";
import { truncateAddress } from "@/lib/wallet";
import { getChainById, getExplorerAddressUrl } from "@/lib/chains";

function avatarGradient(addr: string) {
  let h = 0;
  for (let i = 2; i < 10; i++) h = (h * 31 + addr.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 40) % 360} 80% 55%))`;
}

export default function AvatarMenu() {
  const { address, chainId, provider, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const chain = chainId ? getChainById(chainId) : null;
  const nativeSymbol = chain?.nativeCurrency.symbol ?? "ETH";
  const networkName = chain?.name ?? (chainId ? `Chain ${chainId}` : "Unknown");
  const icon = chain?.icon;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!provider || !address || !open) return;
    let cancelled = false;
    async function fetchBalance() {
      setLoadingBalance(true);
      try {
        const v = await provider!.getBalance(address!);
        if (cancelled) return;
        const formatted = ethers.formatEther(v);
        setBalance(formatted);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    }
    fetchBalance();
    const id = setInterval(fetchBalance, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [provider, address, chainId, open]);

  // also refresh when chain changes even if closed (so pill updates)
  useEffect(() => {
    if (!provider || !address) {
      setBalance(null);
      return;
    }
    // prefetch once on connect/chain switch
    provider
      .getBalance(address)
      .then((v) => setBalance(ethers.formatEther(v)))
      .catch(() => setBalance(null));
  }, [provider, address, chainId]);

  if (!address) return null;
  const explorer = chainId ? getExplorerAddressUrl(chainId, address) : `https://sepolia.etherscan.io/address/${address}`;

  const formattedBalance =
    balance !== null ? Number(balance).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";

  const onCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="flex items-center gap-2 rounded-full border border-border bg-canvas pl-1 pr-3 py-1 hover:bg-white/5 transition-colors"
      >
        <span
          className="h-7 w-7 rounded-full shrink-0 border border-white/10"
          style={{ background: avatarGradient(address) }}
        />
        <span className="text-sm font-mono text-white hidden sm:inline">{truncateAddress(address)}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-panel shadow-xl overflow-hidden z-40"
            >
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted mb-1">Balance</p>
                <div className="flex items-center gap-2">
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} alt={nativeSymbol} className="w-6 h-6 rounded-full bg-white object-contain p-0.5 shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
                  )}
                  <p className="text-lg font-semibold text-white">
                    {loadingBalance && balance === null ? "..." : formattedBalance}{" "}
                    <span className="text-sm font-medium text-muted">{nativeSymbol}</span>
                  </p>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium text-muted bg-white/5 rounded-full border border-white/5">
                  {networkName}
                </span>
              </div>

              <button
                onClick={onCopy}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-white hover:bg-white/5 text-left transition-colors"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? "Copied!" : "Copy address"}
              </button>
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <ExternalLink size={16} />
                View on explorer
              </a>
              <button
                onClick={() => {
                  setOpen(false);
                  disconnect();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 text-left border-t border-border transition-colors"
              >
                <LogOut size={16} />
                Disconnect
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
