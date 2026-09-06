import Image from "next/image";

const rows = [
  {
    eyebrow: "Verified Identity",
    title: "One GO Pass, Every Chain",
    subtitle:
      "Mint a universal pass once that applications can use across apps and compliant payment flows.",
    bullets: [
      "Attested on Creditcoin via ASC, verifiable on any chain",
      "Reusable across RWA, DeFi, and payments",
      "Privacy preserving verification with minimal data exposure",
      "KYC by Sumsub from day one",
    ],
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    eyebrow: "Compliant Asset Issuance",
    title: "GO Assets: RWA + Self-Enforcing Rules",
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
    eyebrow: "Compliant Transfers",
    title: "Payments & DeFi for Pass Holders",
    subtitle:
      "Send or earn in DeFi with the same compliance checks applied to every transfer across networks and payment flows.",
    bullets: [
      "One interface for payments and DeFi with RWA",
      "Checked via GO Pass and GO Asset rules",
      "Lend and borrow on Creditcoin, collateral locked on any chain",
      "Travel rule data generated for every transfer",
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
                    <div className="relative w-full max-w-[480px] min-h-[300px] mx-auto rounded-2xl overflow-hidden bg-canvas border border-white/10 p-5 sm:p-6 flex flex-col shadow-xl">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 20%, #FDB750 35%, #8B7CF0 45%, #5CC8FF 55%, transparent 70%)",
                          backgroundSize: "200% 200%",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.06]"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                        }}
                      />

                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 font-mono">
                            POST
                          </span>
                          <span className="font-mono text-xs sm:text-sm text-white/80">
                            /gtoken/launch
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-400">
                          201 Created
                        </span>
                      </div>

                      <div className="relative z-10 mt-5 sm:mt-6 rounded-lg bg-panel border border-border p-4 font-mono text-[11px] sm:text-xs leading-relaxed text-white/80">
                        <div className="text-white/30 text-[9px] mb-2 uppercase tracking-[0.15em]">
                          Request body
                        </div>
                        <div className="space-y-1">
                          <div><span className="text-sky-400">"token_name"</span>: <span className="text-emerald-300">"USD T-Bill"</span>,</div>
                          <div><span className="text-sky-400">"chain"</span>: <span className="text-emerald-300">"ethereum"</span>,</div>
                          <div><span className="text-sky-400">"rule"</span>: {"{"} <span className="text-sky-400">"countries"</span>: [<span className="text-emerald-300">"US"</span>, <span className="text-emerald-300">"SG"</span>], <span className="text-sky-400">"min_tier"</span>: <span className="text-amber-300">10</span> {"}"}</div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-auto pt-5 flex items-center justify-between font-mono text-[10px] text-white/40">
                        <span>
                          gToken <span className="text-white/80">0x9e02…af31</span>
                        </span>
                        <span>142ms</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full max-w-[560px] min-h-[300px] mx-auto rounded-2xl overflow-hidden bg-canvas border border-white/10 p-5 sm:p-6 flex flex-col shadow-xl">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 20%, #FDB750 35%, #8B7CF0 45%, #5CC8FF 55%, transparent 70%)",
                          backgroundSize: "200% 200%",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.06]"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                        }}
                      />

                      <div className="relative z-10 flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
                        <div className="flex-1 rounded-xl bg-panel border border-border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/60">
                              Ethereum · Source
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-amber shrink-0" aria-hidden>
                              <rect x="4" y="11" width="16" height="10" rx="2" />
                              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                            </svg>
                          </div>
                          <div className="mt-4 font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase">
                            Collateral locked
                          </div>
                          <div className="mt-1 text-lg font-semibold text-white">
                            T-BILL <span className="font-mono text-white/90">$8,000</span>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-white/40">
                            Earning 3.1%
                          </div>
                        </div>

                        <div className="hidden sm:block w-24 lg:w-32 shrink-0 px-2">
                          <div className="relative h-px">
                            <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/15" />
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="connector-dot"
                                style={{
                                  background: d % 2 === 0 ? "#FDB750" : "#8B7CF0",
                                  boxShadow: `0 0 5px ${d % 2 === 0 ? "#FDB750" : "#8B7CF0"}`,
                                  animationDelay: `${d * 0.85}s`,
                                }}
                              />
                            ))}
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-canvas border border-white/10 text-white/50">
                              Attestcoin
                            </span>
                          </div>
                        </div>
                        <div className="sm:hidden flex justify-center">
                          <div className="h-8 border-l border-dashed border-white/15" />
                        </div>

                        <div className="flex-1 rounded-xl bg-panel border border-border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/60">
                              Creditcoin L1
                            </span>
                          </div>
                          <div className="mt-4 font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase">
                            Borrowed
                          </div>
                          <div className="mt-1 text-lg font-semibold text-white">
                            USDC <span className="font-mono text-white/90">$5,000</span>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-white/40">
                            Borrow at 3.1% · 62% LTV
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-white/40">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>GO PASS <span className="text-emerald-400">✓</span></span>
                        </div>
                        <span className="flex items-center gap-1.5">
                          Health <span className="text-white">1.61</span>
                          <span className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden inline-block">
                            <span className="block h-full bg-emerald-400" style={{ width: "72%" }} />
                          </span>
                        </span>
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
                {i === 1 && (
                  <a href="/docs" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-amber hover:text-white transition-colors">
                    View API for Issuers
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M3 7h8M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
