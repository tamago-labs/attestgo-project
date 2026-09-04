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

export default function NikkeiPage() {
  const [offer, setOffer] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const run = async () => {
      const client = getClient();
      const { data: list } = await (client.models.TokenRecord as any).list({ limit: 50 });
      const tok = (list as any[]).find((t: any) => t.symbol === "aN225");
      if (!tok) return;
      const { data: profiles } = await (client.models.RWATokenProfile as any).byTokenRecordId({ tokenRecordId: tok.id });
      const tp = (profiles as any[])?.[0];
      setOffer({ ...tok, apy: tp?.apy || "5.2%", tvl: tp?.tvl || "¥2.1T AUM", desc: tp?.desc || "Go Nikkei 225 index — tokenized, US/JP/SG eligible via GO Pass" });
    };
    run();
  }, []);
  const price = "1.0247";
  return (
    <div className="bg-white text-[#0A0A0F]">
      <div className="max-w-[1120px] mx-auto px-6 py-6">
        <Link href="/demo-products" className="text-sm text-slate-500 hover:text-slate-900">← All funds</Link>
      </div>
      {/* Hero */}
      <div className="max-w-[1120px] mx-auto px-6 pb-8">
        <div className="flex items-center gap-3">
          <img src="/nekkei-token-icon.png" alt="aN225" className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white" />
          <span className="text-sm font-medium text-slate-900">aN225 — Go Nikkei 225 Index</span>
          <span className="ml-auto hidden md:flex gap-2 text-xs"><a href="#overview" className="px-3 py-1.5 rounded-full bg-slate-900 text-white">Overview</a><a href="#use-cases" className="px-3 py-1.5 rounded-full border border-slate-200">Use cases</a><a href="#keyfacts" className="px-3 py-1.5 rounded-full border border-slate-200">Key facts</a></span>
        </div>
        <div className="mt-8 grid md:grid-cols-2 gap-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight">Yield and liquidity built for always-on Nikkei exposure</h1>
            <p className="text-slate-600 mt-4 leading-relaxed">Access institutional Nikkei 225 yield onchain without sacrificing liquidity. aN225 supports near-instant settlement and use as collateral across 24/7 workflows — US, JP, SG eligible via GO Pass.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium">Request access</button>
              <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg border border-slate-200 text-sm">Already approved? Buy aN225 →</button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 bg-white">
            <div className="flex justify-between items-center">
              <p className="text-xs font-mono text-slate-500">aN225 Price</p><p className="text-xs font-mono text-slate-900">{price}</p>
            </div>
            <svg viewBox="0 0 400 80" className="w-full h-20 mt-3"><polyline fill="none" stroke="#0A0A0F" strokeWidth="2" points="0,60 40,58 80,62 120,48 160,52 200,36 240,40 280,24 320,28 360,12 400,16" /></svg>
            <div className="flex gap-2 text-xs text-slate-500 mt-1"><span className="text-slate-900 font-medium">1W</span><span>1M</span><span>ALL</span></div>
            <div className="grid grid-cols-3 gap-4 mt-6 border-t border-slate-200 pt-4">
              <div><p className="text-xs text-slate-500">Est. Gross Yield</p><p className="font-mono font-semibold mt-1">5.45%</p></div>
              <div><p className="text-xs text-slate-500">Est. Net Yield</p><p className="font-mono font-semibold mt-1">{offer?.apy || "5.2%"}</p></div>
              <div><p className="text-xs text-slate-500">AUM</p><p className="font-mono font-semibold mt-1">{offer?.tvl || "¥2.1T"}</p></div>
            </div>
          </div>
        </div>
      </div>
      {/* Banner */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1120px] mx-auto px-6 py-8">
          <h3 className="font-semibold">Institutional access without large upfront commitments</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">aN225 offers Nikkei 225 exposure with ¥50k minimum. First ¥150M waived subscription/redemption fees.</p>
        </div>
      </div>
      {/* Why */}
      <div id="use-cases" className="max-w-[1120px] mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold">Why aN225?</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            ["24/7 access", "Onchain Nikkei exposure, free from TSE trading windows and banking cut-offs."],
            ["Near-instant redemptions", "Redeem into JPYC in ~1 block up to instant capacity, optional extra liquidity."],
            ["Simplified yield", "Yield accrues via rising price — no staking or claiming."],
            ["Seamless integrations", "Single API for aN225 ↔ JPYC across workflows."],
            ["Margin utility", "Use as yield-bearing collateral on supported venues."],
            ["Lower barrier", "First ¥150M daily volume waived fees per wallet."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-200 p-5 bg-white">
              <p className="font-medium text-sm">{t}</p><p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
      {/* What is */}
      <div className="max-w-[1120px] mx-auto px-6 pb-10 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold">What is aN225?</h3>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">aN225 is the onchain representation of GO Nikkei 225 Index Fund, which tracks TSE Nikkei 225 constituents. Issuing on Sepolia enables faster settlement, composability and GO Pass-gated compliance.</p>
          <div className="mt-6 space-y-4">
            <div><p className="font-medium text-sm">Onchain fund structure</p><p className="text-sm text-slate-600 mt-1">Fund invests in Nikkei 225 equities + cash, tokenized as ERC-20 GToken with rule-verified transfers (tier ≥10, US/JP/SG).</p></div>
            <div><p className="font-medium text-sm">Automated workflows</p><p className="text-sm text-slate-600 mt-1">Smart-contract mint/redeem, daily NAV attestation onchain.</p></div>
            <div><p className="font-medium text-sm">Onchain transparency</p><p className="text-sm text-slate-600 mt-1">Activity visible on Sepolia explorer, real-time tracking and auditability.</p></div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-100 border border-slate-200 h-[320px] flex items-center justify-center text-slate-400 text-sm">Photo — trader on laptop</div>
      </div>
      {/* Key facts */}
      <div id="keyfacts" className="max-w-[1120px] mx-auto px-6 pb-10">
        <h3 className="font-semibold">Key facts</h3>
        <div className="mt-4 border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white text-sm">
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">AUM</span><span className="font-mono">{offer?.tvl || "¥2.1T"}</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Inception</span><span className="font-mono">2025-09-01</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Token Standard</span><span className="font-mono">ERC-20</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Network</span><span className="font-mono">Sepolia</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Address</span><a href={`https://sepolia.etherscan.io/address/${offer?.tokenAddress || ""}`} target="_blank" className="font-mono underline">View contract</a></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Subscription</span><span>JPYC</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Subscription fee</span><span>0.04% (0% ≤¥150M)</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Redemption fee</span><span>0.03% (0% ≤¥150M)</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Eligibility</span><span>US, JP, SG · Tier ≥10</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Investment Minimum</span><span>¥50,000</span></div>
        </div>
      </div>
      {/* Docs + FAQ */}
      <div className="max-w-[1120px] mx-auto px-6 pb-12 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Technical documentation</h4><p className="text-sm text-slate-600 mt-2">How to integrate aN225 mint/redeem.</p><a href="/docs" className="text-sm underline mt-3 inline-block">View Documentation →</a></div>
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Need help?</h4><p className="text-sm text-slate-600 mt-2">Already hold aN225?</p><a href="https://help.circle.com" target="_blank" className="text-sm underline mt-3 inline-block">Get Help →</a></div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-12">
        <h3 className="font-semibold">FAQs</h3>
        <div className="mt-4 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
          {[
            ["Who is eligible?", "GO Pass tier ≥10, US/JP/SG only via rule-verified transfer."],
            ["What currency for subscriptions?", "JPYC on Sepolia."],
            ["How fast is settlement?", "~1 block under instant capacity, else T+0/T+1."],
            ["What backs aN225?", "TSE Nikkei 225 constituents + cash."],
          ].map(([q, a]) => (
            <div key={q} className="px-5 py-4"><p className="font-medium text-sm">{q}</p><p className="text-sm text-slate-600 mt-1">{a}</p></div>
          ))}
        </div>
      </div>
      <BuyDrawer open={open} onClose={() => setOpen(false)} symbol="aN225" tokenAddress={offer?.tokenAddress || "0x"} chainId={11155111} payToken="JPYC" />
    </div>
  );
}
