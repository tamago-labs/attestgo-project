const rows = [
  {
    eyebrow: "Verified Identity",
    title: "Verify Once. Credentials For Every Chain.",
    subtitle:
      "Mint a universal pass on Creditcoin that applications can use across networks, financial products, and compliant payment flows.",
    bullets: [
      "Anchored via Attestcoin Protocol — one issuance, universal verification",
      "Use the same pass on any EVM network",
      "Privacy preserving verification with minimal data exposure",
      "KYC via Sumsub and additional providers coming soon",
    ],
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    eyebrow: "Compliant Asset Issuance",
    title: "Launch RWA That Enforce Themselves",
    subtitle:
      "AttestGO gives issuers the tools to create, govern, and distribute digital representations of real-world value with identity-aware controls.",
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
      "One API for send and stream — switch without new integration",
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
                <div
                  className={`relative aspect-[16/10] sm:aspect-[4/3] rounded-xl border border-border bg-panel overflow-hidden bg-gradient-to-br ${row.gradient}`}
                >
                  {/* placeholder illustration — replace with <Image src={...} fill /> when assets ready */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[85%] sm:w-[70%] h-[60%] rounded-lg border border-white/10 bg-canvas/60 backdrop-blur-sm flex flex-col gap-3 p-3 sm:p-4">
                      <div className="h-2.5 w-1/3 rounded bg-white/20" />
                      <div className="h-2 w-full rounded bg-white/10" />
                      <div className="h-2 w-5/6 rounded bg-white/10" />
                      <div className="mt-auto flex gap-2">
                        <div className="h-6 flex-1 rounded bg-white/10" />
                        <div className="h-6 w-16 rounded" style={{ background: "linear-gradient(90deg,#FDB750,#8B7CF0)" }} />
                      </div>
                      <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#FDB750,transparent 70%)" }} />
                      <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#8B7CF0,transparent 70%)" }} />
                    </div>
                  </div>
                  <span className="absolute bottom-3 left-3 font-mono text-[10px] tracking-widest text-white/40 uppercase">
                    Fig {String(i + 1).padStart(2, "0")} — {row.eyebrow}
                  </span>
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
