"use client";

import { useEffect, useState } from "react";
import { UserRound, Globe, ChevronRight, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import EditProfileModal from "@/components/app/EditProfileModal";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export default function SettingsPage() {
  const { address, isConnected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetch = async () => {
    if (!address) {
      setProfile(null);
      return;
    }
    setLoading(true);
    const p = await loadProfile(address);
    setProfile(p);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const displayName = profile?.displayName || "";
  const country = profile?.country || "";

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      {/* Profile row */}
      <div className="rounded-xl border border-border bg-panel overflow-hidden divide-y divide-border">
        <button
          onClick={() => setEditOpen(true)}
          className="w-full px-4 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0 text-sm font-medium text-violet-300">
            {(displayName || address || "U").slice(0, 2).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Loader2 size={12} className="animate-spin" /> Loading
                </span>
              ) : displayName ? (
                displayName
              ) : isConnected ? (
                "Set display name"
              ) : (
                "Connect wallet"
              )}
            </div>
            <div className="text-xs text-muted flex items-center gap-2">
              <span className="font-mono">{address ? shortAddr(address) : "—"}</span>
              {country && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="flex items-center gap-1">
                    <Globe size={10} /> {country}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-muted" />
        </button>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserRound size={16} className="text-muted" />
            <div>
              <div className="text-sm text-white">Display name</div>
              <div className="text-xs text-muted">{displayName || "Not set — shown on GO Pass"}</div>
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="text-xs px-2.5 py-1 rounded-lg border border-border bg-white/5 hover:bg-white/10 text-white">
            Edit
          </button>
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-muted" />
            <div>
              <div className="text-sm text-white">Country</div>
              <div className="text-xs text-muted">{country || "Not set — auto-fills GO Pass"}</div>
            </div>
          </div>
          <span className="text-sm font-mono text-white/60">{country || "—"}</span>
        </div>
      </div>

      <p className="text-[11px] text-white/30 text-center">Signed with wallet — verified on every read. No login required.</p>

      <EditProfileModal
        open={editOpen}
        initialName={displayName}
        initialCountry={country}
        onClose={() => setEditOpen(false)}
        onSaved={fetch}
      />
    </div>
  );
}
