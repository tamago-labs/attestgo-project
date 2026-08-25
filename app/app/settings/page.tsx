"use client";

import { useEffect, useState } from "react";
import { UserRound, ChevronRight, Loader2, Copy, Check } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import EditProfileModal from "@/components/app/EditProfileModal";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function avatarGradient(addr: string) {
  let h = 0;
  for (let i = 2; i < 10; i++) h = (h * 31 + addr.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 40) % 360} 80% 55%))`;
}

export default function SettingsPage() {
  const { address } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      {/* Header — left circle + Not set / wallet at same position */}
      {address ? (
        <div className="rounded-xl border border-border bg-panel px-4 py-4 flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-full border border-white/10 shrink-0"
            style={{ background: avatarGradient(address) }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Loader2 size={12} className="animate-spin" /> Loading
                </span>
              ) : displayName ? (
                displayName
              ) : (
                "Not set"
              )}
            </div>
            <button
              onClick={handleCopy}
              className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas border border-border font-mono text-xs text-muted hover:text-white hover:border-white/15 transition-colors"
            >
              {shortAddr(address)} {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {profile ? (
              <>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-300">
                  <Check size={10} /> Verified
                </span>
                <span className="px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-white/60">
                  {country}
                </span>
              </>
            ) : (
              <span className="text-xs text-white/30">—</span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-6 text-center">
          <p className="text-sm text-muted">Connect your wallet to access settings.</p>
        </div>
      )}

      {/* Menu — single edit row */}
      <div className="rounded-xl border border-border bg-panel overflow-hidden divide-y divide-border">
        <button
          onClick={() => setEditOpen(true)}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <UserRound size={16} className="text-muted" />
          <span className="flex-1 text-sm text-white">Edit profile</span>
          <ChevronRight size={16} className="text-muted" />
        </button>
      </div>

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
