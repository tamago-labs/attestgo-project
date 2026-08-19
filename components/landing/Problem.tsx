"use client";

import { useEffect, useRef, useState } from "react";

const problems = [
  {
    num: "01",
    title: "Money moves. Context doesn't.",
    body: "Stablecoins can move instantly across borders and chains. But the information that makes a payment legitimate — who sent it, who received it, why it was sent, and what real-world activity it represents — often lives somewhere else.",
  },
  {
    num: "02",
    title: "Compliance isn't built into the stream.",
    body: "Cross-border payments need Travel Rule information. Documents like invoices, contracts, and payslips provide evidence of the transaction. Today, these are handled by separate compliance and back-office systems, not traveling with the payment itself.",
  },
  {
    num: "03",
    title: "Without proof, payment history has limited value.",
    body: "A stream of payments tells you that money moved. It doesn't necessarily prove why it moved. That makes verified payment history harder to use for institutional accounting, underwriting, credit, and financing.",
  },
];

export default function Problem() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrolled = -rect.top;
      const scrollable = sectionHeight - viewportHeight;

      if (scrolled < 0) {
        setActive(0);
      } else if (scrolled >= scrollable) {
        setActive(problems.length - 1);
      } else {
        const progress = scrolled / scrollable;
        const index = Math.min(
          Math.floor(progress * problems.length),
          problems.length - 1
        );
        setActive(index);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={sectionRef} className="relative" style={{ height: `${problems.length * 100}vh` }}>
      <div className="sticky top-0 h-screen flex items-center overflow-hidden border-b border-border">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <svg className="w-full h-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 25 }, (_, i) => (
              <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={700} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            ))}
            {Array.from({ length: 15 }, (_, j) => (
              <line key={`h${j}`} x1={0} y1={j * 50} x2={1200} y2={j * 50} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            ))}
          </svg>
        </div>
        <div className="mesh-glow absolute top-1/2 -translate-y-1/2 right-0 w-[500px] h-[400px] pointer-events-none opacity-40" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 w-full">
          <div className="mb-16">
            <span className="font-mono text-xs uppercase tracking-widest text-amber">
              The Problem
            </span>
          </div>

          <div className="relative h-[200px]">
            {problems.map((p, i) => (
              <div
                key={p.num}
                className={`absolute inset-0 transition-all duration-700 ${
                  i === active
                    ? "opacity-100 translate-y-0"
                    : i < active
                      ? "opacity-0 -translate-y-8"
                      : "opacity-0 translate-y-8"
                }`}
              >
                <h3 className="font-display font-medium text-2xl sm:text-3xl leading-tight tracking-tight max-w-2xl glow-text">
                  {p.num} — {p.title}
                </h3>
                <p className="mt-5 text-muted leading-relaxed max-w-2xl">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
