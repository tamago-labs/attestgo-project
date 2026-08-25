"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, Copy, ExternalLink, Clock, Globe, BadgeCheck, QrCode, RefreshCw, UserRoundX } from "lucide-react";
import GOPassCard from "@/components/app/GOPassCard";
import ButtonGlow from "@/components/ui/ButtonGlow";
import { useWallet } from "@/components/app/WalletContext";
import { deleteMockPass, loadMockPass, type MockPass } from "@/lib/mockPass";
import { loadProfile } from "@/lib/userProfile";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export default function IdentityPage() {
  const { address, isConnected } = useWallet();
  const router = useRouter();
  const [pass, setPass] = useState<MockPass | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPass(loadMockPass());
    const onStorage = () => setPass(loadMockPass());
    window.addEventListener("storage", onStorage);
    // also poll for same-tab updates after register
    const id = setInterval(() => setPass(loadMockPass()), 800);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!address) {
      setProfileName("");
      return;
    }
    loadProfile(address).then((p) => setProfileName(p?.displayName || ""));
  }, [address]);

  const hasPass = !!pass;

  const handleDelete = () => {
    deleteMockPass();
    setPass(null);
    setConfirmDelete(false);
  };

  const handleCopy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const verifiedUntil = pass ? new Date(pass.expiry * 1000).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" }) : "—";
  const expiryLabel = pass ? new Date(pass.expiry * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : undefined;

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      {/* Card */}
      <div className="w-full max-w-[420px] mx-auto">
        {hasPass && pass ? (
          <GOPassCard
            wallet={pass.wallet}
            country={pass.country}
            group=""
            verifiedUntil={verifiedUntil}
            expiryLabel={expiryLabel}
            status={pass.status}
            tierLabel={pass.tier >= 20 ? "Gold" : "Silver"}
            name={(profileName || shortAddr(pass.wallet)).toUpperCase()}
          />
        ) : (
          <div className="relative aspect-[1.586/1] rounded-2xl border border-dashed border-white/15 bg-panel/40 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <UserRoundX className="text-white/40" size={20} />
            </div>
            <div className="mt-3 font-medium text-white text-sm">Verification required</div>
            <div className="mt-1 text-xs text-muted max-w-[32ch]">Create your GO Pass to send, stream, and receive compliant assets.</div>
            <Link href="/app/identity/register" className="mt-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 transition-colors">
                Register GO Pass
              </span>
            </Link>
            {!isConnected && <div className="mt-2 text-[11px] text-white/30">Connect wallet to register</div>}
          </div>
        )}
      </div>

      {/* Actions when no pass already covered; when has pass show list */}
      {hasPass && pass ? (
        <>
          {/* Menu list */}
          <div className="rounded-xl border border-border bg-panel overflow-hidden divide-y divide-border">
            <div className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-muted" />
                <div>
                  <div className="text-sm text-white">Country</div>
                  <div className="text-xs text-muted">Single country per wallet — soulbound</div>
                </div>
              </div>
              <span className="text-sm font-mono text-white/80">{pass.country}</span>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3">
                <BadgeCheck size={16} className="text-muted" />
                <div>
                  <div className="text-sm text-white">Tier</div>
                  <div className="text-xs text-muted">min_tier 10 to pass gToken</div>
                </div>
              </div>
              <span className="text-sm font-mono text-white/80">{pass.tier}</span>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-muted" />
                <div>
                  <div className="text-sm text-white">Customer ID</div>
                  <div className="text-xs text-muted font-mono truncate max-w-[18ch]">{pass.customerId}</div>
                </div>
              </div>
              <button onClick={() => handleCopy(pass.customerIdHash)} className="text-xs text-muted hover:text-white inline-flex items-center gap-1">
                <Copy size={12} /> hash
              </button>
            </div>

            <button
              onClick={() => handleCopy(pass.wallet)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors text-left"
            >
              <span className="flex items-center gap-3">
                <QrCode size={16} className="text-muted" />
                <span className="text-sm text-white">Wallet / QR</span>
              </span>
              <span className="text-xs text-muted inline-flex items-center gap-1">
                {shortAddr(pass.wallet)} <ExternalLink size={12} />
              </span>
            </button>

            <div className="px-4 py-2 flex items-center gap-2 bg-canvas/50">
              <Link href="/app/identity/register" className="flex-1">
                <span className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white/5 hover:bg-white/10 text-sm text-white transition-colors">
                  <RefreshCw size={14} /> Reissue
                </span>
              </Link>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-sm text-red-300 transition-colors"
              >
                <Trash2 size={14} /> Delete pass
              </button>
            </div>
          </div>

          <p className="text-[11px] text-white/30 text-center">Delete removes local mock only. On-chain burn is owner-only via GOPass.burn.</p>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="text-sm font-medium text-white">What you get</div>
          <ul className="mt-2 space-y-1.5 text-sm text-muted list-disc pl-4">
            <li>Soulbound NFT bound to your wallet — non-transferable</li>
            <li>One country per wallet, same pass on every chain</li>
            <li>Privacy hash <span className="font-mono text-white/60">customerIdHash</span> on-chain</li>
          </ul>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl">
            <h3 className="font-medium text-white">Delete GO Pass?</h3>
            <p className="mt-1 text-sm text-muted">Removes the local mock pass. You can register again. On-chain still requires burn.</p>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg border border-border text-sm text-muted hover:text-white">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
