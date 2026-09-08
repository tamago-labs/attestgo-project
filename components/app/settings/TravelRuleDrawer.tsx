"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileText, Loader2, Calendar } from "lucide-react";
import { truncateAddr } from "@/lib/send/constants";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

type TravelRuleData = NonNullable<Schema["TravelRuleData"]["type"]>;

const client = generateClient<Schema>();

export default function TravelRuleDrawer({
  open,
  onClose,
  userProfileId,
  walletAddress,
}: {
  open: boolean;
  onClose: () => void;
  userProfileId: string | null;
  walletAddress: string | null;
}) {
  const [records, setRecords] = useState<TravelRuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TravelRuleData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!open || !walletAddress) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await (client.models.TravelRuleData as unknown as {
          list: (a: { filter: { or: [{ originatorWallet: { eq: string } }, { beneficiaryWallet: { eq: string } }] } }) => Promise<{ data: TravelRuleData[] }>;
        }).list({
          filter: {
            or: [
              { originatorWallet: { eq: walletAddress.toLowerCase() } },
              { beneficiaryWallet: { eq: walletAddress.toLowerCase() } },
            ],
          },
        });
        const data = res.data || [];
        const sorted = data.sort((a, b) => {
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        });
        if (!cancelled) setRecords(sorted);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, walletAddress]);

  const filtered = records.filter((r) => {
    if (dateFrom && r.createdAt && r.createdAt < dateFrom) return false;
    if (dateTo && r.createdAt && r.createdAt > dateTo + "T23:59:59") return false;
    return true;
  });

  const downloadTxt = (record: TravelRuleData) => {
    const content = `Travel Rule Compliance Record
================================
Date: ${record.createdAt || "N/A"}
Status: ${record.status || "N/A"}
Transaction: ${record.txHash || "N/A"}

ORIGINATOR
  Name: ${record.originatorName || "N/A"}
  Wallet: ${record.originatorWallet || "N/A"}
  Country: ${record.originatorCountry || "N/A"}

BENEFICIARY
  Name: ${record.beneficiaryName || "N/A"}
  Wallet: ${record.beneficiaryWallet || "N/A"}
  Country: ${record.beneficiaryCountry || "N/A"}
  Institution: ${record.beneficiaryInstitution || "N/A"}
  Self-Custody: ${record.beneficiaryIsSelfHosted ? "Yes" : "No"}

TRANSFER
  Amount: ${record.amount || "N/A"}
  Asset: ${record.asset || "N/A"}
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `travel-rule-${record.id || "export"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[520px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-medium text-white">Travel Rule Records</p>
              <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">&times;</button>
            </div>

            {selected ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <button onClick={() => setSelected(null)} className="text-xs text-muted hover:text-white">← Back to list</button>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted">Date</span><p className="text-white font-mono">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "N/A"}</p></div>
                    <div><span className="text-muted">Status</span><p className="text-emerald-400 capitalize">{selected.status || "N/A"}</p></div>
                    <div><span className="text-muted">Amount</span><p className="text-white">{selected.amount} {selected.asset}</p></div>
                    <div><span className="text-muted">Tx Hash</span><p className="text-white font-mono truncate">{truncateAddr(selected.txHash || "")}</p></div>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-muted text-xs mb-1">Originator</p>
                    <p className="text-white text-sm">{selected.originatorName}</p>
                    <p className="text-muted text-xs font-mono">{truncateAddr(selected.originatorWallet || "")}</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-muted text-xs mb-1">Beneficiary</p>
                    <p className="text-white text-sm">{selected.beneficiaryName}</p>
                    <p className="text-muted text-xs font-mono">{truncateAddr(selected.beneficiaryWallet || "")}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <button onClick={() => downloadTxt(selected)} className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-white">
                    <Download size={13} /> Download
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <Calendar size={14} className="text-muted" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-panel border border-border rounded px-2 py-1 text-xs text-white outline-none" />
                  <span className="text-muted text-xs">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-panel border border-border rounded px-2 py-1 text-xs text-white outline-none" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-20 text-muted"><Loader2 size={20} className="animate-spin" /></div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                      <FileText size={32} className="text-white/20" />
                      <p className="text-sm text-muted mt-3">No travel rule records</p>
                      <p className="text-xs text-muted mt-1">Records from your transfers will appear here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filtered.map((r) => (
                        <button key={r.id} onClick={() => setSelected(r)} className="w-full text-left px-5 py-3 hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">{r.amount} {r.asset}</span>
                            <span className="text-white/30 text-xs font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
                          </div>
                          <p className="text-xs text-muted mt-0.5 truncate">
                            {r.originatorWallet?.toLowerCase() === walletAddress?.toLowerCase() ? "Sent to" : "Received from"} {truncateAddr(r.originatorWallet?.toLowerCase() === walletAddress?.toLowerCase() ? r.beneficiaryWallet || "" : r.originatorWallet || "")}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
