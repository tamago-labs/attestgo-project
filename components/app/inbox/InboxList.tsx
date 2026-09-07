"use client";

import { useState } from "react";
import { Mail, MailOpen, Loader2 } from "lucide-react";
import InboxDetail from "./InboxDetail";
import type { Schema } from "@/amplify/data/resource";

type InboxItem = NonNullable<Schema["InboxItem"]["type"]>;

const TYPE_LABELS: Record<string, string> = {
  send: "Transfer",
  receive: "Received",
  compliance: "Compliance",
  kyc: "KYC",
  lending: "Lending",
};

export default function InboxList({
  items,
  loading,
  onMarkRead,
  profileId,
}: {
  items: InboxItem[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  profileId: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-panel p-12 text-center">
        <Mail size={32} className="mx-auto text-white/20" />
        <p className="text-sm text-muted mt-3">No notifications yet</p>
        <p className="text-xs text-muted mt-1">Transfer updates and compliance alerts will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .map((item) => {
          const isOpen = expanded === item.id;
          return (
            <div
              key={item.id}
              className={`border rounded-xl transition-colors ${isOpen ? "border-amber/30 bg-amber/[0.03]" : "border-border bg-panel hover:bg-white/[0.02]"}`}
            >
              <button
                onClick={() => {
                  setExpanded(isOpen ? null : item.id);
                  if (!item.read) onMarkRead(item.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.read ? "bg-white/[0.04]" : "bg-amber/15"}`}>
                  {item.read ? <Mail size={14} className="text-white/40" /> : <MailOpen size={14} className="text-amber" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm truncate ${item.read ? "text-white/60" : "text-white font-medium"}`}>{item.title}</span>
                    <span className="text-[10px] font-mono text-muted bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">
                      {TYPE_LABELS[item.type || ""] || item.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{item.body.split("\n")[0]}</p>
                </div>
                {!item.read && <span className="w-2 h-2 rounded-full bg-amber shrink-0" />}
              </button>
              {isOpen && <InboxDetail item={item} profileId={profileId} />}
            </div>
          );
        })}
    </div>
  );
}
