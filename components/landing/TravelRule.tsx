export default function TravelRule() {
  return (
    <section className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-amber">TRAVEL RULE, BUILT INTO EVERY TRANSFER</span>
            <h2 className="mt-3 font-display font-semibold text-2xl sm:text-3xl text-white">Ready for a Zero-Threshold Future</h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              Prepare Travel Rule data for every transfer by default. Reuse verified originator identity from GO Pass, resolve beneficiary information when needed, and generate supporting transaction records automatically.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <span className="font-semibold text-white">Verified identity, reused</span> — Originator data from GO Pass</li>
            <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <span className="font-semibold text-white">Only fill what's missing</span> — Recipient information resolved when needed</li>
            <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <span className="font-semibold text-white">Evidence on demand</span> — Invoices, agreements, or source-of-funds records</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-6 self-center">
            {[
              { value: "Every transfer", label: "Travel Rule ready" },
              { value: "AI generated", label: "Transaction documents" },
              { value: "Hash-only", label: "On-chain footprint" },
              { value: "FATF R.16", label: "Travel Rule aligned" },
            ].map((s) => (
              <div key={s.value}>
                <div className="font-display font-semibold text-2xl sm:text-3xl glow-text">{s.value}</div>
                <div className="mt-2 text-xs sm:text-sm text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
