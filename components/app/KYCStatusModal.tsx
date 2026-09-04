"use client";

import { Copy, Check, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  profile: {
    kycStatus?: string | null;
    kycReviewAnswer?: string | null;
    kycRejectType?: string | null;
    applicantId?: string | null;
  } | null;
};

export default function KYCStatusModal({ open, onClose, profile }: Props) {
  const [copied, setCopied] = useState(false);
  const status = profile?.kycStatus || "init";
  const isGreen = status === "green";
  const isRed = status === "red";
  const isPending = status === "pending";
  const dot = isGreen ? "bg-emerald-400" : isRed ? "bg-red-400" : isPending ? "bg-amber-400" : "bg-white/30";
  const label = isGreen ? "Verified" : isRed ? "Rejected" : isPending ? "Under review" : "Not started";
  const sub = isGreen ? "Verification completed" : isRed ? `${profile?.kycRejectType || profile?.kycReviewAnswer || "RETRY"}` : isPending ? "We’ll update when Sumsub finishes" : "Start KYC in Identity → Register";

  const handleCopy = async () => {
    if (!profile?.applicantId) return;
    try {
      await navigator.clipboard.writeText(profile.applicantId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }} className="relative w-full max-w-md rounded-xl border border-border bg-panel p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">KYC Status</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className={`rounded-lg border p-3 flex items-center gap-2 ${isGreen ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : isRed ? "bg-red-500/10 border-red-500/20 text-red-300" : isPending ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-white/5 border-white/10 text-muted"}`}>
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs opacity-70">· {sub}</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted">Review answer</span>
            <span className="font-mono text-white">{profile?.kycReviewAnswer || "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted">Reject type</span>
            <span className="font-mono text-white">{profile?.kycRejectType || "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border items-center">
            <span className="text-muted">Applicant ID</span>
            <span className="font-mono text-white/70 text-xs truncate max-w-[180px] inline-flex items-center gap-1">
              {profile?.applicantId ? `${profile.applicantId.slice(0, 8)}…${profile.applicantId.slice(-6)}` : "—"}
              {profile?.applicantId && (
                <button onClick={handleCopy} className="p-1 hover:text-white">
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted">Level</span>
            <span className="font-mono text-white/70">basic-attestgo</span>
          </div>
        </div>

        {isRed && <p className="text-xs text-red-200/70">Upload a clearer ID where the photo matches your selfie, then retry.</p>}

        <div className="flex gap-2 pt-2">
          {isRed && (
            <Link href="/app/identity/kyc" onClick={onClose} className="flex-1 py-2 rounded-lg bg-white text-canvas text-sm font-medium text-center hover:bg-white/90">
              Retry KYC
            </Link>
          )}
          {isGreen && (
            <Link href="/app/identity/mint" onClick={onClose} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium text-center hover:bg-emerald-600 inline-flex justify-center items-center gap-1">
              Mint GO Pass <ExternalLink size={12} />
            </Link>
          )}
          {!isGreen && !isRed && (
            <Link href="/app/identity/kyc" onClick={onClose} className="flex-1 py-2 rounded-lg bg-white text-canvas text-sm font-medium text-center hover:bg-white/90">
              Go to KYC
            </Link>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-white hover:bg-white/5">
            Close
          </button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
