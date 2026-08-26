"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, ExternalLink, Check, Loader2 } from "lucide-react";
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

function keccakPlaceholder(s: string) {
  // mock hash for UI — real keccak via GOPass mint, display truncated
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "0x" + h.toString(16).padStart(8, "0") + "…" + s.slice(-4);
}

export default function RegisterPage() {
  const { address, isConnected, signer } = useWallet();
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [displayName, setDisplayName] = useState("");
  const [kycSource] = useState("sumsub");
  const [step, setStep] = useState<"form" | "kyc" | "creating" | "done">("form");
  const [kycLoading, setKycLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [sourceChainId] = useState(11155111);
  const [pendingTx, setPendingTx] = useState<{ hash: string; block: number } | null>(null);

  useEffect(() => {
    if (!isConnected) {
      router.replace("/app/identity");
      return;
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (!address) return;
    loadProfile(address).then((p) => {
      if (p) {
        setHasProfile(true);
        if (p?.country) setCountry(p.country);
        if (p?.displayName) setDisplayName((cur) => cur || p.displayName);
      } else {
        setHasProfile(false);
      }
    });
  }, [address]);

  const wallet = address || "0x0000000000000000000000000000000000000000";

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
  const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
  const expiryLabel = new Date(expiry * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleKyc = async () => {
    console.log("[handleKyc] start", { address, hasProfile, country, displayName });
    setKycLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setKycLoading(false);
    setStep("creating");
    setError(null);
    try {
      console.log("[handleKyc] loading profile");
      const profile = await loadProfile(address!);
      console.log("[handleKyc] profile", profile);
      if (!profile) throw new Error("Profile not found — save first");
      const { generateClient } = await import("aws-amplify/data");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = generateClient<any>();
      console.log("[handleKyc] calling mintPass", (profile as unknown as { id: string }).id);
      const res = await client.mutations.mintPass({ userProfileId: (profile as unknown as { id: string }).id });
      console.log("[handleKyc] mintPass res", res);
      if (res.errors) throw new Error(res.errors.map((e: { message: string }) => e.message).join(", "));
      const data = res.data as { txHash: string; blockNumber: number; recordHash: string } | null;
      console.log("[handleKyc] mintPass data", data);
      if (!data?.txHash) throw new Error("mintPass failed: no txHash");
      setPendingTx({ hash: data.txHash, block: data.blockNumber });
      try {
        console.log("[handleKyc] creating PassRequest pending");
        await client.models.PassRequest.create({
          userProfileId: (profile as unknown as { id: string }).id,
          chainId: sourceChainId,
          txHash: data.txHash,
          blockNumber: data.blockNumber,
          recordHash: data.recordHash,
          status: "pending",
        });
        console.log("[handleKyc] PassRequest created");
      } catch (e) {
        console.warn("[handleKyc] PassRequest create failed (maybe already exists)", e);
      }
      setStep("done");
      setTimeout(() => router.push("/app/identity"), 900);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleKyc] error", e);
      setError(msg || "KYC failed");
      setStep("kyc");
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      <Link href="/app/identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> Back to Identity
      </Link>

      <div>
        <h1 className="font-display font-semibold text-2xl text-white">Register GO Pass</h1>
        <p className="mt-1 text-sm text-muted">Get verified for compliant transfers and borrowing — one pass for every chain.</p>
      </div>

      {step === "form" && (
        <div className="space-y-4">
          {/* Card 1 — profile, like EditProfileModal */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Full name (as on ID)</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                maxLength={32}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Country *</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-60 transition-colors inline-flex justify-center items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving profile…
                </>
              ) : (
                <>Save profile</>
              )}
            </button>
          </div>

          {/* Card 2 — rest of GO Pass data */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Source chain</label>
                <div className="mt-1.5 relative">
                  <select
                    value={sourceChainId}
                    onChange={() => {}}
                    className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value={11155111}>ETH Sepolia</option>
                  </select>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628"
                    alt="ETH Sepolia"
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white p-0.5 object-contain"
                  />
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
            <button
              onClick={() => setStep("kyc")}
              disabled={!hasProfile}
              className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex justify-center items-center gap-2"
            >
              Continue to KYC <ExternalLink size={14} />
            </button>
            {!hasProfile && <p className="text-xs text-amber/80 text-center">Save profile first to continue</p>}
          </div>
        </div>
      )}

      {step === "kyc" && (
        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-violet-400" />
              <span className="text-sm font-medium text-white">KYC via {kycSource || "Sumsub"}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">Mock</span>
            </div>
            <p className="mt-1 text-xs text-muted">Simulated Sumsub — no real verification. Click verify to create pass.</p>
          </div>
          <div className="p-5 space-y-4">
            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="rounded-lg border border-border bg-canvas p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">Sumsub KYC</div>
                <div className="text-xs text-muted truncate">
                  Country {country} • Wallet {wallet.slice(0, 10)}…
                </div>
              </div>
              <span className="text-[10px] px-2 py-1 rounded bg-amber/15 text-amber border border-amber/20">Required</span>
            </div>
            <button
              onClick={handleKyc}
              disabled={kycLoading}
              className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-60 inline-flex justify-center items-center gap-2"
            >
              {kycLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  Verify with {kycSource ? "Sumsub" : "Provider"} <ExternalLink size={14} />
                </>
              )}
            </button>
            <button onClick={() => setStep("form")} className="w-full text-sm text-muted hover:text-white">
              Back to form
            </button>
          </div>
        </div>
      )}

      {step === "creating" && (
        <div className="rounded-xl border border-border bg-panel p-6 text-center space-y-3">
          <Loader2 size={20} className="animate-spin mx-auto text-white/60" />
          <div className="text-sm text-white">Creating GO Pass…</div>
          {pendingTx && (
            <div className="rounded-lg bg-canvas border border-border p-3 text-xs font-mono break-all text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Tx</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${pendingTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:text-white inline-flex items-center gap-1"
                >
                  {pendingTx.hash.slice(0, 10)}…{pendingTx.hash.slice(-6)} <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Block</span>
                <span className="text-white/70">{pendingTx.block}</span>
              </div>
              <a
                href={`https://sepolia.etherscan.io/tx/${pendingTx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center mt-2 text-amber hover:text-white"
              >
                View on explorer
              </a>
            </div>
          )}
          <div className="text-xs text-muted">Minting soulbound token • pending Creditcoin attestation</div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
            <Check size={20} />
          </div>
          <div className="mt-3 text-sm font-medium text-white">GO Pass created — Active</div>
          <div className="mt-1 text-xs text-emerald-200/70">Redirecting to Identity…</div>
        </div>
      )}
    </div>
  );
}
