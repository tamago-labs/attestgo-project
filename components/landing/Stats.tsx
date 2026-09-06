const stats = [
  { value: "FATF R.16", label: "Travel Rule compatible" },
  { value: "Zero-threshold", label: "Applies to any transfer amount" },
  { value: "Auto-attach", label: "Originator from GO Pass identity" },
  { value: "Hash-only", label: "On-chain footprint" },
];

export default function Stats() {
  return (
    <section className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16 grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
        {stats.map((s) => (
          <div key={s.value} className="text-center sm:text-left">
            <div className="font-display font-semibold text-2xl sm:text-3xl glow-text">
              {s.value}
            </div>
            <div className="mt-2 text-xs sm:text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
