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

export default function SGDGoPage() {
  const [offer, setOffer] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const run = async () => {
      const client = getClient();
      const { data: list } = await (client.models.TokenRecord as any).list({ limit: 50 });
      const tok = (list as any[]).find((t: any) => t.symbol === "SGD-GO");
      if (!tok) return;
      const { data: profiles } = await (client.models.RWATokenProfile as any).byTokenRecordId({ tokenRecordId: tok.id });
      const tp = (profiles as any[])?.[0];
      setOffer({ ...tok, apy: tp?.apy || "0%", tvl: tp?.tvl || "S$50M", desc: tp?.desc || "GO SGD — Singapore-dollar compliant stablecoin for business & remittance." });
    };
    run();
  }, []);
  const price = "1.0000";
  const marketAddress = "0x0feD657F7551e151E5AC399E6eaA65bc683Fb2aa";
  return (
    <div className="bg-white text-[#0A0A0F]">
      <div className="max-w-[1120px] mx-auto px-6 py-6">
        <Link href="/demo-products" className="text-sm text-slate-500 hover:text-slate-900">← All funds</Link>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-8">
        <div className="flex items-center gap-3">
          <img src="/sgd-go-token-icon.png" alt="SGD-GO" className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white" />
          <span className="text-sm font-medium text-slate-900">SGD-GO — GO SGD Stablecoin</span>
          <span className="ml-auto hidden md:flex gap-2 text-xs"><a href="#overview" className="px-3 py-1.5 rounded-full bg-slate-900 text-white">Overview</a><a href="#use-cases" className="px-3 py-1.5 rounded-full border border-slate-200">Use cases</a><a href="#keyfacts" className="px-3 py-1.5 rounded-full border border-slate-200">Key facts</a></span>
        </div>
        <div className="mt-8 grid md:grid-cols-2 gap-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight">Singapore-dollar stablecoin for business and remittance</h1>
            <p className="text-slate-600 mt-4 leading-relaxed">GO SGD is a compliant Singapore-dollar stablecoin 1:1 pegged to USD — built for cross-border business payments and remittance. Available to verified Singapore users and approved jurisdictions via GO Pass.</p>
            <div className="mt-6 flex gap-3">
              {offer?.tokenAddress ? (
                <>
                  <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium">Request access</button>
                  <button onClick={() => setOpen(true)} className="px-6 py-2.5 rounded-lg border border-slate-200 text-sm">Already approved? Buy SGD-GO →</button>
                </>
              ) : (
                <p className="text-sm text-slate-500">Token not yet issued — coming soon.</p>
              )}
            </div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 bg-white">
            <div className="flex justify-between items-center">
              <p className="text-xs font-mono text-slate-500">SGD-GO Price</p><p className="text-xs font-mono text-slate-900">{price} USDT</p>
            </div>
            <svg viewBox="0 0 400 80" className="w-full h-20 mt-3"><polyline fill="none" stroke="#0A0A0F" strokeWidth="2" points="0,40 40,40 80,40 120,40 160,40 200,40 240,40 280,40 320,40 360,40 400,40" /></svg>
            <div className="flex gap-2 text-xs text-slate-500 mt-1"><span className="text-slate-900 font-medium">1W</span><span>1M</span><span>ALL</span></div>
            <div className="grid grid-cols-3 gap-4 mt-6 border-t border-slate-200 pt-4">
              <div><p className="text-xs text-slate-500">Yield</p><p className="font-mono font-semibold mt-1">None</p></div>
              <div><p className="text-xs text-slate-500">Peg</p><p className="font-mono font-semibold mt-1">1:1 USD</p></div>
              <div><p className="text-xs text-slate-500">AUM</p><p className="font-mono font-semibold mt-1">{offer?.tvl || "S$50M"}</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1120px] mx-auto px-6 py-8">
          <h3 className="font-semibold">Compliant stablecoin for always-on business</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">GO SGD enables near-instant settlement for business payments and remittance — available to verified Singapore users and approved jurisdictions (US, JP, HK, GB).</p>
        </div>
      </div>
      <div id="use-cases" className="max-w-[1120px] mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold">Why GO SGD?</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            ["1:1 pegged", "Backed 1:1 by USD reserves — stable value for business and remittance."],
            ["24/7 settlement", "Send and receive SGD-GO any time — no banking cut-offs or FX delays."],
            ["Cross-border", "Built for business payments and remittance across approved jurisdictions."],
            ["GO Pass-gated", "Tier ≥10 and region (US, SG, JP, HK, GB) enforced on every transfer."],
            ["No yield, no risk", "Stablecoin design — no price accrual, no staking, no claiming."],
            ["Composability", "Use in DeFi, pay for services, or remit across borders."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-200 p-5 bg-white">
              <p className="font-medium text-sm">{t}</p><p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-10 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold">What is GO SGD?</h3>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">GO SGD is a Singapore-dollar compliant stablecoin issued by GO Asset Management. Each SGD-GO is 1:1 pegged to USD and designed for business payments and remittance — available to verified Singapore users and approved jurisdictions via GO Pass.</p>
          <div className="mt-6 space-y-4">
            <div><p className="font-medium text-sm">Stablecoin structure</p><p className="text-sm text-slate-600 mt-1">1:1 backed by USD reserves — no yield accrual, stable value for business use.</p></div>
            <div><p className="font-medium text-sm">Compliant transfers</p><p className="text-sm text-slate-600 mt-1">Rule-verified transfers (tier ≥10, US/SG/JP/HK/GB) enforced on every transaction.</p></div>
            <div><p className="font-medium text-sm">Onchain transparency</p><p className="text-sm text-slate-600 mt-1">Activity visible on Sepolia explorer, real-time tracking and auditability.</p></div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-100 border border-slate-200 h-[320px] flex items-center justify-center text-slate-400 text-sm">Photo — business payment</div>
      </div>
      <div id="keyfacts" className="max-w-[1120px] mx-auto px-6 pb-10">
        <h3 className="font-semibold">Key facts</h3>
        <div className="mt-4 border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white text-sm">
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">AUM</span><span className="font-mono">{offer?.tvl || "S$50M"}</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Inception</span><span className="font-mono">2025-09-08</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Token Standard</span><span className="font-mono">ERC-20</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Network</span><span className="font-mono">Sepolia</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Address</span><a href={`https://sepolia.etherscan.io/address/${offer?.tokenAddress || ""}`} target="_blank" className="font-mono underline">View contract</a></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Peg</span><span>1:1 USD</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Yield</span><span>None (stablecoin)</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Subscription</span><span>USDT</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Eligibility</span><span>US, SG, JP, HK, GB · Tier ≥10</span></div>
          <div className="flex justify-between px-5 py-3"><span className="text-slate-600">Investment Minimum</span><span>$1,000</span></div>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-12 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Technical documentation</h4><p className="text-sm text-slate-600 mt-2">How to integrate SGD-GO mint/redeem.</p><a href="/docs" className="text-sm underline mt-3 inline-block">View Documentation →</a></div>
        <div className="rounded-xl border border-slate-200 p-6 bg-white"><h4 className="font-medium">Need help?</h4><p className="text-sm text-slate-600 mt-2">Already hold SGD-GO?</p><a href="https://help.circle.com" target="_blank" className="text-sm underline mt-3 inline-block">Get Help →</a></div>
      </div>
      <div className="max-w-[1120px] mx-auto px-6 pb-12">
        <h3 className="font-semibold">FAQs</h3>
        <div className="mt-4 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
          {[
            ["Who is eligible?", "GO Pass tier ≥10, US/SG/JP/HK/GB only via rule-verified transfer."],
            ["What currency for subscriptions?", "USDT on Sepolia."],
            ["How fast is settlement?", "~1 block under instant capacity, else T+0/T+1."],
            ["What backs SGD-GO?", "USD reserves 1:1 — stablecoin, no yield accrual."],
            ["Is there yield?", "No — SGD-GO is a stablecoin designed for business payments and remittance, not yield generation."],
          ].map(([q, a]) => (
            <div key={q} className="px-5 py-4"><p className="font-medium text-sm">{q}</p><p className="text-sm text-slate-600 mt-1">{a}</p></div>
          ))}
        </div>
      </div>
      {offer?.tokenAddress && <BuyDrawer open={open} onClose={() => setOpen(false)} symbol="SGD-GO" tokenAddress={offer.tokenAddress} chainId={11155111} payToken="USDT" marketAddress={marketAddress} />}
    </div>
  );
}
