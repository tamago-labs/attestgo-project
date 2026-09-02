export default function TrustBar() {
  return (
    <section className="border-y border-border bg-panel/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <p className="text-sm sm:text-base text-white max-w-xl leading-relaxed text-center lg:text-left">
          Onchain finance stopped being a retail experiment. It&apos;s becoming market infrastructure.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/30">Make this happen</span>
          <div className="flex items-center gap-5 sm:gap-6 text-sm font-medium text-muted">
            <span className="hover:text-white transition-colors">Sumsub</span>
            <span className="w-px h-4 bg-border hidden sm:block" />
            <span className="hover:text-white transition-colors">Attestcoin Protocol</span>
            <span className="w-px h-4 bg-border hidden sm:block" />
            <span className="hover:text-white transition-colors">Creditcoin</span>
          </div>
        </div>
      </div>
    </section>
  );
}
