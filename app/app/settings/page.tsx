"use client";

import { useEffect, useState } from "react";
import { UserRound, ChevronRight, Loader2, Copy, Check, BookMarked } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import EditProfileModal from "@/components/app/EditProfileModal";
import AddressBookDrawer from "@/components/app/AddressBookDrawer";

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
  const [bookOpen, setBookOpen] = useState(false);

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
      {/* Header — horizontal mini CTA */}
      {address ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-panel/70 px-4 py-4 flex items-center gap-3">
          <div className="mesh-glow absolute -top-8 left-1/2 -translate-x-1/2 w-[300px] h-[120px] max-w-full pointer-events-none opacity-40" />
          <span
            className="relative h-9 w-9 rounded-full border border-white/10 shrink-0"
            style={{ background: avatarGradient(address) }}
          />
          <div className="relative flex-1 min-w-0">
            <div className="text-sm font-medium glow-text truncate">
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Loader2 size={12} className="animate-spin" /> Loading
                </span>
              ) : displayName ? (
                displayName
              ) : (
                <span className="text-white/60">Not set</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-canvas border border-border font-mono text-[11px] text-muted hover:text-white hover:border-white/15 transition-colors"
              >
                {shortAddr(address)} {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              </button>
              {profile ? (
                <>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-300">
                    <Check size={10} /> Signature Verified
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-white/60">
                    {country}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="relative ml-auto flex items-center shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-medium h-8"
              style={{ background: "linear-gradient(90deg,#FDB750,#8B7CF0)", color: "#0A0D13" }}
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-6 text-center">
          <p className="text-sm text-muted">Connect your wallet to access settings.</p>
        </div>
      )}

      {/* Menu */}
      <div className="rounded-xl border border-border bg-panel overflow-hidden divide-y divide-border">
        <button
          onClick={() => setEditOpen(true)}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <UserRound size={16} className="text-muted" />
          <span className="flex-1 text-sm text-white">Edit profile</span>
          <ChevronRight size={16} className="text-muted" />
        </button>
        <button
          onClick={() => setBookOpen(true)}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <BookMarked size={16} className="text-muted" />
          <span className="flex-1 text-sm text-white">Address book</span>
          <span className="text-xs text-white/30">{profile ? "Manage" : "—"}</span>
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
      <AddressBookDrawer open={bookOpen} onClose={() => setBookOpen(false)} ownerId={(profile as unknown as { id: string } | null)?.id || null} />
    </div>
  );
}
