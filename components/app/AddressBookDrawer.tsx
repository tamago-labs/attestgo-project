"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Copy, Check, Trash2, Loader2, BookMarked } from "lucide-react";
import { isAddress } from "ethers";
import { addAddressBookEntry, listAddressBook, removeAddressBookEntry, resolveContact, type AddressBookEntry } from "@/lib/addressBook";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}
function avatarGradient(addr: string) {
  let h = 0;
  for (let i = 2; i < 10; i++) h = (h * 31 + addr.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 40) % 360} 80% 55%))`;
}

export default function AddressBookDrawer({
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
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [resolved, setResolved] = useState<Record<string, { displayName: string; country: string } | null>>({});
  const [loading, setLoading] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<{ displayName: string; country: string } | null | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetch = async () => {
    if (!ownerId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const rows = await listAddressBook(ownerId);
    setEntries(rows);
    setLoading(false);
    // resolve each
    rows.forEach(async (r) => {
      if (resolved[r.contactAddress] !== undefined) return;
      const c = await resolveContact(r.contactAddress);
      setResolved((m) => ({ ...m, [r.contactAddress]: c }));
    });
  };

  useEffect(() => {
    if (open) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  // check preview when addr changes
  useEffect(() => {
    if (!isAddress(addr || "")) {
      setPreview(undefined);
      return;
    }
    let cancelled = false;
    setChecking(true);
    resolveContact(addr).then((c) => {
      if (!cancelled) {
        setPreview(c);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [addr]);

  const handleAdd = async () => {
    setErr(null);
    if (!ownerId) {
      setErr("Save your profile first");
      return;
    }
    if (!isAddress(addr)) {
      setErr("Invalid wallet address");
      return;
    }
    setAdding(true);
    try {
      await addAddressBookEntry(ownerId, addr, label);
      setAddr("");
      setLabel("");
      setPreview(undefined);
      await fetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await removeAddressBookEntry(id);
    await fetch();
  };

  const handleCopy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

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
            className="relative w-[380px] max-w-[92vw] h-full bg-canvas border-l border-border flex flex-col"
          >
        <div className="px-4 py-4 border-b border-border flex items-center gap-3">
          <span className="font-medium text-white text-sm flex-1">Address book</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted">{entries.length}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-panel">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Wallet address *</label>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value.trim())}
              placeholder="0x..."
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
            />
            {addr && !isAddress(addr) && <div className="mt-1 text-xs text-amber-300">Invalid address</div>}
            {isAddress(addr || "") && (
              <div className="mt-2 rounded-lg border border-border bg-panel/50 px-3 py-2 flex items-center gap-2">
                <span className="h-7 w-7 rounded-full border border-white/10 shrink-0" style={{ background: avatarGradient(addr) }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {checking ? (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <Loader2 size={10} className="animate-spin" /> Checking…
                      </span>
                    ) : preview ? (
                      preview.displayName
                    ) : (
                      <span className="text-white/50">No AttestGO profile</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted truncate">{shortAddr(addr)}</div>
                </div>
                {preview && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60">{preview.country}</span>}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Treasury"
              maxLength={24}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-panel border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          {!ownerId && <div className="text-xs text-amber-200/70">Save your profile first to use address book.</div>}
          <button
            onClick={handleAdd}
            disabled={adding || !ownerId || !isAddress(addr || "")}
            className="w-full py-2.5 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex justify-center items-center gap-2"
          >
            {adding ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Adding…
              </>
            ) : (
              <>Add to book</>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-sm text-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-panel/40 p-6 text-center">
              <p className="text-sm text-muted">No saved addresses.</p>
              <p className="text-xs text-white/30 mt-1">Add a wallet to see name and country if they have a GO Pass profile.</p>
            </div>
          ) : (
            entries.map((e) => {
              const r = resolved[e.contactAddress];
              const name = r?.displayName || e.label || shortAddr(e.contactAddress);
              return (
                <div key={e.id} className="rounded-xl border border-border bg-panel px-3 py-3 flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full border border-white/10 shrink-0" style={{ background: avatarGradient(e.contactAddress) }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{name}</div>
                    <div className="text-[11px] font-mono text-muted truncate flex items-center gap-1">
                      {shortAddr(e.contactAddress)}{" "}
                      {r?.country && <span className="px-1 py-0 rounded bg-white/5 border border-white/10 text-[10px]">{r.country}</span>}
                    </div>
                    {e.label && r?.displayName && e.label !== r.displayName && <div className="text-[11px] text-white/40 truncate">Label: {e.label}</div>}
                  </div>
                  <button
                    onClick={() => handleCopy(e.contactAddress)}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-white/[0.04]"
                    aria-label="Copy"
                  >
                    {copied === e.contactAddress ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-muted" />}
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="w-7 h-7 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center hover:bg-red-500/20"
                    aria-label="Remove"
                  >
                    <Trash2 size={12} className="text-red-300" />
                  </button>
                </div>
              );
            })
          )}
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return createPortal(content, document.body);
}
