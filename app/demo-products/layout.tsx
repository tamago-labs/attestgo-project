"use client";
import Link from "next/link";
import { WalletProvider, useWallet } from "@/components/app/WalletContext";
import { useState } from "react";

function DemoHeader() {
  const { address, connect, disconnect } = useWallet() as any;
  const [open, setOpen] = useState(false);
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1120px] mx-auto px-6 h-[56px] flex items-center gap-3">
        <Link href="/demo-products" className="flex items-center gap-2">
          <img src="/go-asset-logo.png" alt="GO" className="w-8 h-8 rounded-lg border border-slate-200 bg-white object-cover" />
          <span className="font-semibold text-sm">GO Asset Management</span>
        </Link>
        <nav className="hidden md:flex items-center gap-4 ml-6 text-sm">
          <Link href="/demo-products/nikkei" className="text-slate-600 hover:text-slate-900">Nikkei 225</Link>
          <Link href="/demo-products/tbill" className="text-slate-600 hover:text-slate-900">T-Bill</Link>
        </nav>
        <div className="ml-auto">
          {!address ? (
            <button onClick={connect} className="px-4 py-2 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium">Connect Wallet</button>
          ) : (
            <div className="relative">
              <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-[10px] text-white font-mono">{short.slice(2, 4).toUpperCase()}</span>
                <span className="text-sm font-mono">{short}</span>
                <span className="text-slate-400 text-xs">▾</span>
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  <button onClick={() => { navigator.clipboard.writeText(address); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Copy address</button>
                  <button onClick={() => { disconnect(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Disconnect</button>
                  <a href={`https://sepolia.etherscan.io/address/${address}`} target="_blank" className="block px-3 py-2 text-sm hover:bg-slate-50">View on explorer</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-white text-[#0A0A0F] flex flex-col">
        <DemoHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-[1120px] mx-auto px-6 py-8 flex flex-col md:flex-row gap-6 justify-between">
            <div className="flex gap-3">
              <img src="/go-asset-logo.png" alt="GO" className="w-8 h-8 rounded-lg border border-slate-200 bg-white object-cover" />
              <div>
                <p className="font-semibold text-sm">GO Asset Management</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[320px]">Demo store — tokenized Nikkei 225 & T-Bill on Sepolia via GO Pass. Not financial advice.</p>
              </div>
            </div>
            <div className="flex gap-10 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-xs uppercase tracking-wide text-slate-500">Funds</p>
                <Link href="/demo-products/nikkei" className="block text-slate-600 hover:text-slate-900">Nikkei 225</Link>
                <Link href="/demo-products/tbill" className="block text-slate-600 hover:text-slate-900">T-Bill</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-xs uppercase tracking-wide text-slate-500">AttestGO</p>
                <Link href="/app/discover" className="block text-slate-600 hover:text-slate-900">Discover</Link>
                <Link href="/docs" className="block text-slate-600 hover:text-slate-900">Docs</Link>
              </div>
            </div>
          </div>
          <div className="max-w-[1120px] mx-auto px-6 pb-6 text-xs text-slate-400">© 2026 GO Asset Management · Demo on Sepolia · <a href="https://attestgo.tamagolabs.com" className="underline">attestgo.tamagolabs.com</a></div>
        </footer>
      </div>
    </WalletProvider>
  );
}
