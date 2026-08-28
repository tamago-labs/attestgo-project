import Image from "next/image";

const rows = [
  {
    eyebrow: "Verified Identity",
    title: "Verify Once, Used on Every Chain",
    subtitle:
      "Mint a universal pass once that applications can use across networks, financial products, and compliant payment flows.",
    bullets: [
      "Anchored via Attestcoin Protocol, held in your wallet",
      "Use the same pass on any EVM network",
      "Privacy preserving verification with minimal data exposure",
      "Supports major KYC providers from day one — Sumsub integrated",
    ],
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    eyebrow: "Compliant Asset Issuance",
    title: "Launch RWA That Enforce Themselves",
    subtitle:
      "AttestGO gives issuers the API to create, govern, and distribute digital representations of real-world value with identity-aware controls.",
    bullets: [
      "Define eligibility once, enforced on every move",
      "Whitelist or blacklist countries without redeploying",
      "Wrap any existing token 1:1 with compliance added",
      "Pause or update rules without touching holders",
    ],
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
  },
  {
    eyebrow: "Compliant Transfer",
    title: "Send Once Or Stream Over Time",
    subtitle:
      "Pick instant or continuous settlement with the same compliance checks applied to every transfer across networks and payment flows.",
    bullets: [
      "One interface for send and stream — switch without new integration",
      "Verified before value moves, not after",
      "Continuous streams settle as you earn with instant cancel",
      "Travel rule data generated for every transfer and downloadable anytime",
    ],
    gradient: "from-emerald-500/15 via-teal-500/10 to-transparent",
  },
];

export default function Products() {
  return (
    <section className="relative border-b border-border overflow-hidden">
      {/* subtle glows matching Verification / Cta */}
      <div className="mesh-glow absolute top-20 left-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[500px] max-w-full pointer-events-none opacity-40" />
      <div className="mesh-glow absolute bottom-0 right-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[500px] max-w-full pointer-events-none opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-28">
        <div className="space-y-12 sm:space-y-16 lg:space-y-24">
          {rows.map((row, i) => (
            <div
              key={row.title}
              className={`flex flex-col gap-6 sm:gap-8 lg:gap-14 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"}`}
            >
              {/* picture side */}
              <div className="w-full lg:w-1/2">
                <div className={`relative aspect-[16/10] sm:aspect-[4/3] flex items-center justify-center overflow-visible ${i === 0 || i === 1 || i === 2 ? "bg-transparent" : `rounded-xl border border-border bg-panel overflow-hidden bg-gradient-to-br ${row.gradient}`}`}>
                  {i === 0 ? (
                    <div className="relative w-full max-w-[380px] aspect-[1.586/1] min-h-[200px] mx-auto rounded-2xl overflow-hidden bg-canvas border border-white/10 p-5 sm:p-6 flex flex-col shadow-xl">

  {/* Holographic sheen layer */}
  <div
    className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
    style={{
      background:
        "linear-gradient(115deg, transparent 20%, #FDB750 35%, #8B7CF0 45%, #5CC8FF 55%, transparent 70%)",
      backgroundSize: "200% 200%",
    }}
  />

  {/* Grain / noise texture */}
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.06]"
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    }}
  />

  {/* Top row: brand + tier, status */}
  <div className="relative z-10 flex items-center justify-between">
    <div className="flex items-center gap-1.5">
      <span className="font-display font-semibold text-sm tracking-tight text-white">
        attest
        <span
          className="inline-flex items-center ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest"
          style={{ background: "linear-gradient(135deg,#FDB750,#8B7CF0)", color: "#0A0D13" }}
        >
          GO
        </span>
      </span>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-[9px] font-semibold tracking-wider text-white/60 uppercase">
        Silver
      </span>
    </div>
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-amber/20 bg-amber/15 text-[10px] font-medium text-amber">
      Active
    </span>
  </div>

  {/* Wallet address block */}
  <div className="relative z-10 mt-6 sm:mt-7">
    <div className="font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase">
      Wallet address
    </div>
    <div className="mt-1 font-mono text-sm sm:text-base tracking-[0.12em] text-white/90">
      0x2c1A •••• 8b4f
    </div>
    <div className="mt-1.5 font-mono text-[10px] leading-tight text-white/40">
      Works on any chain with Attestcoin Protocol
    </div>
  </div>

  {/* Bottom row: identity, QR */}
  <div className="relative z-10 mt-auto flex items-end justify-between">
    <div>
      <div className="font-mono text-[10px] tracking-[0.15em] text-white/50">ALEX RIVERA</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-white/60">
        <span>US-DE</span>
        <span className="text-white/25">•</span>
        <span>Verified 09/29</span>
      </div>
    </div>
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-white p-1 shrink-0 overflow-hidden">
      <Image src="/pass-qr.png" alt="Pass QR" width={56} height={56} className="w-full h-full object-contain" />
    </div>
  </div>
</div>
                  ) : i === 1 ? (
                    <div className="w-full max-w-[560px] min-h-[320px] mx-auto rounded-xl border border-border bg-canvas overflow-hidden flex shadow-lg">

  {/* Sidebar */}
  <div className="w-[140px] bg-panel border-r border-border p-3 hidden sm:flex flex-col gap-3 shrink-0">
    <div className="font-mono text-[10px] tracking-widest text-white/30 uppercase px-2">API Docs</div>
    <div className="space-y-0.5 text-xs">
      <div className="px-2 py-1.5 rounded text-muted">Overview</div>
      <div className="px-2 py-1.5 rounded bg-white/10 text-white font-medium">
        Launch gToken
      </div>
      <div className="px-2 py-1.5 rounded text-muted">Rules</div>
      <div className="px-2 py-1.5 rounded text-muted">Pause</div>
      <div className="px-2 py-1.5 rounded text-muted">Webhooks</div>
    </div>
  </div>

  {/* Main panel */}
  <div className="flex-1 p-4 sm:p-5 font-mono text-[12px] leading-relaxed overflow-hidden flex flex-col">

    {/* Endpoint header */}
    <div className="flex items-center gap-2">
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">
        POST
      </span>
      <span className="text-white/80">/gtoken/launch</span>
    </div>

    {/* Request body */}
    <div className="mt-3 rounded-lg bg-panel border border-border p-3 text-[11px] text-white/80">
      <div className="text-white/30 text-[10px] mb-1.5 uppercase tracking-wide">Request body</div>
      <div className="space-y-0.5">
        <div><span className="text-sky-400">"token_name"</span>: <span className="text-emerald-300">"USD T-Bill"</span>,</div>
        <div><span className="text-sky-400">"chain"</span>: <span className="text-emerald-300">"ethereum"</span>,</div>
        <div><span className="text-sky-400">"rule"</span>: {"{"} <span className="text-sky-400">"allowed_group"</span>: <span className="text-emerald-300">""</span>, <span className="text-sky-400">"countries"</span>: [<span className="text-emerald-300">"US"</span>, <span className="text-emerald-300">"SG"</span>], <span className="text-sky-400">"min_tier"</span>: <span className="text-amber-300">10</span> {"}"}</div>
      </div>
    </div>

    {/* Try + response */}
    <div className="mt-3 flex items-center gap-2">
      <button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-white/80 text-[11px] font-medium transition-colors">
        Run request
      </button>
      <span className="text-[10px] text-white/30">or ⌘⏎</span>
    </div>

    <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
          201
        </span>
        <span className="text-emerald-300">Created</span>
      </div>
      <div className="mt-1 text-white/60 break-all">
        gToken <span className="text-white/90">0x9e02…af31</span>
      </div>
    </div>

    <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-white/30">
      <span>View on Explorer</span>
      <span>142ms</span>
    </div>
  </div>
</div>
                  ) : (
                    <div className="w-full max-w-[560px] min-h-[340px] mx-auto rounded-xl border border-border bg-canvas overflow-hidden flex shadow-lg">

  {/* Sidebar */}
  <div className="w-[104px] bg-panel border-r border-border p-3 hidden sm:flex flex-col gap-1 shrink-0">
    <div className="space-y-0.5 text-xs">
      <div className="px-2 py-1.5 rounded text-muted flex items-center gap-2">
        <i className="ti ti-inbox text-[14px]" aria-hidden="true" /> Inbox
      </div>
      <div className="px-2 py-1.5 rounded text-muted flex items-center gap-2">
        <i className="ti ti-id text-[14px]" aria-hidden="true" /> Identity
      </div>
      <div className="px-2 py-1.5 rounded bg-white/10 text-white font-medium flex items-center gap-2">
        <i className="ti ti-send text-[14px]" aria-hidden="true" /> Send
      </div>
      <div className="px-2 py-1.5 rounded text-muted flex items-center gap-2">
        <i className="ti ti-history text-[14px]" aria-hidden="true" /> History
      </div>
      <div className="px-2 py-1.5 rounded text-muted flex items-center gap-2">
        <i className="ti ti-compass text-[14px]" aria-hidden="true" /> Discover
      </div>
    </div>
  </div>

  {/* Main panel */}
  <div className="flex-1 p-4 sm:p-5 flex flex-col">

    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <div className="text-base font-semibold text-white">Send</div>
        <div className="text-xs text-muted mt-0.5">Choose asset to send or stream</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-white/30 uppercase tracking-wide">Total balance</div>
        <div className="text-sm font-semibold text-white">$24,700</div>
      </div>
    </div>

    {/* Asset list */}
    <div className="mt-4 space-y-2 flex-1">
      {[
        { sym: "USDC", name: "USD Coin", bal: "$12,500", color: "#2775CA" },
        { sym: "USDT", name: "Tether", bal: "$4,200", color: "#26A17B" },
        { sym: "USD T-Bill", name: "T-Bill vault", bal: "$8,000", color: "#8B7CF0" },
      ].map((r) => (
        <div
          key={r.sym}
          className="flex items-center justify-between rounded-lg border border-border bg-panel px-3.5 py-2.5 hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: r.color }}
            >
              {r.sym.slice(0, 2)}
            </div>
            <div>
              <div className="text-sm font-medium text-white">{r.sym}</div>
              <div className="text-[11px] text-muted">{r.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/80 font-medium">{r.bal}</div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <a href="#" className="inline-flex items-center gap-1 text-amber hover:text-white transition-colors">
                Send
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.3" /></svg>
              </a>
              <a href="#" className="inline-flex items-center gap-1 text-amber hover:text-white transition-colors">
                Stream
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.3" /></svg>
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
                  )}
                </div>
              </div>

              {/* content side */}
              <div className="w-full lg:w-1/2">
                <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-amber">
                  {row.eyebrow}
                </span>
                <h3 className="mt-3 font-display font-semibold text-xl sm:text-2xl lg:text-3xl leading-tight tracking-tight">
                  {row.title}
                </h3>
                <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">{row.subtitle}</p>
                <ul className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
                  {row.bullets.map((b, j) => (
                    <li key={b} className="flex gap-3 text-sm leading-relaxed">
                      <span className="relative mt-1.5 w-1.5 h-1.5 shrink-0">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ background: "linear-gradient(90deg,#FDB750,#8B7CF0)" }}
                        />
                        <span
                          className="absolute -inset-1 rounded-full border animate-ping"
                          style={{ borderColor: "rgba(253,183,80,0.4)", animationDuration: "1.8s", animationDelay: `${j * 180}ms` }}
                        />
                      </span>
                      <span className="text-white/80">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
