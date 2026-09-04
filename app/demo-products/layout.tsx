"use client";
import Link from "next/link";
import { WalletProvider } from "@/components/app/WalletContext";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-white text-[#0A0A0F] flex flex-col">
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
