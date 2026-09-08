"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileText, Loader2, Calendar, ArrowLeft } from "lucide-react";
import { truncateAddr } from "@/lib/send/constants";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

type TravelRuleData = NonNullable<Schema["TravelRuleData"]["type"]>;

const client = generateClient<Schema>();

export default function TravelRuleDrawer({
  open,
  onClose,
  walletAddress,
}: {
  open: boolean;
  onClose: () => void;
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
        const sorted = data.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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

  const downloadCSV = () => {
    const headers = ["Date", "Type", "Amount", "Asset", "Sender", "Sender Wallet", "Sender Country", "Recipient", "Recipient Wallet", "Recipient Country", "Tx Hash", "Status"];
    const rows = filtered.map((r) => {
      const isSent = r.originatorWallet?.toLowerCase() === walletAddress?.toLowerCase();
      return [
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
        isSent ? "Sent" : "Received",
        r.amount || "",
        r.asset || "",
        r.originatorName || "",
        r.originatorWallet || "",
        r.originatorCountry || "",
        r.beneficiaryName || "",
        r.beneficiaryWallet || "",
        r.beneficiaryCountry || "",
        r.txHash || "",
        r.status || "",
      ].map((v) => `"${v}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `travel-rules-${dateFrom || "all"}-${dateTo || "now"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingle = (record: TravelRuleData) => {
    const isSent = record.originatorWallet?.toLowerCase() === walletAddress?.toLowerCase();
    const content = `Travel Rule Record
Date: ${record.createdAt ? new Date(record.createdAt).toLocaleString() : "N/A"}
Type: ${isSent ? "Sent" : "Received"}
Amount: ${record.amount} ${record.asset}
Sender: ${record.originatorName} (${record.originatorWallet}, ${record.originatorCountry})
Recipient: ${record.beneficiaryName} (${record.beneficiaryWallet}, ${record.beneficiaryCountry})
Tx Hash: ${record.txHash}
Status: ${record.status}
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `travel-rule-${record.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[700px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                {selected && (
                  <button onClick={() => setSelected(null)} className="text-muted hover:text-white mr-1"><ArrowLeft size={16} /></button>
                )}
                <p className="text-sm font-medium text-white">Travel Rule Records</p>
              </div>
              <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">&times;</button>
            </div>

            {selected ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted text-xs">Date</span><p className="text-white font-mono">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "N/A"}</p></div>
                  <div><span className="text-muted text-xs">Status</span><p className="text-emerald-400 capitalize">{selected.status || "N/A"}</p></div>
                  <div><span className="text-muted text-xs">Amount</span><p className="text-white">{selected.amount} {selected.asset}</p></div>
                  <div><span className="text-muted text-xs">Tx Hash</span><p className="text-white font-mono text-xs truncate">{truncateAddr(selected.txHash || "")}</p></div>
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <p className="text-muted text-xs mb-1">Originator</p>
                    <p className="text-white text-sm">{selected.originatorName}</p>
                    <p className="text-muted text-xs font-mono">{truncateAddr(selected.originatorWallet || "")} · {selected.originatorCountry}</p>
                  </div>
                  <div>
                    <p className="text-muted text-xs mb-1">Beneficiary</p>
                    <p className="text-white text-sm">{selected.beneficiaryName}</p>
                    <p className="text-muted text-xs font-mono">{truncateAddr(selected.beneficiaryWallet || "")} · {selected.beneficiaryCountry}</p>
                  </div>
                </div>
                <button onClick={() => downloadSingle(selected)} className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-white">
                  <Download size={13} /> Download
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                  <Calendar size={14} className="text-muted shrink-0" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-panel border border-border rounded px-2 py-1 text-xs text-white outline-none" />
                  <span className="text-muted text-xs">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-panel border border-border rounded px-2 py-1 text-xs text-white outline-none" />
                  <button onClick={downloadCSV} disabled={filtered.length === 0} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted hover:text-white disabled:opacity-40">
                    <Download size={12} /> CSV
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-20 text-muted"><Loader2 size={20} className="animate-spin" /></div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                      <FileText size={32} className="text-white/20" />
                      <p className="text-sm text-muted mt-3">No travel rule records</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-panel border-b border-border">
                        <tr className="text-muted text-left">
                          <th className="px-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Amount</th>
                          <th className="px-4 py-2 font-medium">Counterparty</th>
                          <th className="px-4 py-2 font-medium">Tx</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.map((r) => {
                          const isSent = r.originatorWallet?.toLowerCase() === walletAddress?.toLowerCase();
                          return (
                            <tr key={r.id} onClick={() => setSelected(r)} className="hover:bg-white/[0.03] cursor-pointer">
                              <td className="px-4 py-2.5 text-white font-mono whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</td>
                              <td className="px-4 py-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSent ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                                  {isSent ? "Sent" : "Received"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-white font-mono whitespace-nowrap">{r.amount} {r.asset}</td>
                              <td className="px-4 py-2.5 text-white font-mono">{truncateAddr(isSent ? r.beneficiaryWallet || "" : r.originatorWallet || "")}</td>
                              <td className="px-4 py-2.5 text-muted font-mono">{truncateAddr(r.txHash || "")}</td>
                              <td className="px-4 py-2.5 text-emerald-400 capitalize">{r.status || "pending"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
