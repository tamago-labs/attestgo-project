"use client";

import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-base/70 border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 py-4">
        <a href="#" className="flex items-center gap-2.5">
          <span
            className="relative w-2.5 h-2.5 rounded-full"
            style={{ background: "linear-gradient(135deg,#FDB750,#8B7CF0)" }}
          >
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "linear-gradient(135deg,#FDB750,#8B7CF0)", opacity: 0.5 }}
            ></span>
          </span>
          <span className="font-display font-semibold text-lg tracking-tight">Saffron</span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted">
          <a href="#" className="hover:text-white transition-colors">Protocol</a>
          <a href="#" className="hover:text-white transition-colors">Verification</a>
          <a href="#" className="hover:text-white transition-colors">Docs</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="#" className="hidden sm:inline text-sm text-muted hover:text-white transition-colors">Sign in</a>
          <a
            href="#"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-white hover:bg-panel transition-colors"
          >
            Launch app
          </a>
        </div>
      </nav>
    </header>
  );
}
