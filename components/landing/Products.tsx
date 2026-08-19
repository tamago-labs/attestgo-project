const products = [
  {
    number: "01",
    label: "Streams",
    title: "Stream Payments Across Any Chain",
    description:
      "Fund your balance from any chain, stream anywhere. Unified balance handles cross-chain settlement behind the scenes.",
    features: [
      "Deposit & hold assets across chains",
      "Create payment streams to any chain",
      "One unified balance across networks",
      "Stream payments with programmable terms",
    ],
  },
  {
    number: "02",
    label: "Lending",
    title: "Earn Yield on Payment Streams",
    description:
      "tamaGO turns payment streams into dynamic collateral, giving recipients access to liquidity while ratios adjust as the stream matures.",
    features: [
      "Future payments become borrowing power",
      "Isolated pools limit risk between markets",
      "Anyone can supply liquidity",
      "LPs earn yield from lending activity",
    ],
  },
  {
    number: "03",
    label: "Compliance",
    title: "Compliance That Travels With Payments",
    description:
      "Attach Travel Rule and compliance data directly to payment streams, so required information moves with the transaction from origin to settlement.",
    features: [
      "Embed Travel Rule data into payment flows",
      "IVMS101-ready transaction information",
      "Compliance data travels with the stream",
      "Designed for corporate & regulated flows",
    ],
  },
];

export default function Products() {
  return (
    <section className="relative py-28 border-b border-border overflow-hidden">
      <div className="mesh-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none opacity-40" />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-xl mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-amber">
            Products
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.title}
              className="relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-7 shadow-[0_0_30px_rgba(253,183,80,0.1)] transition-all"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-3xl font-bold"
                  style={{
                    background: "linear-gradient(135deg, #FDB750, #8B7CF0)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {product.number}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-px"
                    style={{
                      background: "linear-gradient(90deg, #FDB750, #8B7CF0)",
                    }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{
                      background: "linear-gradient(135deg, #FDB750, #8B7CF0)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {product.label}
                  </span>
                </div>
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg">
                {product.title}
              </h3>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                {product.description}
              </p>
              <ul className="mt-5 space-y-2.5">
                {product.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-muted"
                  >
                    <span className="text-amber mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
