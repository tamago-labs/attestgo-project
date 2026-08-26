"use client";

import { useEffect, useState } from "react";

const items = [
  { id: "overview", label: "Overview" },
  { id: "how", label: "How it works" },
  { id: "quickstart", label: "Quickstart" },
  { id: "auth", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "networks", label: "Networks" },
  { id: "errors", label: "Errors" },
];

export default function DocsNav() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (ents) => {
        const top = ents.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.5, 1] }
    );
    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <nav className="space-y-1 text-sm">
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className={`flex items-center min-h-[36px] px-3 rounded-lg border transition-colors ${
            active === it.id ? "bg-panel border-white/10 text-white" : "border-transparent text-muted hover:text-white hover:bg-panel/60"
          }`}
        >
          {it.label}
        </a>
      ))}
    </nav>
  );
}
