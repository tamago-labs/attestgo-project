export default function Cta() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="mesh-glow absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-display font-semibold text-4xl sm:text-5xl leading-tight tracking-tight">
          Start streaming with
          <br />
          <span className="glow-text">proof built in.</span>
        </h2>
        <p className="mt-5 text-muted max-w-lg mx-auto leading-relaxed">
          Set up a discovery endpoint and send your first compliant stream in
          an afternoon.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#"
            className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-medium"
            style={{
              background: "linear-gradient(90deg,#FDB750,#8B7CF0)",
              color: "#0A0D13",
            }}
          >
            Start streaming
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-white hover:bg-panel transition-colors"
          >
            Talk to the team
          </a>
        </div>
      </div>
    </section>
  );
}
