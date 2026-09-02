"use client";

export default function DeFiPage() {
  return (
    <div className="w-full">
      <div className="grid md:grid-cols-2 gap-6">
        {/* earn */}
        <div className="space-y-3">
          <div className="border border-border rounded-xl bg-panel p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-amber rounded" />
                <h3 className="text-lg font-semibold text-white">Earn</h3>
              </div>
              <span className="text-emerald-300 text-xs font-mono">on Creditcoin</span>
            </div>
            <p className="text-muted text-sm">Supply a verified asset and earn yield — GO Pass checks the counterparties, not you.</p>
          </div>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            {[
              { sym: "USDT", apy: "6.4% APY" },
              { sym: "USDC", apy: "5.9% APY" },
              { sym: "ATC", apy: "8.1% APY" },
            ].map((r) => (
              <div key={r.sym} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03]">
                <span className="flex items-center gap-3 text-sm text-white">
                  <span className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/60">{r.sym.slice(0, 2)}</span>
                  {r.sym}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{r.apy}</span>
                  <span className="text-white/25">›</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* borrow - RWA collateral */}
        <div className="space-y-3">
          <div className="border border-border rounded-xl bg-panel p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 rounded" style={{ background: "#8B7CF0" }} />
                <h3 className="text-lg font-semibold text-white">Borrow</h3>
              </div>
              <span className="text-violet-300 text-xs font-mono">collateral stays on source chain</span>
            </div>
            <p className="text-muted text-sm">Lock RWA collateral where your assets already live, draw liquidity from Creditcoin.</p>
          </div>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-panel">
            {[
              { sym: "GO-NIKKEI", sub: "Nikkei 225 RWA · JP", ltv: "LTV 62% · 8.9% APR" },
              { sym: "GO-TBILL", sub: "USD T-Bill · US, SG", ltv: "LTV 62% · 8.2% APR" },
              { sym: "GO-JREIT", sub: "J-REIT RWA · JP", ltv: "LTV 58% · 10.5% APR" },
            ].map((r) => (
              <div key={r.sym} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03]">
                <span className="flex items-center gap-3 text-sm text-white">
                  <span className="w-6 h-6 rounded-full bg-amber/15 border border-amber/20 flex items-center justify-center text-[10px] font-mono text-amber">{r.sym.slice(3, 5)}</span>
                  <span>
                    <span className="block text-sm font-medium text-white">{r.sym}</span>
                    <span className="block text-xs text-muted">{r.sub}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-white text-right">{r.ltv}</span>
                  <span className="text-white/25">›</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
