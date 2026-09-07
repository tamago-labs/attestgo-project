"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CAUSES, type CauseId } from "@/lib/send/emailTemplates";

export default function CauseAccordion({
  open,
  onToggle,
  cause,
  onCauseChange,
  customNote,
  onCustomNoteChange,
}: {
  open: boolean;
  onToggle: () => void;
  cause: CauseId;
  onCauseChange: (v: CauseId) => void;
  customNote: string;
  onCustomNoteChange: (v: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">Transfer purpose</span>
          {cause && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {CAUSES.find((c) => c.id === cause)?.label}
            </span>
          )}
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-white/40 text-xs">▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border">
              <div className="pt-3">
                <label className="text-muted text-xs mb-1.5 block">Reason for transfer</label>
                <select value={cause} onChange={(e) => onCauseChange(e.target.value as CauseId)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white">
                  {CAUSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {cause === "other" && (
                <div>
                  <label className="text-muted text-xs mb-1.5 block">Custom note</label>
                  <textarea value={customNote} onChange={(e) => onCustomNoteChange(e.target.value)} rows={2} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white resize-none" placeholder="Describe the purpose…" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
