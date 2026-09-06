"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import StepLock from "@/components/app/defi/StepLock";
import StepAttest from "@/components/app/defi/StepAttest";
import StepBorrow from "@/components/app/defi/StepBorrow";
import RepayUnlock from "@/components/app/defi/RepayUnlock";
import PositionCard from "@/components/app/defi/PositionCard";
import TokenIcon from "@/components/app/defi/TokenIcon";
import { CREDITCOIN_CHAIN_ID, getMarketBySlug } from "@/lib/defi/markets";
import { useMarketData, useUserData } from "@/lib/defi/useDefiData";
import { listLockRecords, type LockRecord } from "@/lib/defi/lockRecords";
import { getChainById, getExplorerAddressUrl } from "@/lib/chains";
import { truncateAddress } from "@/lib/defi/format";
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
  const [activeTab, setActiveTab] = useState<"flow" | "position">("flow");

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
      <Link href="/app/defi" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> All markets
      </Link>

      <div className="flex items-center gap-3">
        <TokenIcon src={market.collateral.icon} symbol={market.collateral.symbol} size={36} />
        <div>
          <h1 className="font-display font-semibold text-xl text-white">Borrow {market.loan.symbol} with {market.collateral.symbol}</h1>
          <p className="text-xs text-muted mt-1">
            Three steps: lock RWA on Sepolia → attestation verifies → borrow on Creditcoin
          </p>
        </div>
        {marketData && (
          <div className="ml-auto flex items-center gap-4 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted">LTV</div>
              <div className="font-mono text-sm text-white">{(Number(market.lltv) / 1e18 * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted">Borrow APR</div>
              <div className="font-mono text-sm text-white">{(marketData.borrowApy * 100).toFixed(2)}%</div>
            </div>
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-panel w-fit">
        <button onClick={() => setActiveTab("flow")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === "flow" ? "bg-white/[0.08] text-white" : "text-muted hover:text-white"}`}>Borrow</button>
        <button onClick={() => setActiveTab("position")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === "position" ? "bg-white/[0.08] text-white" : "text-muted hover:text-white"}`}>Position</button>
      </div>

      {activeTab === "flow" ? (
        <>
          {/* pipeline strip */}
          <div className="flex items-center gap-2">
            <PipelineChip step={1} label="On Sepolia" active sub={`wallet: ${records.length >= 0 && address ? "connected" : "—"}`} />
            <ArrowRight size={14} className="text-white/20 shrink-0" />
            <PipelineChip step={2} label="Locked · pending" active={pendingSum > 0} sub={pendingSum > 0 ? `${pendingSum} ${market.collateral.symbol} attesting` : "nothing pending"} />
            <ArrowRight size={14} className="text-white/20 shrink-0" />
            <PipelineChip step={3} label="Available on Creditcoin" active={collateral > 0} sub={`${collateral} ${market.collateral.symbol} proven`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <div className="space-y-5">
              <StepLock market={market} address={address} onLocked={refreshAll} />
              <StepAttest market={market} records={recordsLoading ? [] : records} onAttested={refreshAll} />
            </div>
            <div className="space-y-5">
              <StepBorrow market={market} marketData={marketData} userData={userData} onDone={refreshAll} />
              <RepayUnlock market={market} userData={userData} onDone={refreshAll} />
            </div>
          </div>
        </>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <PositionCard market={market} marketData={marketData} userData={userData} hideButton />
          <div className="border border-border rounded-xl bg-panel p-4 space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Market data</h3>
            {marketData ? (
              <>
                <StatRow label="Total supplied" value={`${Number(formatUnits(marketData.state.totalSupplyAssets, market.loan.decimals)).toFixed(2)} ${market.loan.symbol}`} />
                <StatRow label="Total borrowed" value={`${Number(formatUnits(marketData.state.totalBorrowAssets, market.loan.decimals)).toFixed(2)} ${market.loan.symbol}`} />
                <StatRow label="Utilization" value={`${(marketData.utilization * 100).toFixed(1)}%`} />
                <StatRow label="Market id" value={truncateAddress(marketData.marketId)} mono />
                <StatRow label="CoreVault" value={truncateAddress("0x51062701163469d30a0c4331BB2FBab215d24434")} mono href={getExplorerAddressUrl(CREDITCOIN_CHAIN_ID, "0x51062701163469d30a0c4331BB2FBab215d24434")} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted py-2"><Loader2 size={13} className="animate-spin" /> Loading on-chain state…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineChip({ step, label, active, sub }: { step: number; label: string; active?: boolean; sub: string }) {
  return (
    <div className={`relative border rounded-xl p-4 flex-1 ${active ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-panel"}`}>
      <div className="flex items-center gap-2">
        {active ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="w-4 h-4 rounded-full border border-white/20 text-[9px] text-white/40 flex items-center justify-center font-mono">{step}</span>}
        <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60"}`}>{label}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted font-mono">{sub}</div>
    </div>
  );
}

function StatRow({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-white/80 hover:text-white inline-flex items-center gap-1">
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span className={mono ? "font-mono text-white/80" : "font-mono text-white"}>{value}</span>
      )}
    </div>
  );
}
