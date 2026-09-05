"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import SupplyPanel from "@/components/app/defi/SupplyPanel";
import PositionCard from "@/components/app/defi/PositionCard";
import { CREDITCOIN_CHAIN_ID, getMarketBySlug } from "@/lib/defi/markets";
import { useMarketData, useUserData } from "@/lib/defi/useDefiData";
import { getExplorerAddressUrl } from "@/lib/chains";
import { truncateAddress } from "@/lib/defi/format";
import { formatUnits } from "ethers";
import { Loader2 } from "lucide-react";

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
        <span className="w-9 h-9 rounded-full bg-violet-400/15 border border-violet-400/25 flex items-center justify-center text-[10px] font-mono text-violet-300">{market.collateral.symbol.slice(0, 4)}</span>
        <div>
          <h1 className="font-display font-semibold text-xl text-white">{market.name}</h1>
          <p className="text-xs text-muted">{market.sub} · collateral on Sepolia → borrow {market.loan.symbol} on Creditcoin</p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-right">
          {marketData && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted">Price</div>
                <div className="font-mono text-sm text-white">{marketData.collateralPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })} {market.loan.symbol}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted">LTV</div>
                <div className="font-mono text-sm text-white">{(Number(market.lltv) / 1e18 * 100).toFixed(0)}%</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
        <SupplyPanel market={market} marketData={marketData} userData={userData} onDone={refreshAll} />
        <div className="space-y-5">
          <PositionCard market={market} marketData={marketData} userData={userData} />

          {/* market stats */}
          <div className="border border-border rounded-xl bg-panel p-4 space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Market data</h3>
            {marketData ? (
              <>
                <StatRow label="Total supplied" value={`${formatUnits(marketData.state.totalSupplyAssets, market.loan.decimals)} ${market.loan.symbol}`} />
                <StatRow label="Total borrowed" value={`${formatUnits(marketData.state.totalBorrowAssets, market.loan.decimals)} ${market.loan.symbol}`} />
                <StatRow label="Utilization" value={`${(marketData.utilization * 100).toFixed(1)}%`} />
                <StatRow label="Market id" value={truncateAddress(marketData.marketId)} mono />
                <StatRow label="CoreVault" value={truncateAddress("0x51062701163469d30a0c4331BB2FBab215d24434")} mono href={getExplorerAddressUrl(CREDITCOIN_CHAIN_ID, "0x51062701163469d30a0c4331BB2FBab215d24434")} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted py-2"><Loader2 size={13} className="animate-spin" /> Loading on-chain state…</div>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted px-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              {market.loan.symbol} is a mock testnet token — use the Faucet in the Deposit tab. Collateral for borrowing must be locked on Sepolia via the Borrow flow.
            </span>
          </div>
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
