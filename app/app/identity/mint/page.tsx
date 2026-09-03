"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Shield } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile } from "@/lib/userProfile";

export default function MintPage() {
  const { address, isConnected } = useWallet();
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<{ hash: string; block: number } | null>(null);
  const sourceChainId = 11155111;

  useEffect(() => {
    if (!isConnected) router.replace("/app/identity");
  }, [isConnected, router]);

  useEffect(() => {
    if (!address) return;
    loadProfile(address).then((p) => {
      if (p) {
        setHasProfile(true);
        if (p.country) setCountry(p.country);
      } else setHasProfile(false);
    });
  }, [address]);

  const wallet = address || "—";
  const expiryLabel = new Date((Math.floor(Date.now() / 1000) + 365 * 86400) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const handleMint = async () => {
    if (!address) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await loadProfile(address);
      if (!profile) throw new Error("Profile not found — back to Register");
      const { generateClient } = await import("aws-amplify/data");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = generateClient<any>();
      const res = await client.mutations.mintPass({ userProfileId: (profile as unknown as { id: string }).id });
      if (res.errors) throw new Error(res.errors.map((e: { message: string }) => e.message).join(", "));
      let raw = res.data as unknown;
      if (typeof raw === "string") {
        for (let i = 0; i < 3 && typeof raw === "string"; i++) {
          try {
            raw = JSON.parse(raw as string);
          } catch {
            break;
          }
        }
      }
      const data = raw as { txHash: string; blockNumber: number; recordHash: string } | null;
      if (!data?.txHash) throw new Error("mintPass no txHash");
      setPendingTx({ hash: data.txHash, block: data.blockNumber });
      try {
        await client.models.PassRequest.create({
          userProfileId: (profile as unknown as { id: string }).id,
          chainId: sourceChainId,
          txHash: data.txHash,
          blockNumber: data.blockNumber,
          recordHash: data.recordHash,
          status: "pending",
        });
      } catch {}
      setTimeout(() => router.push("/app/identity"), 900);
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
          <p className="text-sm text-muted">Connect wallet to mint.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      <Link href="/app/identity/kyc" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> Back to KYC
      </Link>
      <div>
        <h1 className="font-display font-semibold text-2xl text-white">Mint GO Pass</h1>
        <p className="mt-1 text-sm text-muted">Step 3 of 3 — Mint your GO Pass on Sepolia</p>
      </div>

      {!pendingTx ? (
        <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-white/80 uppercase tracking-widest">Wallet</div>
              <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-canvas border border-border font-mono text-sm text-white/70 truncate">{wallet}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-white/80 uppercase tracking-widest">Expiry</div>
              <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white/70">{expiryLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-canvas border border-border">
            <Shield size={14} className="text-violet-400" />
            <span className="text-sm text-white">Country {country}</span>
            <span className="ml-auto px-1.5 py-0.5 rounded-full border border-amber/20 bg-amber/10 text-[10px] font-medium text-amber">Silver • Tier 10</span>
          </div>
          <div className="text-xs text-muted">No gas required — we sponsor the mint on Sepolia</div>
          {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          {!hasProfile && <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">No profile — back to Register</div>}
          <button onClick={handleMint} disabled={saving || !hasProfile} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 inline-flex justify-center items-center gap-2">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Minting…
              </>
            ) : (
              <>
                Mint GO Pass <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
            <Check size={20} />
          </div>
          <div className="text-sm font-medium text-white">GO Pass created — pending attestation</div>
          <div className="rounded-lg bg-canvas border border-border p-3 text-xs font-mono break-all text-left">
            <div className="flex justify-between">
              <span className="text-muted">Tx</span>
              <a href={`https://sepolia.etherscan.io/tx/${pendingTx.hash}`} target="_blank" rel="noopener noreferrer" className="text-amber hover:text-white inline-flex items-center gap-1">
                {pendingTx.hash.slice(0, 10)}…{pendingTx.hash.slice(-6)} <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted">Block</span>
              <span className="text-white/70">{pendingTx.block}</span>
            </div>
          </div>
          <div className="text-xs text-emerald-200/70">Redirecting to Identity…</div>
        </div>
      )}
    </div>
  );
}
