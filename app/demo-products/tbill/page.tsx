"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";
import BuyDrawer from "@/components/demo/BuyDrawer";

let _client: any = null;
function getClient() { if (_client) return _client; try { Amplify.configure(outputs as any, { ssr: true }); } catch {} _client = generateClient<Schema>(); return _client; }

export default function TBillPage() {
  const [offer, setOffer] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const run = async () => {
      const client = getClient();
      const { data: list } = await (client.models.TokenRecord as any).list({ limit: 50 });
      const tok = (list as any[]).find((t: any) => t.symbol === "aTBILL");
      if (!tok) return;
      const { data: profiles } = await (client.models.RWATokenProfile as any).byTokenRecordId({ tokenRecordId: tok.id });
      const tp = (profiles as any[])?.[0];
      setOffer({ ...tok, apy: tp?.apy || "4.8%", tvl: tp?.tvl || "$12M", desc: tp?.desc || "Go T-Bill vault — US only via GO Pass" });
    };
    run();
  }, []);
  return (
    <div className="bg-white text-[#0A0A0F]">
      <div className="max-w-[1120px] mx-auto px-6 py-6">
        <Link href="/demo-products" className="text-sm text-slate-500 hover:text-slate-900">← All funds</Link>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-8">
        <div className="flex items-center gap-3">
          <img src="/t-bill-token-icon.png" alt="aTBILL" className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white" />
          <span className="text-sm font-medium">aTBILL — Go T-Bill</span>
          <span className="ml-auto hidden md:flex gap-2 text-xs"><a href="#overview" className="px-3 py-1.5 rounded-full bg-slate-900 text-white">Overview</a><a href="#keyfacts" className="px-3 py-1.5 rounded-full border border-slate-200">Key facts</a></span>
        </div>
        <div className="mt-8 grid md:grid-cols-2 gap-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight">Yield and liquidity built for always-on Treasury yield</h1>
            <p className="text-slate-600 mt-4 leading-relaxed">Access institutional yield on short-term US Treasury bills without sacrificing liquidity. aTBILL supports near-instant settlement — US only via GO Pass.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium">Request access</button>
              <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg border border-slate-200 text-sm">Already approved? Buy aTBILL →</button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 bg-white">
            <div className="flex justify-between"><p className="text-xs font-mono text-slate-500">aTBILL Price</p><p className="text-xs font-mono">1.0000</p></div>
            <svg viewBox="0 0 400 80" className="w-full h-20 mt-3"><polyline fill="none" stroke="#0A0A0F" strokeWidth="2" points="0,60 40,58 80,62 120,56 160,54 200,48 240,44 280,36 320,32 360,28 400,24" /></svg>
            <div className="grid grid-cols-3 gap-4 mt-6 border-t border-slate-200 pt-4">
              <div><p className="text-xs text-slate-500">Est. Gross Yield</p><p className="font-mono font-semibold mt-1">4.95%</p></div>
              <div><p className="text-xs text-slate-500">Est. Net Yield</p><p className="font-mono font-semibold mt-1">{offer?.apy || "4.8%"}</p></div>
              <div><p className="text-xs text-slate-500">AUM</p><p className="font-mono font-semibold mt-1">{offer?.tvl || "$12M"}</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 border-y border-slate-200"><div className="max-w-[1120px] mx-auto px-6 py-8"><h3 className="font-semibold">Institutional access without large upfront commitments</h3><p className="text-sm text-slate-600 mt-2 max-w-3xl">aTBILL offers $1k minimum, first $1M waived fees on Sepolia for eligible US GO Pass holders.</p></div></div>
      <div className="max-w-[1120px] mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold">Why aTBILL?</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            ["24/7 access", "Around-the-clock access, free from banking cut-offs."],
            ["Near-instant redemptions", "Redeem into USDT in ~1 block up to capacity."],
            ["Simplified yield", "Rising price, no staking."],
            ["Seamless integrations", "Single API aTBILL ↔ USDT."],
            ["Margin utility", "Use as collateral while earning yield."],
            ["Lower barrier", "First $1M daily waived."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-200 p-5 bg-white"><p className="font-medium text-sm">{t}</p><p className="text-sm text-slate-600 mt-2">{d}</p></div>
          ))}
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-10 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold">What is aTBILL?</h3>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">aTBILL is the onchain representation of GO Treasury Fund, investing in US T-Bills and reverse repo backed by US gov securities. GToken on Sepolia enables faster settlement.</p>
          <div className="mt-6 space-y-4">
            <div><p className="font-medium text-sm">Onchain fund structure</p><p className="text-sm text-slate-600 mt-1">1:1 backed by short-term US Treasuries, ERC-20 GToken, rule-verified US only.</p></div>
            <div><p className="font-medium text-sm">Automated workflows</p><p className="text-sm text-slate-600 mt-1">Smart-contract subscriptions/redemptions.</p></div>
            <div><p className="font-medium text-sm">Onchain transparency</p><p className="text-sm text-slate-600 mt-1">Visible on Sepolia explorer.</p></div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-100 border border-slate-200 h-[320px] flex items-center justify-center text-sm text-slate-400">Photo — vault / treasuries</div>
      </div>
      <div id="keyfacts" className="max-w-[1120px] mx-auto px-6 pb-10">
        <h3 className="font-semibold">Key facts</h3>
        <div className="mt-4 border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white text-sm">
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">AUM</span><span className="font-mono">{offer?.tvl || "$12M"}</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Inception</span><span className="font-mono">2025-09-01</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Token Standard</span><span className="font-mono">ERC-20</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Network</span><span className="font-mono">Sepolia</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Address</span><a href={`https://sepolia.etherscan.io/address/${offer?.tokenAddress || ""}`} target="_blank" className="font-mono underline">View contract</a></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Subscription</span><span>USDT</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Eligibility</span><span>US only · Tier ≥10</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Investment Minimum</span><span>$1,000</span></div>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-12 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Technical documentation</h4><a href="/docs" className="text-sm underline mt-3 inline-block">View Documentation →</a></div>
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Need help?</h4><a href="https://help.circle.com" target="_blank" className="text-sm underline mt-3 inline-block">Get Help →</a></div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-12">
        <h3 className="font-semibold">FAQs</h3>
        <div className="mt-4 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
          {[
            ["Who is eligible?", "GO Pass tier ≥10, US only."],
            ["What backs aTBILL?", "Short-term US T-Bills and reverse repo."],
            ["How fast redeem?", "~1 block under capacity, else T+0/T+1."],
          ].map(([q, a]) => (
            <div key={q} className="px-5 py-4"><p className="font-medium text-sm">{q}</p><p className="text-sm text-slate-600 mt-1">{a}</p></div>
          ))}
        </div>
      </div>
      <BuyDrawer open={open} onClose={() => setOpen(false)} symbol="aTBILL" tokenAddress={offer?.tokenAddress || "0x"} chainId={11155111} payToken="USDT" />
    </div>
  );
}
