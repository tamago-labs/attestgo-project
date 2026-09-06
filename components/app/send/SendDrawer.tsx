"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatUnits, fmtUsd, type UnifiedRow } from "@/lib/send";
import { DEFAULT_TOKENS } from "@/lib/defaultTokens";
import TokenIcon from "./TokenIcon";
import AddressBookDrawer from "@/components/app/AddressBookDrawer";

function safeFormatBalance(balance: bigint | undefined, decimals: number): string | null {
  if (balance === undefined) return null;
  try {
    const s = formatUnits(balance, decimals);
    if (s === "NaN" || s === "Infinity" || s.includes("NaN")) return null;
    return s;
  } catch {
    return null;
  }
}

export default function SendDrawer({
  open,
  row,
  balance,
  onClose,
  onSend,
  priceMap,
  ownerId,
}: {
  open: boolean;
  row: UnifiedRow;
  balance: bigint | undefined;
  onClose: () => void;
  onSend: () => void;
  priceMap?: Record<string, number>;
  ownerId?: string | null;
}) {
  if (!row) return null;
  const balText = balance !== undefined ? formatUnits(balance, row.decimals) : "…";
  const [bookOpen, setBookOpen] = useState(false);
  const [recipient, setRecipient] = useState("");

  return (
    <>
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[480px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <TokenIcon icon={row.icon} symbol={row.symbol} size={20} />
                <p className="text-sm font-medium text-white">Send {row.symbol}</p>
              </div>
              <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
               <div className="flex items-center justify-between mb-1.5">
                <label className="text-muted text-xs">Amount</label>
                <span className="text-muted text-xs">Balance: <span className="text-white/60 font-mono">{balText}</span></span>
              </div>
                <div className="border border-border rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <TokenIcon icon={row.icon} symbol={row.symbol} size={18} />
                  <input type="number" className="bg-transparent outline-none text-lg font-semibold text-white w-full" placeholder="0.00" />
                  <button className="text-amber text-xs font-medium shrink-0">Max</button>
                </div>
                <div className="text-muted text-xs mt-1.5 font-mono">{fmtUsd(balance ?? BigInt(0), row.decimals, row.symbol, priceMap)}</div>
              </div>

              <div>
                <label className="text-muted text-xs mb-1.5 block">To</label>
                <div className="flex items-center gap-2">
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm font-mono bg-transparent outline-none text-white/70" placeholder="0x... or GO Pass address" />
                  <button onClick={() => setBookOpen(true)} className="px-3 py-2.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:bg-white/[0.04] transition-colors whitespace-nowrap">Address book</button>
                </div>
                <p className="text-muted text-xs mt-1.5">{recipient && !recipient.startsWith("0x") ? "Not a GO Pass address — beneficiary info required below." : ""}</p>
              </div>

              <div className="border border-amber/30 bg-amber/5 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber text-sm">⚠</span>
                  <p className="text-sm text-white">Travel Rule information required for every transfer.</p>
                </div>

                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
                  <span className="text-emerald-400 text-sm">✓</span>
                  <p className="text-xs text-muted">Your details are attached automatically from your verified GO Pass profile.</p>
                </div>

                <div>
                  <label className="text-muted text-xs mb-1.5 block">Beneficiary name</label>
                  <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white" placeholder="Full legal name" />
                </div>
                <div>
                  <label className="text-muted text-xs mb-1.5 block">Beneficiary institution (if any)</label>
                  <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-muted" placeholder="Leave blank if self-custody wallet" />
                </div>
              </div>

              <div>
                <label className="text-muted text-xs mb-1.5 block">Supporting document <span className="text-muted">(optional)</span></label>
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <p className="text-muted text-xs">Drop a file or <span className="text-amber">browse</span></p>
                  <p className="text-muted text-[10px] mt-1">Invoice, agreement, or source-of-funds — PDF, PNG, JPG</p>
                </div>
              </div>

            </div>

            <div className="border-t border-border p-4">
              <button onClick={onSend} className="w-full py-2.5 rounded-md bg-amber text-canvas text-sm font-medium hover:bg-amber/90 transition-colors">
                Review & send
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    <AddressBookDrawer open={bookOpen} onClose={() => setBookOpen(false)} onSelect={(addr) => { setRecipient(addr); setBookOpen(false); }} ownerId={ownerId || null} />
    </>
  );
}
