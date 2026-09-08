import Link from "next/link";

export default function DemoProductsPage() {
  return (
    <div className="bg-white text-[#0A0A0F]">
      <div className="max-w-[1120px] mx-auto px-6 py-6 flex items-center gap-3">
        <img src="/go-asset-logo.png" alt="GO" className="w-9 h-9 rounded-xl border border-slate-200 bg-white object-cover" />
        <span className="font-semibold tracking-tight">GO Asset Management</span>
        <Link href="/app/discover" className="ml-auto text-sm text-slate-500 hover:text-slate-900">Back to AttestGO →</Link>
      </div>
      {/* Yield Hero like USYC */}
      <div className="max-w-[1120px] mx-auto px-6 py-8">
        <h1 className="text-4xl font-semibold tracking-tight leading-tight max-w-3xl">Yield and liquidity built for always-on institutional funds</h1>
        <p className="text-slate-600 mt-3 leading-relaxed max-w-3xl">GO Asset Management brings Nikkei 225, US T-Bill yield, and GO SGD stablecoin onchain — near-instant settlement and 24/7 access via GO Pass.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/demo-products/nikkei" className="px-6 py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm">Explore Nikkei →</Link>
          <Link href="/demo-products/tbill" className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white">Explore T-Bill →</Link>
        </div>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-mono text-slate-500">aN225 Price</p>
            <p className="font-mono text-xl font-semibold mt-1">1.0247</p>
            <svg viewBox="0 0 200 40" className="w-full h-10 mt-2"><polyline fill="none" stroke="#0A0A0F" strokeWidth="2" points="0,30 30,28 60,32 90,22 120,24 150,16 180,18 200,10" /></svg>
            <div className="flex gap-4 mt-2 text-xs"><span className="font-medium">1W</span><span className="text-slate-400">1M</span><span className="text-slate-400">ALL</span></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-mono text-slate-500">Blended Est. Yield</p>
            <p className="font-mono text-xl font-semibold mt-1">5.0%</p>
            <p className="text-xs text-slate-500 mt-2">aN225 5.2% · aTBILL 4.8% — rising price</p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden flex"><div className="flex-1 bg-[#0A0A0F]"></div><div className="w-[46%] bg-emerald-500"></div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-mono text-slate-500">Total AUM</p>
            <p className="font-mono text-xl font-semibold mt-1">¥2.1T + $12M + S$50M</p>
            <p className="text-xs text-slate-500 mt-2">Sepolia · 3 funds live</p>
            <p className="text-xs font-mono text-slate-900 mt-3">GO Asset Management</p>
          </div>
        </div>
      </div>
      {/* Why */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1120px] mx-auto px-6 py-10">
          <h2 className="text-xl font-semibold">Why GO Asset Management?</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              ["Tokenized Nikkei, T-Bill & SGD", "Single manager for equity index, Treasury yield, and Singapore-dollar stablecoin — all rule-verified."],
              ["24/7 settlement", "Mint/redeem any time into USDC, ~1 block under capacity."],
              ["GO Pass-gated", "Tier ≥10 and region enforced on every transfer."],
              ["Daily NAV", "Onchain attestation, transparent pricing."],
              ["Composability", "Use as collateral or in DeFi while earning."],
              ["Low minimum", "$1k entry, first $1M fees waived."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-slate-200 bg-white p-5"><p className="font-medium text-sm">{t}</p><p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p></div>
            ))}
          </div>
        </div>
      </div>
      {/* Products grid richer */}
      <div className="max-w-[1120px] mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold">Funds</h2>
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {[
            { href: "/demo-products/nikkei", icon: "/nekkei-token-icon.png", name: "Go Nikkei 225 Index", symbol: "aN225", apy: "5.2%", tvl: "¥2.1T AUM", region: "US, JP, SG", desc: "TSE Nikkei 225 constituents tokenized — index exposure with onchain settlement." },
            { href: "/demo-products/tbill", icon: "/t-bill-token-icon.png", name: "Go T-Bill", symbol: "aTBILL", apy: "4.8%", tvl: "$12M", region: "US", desc: "Short-term US Treasury bills + reverse repo — 1:1 backed vault." },
            { href: "/demo-products/sgd-go", icon: "/sgd-go-token-icon.png", name: "GO SGD", symbol: "SGD-GO", apy: "Stablecoin", tvl: "S$50M", region: "US, SG, JP, HK, GB", desc: "Singapore-dollar compliant stablecoin for business & remittance — 1:1 pegged, no yield." },
          ].map((f) => (
            <Link key={f.symbol} href={f.href} className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-md transition">
              <div className="flex items-center gap-4">
                <img src={f.icon} alt={f.symbol} className="w-14 h-14 rounded-xl border border-slate-200 bg-white object-cover" />
                <div><h3 className="font-semibold">{f.name}</h3><p className="text-xs font-mono text-slate-500">{f.symbol} · {f.apy} APY</p></div>
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-white border border-slate-200">{f.region}</span>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{f.desc}</p>
              <div className="mt-4 flex justify-between text-xs font-mono text-slate-500"><span>TVL {f.tvl}</span><span>View fund →</span></div>
            </Link>
          ))}
        </div>
      </div>
      {/* How it works + Key facts teaser */}
      <div className="max-w-[1120px] mx-auto px-6 pb-12 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-medium">Onchain structure</h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">Each fund is a GToken ERC-20 with rule-verified transfers. Subscription in USDC, price accrues yield. Attested daily on Sepolia via GO Pass.</p>
          <ul className="text-sm text-slate-600 mt-3 list-disc list-inside space-y-1"><li>Issued by GO Asset Management (go_asset)</li><li>Tier ≥10, region-gated</li><li>T+0/T+1 settlement</li></ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-medium">Key facts</h3>
          <div className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-lg text-sm">
            <div className="flex justify-between px-4 py-2"><span className="text-slate-600">Standard</span><span className="font-mono">ERC-20</span></div>
            <div className="flex justify-between px-4 py-2"><span className="text-slate-600">Network</span><span className="font-mono">Sepolia 11155111</span></div>
            <div className="flex justify-between px-4 py-2"><span className="text-slate-600">Subscription</span><span>USDC · 0.04% (0% ≤$1M)</span></div>
          </div>
          <a href="/demo-products/nikkei#keyfacts" className="text-xs underline mt-3 inline-block">View full facts →</a>
        </div>
      </div>
    </div>
  );
}
