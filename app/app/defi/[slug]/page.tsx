"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, ExternalLink, Info, Loader2, Undo2 } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import SupplyPanel from "@/components/app/defi/SupplyPanel";
import PositionCard from "@/components/app/defi/PositionCard";
import TokenIcon from "@/components/app/defi/TokenIcon";
import { CREDITCOIN_CHAIN_ID, getMarketBySlug } from "@/lib/defi/markets";
import { useMarketData, useUserData } from "@/lib/defi/useDefiData";
import { getChainById, getExplorerAddressUrl } from "@/lib/chains";
import { truncateAddress } from "@/lib/defi/format";
import { formatUnits } from "ethers";

export default function MarketPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const market = getMarketBySlug(params.slug);

  const { data: marketData, refresh: refreshMarket } = useMarketData(market ?? ({ slug: "x" } as never));
  const { data: userData, refresh: refreshUser } = useUserData(market ?? ({ slug: "x" } as never), isConnected ? address : null);

  useEffect(() => {
    if (!market) router.replace("/app/defi");
  }, [market, router]);

  if (!market) return null;

  const refreshAll = () => {
    refreshMarket();
    refreshUser();
  };

  return (
    <div className="w-full space-y-5">
      <Link href="/app/defi" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> All markets
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <TokenIcon src={market.loan.icon} symbol={market.loan.symbol} size={36} />
        <div>
          <h1 className="font-display font-semibold text-xl text-white">Earn with {market.loan.symbol}</h1>
          <p className="text-xs text-muted">Supply {market.loan.symbol} to earn yield on Creditcoin</p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">Chain</div>
            <div className="flex items-center gap-1.5 justify-end">
              <img src={getChainById(CREDITCOIN_CHAIN_ID)!.icon} alt="Creditcoin" width={16} height={16} className="rounded-full" />
              <span className="font-mono text-sm text-white">Creditcoin</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">Market</div>
            <div className="font-mono text-sm text-white">{market.loan.symbol} / {market.collateral.symbol}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
        <div className="space-y-5">
          <SupplyPanel market={market} marketData={marketData} userData={userData} onDone={refreshAll} />
          {/* market stats */}
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
        <div className="space-y-5">
          <div className="border border-border rounded-xl bg-panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">How it works</h3>
            <ul className="text-xs text-muted leading-relaxed space-y-1.5 list-disc pl-4">
              <li>Supply {market.loan.symbol} to earn yield</li>
              <li>Yield from RWA holders borrowing {market.loan.symbol}</li>
              <li>Withdraw anytime</li>
              <li>All verified and travel-rules attached</li>
            </ul>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <img src={getChainById(CREDITCOIN_CHAIN_ID)!.icon} alt="Creditcoin" width={18} height={18} className="rounded-full" />
                <span className="text-[11px] font-mono text-white/70">Creditcoin</span>
              </div>
              <Undo2 size={12} className="text-white/25" />
              <div className="flex items-center gap-1.5">
                <img src={market.collateral.icon} alt={market.collateral.symbol} width={18} height={18} className="rounded-lg" />
                <span className="text-[11px] font-mono text-white/70">{market.collateral.symbol}</span>
              </div>
            </div>
          </div>
          <PositionCard market={market} marketData={marketData} userData={userData} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`font-mono text-white/80 hover:text-white inline-flex items-center gap-1`}>
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span className={mono ? "font-mono text-white/80" : "font-mono text-white"}>{value}</span>
      )}
    </div>
  );
}
