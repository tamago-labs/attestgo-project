"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, ExternalLink, Loader2, Check } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile } from "@/lib/userProfile";

export default function KycPage() {
  const { address, isConnected } = useWallet();
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [sumsubToken, setSumsubToken] = useState<string | null>(null);
  const [sumsubLaunching, setSumsubLaunching] = useState(false);
  const [sumsubCompleted, setSumsubCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) router.replace("/app/identity");
  }, [isConnected, router]);

  useEffect(() => {
    if (!address) return;
    loadProfile(address).then((p) => {
      if (p?.country) setCountry(p.country);
      if (!p) setError("Profile not found — save in Register first");
    });
  }, [address]);

  // launch WebSDK when token ready and container mounted
  useEffect(() => {
    if (!sumsubToken) return;
    const token = sumsubToken;
    let cancelled = false;
    const doLaunch = async () => {
      const { generateClient } = await import("aws-amplify/data");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = generateClient<any>();
      const launch = () => {
        if (cancelled) return;
        const el = document.querySelector("#sumsub-websdk-container");
        if (!el) {
          setTimeout(launch, 100);
          return;
        }
        const w = window as unknown as any;
        const sdk = w.snsWebSdk || w.SNSWebSDK;
        if (!sdk) {
          setError("Sumsub SDK failed to load — retry (snsWebSdk not found)");
          return;
        }
        const sns = sdk
          .init(token, async () => {
            const rr = await client.mutations.sumsubGetAccessToken({ walletAddress: address, ttlInSecs: 600 });
            let rx = rr.data as unknown;
            for (let i = 0; i < 3 && typeof rx === "string"; i++) {
              try {
                rx = JSON.parse(rx as string);
              } catch {
                break;
              }
            }
            const nt = (rx as { token?: string })?.token || token;
            return nt;
          })
          .withConf({ lang: "en", theme: "light" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onStepCompleted", (p: unknown) => console.log("[sumsub] onStepCompleted", p))
          .on("idCheck.onApplicantSubmitted", () => {
            console.log("[sumsub] onApplicantSubmitted");
            setSumsubCompleted(true);
          })
          .on("idCheck.onError", (e: unknown) => console.log("[sumsub] onError", e))
          .onMessage((type: string, payload: unknown) => {
            if (type === "idCheck.onApplicantSubmitted" || type === "idCheck.onApplicantStatusChanged") {
              const pl = payload as { reviewStatus?: string; reviewResult?: { reviewAnswer?: string } } | null;
              if (pl?.reviewResult?.reviewAnswer === "GREEN" || pl?.reviewStatus === "completed") setSumsubCompleted(true);
            }
          })
          .build();
        try {
          sns.launch("#sumsub-websdk-container");
        } catch (e) {
          setError(String(e));
        }
      };
      const existing = document.querySelector('script[src*="sns-websdk-builder"]');
      const hasSdk = (window as unknown as any).snsWebSdk || (window as unknown as any).SNSWebSDK;
      if (existing && hasSdk) requestAnimationFrame(() => setTimeout(launch, 50));
      else {
        const s = document.createElement("script");
        s.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
        s.async = true;
        s.onload = () => requestAnimationFrame(() => setTimeout(launch, 50));
        s.onerror = () => setError("Failed to load Sumsub SDK — check CSP / adblock");
        document.body.appendChild(s);
      }
    };
    doLaunch();
    return () => {
      cancelled = true;
    };
  }, [sumsubToken, address]);

  const handleLaunch = async () => {
    if (!address) return;
    setSumsubLaunching(true);
    setError(null);
    try {
      const { generateClient } = await import("aws-amplify/data");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = generateClient<any>();
      const r1 = await client.mutations.sumsubCreateApplicant({ walletAddress: address });
      if (r1.errors) throw new Error(r1.errors.map((e: { message: string }) => e.message).join(", "));
      let raw1 = r1.data as unknown;
      for (let i = 0; i < 3 && typeof raw1 === "string"; i++) {
        try {
          raw1 = JSON.parse(raw1 as string);
        } catch {
          break;
        }
      }
      const r2 = await client.mutations.sumsubGetAccessToken({ walletAddress: address, ttlInSecs: 600 });
      if (r2.errors) throw new Error(r2.errors.map((e: { message: string }) => e.message).join(", "));
      let raw2 = r2.data as unknown;
      for (let i = 0; i < 3 && typeof raw2 === "string"; i++) {
        try {
          raw2 = JSON.parse(raw2 as string);
        } catch {
          break;
        }
      }
      const token = (raw2 as { token?: string } | null)?.token;
      if (!token) throw new Error("Failed to get Sumsub token — check SUMSUB_APP_TOKEN/SECRET in sandbox");
      setSumsubCompleted(false);
      setSumsubToken(token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSumsubLaunching(false);
    }
  };

  const wallet = address || "—";

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
        <Link href="/app/identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={14} /> Back to Identity
        </Link>
        <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-8 text-center">
          <p className="text-sm text-muted">Connect wallet to continue KYC.</p>
        </div>
      </div>
    );
  }

  if (!sumsubToken) {
    return (
      <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
        <Link href="/app/identity/register" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={14} /> Back to Register
        </Link>
      <div>
        <h1 className="font-display font-semibold text-2xl text-white">KYC Verification</h1>
        <p className="mt-1 text-sm text-muted">Step 2 of 3 — Complete verification to receive your GO Pass</p>
      </div>
        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-violet-400" />
              <span className="text-sm font-medium text-white">Choose KYC provider</span>
              <span className="ml-auto text-xs text-muted">Step 2 · select one to continue</span>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
              <button className="w-full flex items-center gap-3 px-4 py-4 bg-white/[0.04] text-left">
                <span className="w-5 h-5 rounded-full border-2 border-violet-500 flex items-center justify-center shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                </span>
                <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Sumsub</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">Sandbox</span>
                    <Check size={12} className="text-emerald-400 ml-1" />
                  </div>
                  <div className="text-xs text-muted">Document + Liveness • Level basic-attestgo</div>
                </div>
              </button>
              <div className="w-full flex items-center gap-3 px-4 py-4 opacity-40">
                <span className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Jumio</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">Coming soon</span>
                  </div>
                  <div className="text-xs text-white/30">Document verification</div>
                </div>
              </div>
              <div className="w-full flex items-center gap-3 px-4 py-4 opacity-40">
                <span className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Onfido</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">Coming soon</span>
                  </div>
                  <div className="text-xs text-white/30">Identity verification</div>
                </div>
              </div>
            </div>
            <button onClick={handleLaunch} disabled={sumsubLaunching} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-60 inline-flex justify-center items-center gap-2">
              {sumsubLaunching ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Launching Sumsub…
                </>
              ) : (
                <>
                  Verify with Sumsub <ExternalLink size={14} />
                </>
              )}
            </button>
            <div className="rounded-lg border border-dashed border-white/10 bg-canvas/50 p-3">
              <p className="text-xs text-muted">Sandbox tip: use Document Template GREEN to get instant pass. Manual preset gives Pending.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between px-2 py-2">
        <Link href="/app/identity/register" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={14} /> Back to Register
        </Link>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">Sandbox · basic-attestgo</span>
      </div>
      {error && <div className="mx-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
      <div id="sumsub-websdk-container" className="flex-1 border border-border bg-white overflow-hidden rounded-xl min-h-0" />
      <div className="px-2 py-3 border-t border-border bg-panel">
        {sumsubCompleted ? (
          <>
            <button onClick={() => router.push("/app/identity/mint")} className="w-full py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex justify-center items-center gap-2">
              Continue — Mint GO Pass <Check size={14} />
            </button>
            <p className="mt-2 text-xs text-emerald-300 text-center">Submitted — continue to mint.</p>
          </>
        ) : (
          <p className="text-xs text-muted text-center">Complete verification in the frame above — Continue appears after Sumsub submits.</p>
        )}
      </div>
    </div>
  );
}
