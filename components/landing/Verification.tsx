export default function Verification() {
  return (
    <section className="relative py-28 border-b border-border overflow-hidden">
      <div
        className="mesh-glow absolute top-0 right-0 w-[600px] h-[500px] pointer-events-none opacity-60"
      />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-14 items-center">
        <div className="lg:col-span-5">
          <span className="font-mono text-xs uppercase tracking-widest text-amber">
            Verification
          </span>
          <h2 className="mt-4 font-display font-semibold text-3xl sm:text-4xl leading-tight tracking-tight">
            Anyone can verify a stream. No one can read it.
          </h2>
          <p className="mt-4 text-muted leading-relaxed">
            A Merkle proof lets a counterparty or auditor confirm a specific
            field — sender, recipient, document — was part of an anchored
            transaction, without ever exposing the underlying data.
          </p>
          <a
            href="#"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: "#FDB750" }}
          >
            Try the verifier
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 3l4 4-4 4" stroke="#FDB750" strokeWidth="1.4" />
            </svg>
          </a>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm p-7 font-mono text-xs">
            <div className="flex items-center justify-between mb-6 text-muted">
              <span>merkle_proof.verify()</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                valid
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-muted w-24 shrink-0">leaf</span>
                <span className="flex-1 rounded bg-base border border-border px-3 py-2 text-white/80">
                  hash(doc) · 0x2c1a…8b4f
                </span>
              </div>
              <div className="flex items-center gap-3 pl-6">
                <span className="text-muted w-18 shrink-0">↳ sibling</span>
                <span className="flex-1 rounded bg-base border border-border px-3 py-2 text-white/60">
                  0x9e02…f731
                </span>
              </div>
              <div className="flex items-center gap-3 pl-12">
                <span className="text-muted w-12 shrink-0">↳ node</span>
                <span className="flex-1 rounded bg-base border border-border px-3 py-2 text-white/60">
                  0x5f88…22ac
                </span>
              </div>
              <div className="flex items-center gap-3 pl-12">
                <span className="text-muted w-12 shrink-0">↳ root</span>
                <span
                  className="flex-1 rounded px-3 py-2 font-medium"
                  style={{
                    background:
                      "linear-gradient(90deg,rgba(253,183,80,0.15),rgba(139,124,240,0.15))",
                    color: "#FDB750",
                  }}
                >
                  0x8e34…c14a — anchored on Creditcoin
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
