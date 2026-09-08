"use client";

import { CAUSES } from "@/lib/send/emailTemplates";

export default function ReviewPanel({
  amount,
  symbol,
  recipient,
  cause,
  customNote,
  beneName,
  beneCountry,
  beneInstitution,
  file,
  uploadedPath,
  emailPreview,
}: {
  amount: string;
  symbol: string;
  recipient: string;
  cause: string;
  customNote: string;
  beneName: string;
  beneCountry: string;
  beneInstitution: string;
  file: File | null;
  uploadedPath: string | null;
  emailPreview: { subject: string; body: string } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">You send</span>
          <span className="text-sm font-semibold text-white">{amount} {symbol}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Purpose</span>
          <span className="text-xs text-white">{CAUSES.find((c) => c.id === cause)?.label}</span>
        </div>
        {customNote && (
          <div className="pt-2 border-t border-border">
            <span className="text-xs text-muted">Note</span>
            <p className="text-xs text-white/80 mt-0.5">{customNote}</p>
          </div>
        )}
      </div>

      <div className="bg-white/[0.02] rounded-lg p-4 space-y-2">
        <p className="text-xs text-muted">Recipient</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white">{beneName || "—"}</span>
          <span className="text-[10px] font-mono text-muted">{beneCountry}</span>
        </div>
        {beneInstitution && <p className="text-[11px] text-muted">{beneInstitution}</p>}
        <p className="text-[11px] text-muted font-mono">{recipient}</p>
      </div>

      {uploadedPath && file && (
        <div className="bg-white/[0.02] rounded-lg p-4 flex items-center gap-2">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-xs text-white truncate">{file.name}</span>
          <span className="text-[10px] text-muted shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Email preview */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-white/[0.02] px-4 py-2 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted">Email preview</p>
        </div>
        {emailPreview ? (
          <div className="p-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] text-muted shrink-0">Subject:</span>
              <span className="text-xs text-white">{emailPreview.subject}</span>
            </div>
            <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{emailPreview.body}</p>
          </div>
        ) : (
          <div className="p-4 space-y-2.5">
            <div className="h-2.5 bg-white/[0.04] rounded w-3/4 animate-pulse" />
            <div className="h-2.5 bg-white/[0.04] rounded w-full animate-pulse" />
            <div className="h-2.5 bg-white/[0.04] rounded w-5/6 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
