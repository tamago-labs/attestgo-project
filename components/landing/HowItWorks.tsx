export default function HowItWorks() {
  return (
    <section className="relative py-28 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-xl mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-amber">
            How it works
          </span>
          <h2 className="mt-4 font-display font-semibold text-3xl sm:text-4xl leading-tight tracking-tight">
            Three layers. Each with its own trust model.
          </h2>
          <p className="mt-4 text-muted leading-relaxed">
            Discovery, data exchange, and proof anchoring are independent by
            design — swap any layer without touching the others.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="relative rounded-xl border border-border bg-panel/60 p-7">
            <span className="font-mono text-xs text-amber">01</span>
            <h3 className="mt-4 font-display font-semibold text-lg">
              Discovery
            </h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              The sender&apos;s client looks up the recipient&apos;s endpoint
              and public key. This layer holds routing metadata only — no
              identity data, no documents, ever.
            </p>
          </div>
          <div className="relative rounded-xl border border-border bg-panel/60 p-7">
            <span className="font-mono text-xs text-violet">02</span>
            <h3 className="mt-4 font-display font-semibold text-lg">
              Encrypted exchange
            </h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              The Travel Rule payload is encrypted and pushed to the
              recipient&apos;s inbox. Store-and-forward delivery means both
              sides never need to be online at once.
            </p>
          </div>
          <div className="relative rounded-xl border border-border bg-panel/60 p-7">
            <span className="font-mono text-xs" style={{ color: "#FDB750" }}>
              03
            </span>
            <h3 className="mt-4 font-display font-semibold text-lg">
              Proof anchor
            </h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              A Merkle root of the exchange — hash only, never raw data — is
              committed on-chain. Anyone can verify the exchange happened
              without seeing who was involved.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
