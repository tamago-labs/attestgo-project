"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, Copy, ExternalLink, Clock, Globe, BadgeCheck, QrCode, RefreshCw, UserRoundX, Check } from "lucide-react";
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
  const [profileCountry, setProfileCountry] = useState<string>("");
  const [passRequest, setPassRequest] = useState<{ status: string; txHash: string; blockNumber: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [attestNote, setAttestNote] = useState<string | null>(null);

  useEffect(() => {
    setPass(loadMockPass());
    const onStorage = () => setPass(loadMockPass());
    window.addEventListener("storage", onStorage);
    const id = setInterval(() => setPass(loadMockPass()), 800);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!address) {
      setProfileName("");
      setProfileCountry("");
      setPassRequest(null);
      return;
    }
    loadProfile(address).then(async (p) => {
      setProfileName(p?.displayName || "");
      setProfileCountry(p?.country || "");
      if (!p) {
        setPassRequest(null);
        return;
      }
      try {
        const { generateClient } = await import("aws-amplify/data");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = generateClient<any>();
        const pid = (p as unknown as { id: string }).id;
        let rows: { status: string; txHash: string; blockNumber: number }[] | null = null;
        try {
          const res: { data: unknown } = await client.models.PassRequest.byUserProfile({ userProfileId: pid });
          rows = res.data as unknown as typeof rows;
        } catch {
          const res: { data: unknown } = await client.models.PassRequest.list({ filter: { userProfileId: { eq: pid } } });
          rows = (res.data as unknown as typeof rows) || null;
        }
        if (rows && (rows as unknown as { length: number }).length > 0) {
          const sorted = (JSON.parse(JSON.stringify(rows)) as { status: string; txHash: string; blockNumber: number }[]).sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
          setPassRequest(sorted[0]);
        } else {
          setPassRequest(null);
        }
      } catch {
        setPassRequest(null);
      }
    });
  }, [address]);

  useEffect(() => {
    if (!passRequest || passRequest.status === "active") return;
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 60 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [passRequest?.status]);

  // polling PassRequest pending -> active via attestPass
  useEffect(() => {
    if (!passRequest || passRequest.status === "active" || !address) return;
    let cancelled = false;
    const poll = async () => {
      try {
        console.log("[poll] attestPass start", passRequest.txHash);
        const { generateClient } = await import("aws-amplify/data");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = generateClient<any>();
        const pid = (await loadProfile(address))?.id;
        if (!pid) {
          console.warn("[poll] no profile");
          return;
        }
        let attestOk = false;
        try {
          const r = await client.mutations.attestPass({ userProfileId: pid });
          console.log("[poll] attestPass res", r);
          if (r.errors) {
            const msg = JSON.stringify(r.errors);
            if (msg.includes("ExecutionTimeoutException") || msg.includes("timed out")) {
              console.warn("[poll] attestPass timeout - will refetch PassRequest immediately", r.errors);
              setAttestNote("Attestation is processing — will retry in 60s");
            } else if (msg.includes("404") || msg.toLowerCase().includes("not yet attested") || msg.includes("Failed to generate proof")) {
              // from handler 404 -> Lambda:Unhandled Proof generation failed 404 - show friendly, not just countdown
              setAttestNote(`Block ${passRequest.blockNumber} not yet attested on Creditcoin — prover 404. Retrying in 60s (usually 2–5 min).`);
            } else {
              console.warn("[poll] attestPass errors", r.errors);
              const m = (r.errors as unknown as { message?: string }[])?.[0]?.message?.slice(0, 180) || "Attestation pending";
              setAttestNote(m);
            }
          } else if (r.data) {
            try {
              const parsed = typeof r.data === "string" ? JSON.parse(r.data as unknown as string) : (r.data as unknown as Record<string, unknown>);
              if ((parsed as Record<string, unknown>).status === "active") {
                attestOk = true;
                setAttestNote(null);
              } else if ((parsed as Record<string, unknown>).status === "pending" && (parsed as Record<string, unknown>).reason) {
                const reason = String((parsed as Record<string, unknown>).reason).slice(0, 220);
                setAttestNote(reason.includes("404") || reason.toLowerCase().includes("not yet") ? `Block ${passRequest.blockNumber} not yet attested — ${reason.slice(0, 120)}` : reason);
              } else if ((r.data as unknown as string)?.includes?.("active")) {
                attestOk = true;
                setAttestNote(null);
              }
            } catch {
              if ((r.data as unknown as string)?.includes?.("active")) {
                attestOk = true;
                setAttestNote(null);
              }
            }
          }
        } catch (e) {
          console.warn("[poll] attestPass throw", e);
          setAttestNote("Network error — retrying in 60s");
        }
        // always refetch - even on timeout the Lambda may have updated PassRequest before timing out (see handler: update before return, 60s wait cap)
        const res = await client.models.PassRequest.byUserProfile({ userProfileId: pid }).catch(async () => {
          return client.models.PassRequest.list({ filter: { userProfileId: { eq: pid } } });
        });
        console.log("[poll] PassRequest rows", res.data);
        const rows = (res.data as unknown as { status: string; txHash: string; blockNumber: number }[]) || [];
        if (!cancelled && rows.length > 0) {
          const sorted = (JSON.parse(JSON.stringify(rows)) as typeof rows).sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
          console.log("[poll] sorted", sorted[0]);
          if (sorted[0].status === "active") {
            setPassRequest(sorted[0]);
            return;
          }
          // if attest returned active but DB still pending (eventual consistency), retry quickly
          if (attestOk) {
            setTimeout(async () => {
              try {
                const r2 = await client.models.PassRequest.byUserProfile({ userProfileId: pid }).catch(async () => client.models.PassRequest.list({ filter: { userProfileId: { eq: pid } } }));
                const rows2 = (r2.data as unknown as typeof rows) || [];
                const s2 = (JSON.parse(JSON.stringify(rows2)) as typeof rows).sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
                if (s2[0]?.status === "active") setPassRequest(s2[0]);
              } catch {}
            }, 2000);
          }
        }
      } catch (e) {
        console.warn("[poll] failed", e);
      }
    };
    poll();
    const iid = setInterval(poll, 60000);
    return () => {
      cancelled = true;
      clearInterval(iid);
    };
  }, [passRequest?.status, address]);

  const hasPass = !!pass || !!passRequest;
  const displayPass = passRequest
    ? {
        wallet: address || "",
        country: profileCountry || "US",
        tier: 10,
        status: passRequest.status === "active" ? ("Active" as const) : ("Pending" as const),
        customerId: pass?.customerId || "",
        customerIdHash: pass?.customerIdHash || "",
        expiry: pass?.expiry || Math.floor(Date.now() / 1000) + 365 * 86400,
      }
    : pass;

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

  const verifiedUntil = displayPass ? new Date(displayPass.expiry * 1000).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" }) : "—";
  const expiryLabel = displayPass ? new Date(displayPass.expiry * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : undefined;

  return (
    <div className="max-w-2xl mx-auto w-full px-2 sm:px-0 py-2 space-y-6">
      {/* Card */}
      <div className="w-full max-w-[420px] mx-auto">
        {hasPass && displayPass ? (
          <GOPassCard
            wallet={displayPass.wallet}
            country={displayPass.country}
            group=""
            verifiedUntil={verifiedUntil}
            expiryLabel={expiryLabel}
            status={displayPass.status}
            tierLabel={displayPass.tier >= 20 ? "Gold" : "Silver"}
            name={(profileName || shortAddr(displayPass.wallet)).toUpperCase()}
          />
        ) : (
          <div className="relative aspect-[1.586/1] rounded-2xl border border-dashed border-white/15 bg-panel/40 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <UserRoundX className="text-white/40" size={20} />
            </div>
            <div className="mt-3 font-medium text-white text-sm">Verification required</div>
            <div className="mt-1 text-xs text-muted max-w-[44ch]">Create your GO Pass to send and receive compliant assets and use them as collateral to borrow.</div>
            {isConnected ? (
              <Link href="/app/identity/register" className="mt-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 transition-colors">
                  Register GO Pass
                </span>
              </Link>
            ) : (
              <span className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/40 text-sm font-medium cursor-not-allowed">
                Register GO Pass
              </span>
            )}
            {!isConnected && <div className="mt-2 text-[11px] text-white/40">Connect wallet to register</div>}
          </div>
        )}
      </div>

      {/* Actions when no pass already covered; when has pass show list */}
      {hasPass && displayPass ? (
        <>
          {passRequest && passRequest.status !== "active" && (
            <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check size={12} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Completed mint on Sepolia</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">{shortAddr(passRequest.txHash)}</span>
                    <a href={`https://sepolia.etherscan.io/tx/${passRequest.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-amber hover:text-white inline-flex items-center gap-1 shrink-0">
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 border-amber/20 text-amber">
                  <Clock size={12} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Waiting for attestation to Creditcoin</div>
                  <div className="mt-1 text-xs text-muted">Polling… {countdown}s</div>
                  {attestNote && <div className="mt-1 text-xs text-amber/80 leading-relaxed">{attestNote}</div>}
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 border-white/10 text-white/30">
                  <span className="text-xs">3</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/40">Your pass is ready</div>
                  <div className="mt-1 text-xs text-muted">Waiting for activation</div>
                </div>
              </div>
            </div>
          )}
          {passRequest && passRequest.status === "active" && (
            <div className="rounded-xl border border-border bg-panel p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">active</span>
                <span className="text-xs font-mono text-muted">{shortAddr(passRequest.txHash)}</span>
              </div>
              <a href={`https://sepolia.etherscan.io/tx/${passRequest.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-amber hover:text-white inline-flex items-center gap-1">
                View <ExternalLink size={10} />
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="text-sm font-medium text-white">How to get your GO Pass</div>
          <ol className="mt-3 space-y-3">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10 text-xs font-medium text-white">
                1
              </span>
              <div className="text-sm leading-relaxed">
                <span className="font-medium text-white">Choose your chain:</span> <span className="text-muted">Select where your GO Pass NFT will be minted.</span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10 text-xs font-medium text-white">
                2
              </span>
              <div className="text-sm leading-relaxed">
                <span className="font-medium text-white">Verify with Sumsub:</span> <span className="text-muted">Complete KYC with Sumsub including liveness check.</span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10 text-xs font-medium text-white">
                3
              </span>
              <div className="text-sm leading-relaxed">
                <span className="font-medium text-white">Attest & activate:</span> <span className="text-muted">Your pass is attested to Creditcoin via Attestcoin Protocol. AttestGO verifies the attestation then marks your NFT Active.</span>
              </div>
            </li>
          </ol>
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
