"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Plus, Loader2, TrendingUp, ShieldCheck, Globe2, Search, Check, ChevronDown } from "lucide-react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";
import { useWallet } from "@/components/app/WalletContext";
import { loadProfile } from "@/lib/userProfile";
import { addFactoryToken, listMyTokens } from "@/lib/tokenRegistry";

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (_client) return _client;
  try { Amplify.configure(outputs, { ssr: true }); } catch {}
  _client = generateClient<Schema>();
  return _client;
}

type Offer = {
  id: string;
  issuerId: string;
  issuer: string;
  handle: string;
  productName: string;
  symbol: string;
  tokenAddress: string;
  chainId: number;
  chain: string;
  apy: string;
  tvl: string;
  region: string;
  desc: string;
  productUrl: string;
  isWrapped: boolean;
  ruleMinTier: number;
  countries: string[];
  iconURI?: string;
};

type FeedItem = {
  id: string;
  issuer: string;
  handle: string;
  logoURI?: string;
  time: string;
  createdAt: string;
  text: string;
  tokenProfileId?: string;
  likes: number;
  replies: { author: string; text: string; time: string }[];
  verified: boolean;
};

const CHAIN_NAMES: Record<number, string> = { 11155111: "Sepolia", 102031: "Creditcoin" };
const COUNTRY_BIT: Record<number, string> = { 0: "US", 1: "SG", 2: "JP", 3: "HK", 4: "DE", 5: "CN", 6: "GB", 7: "FR", 8: "AE", 9: "CH" };
function bitmapToRegion(bitmap: string): string {
  try { const n = BigInt(bitmap || "0"); for (let i = 0; i < 10; i++) if ((n & (BigInt(1) << BigInt(i))) !== BigInt(0)) return COUNTRY_BIT[i] || "—"; } catch {}
  return bitmap && bitmap !== "0" ? bitmap : "—";
}
function bitmapToCountries(bitmap: string): string[] {
  try { const n = BigInt(bitmap || "0"); const out: string[] = []; for (let i = 0; i < 10; i++) if ((n & (BigInt(1) << BigInt(i))) !== BigInt(0)) out.push(COUNTRY_BIT[i]); return out; } catch { return []; }
}

function shortAddr(a: string) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function issuerInitials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function issuerGradient(name: string) { let h = 0; for (let i = 0; i < 6; i++) h = (h * 31 + name.charCodeAt(i % name.length)) % 360; return `linear-gradient(135deg, hsl(${h} 70% 50%), hsl(${(h + 40) % 360} 70% 45%))`; }
function timeAgo(iso?: string) {
  if (!iso) return "now";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function DiscoverPage() {
  const { address } = useWallet();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [mounted, setMounted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "foryou">("all");
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "eligibility" | "token">("overview");
  useEffect(() => { setTab("overview"); }, [selected?.id]);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!address) { setOwnerId(null); setUserCountry(null); return; } loadProfile(address).then((p) => { setOwnerId((p as unknown as { id: string } | null)?.id || null); setUserCountry((p as unknown as { country?: string } | null)?.country || null); }); }, [address]);
  useEffect(() => { if (!ownerId) { setAddedIds(new Set()); return; } listMyTokens(ownerId).then((rows) => { const s = new Set<string>(); rows.forEach((r) => s.add(`${r.tokenAddress.toLowerCase()}:${r.chainId}`)); setAddedIds(s); }); }, [ownerId]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const client = getClient();
        let tokenProfiles: any[] = [];
        try {
          const { data } = await (client.models.RWATokenProfile as any).byTokenStatus({ status: "listed" });
          tokenProfiles = (data as any[]) || [];
          console.log("[Discover] byTokenStatus listed", tokenProfiles.length, tokenProfiles.map((t:any)=>t.id));
        } catch (e) { console.warn("[Discover] byTokenStatus failed", e); }
        if (!tokenProfiles || tokenProfiles.length === 0) {
          const { data } = await (client.models.RWATokenProfile as any).list({ limit: 50 });
          tokenProfiles = ((data as any[]) || []).filter((t:any)=> t.status === "listed");
          console.log("[Discover] fallback list listed", tokenProfiles.length);
        }
        const list: Offer[] = [];
        for (const tp of (tokenProfiles as any[]) || []) {
          const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: tp.issuerProfileId });
          if (!issuer || issuer.status !== "verified") continue;
          const { data: token } = await (client.models.TokenRecord as any).get({ id: tp.tokenRecordId });
          if (!token) continue;
          list.push({
            id: tp.id,
            issuerId: issuer.id,
            issuer: issuer.issuerName,
            handle: issuer.handle,
            productName: token.name,
            symbol: token.symbol,
            tokenAddress: token.tokenAddress,
            chainId: token.chainId,
            chain: CHAIN_NAMES[token.chainId] || String(token.chainId),
            apy: tp.apy || "—",
            tvl: tp.tvl || "—",
            region: bitmapToRegion(token.ruleBitmap),
            desc: tp.desc || "",
            productUrl: tp.productUrl || "",
            isWrapped: token.isWrapped,
            ruleMinTier: token.ruleMinTier,
            countries: bitmapToCountries(token.ruleBitmap),
            iconURI: token.iconURI || undefined,
          });
        }
        setOffers(list);
        const { data: announcements } = await (client.models.IssuerAnnouncement as any).list({ limit: 50 });
        const feedList: FeedItem[] = [];
        for (const a of ((announcements as any[]) || []).slice(0, 20)) {
          const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: a.issuerProfileId });
          if (!issuer || issuer.status !== "verified") continue;
          const { data: replies } = await (client.models.AnnouncementReply as any).listByAnnouncement({ announcementId: a.id });
          feedList.push({
            id: a.id,
            issuer: issuer.issuerName,
            handle: issuer.handle,
            logoURI: issuer.logoURI || undefined,
            time: timeAgo(a.createdAt),
            text: a.text,
            tokenProfileId: a.tokenProfileId || undefined,
            likes: a.likesCount || 0,
            createdAt: a.createdAt,
            replies: ((replies as any[]) || []).map((r: any) => ({ author: r.authorWallet.slice(0, 6) + "…" + r.authorWallet.slice(-4), text: r.text, time: timeAgo(r.createdAt) })),
            verified: issuer.status === "verified",
          });
        }
        feedList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setFeed(feedList);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleAdd = async (o: Offer) => {
    setErr(null);
    if (!ownerId) { setErr("Connect wallet and save profile in Settings first"); return; }
    setAdding(true);
    try {
      const client = getClient();
      const { data: tp } = await (client.models.RWATokenProfile as any).get({ id: o.id });
      await addFactoryToken(ownerId, { id: tp?.tokenRecordId || o.id, tokenAddress: o.tokenAddress, chainId: o.chainId, symbol: o.symbol, name: o.productName, decimals: 18 });
      setAddedIds((prev) => new Set(prev).add(`${o.tokenAddress.toLowerCase()}:${o.chainId}`));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setAdding(false); }
  };

  const isAdded = (o: Offer) => addedIds.has(`${o.tokenAddress.toLowerCase()}:${o.chainId}`);
  const toggleComments = (id: string) => setOpenComments((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const q = search.toLowerCase();
  const filteredOffers = offers.filter((o) => (search ? `${o.symbol} ${o.productName} ${o.issuer} ${o.handle}`.toLowerCase().includes(q) : true))
    .sort((a, b) => { const av = a.apy === "—" ? -1 : parseFloat(a.apy); const bv = b.apy === "—" ? -1 : parseFloat(b.apy); return bv - av; });
  const offersById = new Map(filteredOffers.map((o) => [o.id, o]));
  const filteredFeed = feed.filter((f) => {
    if (search) return `${f.issuer} ${f.handle} ${f.text}`.toLowerCase().includes(q);
    if (filter === "foryou") {
      if (!userCountry) return false;
      const o = f.tokenProfileId ? filteredOffers.find((x) => x.id === f.tokenProfileId) : undefined;
      if (!o || !o.countries.includes(userCountry)) return false;
    }
    return true;
  });

  const drawer = mounted && selected ? (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[420px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-canvas">
            <p className="text-xs text-white/40 font-mono">Details</p>
            <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-panel text-white/60 hover:text-white"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 flex items-center gap-4 border-b border-border">
              {selected.iconURI ? (
                <img src={selected.iconURI} alt={selected.symbol} className="w-14 h-14 rounded-xl object-cover border border-white/10 bg-white shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-mono text-sm font-semibold text-white shrink-0">{selected.symbol.slice(0, 4).toUpperCase()}</div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug text-white truncate">{selected.productName}</h3>
                <p className="text-white/40 text-xs font-mono">{selected.productName} · {selected.chain}</p>
              </div>
            </div>
            <div className="flex gap-1 px-5 pt-4">
              {(["overview", "eligibility", "token"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${tab === t ? "bg-panel border border-border text-white" : "text-white/40 hover:text-white"}`}>{t}</button>
              ))}
            </div>
            {tab === "overview" && (
              <div className="p-6 space-y-5">
                <p className="text-muted text-sm leading-relaxed">{selected.desc || "—"}</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-white/40 text-xs mb-1 uppercase tracking-wide">APY</p>
                    <p className="text-2xl font-semibold font-mono text-emerald-300">{selected.apy}</p>
                  </div>
                  <div className="flex-1">
                    <svg viewBox="0 0 200 50" className="w-full h-10">
                      <polyline fill="none" stroke="#3FCF8E" strokeWidth="2" points="0,35 20,32 40,38 60,26 80,30 100,18 120,22 140,12 160,16 180,6 200,10" />
                    </svg>
                  </div>
                </div>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3"><span className="text-muted text-sm">Tier</span><span className="font-mono text-sm text-white">≥ {selected.ruleMinTier}</span></div>
                  <div className="flex items-center justify-between px-4 py-3"><span className="text-muted text-sm">Region</span><span className="text-sm text-white">{selected.countries.length ? selected.countries.join(", ") : "All"}</span></div>
                  <div className="flex items-center justify-between px-4 py-3"><span className="text-muted text-sm">Type</span><span className="text-sm text-white">{selected.isWrapped ? "Wrapped 1:1" : "Direct"}</span></div>
                </div>
              </div>
            )}
            {tab === "eligibility" && (
              <div className="p-6 space-y-4">
                <p className="text-muted text-sm leading-relaxed">GO Pass required. Tier ≥ {selected.ruleMinTier}, allowed: {selected.countries.length ? selected.countries.join(", ") : "All regions"}.</p>
                <div className="flex flex-wrap gap-1.5">{selected.countries.map((c) => (<span key={c} className="px-2 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-white">{c}</span>))}{selected.countries.length === 0 && <span className="text-xs text-muted">All</span>}</div>
                <div className="rounded-lg border border-border bg-panel p-3 flex items-center gap-2 text-sm"><ShieldCheck size={14} className="text-emerald-300" /> Eligible holders can transfer; compliance checked on every transfer.</div>
              </div>
            )}
            {tab === "token" && (
              <div className="p-6 space-y-3">
                <div className="rounded-lg border border-border bg-panel p-3 space-y-2">
                  <div className="text-xs font-mono text-white/40">Token</div><div className="text-xs font-mono text-white break-all">{selected.tokenAddress}</div>
                  <a href={`https://${selected.chain === "Sepolia" ? "sepolia.etherscan.io" : "explorer.creditcoin.xyz"}/address/${selected.tokenAddress}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-mono text-white/60 hover:text-white underline underline-offset-2">View on explorer <ExternalLink size={10} /></a>
                </div>
                <div className="text-xs text-muted">Add to registry to track in Send & Portfolio.</div>
              </div>
            )}
          </div>
          <div className="border-t border-border p-4 space-y-2 shrink-0 bg-canvas">
            {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
            <div className="flex gap-2">
              <button onClick={() => handleAdd(selected)} disabled={adding || isAdded(selected) || !ownerId} className="flex-1 py-2.5 rounded-md bg-panel border border-border text-muted text-sm disabled:opacity-40 inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.04] hover:text-white">{adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {isAdded(selected) ? "Added" : "Add to registry"}</button>
              {selected.productUrl ? <a href={selected.productUrl} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-md bg-emerald-500 text-white text-sm text-center hover:bg-emerald-600">View product</a> : <a href={`https://${selected.chain === "Sepolia" ? "sepolia.etherscan.io" : "explorer.creditcoin.xyz"}/address/${selected.tokenAddress}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-md bg-emerald-500 text-white text-sm text-center hover:bg-emerald-600">View on explorer</a>}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  ) : null;

  const pills: { id: typeof filter; label: string }[] = [{ id: "all", label: "All products" }, { id: "foryou", label: "For you" }];

  return (
    <div className="w-full">
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 mb-3 items-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="w-1 h-4 bg-amber rounded" /><span className="font-mono text-xs font-medium text-white">Discover</span></div>
          <div className="relative">
            <button onClick={() => setFilterOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-panel text-xs font-medium text-white hover:bg-white/[0.04]">
              {pills.find((p) => p.id === filter)?.label} <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-panel shadow-lg overflow-hidden z-20">
                {pills.map((p) => (
                  <button key={p.id} onClick={() => { setFilter(p.id); setFilterOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] ${filter === p.id ? "text-white bg-white/[0.04]" : "text-muted"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin mr-2" /> Loading listings...</div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="space-y-3">
            {filteredFeed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-8 text-center text-sm text-muted">No announcements yet.</div>
            ) : (
              filteredFeed.map((f) => (
                <div key={f.id} className="rounded-xl border border-border bg-panel overflow-hidden">
                  <div className="p-4">
                    <div className="flex gap-3">
                      {f.logoURI ? (
                        <img src={f.logoURI} alt={f.issuer} className="w-9 h-9 rounded-full shrink-0 object-cover border border-white/10 bg-white" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white border border-white/10" style={{ background: issuerGradient(f.issuer) }}>{issuerInitials(f.issuer)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-white text-sm">{f.issuer}</span>
                          {f.verified && <Check size={12} className="text-emerald-300 shrink-0" />}
                          <span className="text-white/30 text-xs">@{f.handle} · {f.time}</span>
                        </div>
                        <p className="text-white text-sm mt-1 leading-relaxed">{f.text}</p>
                      </div>
                    </div>
                    {f.tokenProfileId && offersById.get(f.tokenProfileId) && (
                      <div onClick={() => { const o = offersById.get(f.tokenProfileId!); if (o) setSelected(o); }} className="mt-3 border border-border rounded-md p-3 flex items-center justify-between bg-panel hover:bg-white/[0.04] cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          {offersById.get(f.tokenProfileId)!.iconURI ? (
                            <img src={offersById.get(f.tokenProfileId)!.iconURI} alt={offersById.get(f.tokenProfileId)!.symbol} className="w-8 h-8 rounded-lg object-cover border border-white/10 bg-white shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-mono text-[10px] font-semibold text-white shrink-0">{offersById.get(f.tokenProfileId)!.symbol.slice(0,4)}</div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{offersById.get(f.tokenProfileId)!.productName}</p>
                            <p className="text-white/40 text-xs font-mono">{offersById.get(f.tokenProfileId)!.productName} · Tier {offersById.get(f.tokenProfileId)!.ruleMinTier}+{offersById.get(f.tokenProfileId)!.countries.length > 0 ? ` · ${offersById.get(f.tokenProfileId)!.countries.join(", ")}` : ""}</p>
                          </div>
                        </div>
                        <p className="font-mono text-sm text-white shrink-0 ml-3">{offersById.get(f.tokenProfileId)!.tvl}</p>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-5">
                      <button onClick={() => setLiked((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} className={`inline-flex items-center gap-1.5 text-xs ${liked.has(f.id) ? "text-red-300" : "text-white/40 hover:text-white"}`}>
                        ♥ {f.likes + (liked.has(f.id) ? 1 : 0)}
                      </button>
                      <button onClick={() => toggleComments(f.id)} className={`inline-flex items-center gap-1.5 text-xs ${openComments.has(f.id) ? "text-white" : "text-white/40 hover:text-white"}`}>
                        💬 {f.replies.length} {openComments.has(f.id) ? "hide" : "reply"}
                      </button>
                      {f.tokenProfileId && (
                        <button onClick={() => { const o = offersById.get(f.tokenProfileId!); if (o) setSelected(o); }} className="ml-auto text-xs text-white/30 hover:text-white">↗ View product</button>
                      )}
                    </div>
                  </div>
                  {openComments.has(f.id) && (
                    <div className="border-t border-border bg-canvas/30 px-4 py-3 space-y-2">
                      {f.replies.length === 0 ? <p className="text-xs text-muted">No replies yet — be first.</p> : f.replies.map((r, i) => (
                        <div key={i} className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2">
                          <p className="text-xs"><span className="font-medium text-white">{r.author}</span> <span className="text-muted">{r.text}</span> <span className="text-white/25">· {r.time}</span></p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <aside className="lg:sticky lg:top-24 self-start">
            <div className="border border-border rounded-lg p-4 bg-panel">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-canvas border border-border rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
              </div>
              <p className="text-white/30 text-xs uppercase tracking-wide mt-4 mb-2">All products</p>
              {filteredOffers.length === 0 ? (
                <div className="text-xs text-muted py-4 text-center border border-dashed border-white/10 rounded-lg">No listings yet.</div>
              ) : (
                <ol className="space-y-1 text-sm">
                  {filteredOffers.map((o, i) => (
                    <li key={o.id} className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-white/[0.04] cursor-pointer" onClick={() => setSelected(o)}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-white/20 text-xs font-mono w-3 shrink-0">{i + 1}</span>
                        <span className="text-white truncate">{o.productName}</span>
                      </span>
                      <span className={`text-xs font-mono shrink-0 ml-2 ${o.apy === "0%" || o.apy === "Stablecoin" ? "text-emerald-400" : "text-white/25"}`}>{o.apy === "0%" || o.apy === "Stablecoin" ? "Stablecoin" : (o.apy === "-" ? "—" : o.apy)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {err && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
            </div>
          </aside>
        </div>
      )}
      {mounted ? createPortal(drawer, document.body) : null}
    </div>
  );
}
