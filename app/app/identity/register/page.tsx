"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, ExternalLink, Check, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { saveMockPass, type MockPass } from "@/lib/mockPass";
import { loadProfile } from "@/lib/userProfile";

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
  const { address } = useWallet();
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [customerId, setCustomerId] = useState("");
  const [kycSource, setKycSource] = useState("sumsub");
  const [step, setStep] = useState<"form" | "kyc" | "creating" | "done">("form");
  const [kycLoading, setKycLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    loadProfile(address).then((p) => {
      if (p?.country) setCountry(p.country);
      if (p?.displayName) setCustomerId((cur) => cur || p.displayName);
    });
  }, [address]);

  const wallet = address || "0x0000000000000000000000000000000000000000";
  const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
  const expiryLabel = new Date(expiry * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const handleContinue = () => {
    if (!country) return;
    setStep("kyc");
  };

  const handleKyc = async () => {
    setKycLoading(true);
    // simulate Sumsub iframe success
    await new Promise((r) => setTimeout(r, 1400));
    setKycLoading(false);
    setStep("creating");
    // simulate mint + Creditcoin approval
    await new Promise((r) => setTimeout(r, 900));
    const cid = customerId.trim() || `cust-${Date.now()}`;
    const mock: MockPass = {
      wallet,
      tier: 10,
      country,
      customerId: cid,
      customerIdHash: keccakPlaceholder(cid),
      kycSource: kycSource || "",
      expiry,
      status: "Active",
      createdAt: Date.now(),
    };
    saveMockPass(mock);
    setStep("done");
    setTimeout(() => router.push("/app/identity"), 900);
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      <Link href="/app/identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> Back to Identity
      </Link>

      <div>
        <h1 className="font-display font-semibold text-2xl text-white">Register GO Pass</h1>
        <p className="mt-1 text-sm text-muted">
          One wallet one country. Mirrors <span className="font-mono text-white/70">scripts/gopass/2_mint.ts</span> — tier 10, bitmap 1 country, expiry 365d, active after CC.
        </p>
      </div>

      {step === "form" && (
        <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Wallet</label>
            <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-canvas border border-border font-mono text-sm text-white/70 truncate">
              {wallet}
            </div>
            {!address && <div className="mt-1 text-xs text-amber/80">Connect wallet to bind pass — using placeholder.</div>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="mt-1 text-[11px] text-white/30">Single country → bitmap 1&lt;&lt;bit (e.g. US=0 → 1)</div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Tier</label>
              <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white/50">10 — Standard (fixed)</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Customer ID (optional)</label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="cust-123 or leave blank → auto"
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
            />
            <div className="mt-1 text-[11px] text-white/30 font-mono break-all">hash → {keccakPlaceholder(customerId || "cust-auto")}</div>
          </div>

          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">KYC Provider</label>
            <div className="mt-1.5 flex gap-2">
              {[
                { v: "sumsub", l: "Sumsub" },
                { v: "", l: "None (blank)" },
              ].map((o) => (
                <button
                  key={o.v || "blank"}
                  onClick={() => setKycSource(o.v)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    kycSource === o.v ? "bg-white text-canvas border-white" : "bg-canvas border-border text-muted hover:text-white"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-canvas border border-border p-3 text-xs text-muted space-y-1">
            <div className="flex justify-between">
              <span>Expiry</span>
              <span className="text-white/70">{expiryLabel} (365 days)</span>
            </div>
            <div className="flex justify-between">
              <span>Record</span>
              <span className="font-mono text-white/50">
                tier 10 • bitmap 1 • active false → pending CC
              </span>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 transition-colors inline-flex justify-center items-center gap-2"
          >
            Continue to KYC <ExternalLink size={14} />
          </button>
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
        <div className="rounded-xl border border-border bg-panel p-8 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-white/60" />
          <div className="mt-3 text-sm text-white">Creating GO Pass…</div>
          <div className="mt-1 text-xs text-muted">Minting soulbound token • keccak hash • pending Creditcoin verification → active</div>
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
