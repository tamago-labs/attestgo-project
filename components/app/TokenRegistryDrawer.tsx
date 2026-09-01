"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Coins, Trash2, Loader2, Plus, Search } from "lucide-react";
import { isAddress } from "ethers";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";
import { addCustomToken, addFactoryToken, listMyTokens, removeRegistryEntry, type TokenRegistryEntry } from "@/lib/tokenRegistry";

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (_client) return _client;
  try {
    Amplify.configure(outputs, { ssr: true });
  } catch {}
  _client = generateClient<Schema>();
  return _client;
}

type FactoryRow = { id: string; tokenAddress: string; chainId: number; symbol: string; name: string; decimals: number };

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export default function TokenRegistryDrawer({
  open,
  onClose,
  ownerId,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [tab, setTab] = useState<"factory" | "custom">("factory");
  const [myTokens, setMyTokens] = useState<TokenRegistryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [factory, setFactory] = useState<FactoryRow[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  // custom form
  const [addr, setAddr] = useState("");
  const [chainId, setChainId] = useState(11155111);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchMy = async () => {
    if (!ownerId) {
      setMyTokens([]);
      return;
    }
    setLoading(true);
    const rows = await listMyTokens(ownerId);
    setMyTokens(rows);
    setLoading(false);
  };

  const fetchFactory = async () => {
    setFactoryLoading(true);
    try {
      const client = getClient();
      // try listByChain then fallback list
      let rows: FactoryRow[] = [];
      try {
        const res = await (client.models.TokenRecord as unknown as {
          listByChain: (a: { chainId: number }) => Promise<{ data: FactoryRow[] }>;
        }).listByChain({ chainId: 11155111 });
        rows = (res.data as FactoryRow[]) || [];
      } catch {
        const res = await (client.models.TokenRecord as unknown as {
          list: (a: { filter?: unknown }) => Promise<{ data: FactoryRow[] }>;
        }).list({});
        rows = (res.data as FactoryRow[]) || [];
      }
      setFactory(rows);
    } catch {
      setFactory([]);
    } finally {
      setFactoryLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMy();
      fetchFactory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  const handleAddFactory = async (r: FactoryRow) => {
    setErr(null);
    if (!ownerId) {
      setErr("Save your profile first");
      return;
    }
    setAdding(true);
    try {
      await addFactoryToken(ownerId, r);
      await fetchMy();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleAddCustom = async () => {
    setErr(null);
    if (!ownerId) {
      setErr("Save your profile first");
      return;
    }
    if (!isAddress(addr)) {
      setErr("Invalid token address");
      return;
    }
    if (!symbol.trim()) {
      setErr("Symbol required");
      return;
    }
    setAdding(true);
    try {
      await addCustomToken(ownerId, {
        tokenAddress: addr,
        chainId,
        symbol: symbol.trim(),
        name: name.trim() || undefined,
        decimals: decimals ? Number(decimals) : undefined,
      });
      setAddr("");
      setSymbol("");
      setName("");
      setDecimals("18");
      await fetchMy();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeRegistryEntry(id);
    await fetchMy();
  };

  const filteredFactory = factory.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.tokenAddress.toLowerCase().includes(q);
  });

  if (!mounted) return null;
  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-[420px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col"
          >
            <div className="px-4 py-4 border-b border-border flex items-center gap-3">
              <Coins size={16} className="text-muted" />
              <span className="font-medium text-white text-sm flex-1">Token registry</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted">{myTokens.length}</span>
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-panel">
                <X size={14} />
              </button>
            </div>

            {/* My tokens */}
            <div className="p-4 border-b border-border">
              <div className="text-xs font-medium text-white/80 uppercase tracking-widest">My tokens</div>
              <div className="mt-2 space-y-2 max-h-[180px] overflow-y-auto">
                {loading ? (
                  <div className="text-sm text-muted flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Loading
                  </div>
                ) : myTokens.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/15 bg-panel/40 p-3 text-center text-xs text-muted">No tokens yet — add from factory or custom.</div>
                ) : (
                  myTokens.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border bg-panel px-3 py-2 flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {e.symbol.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate flex items-center gap-1">
                          {e.symbol} {e.isCustom && <span className="px-1 py-0 rounded bg-amber/15 border border-amber/20 text-[10px] text-amber">custom</span>}
                        </div>
                        <div className="text-[11px] font-mono text-muted truncate">{shortAddr(e.tokenAddress)} · {e.chainId}</div>
                        {e.name && <div className="text-[11px] text-white/40 truncate">{e.name}</div>}
                      </div>
                      <button onClick={() => handleRemove(e.id)} className="w-7 h-7 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center hover:bg-red-500/20">
                        <Trash2 size={12} className="text-red-300" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 pt-3 flex gap-2 border-b border-border">
              <button
                onClick={() => setTab("factory")}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 ${tab === "factory" ? "border-white text-white bg-white/5" : "border-transparent text-muted hover:text-white"}`}
              >
                Factory tokens
              </button>
              <button
                onClick={() => setTab("custom")}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 ${tab === "custom" ? "border-white text-white bg-white/5" : "border-transparent text-muted hover:text-white"}`}
              >
                Custom token
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
              {!ownerId && <div className="text-xs text-amber-200/70">Save your profile first to manage registry.</div>}

              {tab === "factory" ? (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol, name, address" className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                  </div>
                  {factoryLoading ? (
                    <div className="text-sm text-muted flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Loading factory tokens
                    </div>
                  ) : filteredFactory.length === 0 ? (
                    <div className="text-xs text-muted">No factory tokens found.</div>
                  ) : (
                    filteredFactory.map((r) => {
                      const already = myTokens.some((e) => e.tokenAddress.toLowerCase() === r.tokenAddress.toLowerCase() && e.chainId === r.chainId);
                      return (
                        <div key={r.id} className="rounded-lg border border-border bg-panel px-3 py-3 flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {r.symbol.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{r.symbol}</div>
                            <div className="text-xs text-muted truncate">{r.name}</div>
                            <div className="text-[11px] font-mono text-white/30 truncate">{shortAddr(r.tokenAddress)} · {r.chainId}</div>
                          </div>
                          <button
                            onClick={() => handleAddFactory(r)}
                            disabled={adding || already || !ownerId}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-canvas hover:bg-white/90 disabled:opacity-40"
                          >
                            <Plus size={12} /> {already ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Token address *</label>
                    <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x..." className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                    {addr && !isAddress(addr) && <div className="mt-1 text-xs text-amber-300">Invalid address</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Chain ID *</label>
                      <select value={chainId} onChange={(e) => setChainId(Number(e.target.value))} className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white focus:outline-none focus:border-violet-500/50">
                        <option value={11155111}>Sepolia 11155111</option>
                        <option value={1}>Mainnet 1</option>
                        <option value={137}>Polygon 137</option>
                        <option value={102031}>Creditcoin 102031</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Decimals</label>
                      <input value={decimals} onChange={(e) => setDecimals(e.target.value)} placeholder="18" className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Symbol *</label>
                    <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. USDC" className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. USD Coin" className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <button onClick={handleAddCustom} disabled={adding || !ownerId || !isAddress(addr || "") || !symbol.trim()} className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 inline-flex justify-center items-center gap-2">
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add custom token
                  </button>
                  <p className="text-[11px] text-white/30">Custom tokens are any ERC-20 not from GTokenFactory — you provide address + symbol; we store without TokenRecord link (isCustom:true).</p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return createPortal(content, document.body);
}
