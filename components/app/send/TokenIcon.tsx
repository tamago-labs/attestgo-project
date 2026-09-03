"use client";

import { useState } from "react";

export default function TokenIcon({ icon, symbol, size = 28 }: { icon?: string | null; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!icon || err) {
    return (
      <div style={{ width: size, height: size }} className="rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={icon} alt={symbol} width={size} height={size} onError={() => setErr(true)} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}
