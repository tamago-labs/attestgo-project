import { ethers } from "ethers";
import { getChainById } from "@/lib/chains";

export function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}
export function chainName(id: number) {
  return getChainById(id)?.shortName || String(id);
}

const COUNTRIES = ["us", "sg", "jp", "hk", "de", "cn", "gb", "fr", "ae", "ch"] as const;
export function bitmapToCountries(bitmap: string | string[] | bigint): string {
  if (Array.isArray(bitmap)) return (bitmap as string[]).map((c) => String(c).toUpperCase()).join(", ") || "All";
  if (typeof bitmap === "bigint") {
    const out: string[] = [];
    const one = BigInt(1);
    const zero = BigInt(0);
    COUNTRIES.forEach((c, i) => {
      if ((bitmap & (one << BigInt(i))) !== zero) out.push(c.toUpperCase());
    });
    return out.length ? out.join(", ") : "All";
  }
  const s = String(bitmap || "");
  if (!s || s === "0") return "All";
  try {
    const n = BigInt(s);
    const zero = BigInt(0);
    const one = BigInt(1);
    if (n === zero) return "All";
    const out: string[] = [];
    COUNTRIES.forEach((c, i) => {
      if ((n & (one << BigInt(i))) !== zero) out.push(c.toUpperCase());
    });
    return out.length ? out.join(", ") : s;
  } catch {
    return s.toUpperCase();
  }
}

export function formatUnits(raw: bigint, decimals: number) {
  try {
    const s = ethers.formatUnits(raw, decimals);
    const n = Number(s);
    if (Number.isNaN(n)) return s;
    if (n === 0) return "0";
    if (n < 0.001) return n.toFixed(6).replace(/\.?0+$/, "");
    if (n < 1) return n.toFixed(4).replace(/\.?0+$/, "");
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return raw.toString();
  }
}
export function fmtUsd(raw: bigint, decimals: number, symbol: string, priceMap?: Record<string, number>) {
  if (raw === BigInt(0)) return "$0.00";
  const p = priceMap?.[symbol] ?? 0;
  if (p === 0) return "$0.00";
  try {
    const bal = Number(ethers.formatUnits(raw, decimals));
    return `$${(bal * p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return "$0.00";
  }
}
export function getPriceUsd(symbol: string, priceMap?: Record<string, number>): number {
  return priceMap?.[symbol] ?? 0;
}

// cache static JSON-RPC providers per chain
const RPC_CACHE = new Map<number, ethers.JsonRpcProvider>();
export function getRpcProvider(chainId: number): ethers.JsonRpcProvider | null {
  const chain = getChainById(chainId);
  if (!chain) return null;
  let p = RPC_CACHE.get(chainId);
  if (!p) {
    p = new ethers.JsonRpcProvider(chain.rpcUrl);
    RPC_CACHE.set(chainId, p);
  }
  return p;
}

export type TokenRecordLite = {
  id: string;
  tokenAddress: string;
  chainId: number;
  ruleMinTier: number;
  ruleBitmap: string;
  isWrapped: boolean;
  underlying?: string | null;
  iconURI?: string | null;
};

export type UnifiedRow = {
  key: string;
  symbol: string;
  name: string;
  address: string;
  chainId: number;
  decimals: number;
  icon?: string | null;
  source: "default" | "factory" | "custom";
  ruleMinTier?: number;
  ruleBitmap?: string;
  isWrapped?: boolean;
  underlying?: string | null;
};
