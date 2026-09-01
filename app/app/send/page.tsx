"use client";

export default function SendPage() {
  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="rounded-xl border border-border bg-panel overflow-hidden grid md:grid-cols-[260px_1fr] flex-1 min-h-0">
        {/* sidebar */}
        <div className="border-b md:border-b-0 md:border-r border-border p-4 bg-panel">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 bg-amber rounded" />
            <span className="font-mono text-xs font-medium text-white">Send</span>
          </div>
          <p className="text-muted text-sm mb-1">Total balance</p>
          <p className="text-2xl font-semibold tracking-tight text-white mb-4">$24,700.00</p>

          <p className="text-white/30 text-xs uppercase tracking-wide mb-2">Allocation</p>
          <div className="h-2 rounded-full overflow-hidden flex mb-3 bg-canvas border border-border">
            <div className="bg-amber-400" style={{ width: "50.6%" }} />
            <div className="bg-violet-400" style={{ width: "17%" }} />
            <div className="bg-emerald-400" style={{ width: "32.4%" }} />
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                USDC
              </span>
              <span className="font-mono text-white/40 text-xs">50.6%</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted">
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                ATC
              </span>
              <span className="font-mono text-white/40 text-xs">17.0%</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                T-Bill
              </span>
              <span className="font-mono text-white/40 text-xs">32.4%</span>
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-white/30 text-xs mb-1">Identity</p>
            <p className="text-sm text-white">Verified · Tier 10</p>
          </div>
        </div>

        {/* list — scroll only this column */}
        <div className="divide-y divide-border bg-canvas/30 overflow-y-auto min-h-0">
          {[
            { name: "USD Coin", sub: "12,500.00 USDC", usd: "$12,500.00", act: "Send" },
            { name: "Attestcoin", sub: "4,200.00 ATC", usd: "$4,200.00", act: "Lend" },
            { name: "USD T-Bill", sub: "8,000.00 GO-TBILL · US, SG", usd: "$8,000.00", act: "Borrow" },
            { name: "Wrapped USDC", sub: "5,300.00 wUSDC", usd: "$5,300.00", act: "Send" },
            { name: "Euro T-Bill", sub: "3,100.00 GO-ETBILL · DE, FR", usd: "$3,350.00", act: "Borrow" },
            { name: "SGD T-Bill", sub: "2,000.00 GO-SGTB · SG", usd: "$1,480.00", act: "Borrow" },
            { name: "Gold Vault", sub: "1.20 GO-GOLD", usd: "$2,760.00", act: "Lend" },
            { name: "Tether", sub: "4,800.00 USDT", usd: "$4,798.00", act: "Send" },
            { name: "AttestGO LP", sub: "850.00 GO-LP", usd: "$920.00", act: "Lend" },
            { name: "US Treasury 3M", sub: "6,000.00 GO-T3M · US", usd: "$6,000.00", act: "Borrow" },
          ].map((r) => (
            <div key={r.name} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-sm">{r.name}</p>
                <p className="text-white/30 text-xs font-mono">{r.sub}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-sm text-white">{r.usd}</p>
                <a href="#" className="text-amber text-sm hover:text-white transition-colors">
                  {r.act}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
