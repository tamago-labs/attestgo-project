"use client";

import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
};

export default function ButtonGlow({ children, href, onClick, className }: Props) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;

    const ns = "http://www.w3.org/2000/svg";
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const r = 6;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = "";

    const d = `M${r},0 L${w - r},0 Q${w},0 ${w},${r} L${w},${h - r} Q${w},${h} ${w - r},${h} L${r},${h} Q0,${h} 0,${h - r} L0,${r} Q0,0 ${r},0 Z`;

    const colors = ["#FDB750", "#8B7CF0"];

    for (let k = 0; k < 3; k++) {
      const color = colors[k % colors.length];
      const dur = (3 + k * 0.8).toFixed(2);
      const delay = (-k * 1.2).toFixed(2);

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "0");
      circle.setAttribute("fill", color);
      circle.style.filter = `drop-shadow(0 0 4px ${color})`;

      const motion = document.createElementNS(ns, "animateMotion");
      motion.setAttribute("dur", dur + "s");
      motion.setAttribute("begin", delay + "s");
      motion.setAttribute("repeatCount", "indefinite");
      motion.setAttribute("path", d);

      const rAnim = document.createElementNS(ns, "animate");
      rAnim.setAttribute("attributeName", "r");
      rAnim.setAttribute("values", "0;2.5;2.5;0");
      rAnim.setAttribute("keyTimes", "0;0.1;0.9;1");
      rAnim.setAttribute("dur", dur + "s");
      rAnim.setAttribute("begin", delay + "s");
      rAnim.setAttribute("repeatCount", "indefinite");

      circle.appendChild(motion);
      circle.appendChild(rAnim);
      svg.appendChild(circle);
    }
  }, []);

  const inner = (
    <>
      <span
        className={`relative z-10 inline-flex items-center rounded-lg border border-border text-sm font-medium text-white group-hover:bg-panel transition-colors ${className ?? ""}`}
      >
        {children}
      </span>
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-visible z-20" />
    </>
  );

  if (href) {
    return (
      <a ref={containerRef as React.Ref<HTMLAnchorElement>} href={href} className="relative inline-flex items-center group">
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={containerRef as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      type="button"
      className="relative inline-flex items-center group"
    >
      {inner}
    </button>
  );
}
