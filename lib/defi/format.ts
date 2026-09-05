export function fmtAmount(value: bigint, decimals: number, maxFrac = 6): string {
  const str = `${value}`;
  if (value === 0n) return "0";
  if (str.length <= decimals) {
    // value < 1 unit
    const frac = str.padStart(decimals + 1, "0").slice(decimals).slice(0, maxFrac);
    const trimmed = frac.replace(/0+$/, "") || "0";
    return `0.${trimmed}`;
  }
  const int = str.slice(0, str.length - decimals) || "0";
  let frac = str.slice(str.length - decimals).slice(0, maxFrac).replace(/0+$/, "");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${withSep}.${frac}` : withSep;
}

export function fmtFixed(value: number, frac = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

export function fmtUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(fraction: number, frac = 2): string {
  if (!Number.isFinite(fraction) || fraction < 0) return "—";
  return `${(fraction * 100).toFixed(frac)}%`;
}

export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
