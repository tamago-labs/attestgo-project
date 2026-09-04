"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile, type UserProfile } from "@/lib/userProfile";
import EditProfileModal from "@/components/app/EditProfileModal";
import AddressBookDrawer from "@/components/app/AddressBookDrawer";
import TokenRegistryDrawer from "@/components/app/TokenRegistryDrawer";
import KYCStatusModal from "@/components/app/KYCStatusModal";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function initials(name: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const [tokenOpen, setTokenOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);

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
    <div className="max-w-md mx-auto w-full px-2 sm:px-0 py-2">
      {address ? (
        <>
          {/* profile card */}
          <div className="border border-border rounded-xl p-5 flex items-center justify-between mb-6 bg-panel">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white border border-white/10 shrink-0"
                style={{ background: avatarGradient(address) }}
              >
                {initials(displayName || "—")}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white text-sm truncate">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Loader2 size={12} className="animate-spin" /> Loading
                    </span>
                  ) : displayName ? (
                    displayName
                  ) : (
                    <span className="text-white/60">Not set</span>
                  )}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <button onClick={handleCopy} className="text-muted text-xs font-mono hover:text-white flex items-center gap-1">
                    {shortAddr(address)} {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                  </button>
                  {profile && (
                    <>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <Check size={10} /> Signature
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/60">{country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} className="text-amber text-sm font-medium hover:underline shrink-0 ml-3">
              Edit
            </button>
          </div>

          {/* menu */}
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            <button onClick={() => setEditOpen(true)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left">
              <span className="text-sm text-white">Edit profile</span>
              <span className="text-white/25">›</span>
            </button>
            <button onClick={() => setKycOpen(true)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left">
              <span className="text-sm text-white">KYC Status</span>
              <span className="flex items-center gap-2">
                {profile && (profile as unknown as { kycStatus?: string })?.kycStatus ? (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${ (profile as unknown as { kycStatus?: string }).kycStatus === "green" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : (profile as unknown as { kycStatus?: string }).kycStatus === "red" ? "bg-red-500/10 border-red-500/20 text-red-300" : (profile as unknown as { kycStatus?: string }).kycStatus === "pending" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-white/5 border-white/10 text-white/60"}`}>
                    {(profile as unknown as { kycStatus?: string }).kycStatus === "green" ? "Verified" : (profile as unknown as { kycStatus?: string }).kycStatus === "red" ? "Rejected" : (profile as unknown as { kycStatus?: string }).kycStatus === "pending" ? "Pending" : (profile as unknown as { kycStatus?: string }).kycStatus}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/60">Not started</span>
                )}
                <span className="text-white/25">›</span>
              </span>
            </button>
            <button onClick={() => setBookOpen(true)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left">
              <span className="text-sm text-white">Address book</span>
              <span className="text-white/25">›</span>
            </button>
            <button onClick={() => setTokenOpen(true)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left">
              <span className="text-sm text-white">Token registry</span>
              <span className="text-white/25">›</span>
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-6 text-center">
          <p className="text-sm text-muted">Connect your wallet to access settings.</p>
        </div>
      )}

      <EditProfileModal open={editOpen} initialName={displayName} initialCountry={country} onClose={() => setEditOpen(false)} onSaved={fetch} />
      <AddressBookDrawer open={bookOpen} onClose={() => setBookOpen(false)} ownerId={(profile as unknown as { id: string } | null)?.id || null} />
      <TokenRegistryDrawer open={tokenOpen} onClose={() => setTokenOpen(false)} ownerId={(profile as unknown as { id: string } | null)?.id || null} />
      <KYCStatusModal open={kycOpen} onClose={() => setKycOpen(false)} profile={profile as unknown as { kycStatus?: string; kycReviewAnswer?: string; kycRejectType?: string; applicantId?: string } | null} />
    </div>
  );
}
