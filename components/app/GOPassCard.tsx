"use client";

import Image from "next/image";

type Props = {
  wallet: string;
  tierLabel?: string; // e.g. Silver
  country: string; // US
  group?: string; // DE or ""
  verifiedUntil?: string; // 09/29
  expiryLabel?: string; // Aug 2027
  kycSource?: string; // sumsub
  status?: "Active" | "Pending" | "Frozen";
  name?: string;
  className?: string;
};

function shortWallet(addr: string) {
  if (!addr || addr.length < 10) return addr || "0x ———— •••• ————";
  return `${addr.slice(0, 6)} •••• ${addr.slice(-4)}`;
}

export default function GOPassCard({
  wallet,
  tierLabel = "Silver",
  country = "US",
  group = "DE",
  verifiedUntil = "09/29",
  expiryLabel,
  kycSource,
  status = "Active",
  name = "ALEX RIVERA",
  className,
}: Props) {
  const statusColor =
    status === "Active"
      ? "border-amber/20 bg-amber/15 text-amber"
      : status === "Pending"
        ? "border-violet-400/20 bg-violet-500/15 text-violet-300"
        : "border-red-500/20 bg-red-500/10 text-red-300";

  return (
    <div
      className={`relative w-full aspect-[1.586/1] min-h-[200px] rounded-2xl overflow-hidden bg-canvas border border-white/10 p-5 sm:p-6 flex flex-col shadow-xl ${className ?? ""}`}
    >
      {/* Holographic sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          background:
            "linear-gradient(115deg, transparent 20%, #FDB750 35%, #8B7CF0 45%, #5CC8FF 55%, transparent 70%)",
          backgroundSize: "200% 200%",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Top row */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-sm tracking-tight text-white">
            attest
            <span
              className="inline-flex items-center ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest"
              style={{ background: "linear-gradient(135deg,#FDB750,#8B7CF0)", color: "#0A0D13" }}
            >
              GO
            </span>
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-[9px] font-semibold tracking-wider text-white/60 uppercase">
            {tierLabel}
          </span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusColor}`}>
          {status}
        </span>
      </div>

      {/* Wallet */}
      <div className="relative z-10 mt-6 sm:mt-7">
        <div className="font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase">Wallet address</div>
        <div className="mt-1 font-mono text-sm sm:text-base tracking-[0.12em] text-white/90">{shortWallet(wallet)}</div>
        <div className="mt-1.5 font-mono text-[10px] leading-tight text-white/40">Works on any chain with Attestcoin Protocol</div>
      </div>

      {/* Bottom */}
      <div className="relative z-10 mt-auto flex items-end justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.15em] text-white/50">{name}</div>
          <div className="mt-1 font-mono text-[10px] text-white/60 flex items-center gap-2">
            <span>
              {country}
              {group ? `-${group}` : ""}
            </span>
            <span className="text-white/25">•</span>
            <span>Verified until {verifiedUntil}</span>
          </div>
        </div>
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-white p-1 shrink-0 overflow-hidden">
          <Image src="/pass-qr.png" alt="Pass QR" width={56} height={56} className="w-full h-full object-contain" />
        </div>
      </div>
    </div>
  );
}
