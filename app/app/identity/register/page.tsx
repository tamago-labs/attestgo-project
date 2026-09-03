"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { buildMessage, loadProfile, saveProfile } from "@/lib/userProfile";

const COUNTRIES = [
  { code: "US", label: "United States — US" },
  { code: "SG", label: "Singapore — SG" },
  { code: "JP", label: "Japan — JP" },
  { code: "HK", label: "Hong Kong — HK" },
  { code: "DE", label: "Germany — DE" },
  { code: "CN", label: "China — CN" },
  { code: "GB", label: "United Kingdom — GB" },
  { code: "FR", label: "France — FR" },
  { code: "AE", label: "UAE — AE" },
  { code: "CH", label: "Switzerland — CH" },
];

export default function RegisterPage() {
  const { address, isConnected, signer } = useWallet();
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const sourceChainId = 11155111;

  useEffect(() => {
    if (!isConnected) router.replace("/app/identity");
  }, [isConnected, router]);

  useEffect(() => {
    if (!address) return;
    loadProfile(address).then((p) => {
      if (p) {
        setHasProfile(true);
        if (p?.country) setCountry(p.country);
        if (p?.displayName) setDisplayName((cur) => cur || p.displayName);
      } else setHasProfile(false);
    });
  }, [address]);

  const wallet = address || "0x0000000000000000000000000000000000000000";
  const expiryLabel = new Date((Math.floor(Date.now() / 1000) + 365 * 86400) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const handleSaveProfile = async () => {
    if (!country || !displayName.trim()) {
      setError("Display name and country required");
      return;
    }
    if (!address || !signer) {
      setError("Connect wallet to continue");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const name = displayName.trim();
      const message = buildMessage(address, name, country);
      const signature = await (signer as unknown as { signMessage: (m: string) => Promise<string> }).signMessage(message);
      await saveProfile({ walletAddress: address, displayName: name, country, message, signature });
      setHasProfile(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
        <Link href="/app/identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={14} /> Back to Identity
        </Link>
        <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-8 text-center">
          <p className="text-sm text-muted">Connect your wallet to register a GO Pass.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      <Link href="/app/identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> Back to Identity
      </Link>
      <div>
        <h1 className="font-display font-semibold text-2xl text-white">Register GO Pass</h1>
        <p className="mt-1 text-sm text-muted">Step 1 of 3 — your profile for onchain finance.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Full name (as on ID)</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Rivera" maxLength={32} className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Country *</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white focus:outline-none focus:border-violet-500/50">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={handleSaveProfile} disabled={saving} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-60 inline-flex justify-center items-center gap-2">
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving profile…
              </>
            ) : (
              <>Save profile</>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Source chain</label>
              <div className="mt-1.5 relative">
                <select value={sourceChainId} onChange={() => {}} className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white focus:outline-none focus:border-violet-500/50">
                  <option value={11155111}>ETH Sepolia</option>
                </select>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628" alt="ETH Sepolia" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white p-0.5 object-contain" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">▾</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Expiry</label>
              <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white/70">{expiryLabel}</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Wallet to verify</label>
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-canvas border border-border">
              <span className="flex-1 font-mono text-sm text-white/70 truncate">{wallet}</span>
              <span className="shrink-0 px-1.5 py-0.5 rounded-full border border-amber/20 bg-amber/10 text-[10px] font-medium text-amber">Silver • Tier 10</span>
            </div>
          </div>
          <button onClick={() => router.push("/app/identity/kyc")} disabled={!hasProfile} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex justify-center items-center gap-2">
            Continue to KYC <ExternalLink size={14} />
          </button>
          {!hasProfile && <p className="text-xs text-amber/80 text-center">Save profile first to continue</p>}
          <p className="text-xs text-muted text-center">Next: KYC verification → Mint pass</p>
        </div>
      </div>
    </div>
  );
}
