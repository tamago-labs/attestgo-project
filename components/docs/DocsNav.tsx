"use client";

import { useEffect, useState } from "react";

const items = [
  { id: "overview", label: "Overview" },
  { id: "how", label: "How it works" },
  { id: "quickstart", label: "Quickstart" },
  { id: "auth", label: "Authentication" },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "endpoints", label: "Token Issuance" },
      { id: "issuers", label: "Issuer Profile Management" },
      { id: "listings", label: "RWA Token Listings" },
      { id: "feed", label: "Issuer Announcements" },
    ],
  },
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
    const allIds = items.flatMap((it: any) => (it.children ? it.children.map((c: any) => c.id) : [it.id]));
    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <nav className="space-y-1 text-sm">
      {items.map((it: any) => (
        <div key={it.id}>
          <a
            href={`#${it.id}`}
            className={`flex items-center min-h-[36px] px-3 rounded-lg border transition-colors ${
              active === it.id ? "bg-panel border-white/10 text-white" : "border-transparent text-muted hover:text-white hover:bg-panel/60"
            }`}
          >
            {it.label}
          </a>
          {it.children && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-white/5 pl-3">
              {it.children.map((ch: any) => (
                <a
                  key={ch.id}
                  href={`#${ch.id}`}
                  className={`flex items-center min-h-[28px] px-2 rounded-md text-xs transition-colors ${
                    active === ch.id ? "text-white bg-white/[0.04]" : "text-muted hover:text-white"
                  }`}
                >
                  {ch.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
