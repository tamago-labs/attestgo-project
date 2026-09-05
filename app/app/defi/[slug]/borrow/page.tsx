"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import StepLock from "@/components/app/defi/StepLock";
import StepAttest from "@/components/app/defi/StepAttest";
import StepBorrow from "@/components/app/defi/StepBorrow";
import RepayUnlock from "@/components/app/defi/RepayUnlock";
import { getMarketBySlug } from "@/lib/defi/markets";
import { useMarketData, useUserData } from "@/lib/defi/useDefiData";
import { listLockRecords, type LockRecord } from "@/lib/defi/lockRecords";
import { formatUnits } from "ethers";

export default function BorrowPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const market = getMarketBySlug(params.slug);
  const { data: marketData, refresh: refreshMarket } = useMarketData(market ?? ({ slug: "x" } as never));
  const { data: userData, refresh: refreshUser } = useUserData(market ?? ({ slug: "x" } as never), isConnected ? address : null);
  const [records, setRecords] = useState<LockRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!address || !market) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    try {
      setRecords(await listLockRecords(address, market.slug));
    } catch {
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, [address, market]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!market) router.replace("/app/defi");
  }, [market, router]);

  if (!market) return null;

  const refreshAll = () => {
    refreshMarket();
    refreshUser();
    loadRecords();
  };

  const lockedPending = records.filter((r) => r.status === "locked" || r.status === "attesting");
  const pendingSum = lockedPending.reduce((acc, r) => acc + Number(r.amount || "0"), 0);
  const collateral = userData ? Number(formatUnits(userData.collateral, 18)) : 0;

  return (
    <div className="w-full space-y-5">
      <Link href={`/app/defi/${market.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> {market.name}
      </Link>

      <div>
        <h1 className="font-display font-semibold text-xl text-white">Borrow {market.loan.symbol} with {market.collateral.symbol}</h1>
        <p className="text-xs text-muted mt-1">
          Three steps: lock your RWA on Sepolia, let Creditcoin&apos;s attestation verify it, then borrow on Creditcoin. Your collateral never moves.
        </p>
      </div>

      {/* pipeline strip */}
      <div className="grid sm:grid-cols-3 gap-3">
        <PipelineChip step={1} label="On Sepolia" active sub={`wallet: ${records.length >= 0 && address ? "connected" : "—"}`} />
        <PipelineChip step={2} label="Locked · pending" active={pendingSum > 0} sub={pendingSum > 0 ? `${pendingSum} ${market.collateral.symbol} attesting` : "nothing pending"} />
        <PipelineChip step={3} label="Available on Creditcoin" active={collateral > 0} sub={`${collateral} ${market.collateral.symbol} proven`} last />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <StepLock market={market} address={address} onLocked={refreshAll} />
          {recordsLoading ? (
            <div className="border border-border rounded-xl bg-panel p-4 flex items-center gap-2 text-xs text-muted">
              <Loader2 size={13} className="animate-spin" /> Loading your lock records…
            </div>
          ) : (
            <StepAttest market={market} records={records} onAttested={refreshAll} />
          )}
        </div>
        <div className="space-y-5">
          <StepBorrow market={market} marketData={marketData} userData={userData} onDone={refreshAll} />
          <RepayUnlock market={market} userData={userData} onDone={refreshAll} />
        </div>
      </div>
    </div>
  );
}

function PipelineChip({ step, label, active, sub, last }: { step: number; label: string; active?: boolean; sub: string; last?: boolean }) {
  return (
    <div className={`relative border rounded-xl p-4 ${active ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-panel"}`}>
      <div className="flex items-center gap-2">
        {active ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="w-4 h-4 rounded-full border border-white/20 text-[9px] text-white/40 flex items-center justify-center font-mono">{step}</span>}
        <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60"}`}>{label}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted font-mono">{sub}</div>
      {!last && <ArrowRight size={13} className="hidden sm:block absolute top-1/2 -right-[19px] text-white/15 z-10" />}
    </div>
  );
}
