"use client";

import { useState } from "react";
import { ExternalLink, Hourglass, Loader2, RadioTower, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DefiMarket } from "@/lib/defi/markets";
import { SEPOLIA_CHAIN_ID } from "@/lib/defi/markets";
import { attestLock, updateLockStatus, type LockRecord } from "@/lib/defi/lockRecords";
import { getChainById } from "@/lib/chains";

export default function StepAttest({ market, records, onAttested }: { market: DefiMarket; records: LockRecord[]; onAttested: () => void }) {
  const [busyTx, setBusyTx] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tx: string; text: string; kind: "ok" | "warn" | "err" } | null>(null);

  const sendProof = async (rec: LockRecord) => {
    setBusyTx(rec.lockTxHash);
    setMsg(null);
    console.log("[StepAttest] sendProof start", { lockTxHash: rec.lockTxHash, marketSlug: market.slug, recordId: rec.id });
    try {
      console.log("[StepAttest] updateLockStatus -> attesting");
      await updateLockStatus(rec.id, "attesting");
      console.log("[StepAttest] attestLock calling mutation");
      const res = await attestLock(rec.lockTxHash, market.slug);
      console.log("[StepAttest] attestLock result", JSON.stringify(res));
      if (res.status === "attested") {
        await updateLockStatus(rec.id, "attested", res.txHash);
        setMsg({ tx: rec.lockTxHash, text: "Proof verified — collateral credited on Creditcoin.", kind: "ok" });
        onAttested();
      } else if (res.status === "pending") {
        await updateLockStatus(rec.id, "locked");
        setMsg({ tx: rec.lockTxHash, text: "Block not attested yet — try again in a few minutes.", kind: "warn" });
      } else {
        await updateLockStatus(rec.id, "locked");
        setMsg({ tx: rec.lockTxHash, text: `Unexpected status: ${res.status}`, kind: "warn" });
      }
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      console.error("[StepAttest] sendProof error", text);
      setMsg({ tx: rec.lockTxHash, text, kind: "err" });
      try {
        await updateLockStatus(rec.id, "failed");
      } catch {}
    } finally {
      setBusyTx(null);
      onAttested();
    }
  };

  return (
    <div className="border border-border rounded-xl bg-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-violet-400/15 border border-violet-400/30 text-violet-300 text-[10px] font-mono flex items-center justify-center">2</span>
        <h3 className="text-sm font-semibold text-white">Prove the lock to Creditcoin</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted font-mono">
          <RadioTower size={11} /> attestation service
        </span>
      </div>

      {records.length === 0 ? (
        <p className="text-xs text-muted">No locks yet — lock collateral above to create a proof request.</p>
      ) : (
        <div className="space-y-2">
          {[...records].reverse().map((rec) => (
            <div key={rec.id} className="rounded-lg bg-canvas border border-border p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-white font-mono">
                  {rec.amount} {market.collateral.symbol}
                  <StatusChip status={rec.status} />
                </div>
                <a href={`${getChainById(SEPOLIA_CHAIN_ID)!.explorerUrl}/tx/${rec.lockTxHash}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted hover:text-amber inline-flex items-center gap-1 mt-0.5">
                  lock tx {rec.lockTxHash.slice(0, 10)}…{rec.lockTxHash.slice(-6)} <ExternalLink size={9} />
                </a>
                {rec.attestTxHash && (
                  <a href={`${getChainById(102031)!.explorerUrl}/tx/${rec.attestTxHash}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-300/80 hover:text-amber inline-flex items-center gap-1 ml-2">
                    creditcoin tx <ExternalLink size={9} />
                  </a>
                )}
              </div>
              {rec.status !== "attested" && (
                <button
                  onClick={() => sendProof(rec)}
                  disabled={busyTx !== null || rec.status === "failed"}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber text-canvas text-xs font-semibold hover:bg-amber/90 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {busyTx === rec.lockTxHash ? <Loader2 size={12} className="animate-spin" /> : <Hourglass size={12} />}
                  {rec.status === "failed" ? "Retry unavailable" : "Send proof"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div className={`rounded-xl px-4 py-3 border flex items-start gap-2.5 ${msg.kind === "ok" ? "text-emerald-200 bg-emerald-500/15 border-emerald-500/30" : msg.kind === "warn" ? "text-amber-200 bg-amber-500/15 border-amber-500/30" : "text-red-200 bg-red-500/15 border-red-500/30"}`}>
          {msg.kind === "err" && <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
          {msg.kind === "ok" && <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
          {msg.kind === "warn" && <Hourglass size={15} className="shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className="text-sm font-medium">{msg.kind === "ok" ? "Proof verified" : msg.kind === "warn" ? "Not attested yet" : "Attestation failed"}</div>
            <div className="text-xs mt-0.5 opacity-80 break-all">{msg.text}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: LockRecord["status"] }) {
  const map: Record<LockRecord["status"], { label: string; cls: string }> = {
    locked: { label: "pending attestation", cls: "text-amber border-amber/25 bg-amber/10" },
    attesting: { label: "attesting…", cls: "text-violet-300 border-violet-400/25 bg-violet-400/10" },
    attested: { label: "available on Creditcoin", cls: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" },
    failed: { label: "failed", cls: "text-red-300 border-red-500/25 bg-red-500/10" },
  };
  const s = map[status];
  return <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${s.cls}`}>{s.label}</span>;
}
