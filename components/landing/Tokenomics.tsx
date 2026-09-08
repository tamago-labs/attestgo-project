export default function Tokenomics() {
  const utilities = [
    "Supply liquidity and earn ecosystem incentives.",
    "Stake $ATGO for future access and benefits.",
    "Participate in governance as the protocol decentralizes.",
    "Support ecosystem growth through aligned incentives.",
  ];

  return (
    <section className="border-t border-border">
      <div className="border border-border grid md:grid-cols-[320px_1fr] border-l-0 overflow-hidden">
        {/* Left */}
        <div className="border-b md:border-b-0 md:border-r border-border p-8 flex flex-col justify-between bg-panel/50">
          <div>
            <div className="w-16 h-16 rounded-full token-mark mb-6" />
            <p className="text-amber text-xs font-mono tracking-wide mb-2">$ATGO</p>
            <h3 className="text-2xl font-semibold leading-snug mb-3 text-white">Incentivizing verified onchain finance</h3>
            <p className="text-muted text-sm leading-relaxed">
              The planned ecosystem token for AttestGO — rewarding participation across compliant assets, payments, and cross-chain DeFi.
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="p-8">
          <div className="flex items-start justify-between mb-4">
            <p className="text-amber text-xs uppercase tracking-wide">What $ATGO is for</p>
            <span className="inline-block px-3 py-1.5 rounded-full border border-border text-xs font-mono text-muted shrink-0 ml-4">
              Planned to launch on Creditcoin
            </span>
          </div>
          <ul className="space-y-3 mb-8">
            {utilities.map((u, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-emerald-400 mt-0.5">→</span>
                <span className="text-sm text-muted">{u}</span>
              </li>
            ))}
          </ul>

          <div className="dashed rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-muted text-xs uppercase tracking-wide mb-1">Tokenomics</p>
              <p className="text-sm text-muted">Supply, allocation and emissions — announced closer to launch.</p>
            </div>
            <span className="text-amber text-xs font-mono shrink-0 ml-4">TBD</span>
          </div>
        </div>
      </div>
    </section>
  );
}
