"use client";

import { useState } from "react";

export default function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden">
      {title && <div className="px-4 py-2 border-b border-border text-xs text-muted font-mono">{title}</div>}
      <div className="relative">
        <pre className="p-4 pr-12 text-xs leading-5 overflow-x-auto font-mono text-white/90 whitespace-pre-wrap break-all">
          <code>{code}</code>
        </pre>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className={`absolute top-2 right-2 px-2.5 py-1 rounded-md text-xs border transition-colors ${copied ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-canvas border-white/10 text-muted hover:text-white"}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {lang && <div className="px-4 py-1 bg-canvas/50 text-[10px] tracking-wide text-muted font-mono border-t border-border">{lang}</div>}
    </div>
  );
}
