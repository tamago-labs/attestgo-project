"use client";
import { useState } from "react";

export default function TokenIcon({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setErr(true)}
        className="rounded-lg object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-mono text-white/60 shrink-0"
    >
      {symbol.slice(0, 4)}
    </div>
  );
}
