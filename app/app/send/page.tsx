"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/components/app/WalletContext";
import { DEFAULT_TOKENS, type DefaultToken } from "@/lib/defaultTokens";
import { getChainById } from "@/lib/chains";
import { loadProfile } from "@/lib/userProfile";
import { getClient as getDataClient, listMyTokens, type TokenRegistryEntry } from "@/lib/tokenRegistry";
import FaucetModal from "@/components/app/FaucetModal";
import SendSuccessModal from "@/components/app/send/SuccessModal";
import SendSidebar from "@/components/app/send/SendSidebar";
import TokenList from "@/components/app/send/TokenList";
import SendDrawer from "@/components/app/send/SendDrawer";
import { getPriceUsd, getRpcProvider, type TokenRecordLite, type UnifiedRow } from "@/lib/send";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"] as const;

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    // call immediately on delay set, then interval
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function SendPage() {
  const { address, provider, chainId: walletChainId, signer } = useWallet();
  const [filter, setFilter] = useState<number | "all">("all");
  const [myTokens, setMyTokens] = useState<TokenRegistryEntry[]>([]);
  const [recordMap, setRecordMap] = useState<Record<string, TokenRecordLite>>({});
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [faucetToken, setFaucetToken] = useState<DefaultToken | null>(null);
  const [sendRow, setSendRow] = useState<UnifiedRow | null>(null);
  const [successDetails, setSuccessDetails] = useState<{ txHash: string; amount: string; recipient: string; chainId: string; symbol: string } | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{ displayName: string; country: string } | null>(null);
  const [balNonce, setBalNonce] = useState(0);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [identity, setIdentity] = useState<{ status: "verified" | "pending" | "unverified" | "idle"; tier?: number; country?: string }>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    async function runIdentity() {
      if (!address) {
        if (!cancelled) setIdentity({ status: "idle" });
        return;
      }
      try {
        const profile = await loadProfile(address);
        if (!profile) {
          if (!cancelled) setIdentity({ status: "unverified" });
          return;
        }
        if (!cancelled) {
          setOwnerId(profile.id);
          setOwnerProfile({ displayName: profile.displayName, country: profile.country });
        }
        const countryCode = (profile as unknown as { country?: string }).country || undefined;
        const client = getDataClient();
        let rows: { status: string }[] = [];
        try {
          const res = await (client.models.PassRequest as unknown as { byUserProfile: (a: { userProfileId: string }) => Promise<{ data: unknown }> }).byUserProfile({ userProfileId: profile.id });
          const d = (res as { data: unknown }).data;
          rows = Array.isArray(d) ? (d as { status: string }[]) : d ? [d as { status: string }] : [];
        } catch {
          const res2 = await (client.models.PassRequest as unknown as { list: (a: unknown) => Promise<{ data: { status: string }[] }> }).list({ filter: { userProfileId: { eq: profile.id } } });
          rows = res2.data || [];
        }
        if (!cancelled) {
          const active = rows.find((r) => r.status === "active");
          if (active) setIdentity({ status: "verified", tier: 10, country: countryCode });
          else if (rows.find((r) => r.status === "pending")) setIdentity({ status: "pending", country: countryCode });
          else setIdentity({ status: "unverified", country: countryCode });
        }
      } catch {
        if (!cancelled) setIdentity({ status: "unverified" });
      }
    }
    runIdentity();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    console.log("[send] loadRegistry start", { address });
    async function run() {
      if (!address) {
        console.log("[send] loadRegistry no address");
        setMyTokens([]);
        setRecordMap({});
        return;
      }
      console.log("[send] loadRegistry fetching", address);
      setLoadingRegistry(true);
      try {
        const profile = await loadProfile(address);
        if (!profile) {
          if (!cancelled) {
            setMyTokens([]);
            setRecordMap({});
          }
          return;
        }
        const rows = await listMyTokens(profile.id);
        console.log("[send] loadRegistry rows", rows.length);
        if (!cancelled) setMyTokens(rows);
        const ids = rows.filter((r) => r.tokenRecordId).map((r) => r.tokenRecordId as string);
        console.log("[send] loadRegistry ids", ids);
        if (ids.length > 0) {
          const client = getDataClient();
          const map: Record<string, TokenRecordLite> = {};
          await Promise.all(
            ids.map(async (id) => {
              try {
                const res = await (client.models.TokenRecord as unknown as { get: (a: { id: string }) => Promise<{ data: TokenRecordLite | null }> }).get({ id });
                if (res.data) map[id] = res.data;
              } catch {}
            })
          );
          console.log("[send] loadRegistry recordMap", Object.keys(map).length);
          if (!cancelled) setRecordMap(map);
        } else if (!cancelled) setRecordMap({});
      } catch (e) {
        console.warn("[send] loadRegistry error", e);
        if (!cancelled) {
          setMyTokens([]);
          setRecordMap({});
        }
      } finally {
        console.log("[send] loadRegistry done");
        if (!cancelled) setLoadingRegistry(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const unified: UnifiedRow[] = useMemo(() => {
    const map = new Map<string, UnifiedRow>();
    DEFAULT_TOKENS.forEach((t) => {
      const k = `${t.address.toLowerCase()}:${t.chainId}`;
      map.set(k, { key: k, symbol: t.symbol, name: t.name, address: t.address, chainId: t.chainId, decimals: t.decimals, icon: t.icon, source: "default" });
    });
    myTokens.forEach((e) => {
      const k = `${e.tokenAddress.toLowerCase()}:${e.chainId}`;
      if (map.has(k)) return;
      const rec = e.tokenRecordId ? recordMap[e.tokenRecordId] : undefined;
      map.set(k, {
        key: k,
        symbol: e.symbol,
        name: e.name || e.symbol,
        address: e.tokenAddress,
        chainId: e.chainId,
        decimals: e.decimals ?? (rec as unknown as { decimals?: number })?.decimals ?? 18,
        icon: rec?.iconURI || (e as unknown as { iconURI?: string }).iconURI || null,
        source: e.isCustom ? "custom" : "factory",
        ruleMinTier: rec?.ruleMinTier,
        ruleBitmap: rec?.ruleBitmap,
        isWrapped: rec?.isWrapped,
        underlying: rec?.underlying,
      });
    });
    return Array.from(map.values());
  }, [myTokens, recordMap]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? unified : unified.filter((r) => r.chainId === filter);
    const val = (r: UnifiedRow) => {
      const bal = balances[r.key];
      if (bal === undefined) return -1;
      const p = getPriceUsd(r.symbol, priceMap) ?? 0;
      if (!p || bal === BigInt(0)) return 0;
      try {
        return Number(ethers.formatUnits(bal, r.decimals)) * p;
      } catch {
        return 0;
      }
    };
    return [...base].sort((a, b) => val(b) - val(a) || a.symbol.localeCompare(b.symbol));
  }, [unified, filter, balances, priceMap]);

  const fetchPrices = useCallback(async () => {
    try {
      const client = getDataClient();
      const res = await (client.models.AssetPrice as unknown as { list: (a?: unknown) => Promise<{ data: { symbol: string; priceUSD: number }[] }> }).list();
      const map: Record<string, number> = {};
      (res.data || []).forEach((r) => {
        if (r.symbol && typeof r.priceUSD === "number") map[r.symbol] = r.priceUSD;
      });
      setPriceMap(map);
    } catch {}
  }, []);

  const hasPriceValue = Object.keys(priceMap).length > 0;
  const priceDelay = useMemo(() => {
    if (!address || unified.length === 0) return null;
    if (!hasPriceValue) return 5000;
    return 60000;
  }, [address, unified.length, hasPriceValue]);
  useInterval(fetchPrices, priceDelay);
  useEffect(() => {
    if (!address || unified.length === 0) return;
    fetchPrices();
  }, [fetchPrices, address, unified.length]);

  const fetchBalances = useCallback(async () => {
    if (!address || unified.length === 0) {
      console.log("[send] fetchBalances skip empty");
      setBalances({});
      setBalancesLoading(false);
      return;
    }
    const addr = address as string;
    console.log("[send] fetchBalances start", { addr, chains: Array.from(new Set(unified.map((r) => r.chainId))), count: unified.length });
    const t0 = Date.now();
    setBalancesLoading(true);
    const out: Record<string, bigint> = {};
    const byChain = new Map<number, UnifiedRow[]>();
    unified.forEach((r) => {
      const arr = byChain.get(r.chainId) || [];
      arr.push(r);
      byChain.set(r.chainId, arr);
    });
    try {
      await Promise.all(
        Array.from(byChain.entries()).map(async ([chainId, rows]) => {
          const prov: ethers.Provider | null = walletChainId === chainId && provider ? provider : getRpcProvider(chainId);
          console.log("[send] chain start", { chainId, useWallet: !!(walletChainId === chainId && provider), count: rows.length });
          if (!prov) {
            console.warn("[send] no provider", chainId);
            return;
          }
          await Promise.all(
            rows.map(async (r) => {
              const t = Date.now();
              try {
                const c = new ethers.Contract(r.address, ERC20_ABI, prov);
                const bal: bigint = await Promise.race([
                  (c as unknown as { balanceOf(a: string): Promise<bigint> }).balanceOf(addr),
                  new Promise<bigint>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
                ]);
                console.log("[send] balance ok", r.symbol, `${Date.now() - t}ms`, bal.toString());
                out[r.key] = bal;
              } catch (e) {
                console.warn("[send] balance fail", r.symbol, e);
                out[r.key] = BigInt(0);
              }
            })
          );
        })
      );
      console.log("[send] fetchBalances done", { ms: Date.now() - t0, out });
      setBalances(out);
    } catch (e) {
      console.warn("[send] fetch top error", e);
    } finally {
      console.log("[send] fetchBalances finally");
      setBalancesLoading(false);
    }
  }, [address, walletChainId, provider, unified]);

  const hasValue = !!address && unified.length > 0 && Object.keys(balances).length > 0;
  const intervalDelay = useMemo(() => {
    if (!address || unified.length === 0) return null;
    if (!hasValue) return 3000; // no value yet: fast poll
    return 15000; // once fetched: longer
  }, [address, unified.length, hasValue]);

  useInterval(fetchBalances, intervalDelay);

  // immediate fetch on mount / deps change (no value → fast, faucet via balNonce)
  useEffect(() => {
    if (!address || unified.length === 0) return;
    console.log("[send] immediate fetch trigger", { balNonce, unifiedLen: unified.length });
    fetchBalances();
  }, [fetchBalances, balNonce, unified]);

  const totalUsd = useMemo(() => {
    let sum = 0;
    unified.forEach((r) => {
      const bal = balances[r.key] ?? BigInt(0);
      const p = getPriceUsd(r.symbol, priceMap);
      if (p && bal !== BigInt(0)) {
        try {
          sum += Number(ethers.formatUnits(bal, r.decimals)) * p;
        } catch {}
      }
    });
    return sum;
  }, [unified, balances, priceMap]);

  const alloc = useMemo(() => {
    const by: Record<string, number> = {};
    unified.forEach((r) => {
      const bal = balances[r.key];
      if (bal === undefined) return;
      const p = getPriceUsd(r.symbol, priceMap);
      let v = 0;
      try {
        v = Number(ethers.formatUnits(bal, r.decimals)) * p;
      } catch {}
      by[r.symbol] = (by[r.symbol] || 0) + v;
    });
    const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    return { by, total };
  }, [unified, balances, priceMap]);

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="rounded-xl border border-border bg-panel overflow-hidden grid md:grid-cols-[260px_1fr] flex-1 min-h-0">
        <SendSidebar address={address} walletChainId={walletChainId} totalUsd={totalUsd} balancesLoading={balancesLoading} balancesCount={Object.keys(balances).length} filter={filter} setFilter={setFilter} alloc={alloc} onRefresh={() => setBalNonce((n) => n + 1)} identity={identity} />
        <div className="divide-y divide-border bg-canvas/30 overflow-y-auto min-h-0">
          <TokenList filtered={filtered} balances={balances} address={address} loadingRegistry={loadingRegistry} filter={filter} openMenu={openMenu} setOpenMenu={setOpenMenu} setFaucetToken={setFaucetToken} setSendRow={setSendRow} priceMap={priceMap} />
        </div>
      </div>
      <SendDrawer open={!!sendRow} row={sendRow!} balance={sendRow ? balances[sendRow.key] : undefined} onClose={() => setSendRow(null)} onSend={() => { setBalNonce((n) => n + 1); }} onSuccess={(d) => setSuccessDetails({ ...d, chainId: String(sendRow!.chainId), symbol: sendRow!.symbol })} priceMap={priceMap} ownerId={ownerId} ownerProfile={ownerProfile} walletAddress={address} signer={signer} walletChainId={walletChainId} />
      <SendSuccessModal
        open={!!successDetails}
        onClose={() => setSuccessDetails(null)}
        amount={successDetails?.amount || ""}
        symbol={successDetails?.symbol || ""}
        recipient={successDetails?.recipient || ""}
        txHash={successDetails?.txHash || null}
        chainId={Number(successDetails?.chainId) || 11155111}
      />
      <FaucetModal open={!!faucetToken} token={faucetToken} onClose={() => setFaucetToken(null)} onMinted={() => setBalNonce((n) => n + 1)} />
    </div>
  );
}
