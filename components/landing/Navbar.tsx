"use client";

import { useEffect, useState } from "react";
import ButtonGlow from "./ButtonGlow";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          ? "backdrop-blur-md bg-canvas/70 border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-10 py-4">
        <a href="#" className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-lg tracking-tight text-white">
            attest
          </span>
          <span className="brand-tamg font-display text-sm">
            GO
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted">
          <a href="#" className="hover:text-white transition-colors">Protocol</a>
          <a href="#" className="hover:text-white transition-colors">Verification</a>
          <a href="#" className="hover:text-white transition-colors">Docs</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
        </div>

        <div className="flex items-center gap-3">
          <ButtonGlow href="/app" className="px-4 py-2 rounded-md min-h-[44px]">Launch app</ButtonGlow>
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border text-white hover:bg-panel transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {open ? (
                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 6h12M3 9h12M3 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <div className="md:hidden border-t border-border bg-canvas/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            <a onClick={() => setOpen(false)} href="#" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Protocol</a>
            <a onClick={() => setOpen(false)} href="#" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Verification</a>
            <a onClick={() => setOpen(false)} href="#" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Docs</a>
            <a onClick={() => setOpen(false)} href="#" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">GitHub</a>
          </div>
        </div>
      )}
    </header>
  );
}
