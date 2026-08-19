const stats = [
  { value: "<400ms", label: "Proof attach time" },
  { value: "IVMS101", label: "Data standard" },
  { value: "Hash-only", label: "On-chain footprint" },
  { value: "3 layers", label: "Independently swappable" },
];

export default function Stats() {
  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-2 lg:grid-cols-4 gap-10">
        {stats.map((s) => (
          <div key={s.value}>
            <div className="font-display font-semibold text-3xl glow-text">
              {s.value}
            </div>
            <div className="mt-2 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
