"use client";

import { useState } from "react";

type Msg = {
  title: string;
  time: string;
  preview: string;
  body: string;
  tags: { label: string; cls: string }[];
  unread: boolean;
};

const msgs: Msg[] = [
  {
    title: "Signature verified",
    time: "2m",
    preview: "Sumsub confirmed your identity check. GO Pass upgraded to Tier 10.",
    body: "Sumsub confirmed your identity check. Your GO Pass has been upgraded to Tier 10, unlocking transfers and borrowing against restricted assets such as USD T-Bill in the US and SG.",
    tags: [
      { label: "Tier 10", cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" },
      { label: "Sumsub", cls: "bg-white/5 border-white/10 text-white/60" },
    ],
    unread: true,
  },
  {
    title: "Transfer blocked",
    time: "1h",
    preview: "8,000 GO-TBILL send to 0x4E2…9c1 rejected — recipient not verified for US, SG.",
    body: "8,000 GO-TBILL send to 0x4E2…9c1 rejected — recipient not verified for US, SG. The recipient needs a GO Pass with Tier 10 and US eligibility before you can send this restricted asset.",
    tags: [
      { label: "US, SG", cls: "bg-amber-500/10 border-amber-500/20 text-amber-300" },
      { label: "Blocked", cls: "bg-red-500/10 border-red-500/20 text-red-300" },
    ],
    unread: true,
  },
  {
    title: "Attestation issued",
    time: "3h",
    preview: "New proof anchored on Creditcoin for wallet 0x971F…a64e.",
    body: "New proof anchored on Creditcoin for wallet 0x971F…a64e via Attestcoin Protocol. Your GO Pass is now verifiable on any chain in ~1 block with Merkle + continuity proof.",
    tags: [
      { label: "Creditcoin", cls: "bg-violet-500/10 border-violet-500/20 text-violet-300" },
      { label: "Attestcoin", cls: "bg-white/5 border-white/10 text-white/60" },
    ],
    unread: true,
  },
  {
    title: "Rule updated",
    time: "Yesterday",
    preview: "USD T-Bill min_tier raised from 5 to 10.",
    body: "USD T-Bill rule updated: min_tier raised from 5 to 10. Holders below Tier 10 can no longer receive this asset. Your Tier 10 remains eligible.",
    tags: [
      { label: "min_tier 10", cls: "bg-white/5 border-white/10 text-white/60" },
      { label: "GO-TBILL", cls: "bg-white/5 border-white/10 text-white/60" },
    ],
    unread: false,
  },
];

export default function InboxPage() {
  const [selected, setSelected] = useState(0);
  const active = msgs[selected];

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="rounded-xl border border-border overflow-hidden grid md:grid-cols-[320px_1fr] flex-1 min-h-0 bg-panel">
        {/* left — unread list l1 inside l3 shell */}
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-panel">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-amber rounded" />
              <h3 className="font-medium text-white text-sm">Inbox</h3>
            </div>
            <span className="text-white/30 text-xs font-mono">3 new</span>
          </div>
          <div className="divide-y divide-border overflow-y-auto min-h-0">
            {msgs.map((m, i) => (
              <button
                key={m.title}
                onClick={() => setSelected(i)}
                className={`w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors ${i === selected ? "bg-white/[0.04]" : ""} ${!m.unread ? "opacity-60" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${m.unread ? "bg-amber-400" : "bg-border"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm text-white truncate">{m.title}</p>
                    <span className="text-white/30 text-xs font-mono shrink-0 ml-2">{m.time}</span>
                  </div>
                  <p className="text-muted text-sm mt-0.5 truncate">{m.preview}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* right — preview l3 */}
        <div className="p-8 bg-canvas/30 overflow-y-auto min-h-0">
          <p className="text-white/30 text-xs font-mono mb-2">TODAY · 09:41</p>
          <h3 className="text-xl font-semibold text-white mb-4">{active.title}</h3>
          <p className="text-muted text-sm leading-relaxed max-w-md">{active.body}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {active.tags.map((t) => (
              <span key={t.label} className={`px-2.5 py-1 rounded-full text-xs font-mono border ${t.cls}`}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
