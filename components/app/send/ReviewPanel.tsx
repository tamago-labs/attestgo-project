"use client";

import { truncateAddr } from "@/lib/send/constants";
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
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">You send</span>
          <span className="text-sm font-semibold text-white">{amount} {symbol}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">To</span>
          <span className="text-xs font-mono text-white/70">{truncateAddr(recipient)}</span>
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

      <div className="bg-amber/5 border border-amber/20 rounded-lg p-3">
        <p className="text-[11px] text-muted">A notification with transfer details will be sent to the recipient's inbox.</p>
      </div>
    </div>
  );
}
