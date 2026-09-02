"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Plus, Loader2, TrendingUp, ShieldCheck, Globe2, Search, Heart, MessageCircle, ChevronDown, Check } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile } from "@/lib/userProfile";
import { addFactoryToken, listMyTokens } from "@/lib/tokenRegistry";

type Offer = {
  id: string;
  issuer: string;
  issuerUrl: string;
  productName: string;
  symbol: string;
  tokenAddress: string;
  chainId: number;
  chain: string;
  apy: string;
  region: string;
  cat: "rwa" | "tbill" | "gold";
  desc: string;
  underlying?: string;
  isWrapped: boolean;
  ruleMinTier: number;
  countries: string[];
  productUrl: string;
  tvl: string;
};

const OFFERS: Offer[] = [
  {
    id: "nikkei-rwa",
    issuer: "SBI Asset Management",
    issuerUrl: "https://www.sbiam.co.jp",
    productName: "Nikkei 225 RWA",
    symbol: "GO-NIKKEI",
    tokenAddress: "0xN1kke1RWA100000000000000000000000000001",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "12.8%",
    region: "JP",
    cat: "rwa",
    desc: "Japan Nikkei 225 mutual fund — daily NAV attested on Creditcoin. Transfer restricted to Tier ≥10 JP holders.",
    isWrapped: false,
    ruleMinTier: 10,
    countries: ["JP"],
    productUrl: "https://issuer.example/nikkei-225-rwa",
    tvl: "$6.4M",
  },
  {
    id: "usd-tbill",
    issuer: "Meridian Capital",
    issuerUrl: "https://issuer.example/usd-tbill",
    productName: "USD T-Bill",
    symbol: "GO-TBILL",
    tokenAddress: "0xTb1llUSDC000000000000000000000000000002",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "6.2%",
    region: "US",
    cat: "tbill",
    desc: "Short-duration US Treasury. Eligible collateral in Morpho on Creditcoin.",
    isWrapped: false,
    ruleMinTier: 10,
    countries: ["US", "SG"],
    productUrl: "https://issuer.example/usd-tbill",
    tvl: "$8.0M",
  },
  {
    id: "sg-tbill",
    issuer: "MAS Licensed",
    issuerUrl: "https://www.mas.gov.sg",
    productName: "SGD T-Bill",
    symbol: "GO-SGTB",
    tokenAddress: "0xSGTbill000000000000000000000000000003",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "4.5%",
    region: "SG",
    cat: "tbill",
    desc: "Singapore T-Bill backed by MAS. Low volatility, SG holders only.",
    isWrapped: false,
    ruleMinTier: 10,
    countries: ["SG"],
    productUrl: "https://issuer.example/sgd-tbill",
    tvl: "$1.4M",
  },
  {
    id: "jreit",
    issuer: "Northstar RWA",
    issuerUrl: "https://www.tr.mufg.jp",
    productName: "J-REIT Index RWA",
    symbol: "GO-JREIT",
    tokenAddress: "0xJRe1tRWA000000000000000000000000000004",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "9.4%",
    region: "JP",
    cat: "rwa",
    desc: "Tokyo-listed J-REIT basket. Monthly distribution, JP eligible.",
    isWrapped: true,
    underlying: "0xJRe1tUnd000000000000000000000000000004",
    ruleMinTier: 5,
    countries: ["JP"],
    productUrl: "https://issuer.example/jreit",
    tvl: "$3.1M",
  },
  {
    id: "gold",
    issuer: "PAMP Suisse",
    issuerUrl: "https://www.pamp.ch",
    productName: "Gold Vault",
    symbol: "GO-GOLD",
    tokenAddress: "0xGo1dVault000000000000000000000000000005",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "—",
    region: "CH",
    cat: "gold",
    desc: "Physical gold 1:1 vaulted. Transfer unrestricted Tier ≥1.",
    isWrapped: false,
    ruleMinTier: 1,
    countries: [],
    productUrl: "https://issuer.example/gold-vault",
    tvl: "$2.7M",
  },
  {
    id: "usdc",
    issuer: "Circle Issuer",
    issuerUrl: "https://www.circle.com",
    productName: "USD Coin",
    symbol: "USDC",
    tokenAddress: "0xUSDC0000000000000000000000000000000006",
    chainId: 11155111,
    chain: "Sepolia",
    apy: "—",
    region: "US",
    cat: "tbill",
    desc: "USD Coin base asset.",
    isWrapped: false,
    ruleMinTier: 1,
    countries: [],
    productUrl: "https://www.circle.com/usdc",
    tvl: "$12.4M",
  },
];

type FeedItem = { id: string; issuer: string; handle: string; time: string; text: string; offerId?: string; likes: number; replies: { author: string; text: string; time: string }[]; verified?: boolean };

const FEED: FeedItem[] = [
  { id: "f1", issuer: "Meridian Capital", handle: "meridian_cap", time: "2h", text: "This week we processed GO-TBILL redemptions for 1,240 holders — all on schedule, zero delays. Built for reliable settlement at institutional scale, verified on Creditcoin in ~1 block.", offerId: "usd-tbill", likes: 128, replies: [], verified: true },
  {
    id: "f2",
    issuer: "Northstar RWA",
    handle: "northstar_rwa",
    time: "6h",
    text: "Heads up: minimum tier for new GO-JREIT allocations is now 10. If you're already holding, you're grandfathered — no action needed. Happy to answer questions below.",
    offerId: "jreit",
    likes: 61,
    replies: [
      { author: "dana.eth", text: "Does this affect the current pool rate?", time: "45m" },
      { author: "Northstar RWA", text: "No change for existing holders — pool rate stays as is.", time: "30m" },
    ],
    verified: true,
  },
  { id: "f3", issuer: "Creditcoin Foundation", handle: "creditcoin", time: "1d", text: "Milestone: $50M+ settlement volume across attested pools this month. Thank you to every issuer and holder building compliant onchain finance with us.", likes: 340, replies: [], verified: false },
  { id: "f4", issuer: "SBI Asset Management", handle: "sbi_am", time: "1d", text: "Proud to bring Nikkei 225 onchain — GO-NIKKEI is live with daily NAV attested on Creditcoin. 12.8% APY, open for JP Tier 10 holders.", offerId: "nikkei-rwa", likes: 210, replies: [{ author: "Kenji T.", text: "Added to registry — super smooth flow.", time: "3h" }], verified: true },
  { id: "f5", issuer: "PAMP Suisse", handle: "pamp_suisse", time: "2d", text: "Behind the scenes: 1.2 GO-GOLD redeemed and delivered — from vault to onchain proof seamlessly. Always 1:1 backed and verifiable on Explorer.", offerId: "gold", likes: 88, replies: [], verified: true },
];

function shortAddr(a: string) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function issuerInitials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function issuerGradient(name: string) { let h = 0; for (let i = 0; i < 6; i++) h = (h * 31 + name.charCodeAt(i % name.length)) % 360; return `linear-gradient(135deg, hsl(${h} 70% 50%), hsl(${(h + 40) % 360} 70% 45%))`; }

export default function DiscoverPage() {
  const { address } = useWallet();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [mounted, setMounted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "rwa" | "tbill" | "gold">("all");
  const [search, setSearch] = useState("");
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!address) { setOwnerId(null); return; } loadProfile(address).then((p) => setOwnerId((p as unknown as { id: string } | null)?.id || null)); }, [address]);
  useEffect(() => { if (!ownerId) { setAddedIds(new Set()); return; } listMyTokens(ownerId).then((rows) => { const s = new Set<string>(); rows.forEach((r) => s.add(`${r.tokenAddress.toLowerCase()}:${r.chainId}`)); setAddedIds(s); }); }, [ownerId]);

  const handleAdd = async (o: Offer) => {
    setErr(null);
    if (!ownerId) { setErr("Connect wallet and save profile in Settings first"); return; }
    setAdding(true);
    try { await addFactoryToken(ownerId, { id: o.id, tokenAddress: o.tokenAddress, chainId: o.chainId, symbol: o.symbol, name: o.productName, decimals: 18 }); setAddedIds((prev) => new Set(prev).add(`${o.tokenAddress.toLowerCase()}:${o.chainId}`)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setAdding(false); }
  };

  const isAdded = (o: Offer) => addedIds.has(`${o.tokenAddress.toLowerCase()}:${o.chainId}`);
  const toggleComments = (id: string) => setOpenComments((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const filteredOffers = OFFERS.filter((o) => (filter !== "all" ? o.cat === filter : true) && (search ? `${o.symbol} ${o.productName} ${o.issuer}`.toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => {
      const av = a.apy === "—" ? -1 : parseFloat(a.apy);
      const bv = b.apy === "—" ? -1 : parseFloat(b.apy);
      return bv - av;
    });
  const filteredFeed = FEED.filter((f) => {
    if (!search) {
      if (filter === "all") return true;
      if (!f.offerId) return filter === "all";
      const o = OFFERS.find((x) => x.id === f.offerId);
      return o?.cat === filter;
    }
    return `${f.issuer} ${f.text}`.toLowerCase().includes(search.toLowerCase());
  });

  const drawer = mounted && selected ? (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[420px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border flex items-center gap-3 sticky top-0 bg-canvas z-10">
            <span className="font-medium text-white text-sm flex-1">Details</span>
            <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-panel"><X size={14} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2"><span className="w-1 h-4 bg-amber rounded" /><span className="text-xs font-mono text-white/40">{selected.region} · {selected.apy !== "—" ? `${selected.apy} APY` : "Vault"}</span></div>
              <h3 className="mt-2 text-lg font-semibold text-white">{selected.productName}</h3>
              <p className="text-sm text-muted">{selected.symbol} · {selected.chain}</p>
              <p className="mt-3 text-sm text-muted leading-relaxed">{selected.desc}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-panel p-3"><div className="flex items-center gap-1 text-[11px] text-white/40 uppercase tracking-wide"><TrendingUp size={12} /> APY</div><p className="mt-1 text-sm font-mono font-medium text-white">{selected.apy}</p></div>
              <div className="rounded-lg border border-border bg-panel p-3"><div className="flex items-center gap-1 text-[11px] text-white/40 uppercase tracking-wide"><ShieldCheck size={12} /> Tier</div><p className="mt-1 text-sm font-mono font-medium text-white">≥{selected.ruleMinTier}</p></div>
              <div className="rounded-lg border border-border bg-panel p-3"><div className="flex items-center gap-1 text-[11px] text-white/40 uppercase tracking-wide"><Globe2 size={12} /> Region</div><p className="mt-1 text-sm font-mono font-medium text-white">{selected.countries.length ? selected.countries.join(", ") : "All"}</p></div>
            </div>
            <div className="rounded-lg border border-border bg-panel p-3 space-y-2">
              <div className="text-xs font-mono text-white/40">Token</div><div className="text-xs font-mono text-white break-all">{selected.tokenAddress}</div><div className="text-xs text-muted">{selected.chain} · {selected.chainId}</div>
              <div className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono border ${selected.isWrapped ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"}`}>{selected.isWrapped ? `Wrapped · ${shortAddr(selected.underlying || "")}` : "Native"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAdd(selected)} disabled={adding || isAdded(selected) || !ownerId} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40">{adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {isAdded(selected) ? "Added" : "Add to registry"}</button>
              <a href={selected.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-lg border border-border bg-panel text-sm text-white hover:bg-white/[0.04]">View product <ExternalLink size={12} /></a>
            </div>
            {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
            {!ownerId && <div className="text-xs text-amber-200/70">Save profile in Settings to add tokens.</div>}
            <div className="pt-2 border-t border-border text-xs text-muted">Issuer <a href={selected.issuerUrl} target="_blank" rel="noreferrer" className="text-white hover:underline">{selected.issuer}</a> · via API for Issuers (later)</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  ) : null;

  const pills: { id: typeof filter; label: string }[] = [{ id: "all", label: "For you" }, { id: "rwa", label: "RWA" }, { id: "tbill", label: "T-Bill" }, { id: "gold", label: "Gold" }];

  return (
    <div className="w-full">
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 mb-3 items-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-amber rounded" />
            <span className="font-mono text-xs font-medium text-white">Discover</span>
          </div>
          <div className="relative">
            <button onClick={() => setFilterOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-panel text-xs font-medium text-white hover:bg-white/[0.04]">
              {pills.find((p) => p.id === filter)?.label} <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-panel shadow-lg overflow-hidden z-20">
                {pills.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setFilter(p.id); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] ${filter === p.id ? "text-white bg-white/[0.04]" : "text-muted"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* left — social cards with gap */}
        <div className="space-y-3">
            {filteredFeed.length === 0 ? <div className="rounded-xl border border-border bg-panel p-8 text-center text-sm text-muted">No posts for this filter.</div> : filteredFeed.map((f) => {
              const offer = f.offerId ? OFFERS.find((o) => o.id === f.offerId) : null;
              const isOpen = openComments.has(f.id);
              return (
                <div key={f.id} className="rounded-xl border border-border bg-panel overflow-hidden">
                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white border border-white/10" style={{ background: issuerGradient(f.issuer) }}>{issuerInitials(f.issuer)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-white text-sm">{f.issuer}</span>
                          {f.verified && <Check size={12} className="text-emerald-300 shrink-0" />}
                          <span className="text-white/30 text-xs">@{f.handle} · {f.time}</span>
                        </div>
                        <p className="text-white text-sm mt-1 leading-relaxed">{f.text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 mt-2 text-white/30 text-xs font-mono">
                      <button onClick={() => setLiked((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} className={`hover:text-white ${liked.has(f.id) ? "text-red-300" : ""}`}>♡ {f.likes + (liked.has(f.id) ? 1 : 0)}</button>
                      <button onClick={() => toggleComments(f.id)} className="hover:text-white">💬 {f.replies.length}</button>
                      {offer && <button onClick={() => setSelected(offer)} className="hover:text-white">↗ View</button>}
                    </div>
                    {isOpen && f.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l border-border space-y-2">
                        {f.replies.map((r, i) => (
                          <p key={i} className="text-xs"><span className="font-medium text-white">{r.author}</span> <span className="text-muted">{r.text}</span> <span className="text-white/25">{r.time}</span></p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* right — sticky aside like design */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="border border-border rounded-lg p-4 bg-panel">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-canvas border border-border rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
            </div>
            <p className="text-white/30 text-xs uppercase tracking-wide mt-4 mb-2">All products</p>
            <ol className="space-y-1 text-sm">
              {filteredOffers.map((o, i) => (
                <li key={o.id} className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-white/[0.04] cursor-pointer" onClick={() => setSelected(o)}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-white/20 text-xs font-mono w-3 shrink-0">{i + 1}</span>
                    <span className="text-white truncate">{o.symbol}</span>
                  </span>
                  <span className="text-white/25 text-xs font-mono shrink-0 ml-2">{o.tvl}</span>
                </li>
              ))}
            </ol>
            {err && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          </div>
        </aside>
      </div>
      {mounted ? createPortal(drawer, document.body) : null}
    </div>
  );
}
