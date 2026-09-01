export default function Inbox() {
  return (
    <section className="relative py-12 sm:py-20 lg:py-28 border-b border-border overflow-hidden">
      <div
        className="mesh-glow absolute top-0 right-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[500px] max-w-full pointer-events-none opacity-60"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid lg:grid-cols-12 gap-10 sm:gap-14 items-center">
        <div className="lg:col-span-5">
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-amber">
            AI Composed Inbox
          </span>
          <h2 className="mt-4 font-display font-semibold text-2xl sm:text-3xl lg:text-4xl leading-tight tracking-tight">
            AI Decodes Every Action Into Your Inbox
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
            Salary, invoice, receipt — every send creates a structured document, hashed for proof, then rendered by AI into a human email in your inbox. Recipients see a familiar inbox, not raw hashes or explorer links.
          </p>
          <a
            href="#"
            className="mt-6 sm:mt-8 inline-flex items-center gap-2 text-sm font-medium min-h-[44px]"
            style={{ color: "#FDB750" }}
          >
            Open inbox
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 3l4 4-4 4" stroke="#FDB750" strokeWidth="1.4" />
            </svg>
          </a>
        </div>

        <div className="lg:col-span-7 min-w-0">
          <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm overflow-hidden">
            <div className="h-8 bg-canvas border-b border-border flex items-center gap-2 px-3">
              <span className="w-1 h-4 bg-amber rounded"></span>
              <span className="font-mono text-xs font-medium text-white">Inbox — Composed By AttestGO AI</span>
            </div>
            <div className="grid lg:grid-cols-[1fr_1.3fr] min-h-[280px]">
            {/* list */}
            <div className="divide-y divide-border border-r border-border bg-panel/50 min-w-0 w-full overflow-hidden">
              {[
                { time: "09:32", title: "Salary — March — $4,200", preview: "Your salary of $4,200 has been sent and proof anchored — download when needed.", active: true },
                { time: "09:34", title: "KYC Approved — Ready to Receive", preview: "Your identity is verified. You can now receive RWA transfers.", active: false },
                { time: "09:35", title: "Transfer Rejected — Country Not Allowed", preview: "Transfer of $12,500 blocked by country rule · 0x9e02…", active: false },
              ].map((m) => (
                <div key={m.title} className={`px-3 py-2.5 min-w-0 w-full overflow-hidden ${m.active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{m.title}</span>
                    <span className="ml-auto text-[11px] text-white/30 shrink-0">{m.time}</span>
                  </div>
                  <div className="text-xs text-muted block w-full overflow-hidden whitespace-nowrap text-ellipsis">{m.preview}</div>
                </div>
              ))}
            </div>
            {/* preview */}
            <div className="p-4 bg-canvas flex flex-col">
              <div className="font-mono text-[11px] text-white/30">To: Alex · $4,200 · 0x2c1a…8b4f</div>
              <div className="mt-2 text-sm font-semibold text-white">Salary — March — $4,200</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">
                Hi Alex, your salary of $4,200 (4,200.84 USDT @ $0.9998) for March has been sent. View details and proof attached.
                <br />
                <span className="mt-2 block">Best regards, Your AI</span>
              </div>
              <div className="mt-auto pt-3 flex flex-wrap items-center gap-3 text-xs font-medium">
                <a href="#" className="inline-flex items-center gap-1 text-amber hover:text-white transition-colors">
                  Payslip
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.3" /></svg>
                </a>
                <span className="text-white/20">·</span>
                <a href="#" className="inline-flex items-center gap-1 text-amber hover:text-white transition-colors">
                  View on Explorer
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.3" /></svg>
                </a>
              </div>
            </div>
           </div>
         </div>
       </div>
       </div>
     </section>
  );
}
