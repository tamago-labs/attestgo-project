"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Radio,
  FileDown,
  ArrowUpFromLine,
  ArrowDownToLine,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { label: "Inbox", href: "/app", icon: Inbox },
  { label: "Streams", href: "/app/payment-streams", icon: Radio },
  { label: "Lend", href: "/app/pools", icon: ArrowUpFromLine },
  { label: "Borrow", href: "/app/borrow", icon: ArrowDownToLine },
  { label: "Travel Rule", href: "/app/travel-rule", icon: FileDown },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col border-r border-border bg-panel transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="font-display font-semibold text-lg tracking-tight text-white">
              tama
            </span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, #FDB750, #8B7CF0)",
                color: "#0A0D13",
              }}
            >
              GO
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors ml-auto"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group ${
                active
                  ? "text-[#E2E8F0]"
                  : "text-muted hover:text-[#E2E8F0]"
              }`}
            >
              {active && (
                <span className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(253,183,80,0.4), rgba(139,124,240,0.4))" }} />
              )}
              <Icon size={18} className={`shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-110 ${active ? "drop-shadow-[0_0_6px_rgba(253,183,80,0.6)]" : ""}`} />
              {!collapsed && <span className="relative z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
