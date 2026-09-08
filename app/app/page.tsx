"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles, Loader2 } from "lucide-react";
import { getUrl, uploadData } from "aws-amplify/storage";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile } from "@/lib/userProfile";
import { getClient } from "@/lib/tokenRegistry";
import { truncateAddr } from "@/lib/send/constants";
import type { Schema } from "@/amplify/data/resource";
import type { UserProfile } from "@/lib/userProfile";

type InboxItem = NonNullable<Schema["InboxItem"]["type"]>;

function smartTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && d.getDate() === now.getDate()) return `${diffHr}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function DownloadLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { url } = await getUrl({ path });
        if (!cancelled) setUrl(url.toString());
      } catch {
        // fallback to path name
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  const fileName = path.split("/").pop() || path;

  if (loading) {
    return <span className="text-xs text-muted">Loading…</span>;
  }

  return (
    <a
      href={url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-amber hover:text-white"
    >
      <span className="truncate">{fileName}</span>
      <ArrowUpRight size={10} />
    </a>
  );
}

export default function InboxPage() {
  const { isConnected, address } = useWallet();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [travelRuleData, setTravelRuleData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address) {
        setLoading(false);
        return;
      }
      const p = await loadProfile(address);
      if (!p) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const client = getClient();
        const res = await (client.models.InboxItem as unknown as {
          byRecipient: (a: { recipientId: string }) => Promise<{ data: InboxItem[] }>;
        }).byRecipient({ recipientId: p.id });
        const sorted = (res.data || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        if (!cancelled) setItems(sorted);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [address]);

  const markRead = async (id: string) => {
    try {
      const client = getClient();
      await client.models.InboxItem.update({ id, read: true });
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)));
    } catch {}
  };

  const generateDocument = async () => {
    if (!active) return;
    console.log("[inbox] generateDocument start, inbox id:", active.id);
    setGenerating(true);
    try {
      // Fetch linked travel rule data
      const client = getClient();
      console.log("[inbox] fetching travel rule data...");
      const trRes = await (client.models.TravelRuleData as unknown as {
        list: (a: { filter: { inboxItemId: { eq: string } } }) => Promise<{ data: Record<string, unknown>[] }>;
      }).list({ filter: { inboxItemId: { eq: active.id } } });
      console.log("[inbox] travel rule records found:", trRes.data?.length);
      const trData = trRes.data?.[0];
      if (!trData) throw new Error("No travel rule data linked");

      // Generate document via AI (feed email content + travel rule data)
      console.log("[inbox] calling AI document API...");
      const aiRes = await fetch("/api/ai/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailContent: active.body,
          travelRule: trData,
        }),
      });
      console.log("[inbox] AI response status:", aiRes.status);
      if (!aiRes.ok) throw new Error("AI generation failed");
      const aiData = await aiRes.json();
      if (!aiData.document) throw new Error("No document generated");

      // Upload to S3
      const fileName = `receipt-${active.id}.txt`;
      const file = new File([new Blob([aiData.document]) as unknown as BlobPart], fileName);
      const result = await uploadData({
        path: `docs/${fileName}`,
        data: file,
        options: { contentType: "text/plain" },
      }).result;
      console.log("[inbox] uploaded to:", result.path);

      // Update inbox item with document
      await client.models.InboxItem.update({
        id: active.id,
        docs: [result.path],
      } as unknown as { id: string; docs: string[] });

      // Update local state to show doc immediately
      setItems((prev) =>
        prev.map((it) =>
          it.id === active.id
            ? { ...it, docs: [result.path] }
            : it
        )
      );
      console.log("[inbox] done");
    } catch (e) {
      console.error("[inbox] generateDocument error:", e);
    } finally {
      setGenerating(false);
    }
  };

  const active = items[selected];
  const unreadCount = items.filter((it) => !it.read).length;
  const [senderProfile, setSenderProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!active?.senderId) {
        setSenderProfile(null);
        return;
      }
      try {
        const client = getClient();
        const res = await (client.models.UserProfile as unknown as {
          get: (a: { id: string }) => Promise<{ data: UserProfile | null }>;
        }).get({ id: active.senderId });
        if (!cancelled) setSenderProfile(res.data);
      } catch {
        if (!cancelled) setSenderProfile(null);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [active?.senderId]);

function smartTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && d.getDate() === now.getDate()) return `${diffHr}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

  const TYPE_TAGS: Record<string, string> = {
    send: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    receive: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    compliance: "bg-red-500/10 border-red-500/20 text-red-300",
    kyc: "bg-violet-500/10 border-violet-500/20 text-violet-300",
    lending: "bg-blue-500/10 border-blue-500/20 text-blue-300",
  };

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="rounded-xl border border-border overflow-hidden grid md:grid-cols-[320px_1fr] flex-1 min-h-0 bg-panel">
        {/* left — inbox list */}
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-panel">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-amber rounded" />
              <h3 className="font-medium text-white text-sm">Inbox</h3>
            </div>
            <span className="text-white/30 text-xs font-mono">{isConnected && unreadCount > 0 ? `${unreadCount} new` : "—"}</span>
          </div>
          <div className="divide-y divide-border overflow-y-auto min-h-0 flex-1">
            {isConnected && items.length > 0 ? (
              items.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => { setSelected(i); if (!m.read) markRead(m.id); }}
                  className={`w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors ${i === selected ? "bg-white/[0.04]" : ""} ${!m.read ? "bg-amber/[0.03]" : "opacity-60"}`}
                >
                  <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${m.read ? "bg-border" : "bg-amber"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-white truncate">{m.title}</p>
                      <span className="text-white/30 text-xs font-mono shrink-0 ml-2">{smartTime(m.createdAt)}</span>
                    </div>
                    <p className="text-muted text-sm mt-0.5 truncate">{m.body.split("\n")[0]}</p>
                  </div>
                </button>
              ))
            ) : isConnected && !loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-sm text-white font-medium">No notifications yet</p>
                <p className="text-xs text-white/30 mt-1">Transfer updates will appear here</p>
              </div>
            ) : isConnected && loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <span className="text-xs text-muted">Loading…</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-sm text-white font-medium">Welcome to your inbox</p>
                <p className="text-xs text-white/30 mt-1">All your onchain actions, composed into your inbox</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm text-amber">
                  Connect wallet to continue <ArrowUpRight size={12} />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* right — preview */}
        <div className="p-8 bg-canvas/30 overflow-y-auto min-h-0 flex flex-col">
           {isConnected && active ? (
             <>
               {/* Sender section */}
               <div className="-mx-8 -mt-8 mb-6 border-b border-border px-8 py-3">
                 <p className="text-xs font-mono">
                   <span className="text-white/30">From: </span>
                   {active.senderId ? (
                     senderProfile ? (
                       <a href={`https://sepolia.etherscan.io/address/${senderProfile.walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
                         {truncateAddr(senderProfile.walletAddress)} &lt;{senderProfile.displayName}&gt;
                       </a>
                     ) : (
                       <span className="text-white/30">Loading…</span>
                     )
                   ) : (
                     <span className="text-white/30">—</span>
                   )}
                 </p>
               </div>

               <p className="text-white/30 text-xs font-mono mb-2">TODAY · {active.createdAt ? new Date(active.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
               <h3 className="text-xl font-semibold text-white mb-4">{active.title}</h3>

               <p className="text-muted text-sm leading-relaxed max-w-md whitespace-pre-wrap">{active.body}</p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {active.txHash && (
                  <span className="text-[10px] uppercase tracking-widest text-muted">Tx</span>
                )}
                {active.txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${active.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-full text-xs font-mono border bg-white/5 border-white/10 text-amber inline-flex items-center gap-1"
                  >
                    {truncateAddr(active.txHash)} <ArrowUpRight size={10} />
                  </a>
                )}
              </div>

              {/* Documents */}
              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Documents</p>
                {active.docs && active.docs.length > 0 ? (
                  <div className="space-y-1.5">
                    {active.docs.filter(Boolean).map((doc, i) => (
                      <DownloadLink key={i} path={doc!} />
                    ))}
                  </div>
                ) : (
                  <button onClick={generateDocument} disabled={generating} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg, rgba(253,183,80,0.4), rgba(139,124,240,0.4))" }}>
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generating ? "Generating..." : "Generate document with AI"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="relative overflow-hidden rounded-xl border border-border bg-panel/70 px-6 py-8 text-center max-w-md w-full">
                <div className="mesh-glow absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] max-w-full pointer-events-none opacity-60" />
                <div className="relative">
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <span className="font-display font-semibold text-base tracking-tight text-white">attest</span>
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest"
                      style={{ background: "linear-gradient(135deg,#FDB750,#8B7CF0)", color: "#0A0D13" }}
                    >
                      GO
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-xl sm:text-2xl leading-tight tracking-tight text-white">
                   Experience the Future
                    <br />
                    of Compliant <span className="glow-text">Onchain Finance</span>
                  </h3>
                  <p className="mt-3 text-sm text-muted max-w-xs mx-auto leading-relaxed">AI simplifies every compliance workflow</p>
                  <div className="mt-5 flex items-center justify-center gap-2 text-xs font-mono text-white/60 flex-wrap">
                    <span>Mint GO Pass</span>
                    <span className="text-white/20">·</span>
                    <span>Acquire GO Assets</span>
                    <span className="text-white/20">·</span>
                    <span>Use in DeFi</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
