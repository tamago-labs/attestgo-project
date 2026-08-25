"use client";

import { useEffect, useRef } from "react";
import ButtonGlow from "./ButtonGlow";

export default function Hero() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ns = "http://www.w3.org/2000/svg";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cols = 24,
      rows = 14,
      cell = 50;
    const w = cols * cell,
      h = rows * cell;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const g = document.createElementNS(ns, "g");
    for (let i = 0; i <= cols; i++) {
      const l = document.createElementNS(ns, "line");
      l.setAttribute("x1", String(i * cell));
      l.setAttribute("y1", "0");
      l.setAttribute("x2", String(i * cell));
      l.setAttribute("y2", String(h));
      l.setAttribute("stroke", "rgba(255,255,255,0.07)");
      l.setAttribute("stroke-width", "1");
      g.appendChild(l);
    }
    for (let j = 0; j <= rows; j++) {
      const l = document.createElementNS(ns, "line");
      l.setAttribute("x1", "0");
      l.setAttribute("y1", String(j * cell));
      l.setAttribute("x2", String(w));
      l.setAttribute("y2", String(j * cell));
      l.setAttribute("stroke", "rgba(255,255,255,0.07)");
      l.setAttribute("stroke-width", "1");
      g.appendChild(l);
    }
    svg.appendChild(g);

    if (reduceMotion) return;

    const colors = ["#FDB750", "#8B7CF0"];
    const dotCount = 18;

    for (let k = 0; k < dotCount; k++) {
      const horizontal = Math.random() > 0.5;
      const color = colors[k % colors.length];
      const dur = (4 + Math.random() * 4).toFixed(2);
      const delay = (-Math.random() * 8).toFixed(2);
      let x1: number, y1: number, x2: number, y2: number;
      if (horizontal) {
        const row = Math.floor(Math.random() * (rows + 1)) * cell;
        const startCol = Math.floor(Math.random() * (cols - 5));
        const len = 4 + Math.floor(Math.random() * 5);
        x1 = startCol * cell;
        x2 = Math.min(cols, startCol + len) * cell;
        y1 = y2 = row;
      } else {
        const col = Math.floor(Math.random() * (cols + 1)) * cell;
        const startRow = Math.floor(Math.random() * (rows - 3));
        const len = 3 + Math.floor(Math.random() * 4);
        y1 = startRow * cell;
        y2 = Math.min(rows, startRow + len) * cell;
        x1 = x2 = col;
      }

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "0");
      circle.setAttribute("fill", color);
      circle.style.filter = `drop-shadow(0 0 5px ${color})`;

      const motion = document.createElementNS(ns, "animateMotion");
      motion.setAttribute("path", `M${x1},${y1} L${x2},${y2}`);
      motion.setAttribute("dur", dur + "s");
      motion.setAttribute("begin", delay + "s");
      motion.setAttribute("repeatCount", "indefinite");

      const rAnim = document.createElementNS(ns, "animate");
      rAnim.setAttribute("attributeName", "r");
      rAnim.setAttribute("values", "0;3;3;0");
      rAnim.setAttribute("keyTimes", "0;0.15;0.85;1");
      rAnim.setAttribute("dur", dur + "s");
      rAnim.setAttribute("begin", delay + "s");
      rAnim.setAttribute("repeatCount", "indefinite");

      circle.appendChild(motion);
      circle.appendChild(rAnim);
      svg.appendChild(circle);
    }
  }, []);

  return (
    <section className="relative overflow-hidden isolate -mt-[65px] pt-[65px]">
      <div id="grid-wrap" className="absolute inset-0 pointer-events-none">
        <svg ref={svgRef} id="grid" className="w-full h-full" preserveAspectRatio="xMidYMid slice" />
      </div>
      <div className="mesh-glow absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[550px] max-w-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 sm:pt-24 pb-10 sm:pb-12 z-10">
        <div className="max-w-3xl">
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-amber">
            IDENTITY × RWA × COMPLIANCE
          </span>
          <h1 className="mt-4 font-display font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
            The Compliance Layer for <span className="glow-text">Onchain Finance</span>
          </h1>

          <p className="mt-6 text-sm sm:text-lg text-muted max-w-2xl leading-relaxed">
            AttestGO connects verified identity, compliant assets, and payment flows across networks, using <span className="glow-text font-medium">Attestcoin Protocol</span> to make every transaction provable and auditable, with AI turning every payment into a human-readable inbox.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <a
              href="/app"
              className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium min-h-[44px]"
              style={{ background: "linear-gradient(90deg,#FDB750,#8B7CF0)", color: "#0A0D13" }}
            >
              Mint GO Pass
            </a>
            <ButtonGlow href="https://github.com/tamago-labs/attestgo-project" className="hidden sm:inline-flex px-6 py-3 min-h-[44px] justify-center">View GitHub</ButtonGlow>
          </div>
        </div>
      </div>
    </section>
  );
}
