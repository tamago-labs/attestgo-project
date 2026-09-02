const tickerItems = ["Sumsub", "Attestcoin Protocol", "Creditcoin", "+ More"];

export default function Manifesto() {
  return (
    <section className="relative border-y border-border overflow-hidden">
      <div className="mesh-glow absolute top-0 left-1/2 -translate-x-1/2 w-[500px] sm:w-[700px] h-[300px] max-w-full pointer-events-none opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20 lg:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-mono text-sm sm:text-base uppercase tracking-[0.15em] text-white/70 max-w-2xl mx-auto leading-relaxed">
            The next trillion onchain won&rsquo;t come from memecoins. It looks
            like real-world value is next, and it won&rsquo;t move without
            identity and enforcement.{" "}
            <span className="glow-text">AttestGO makes it happen with:</span>
          </p>
        </div>

        <div
          className="marquee-wrap mt-8 sm:mt-10 relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          }}
        >
          <div className="marquee-track flex w-max items-center">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex items-center shrink-0"
                aria-hidden={copy === 1}
              >
                {tickerItems.map((item) => (
                  <span key={`${copy}-${item}`} className="flex items-center">
                    <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.2em] text-white/40 whitespace-nowrap hover:text-white/70 transition-colors">
                      {item}
                    </span>
                    <span
                      className="mx-6 sm:mx-8 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "linear-gradient(90deg,#FDB750,#8B7CF0)" }}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
