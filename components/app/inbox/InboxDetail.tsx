"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { getClient } from "@/lib/tokenRegistry";
import { truncateAddr } from "@/lib/send/constants";
import type { Schema } from "@/amplify/data/resource";

type TravelRuleData = NonNullable<Schema["TravelRuleData"]["type"]>;

export default function InboxDetail({
  item,
  profileId,
}: {
  item: NonNullable<Schema["InboxItem"]["type"]>;
  profileId: string | null;
}) {
  const [travelRule, setTravelRule] = useState<TravelRuleData | null>(null);
  const [loadingTr, setLoadingTr] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingTr(true);
      try {
        const client = getClient();
        const res = await (client.models.TravelRuleData as unknown as {
          list: (a: { filter: { inboxItemId: { eq: string } } }) => Promise<{ data: TravelRuleData[] }>;
        }).list({ filter: { inboxItemId: { eq: item.id } } });
        if (!cancelled && res.data && res.data.length > 0) {
          setTravelRule(res.data[0]);
        }
      } catch {}
      if (!cancelled) setLoadingTr(false);
    }
    run();
    return () => { cancelled = true; };
  }, [item.id]);

  const isSender = item.senderId === profileId;

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-border/50">
      {/* Email body */}
      <div className="pt-3">
        <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{item.body}</p>
      </div>

      {/* Travel Rule data */}
      {loadingTr ? (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <Loader2 size={12} className="animate-spin" /> Loading transfer details…
        </div>
      ) : travelRule ? (
        <div className="bg-white/[0.02] rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted">Transfer details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <span className="text-[10px] text-muted">From</span>
              <p className="text-xs text-white font-mono">{truncateAddr(travelRule.originatorWallet)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted">To</span>
              <p className="text-xs text-white font-mono">{truncateAddr(travelRule.beneficiaryWallet)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted">Amount</span>
              <p className="text-xs text-white">{travelRule.amount} {travelRule.asset}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted">Status</span>
              <p className="text-xs text-emerald-400 capitalize">{travelRule.status}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Documents */}
          {item.docs && item.docs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted">Documents</p>
              {item.docs.map((doc, i) => (
                <a
                  key={i}
                  href={`https://attestgo-files.s3.amazonaws.com/${doc}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-amber hover:text-white"
                >
                  <FileText size={13} />
                  <span className="truncate">{(doc || "").split("/").pop()}</span>
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}

      {/* Tx hash */}
      {item.txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-white"
        >
          View transaction <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
