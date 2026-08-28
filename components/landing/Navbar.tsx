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
          <a href="#products" className="hover:text-white transition-colors">How It Works</a>
          <a href="/app/identity" className="hover:text-white transition-colors">Identity</a>
          <a href="/app/defi" className="hover:text-white transition-colors">Earn</a>
          <a href="/app/discover" className="hover:text-white transition-colors">Discover</a>
          <div className="relative group">
            <button className="inline-flex items-center gap-1 hover:text-white transition-colors">
              More
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              <div className="bg-panel border border-border rounded-xl p-2 min-w-[160px] shadow-xl space-y-0.5">
                <a href="/docs" className="block px-3 py-2 rounded-lg text-sm text-white hover:bg-canvas transition-colors">API for Issuers</a>
                <a href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-canvas transition-colors">GitHub <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
              </div>
            </div>
          </div>
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
            <a onClick={() => setOpen(false)} href="#products" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">How It Works</a>
            <a onClick={() => setOpen(false)} href="/app/identity" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Identity</a>
            <a onClick={() => setOpen(false)} href="/app/defi" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Earn</a>
            <a onClick={() => setOpen(false)} href="/app/discover" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">Discover</a>
            <div className="border-t border-border my-2 pt-2">
              <a onClick={() => setOpen(false)} href="/docs" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">API for Issuers</a>
              <a onClick={() => setOpen(false)} href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="flex items-center min-h-[44px] px-3 rounded-lg text-sm text-white hover:bg-panel transition-colors">GitHub →</a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
