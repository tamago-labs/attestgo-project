"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COUNTRIES, truncateAddr } from "@/lib/send/constants";
import { loadProfile, type UserProfile } from "@/lib/userProfile";

export default function TravelRuleAccordion({
  open,
  onToggle,
  recipient,
  ownerProfile,
  walletAddress,
  beneName,
  onBeneNameChange,
  beneInstitution,
  onBeneInstitutionChange,
  beneCountry,
  onBeneCountryChange,
  beneSelfCustody,
  onBeneSelfCustodyChange,
}: {
  open: boolean;
  onToggle: () => void;
  recipient: string;
  ownerProfile?: { displayName: string; country: string } | null;
  walletAddress?: string | null;
  beneName: string;
  onBeneNameChange: (v: string) => void;
  beneInstitution: string;
  onBeneInstitutionChange: (v: string) => void;
  beneCountry: string;
  onBeneCountryChange: (v: string) => void;
  beneSelfCustody: boolean;
  onBeneSelfCustodyChange: (v: boolean) => void;
}) {
  const [beneProfile, setBeneProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!recipient.startsWith("0x") || recipient.length !== 42) {
      setBeneProfile(null);
      return;
    }
    (async () => {
      const p = await loadProfile(recipient);
      if (!cancelled && p) {
        setBeneProfile(p);
        onBeneNameChange(p.displayName);
        onBeneCountryChange(p.country);
      }
    })();
    return () => { cancelled = true; };
  }, [recipient, onBeneNameChange, onBeneCountryChange]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber text-sm">⚠</span>
          <span className="text-sm text-white">Travel Rule information</span>
          {beneName && beneCountry && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ready</span>
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
              {/* Originator (read-only) */}
              <div className="pt-3">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Originator</p>
                <div className="bg-white/[0.02] rounded-md px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white">{ownerProfile?.displayName || (walletAddress ? truncateAddr(walletAddress) : "—")}</span>
                    <span className="text-[10px] font-mono text-emerald-400">from profile</span>
                  </div>
                  <div className="text-[11px] text-muted font-mono">{ownerProfile?.country || "—"}</div>
                </div>
              </div>

              {/* Beneficiary */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Beneficiary</p>
                {beneProfile && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-emerald-400 text-xs">✓</span>
                    <span className="text-[11px] text-muted">GO Pass profile matched</span>
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-muted text-xs mb-1 block">Full legal name</label>
                    <input value={beneName} onChange={(e) => onBeneNameChange(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white" placeholder="Required" />
                  </div>
                  <div>
                    <label className="text-muted text-xs mb-1 block">Institution <span className="text-muted">(optional)</span></label>
                    <input value={beneInstitution} onChange={(e) => onBeneInstitutionChange(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white" placeholder="Leave blank if self-custody" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-muted text-xs mb-1 block">Country</label>
                      <select value={beneCountry} onChange={(e) => onBeneCountryChange(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white">
                        <option value="" disabled>Select</option>
                        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-muted text-xs mb-1">Wallet type</label>
                      <label className="flex items-center gap-2 flex-1 border border-border rounded-md px-3 py-2 cursor-pointer bg-panel">
                        <input type="checkbox" checked={beneSelfCustody} onChange={(e) => onBeneSelfCustodyChange(e.target.checked)} className="w-4 h-4 accent-amber" />
                        <span className="text-xs text-white">Self-custody</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
