const features = [
  {
    title: "Real-time streaming",
    desc: "Value moves continuously, not in discrete batches — settlement in under a second.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8h11M8 3l4 5-4 5" stroke="#FDB750" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    title: "Travel Rule native",
    desc: "IVMS101-formatted originator and beneficiary data, exchanged on every transfer by default.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="#8B7CF0" strokeWidth="1.4" />
        <path d="M5 8h6M5 5.5h6M5 10.5h3" stroke="#8B7CF0" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    title: "Hash-only anchoring",
    desc: "Only Merkle roots touch the chain. Raw identity data never leaves the encrypted exchange layer.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1l6 3v4c0 4-2.7 6.5-6 7-3.3-.5-6-3-6-7V4l6-3z" stroke="#FDB750" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    title: "Async by default",
    desc: "Store-and-forward delivery means the recipient doesn't need to be online when a stream opens.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="4" cy="4" r="2" stroke="#8B7CF0" strokeWidth="1.3" />
        <circle cx="12" cy="12" r="2" stroke="#8B7CF0" strokeWidth="1.3" />
        <path d="M5.5 5.5l5 5" stroke="#8B7CF0" strokeWidth="1.3" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    title: "Composable layers",
    desc: "Discovery, exchange, and anchoring are separate services — swap any one without breaking the rest.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="6" width="4" height="4" stroke="#FDB750" strokeWidth="1.3" />
        <rect x="6" y="1" width="4" height="4" stroke="#FDB750" strokeWidth="1.3" />
        <rect x="11" y="6" width="4" height="4" stroke="#FDB750" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    title: "Cross-chain proofs",
    desc: "Anchor commitments on Creditcoin or any chain that supports cheap, frequent writes.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8a6 6 0 1112 0 6 6 0 01-12 0z" stroke="#8B7CF0" strokeWidth="1.3" />
        <path d="M8 5v3l2 2" stroke="#8B7CF0" strokeWidth="1.3" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section className="relative py-28 border-b border-border bg-panel/20">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="max-w-xl mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-violet">
            Built for compliance-first payments
          </span>
          <h2 className="mt-4 font-display font-semibold text-3xl sm:text-4xl leading-tight tracking-tight">
            Everything a regulated stream needs, nothing it doesn&apos;t.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-base p-7 hover:bg-panel/60 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-5"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(253,183,80,0.15),rgba(139,124,240,0.15))",
                }}
              >
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-base mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
