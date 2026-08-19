"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, BarChart2, ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/prospection", label: "Prospection B2B", icon: Target },
  { href: "/dashboard",   label: "CRM",             icon: BarChart2 },
  { href: "/app",         label: "Appeler",          icon: Phone },
];

// Bandeau de conformité : indique si on est dans le créneau légal d'appel
// B2B en France (lun-ven 10h-13h / 14h-20h, heure de Paris).
// Voir src/lib/compliance.ts et /api/compliance/call-window.
function CallWindowBadge() {
  const [status, setStatus] = useState<{ open: boolean; reason: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res  = await fetch("/api/compliance/call-window");
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch { /* ignore */ }
    }
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!status) return null;

  return (
    <div
      className={cn(
        "glass rounded-xl p-3 text-xs font-medium border",
        status.open
          ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10"
          : "text-red-300 border-red-500/25 bg-red-500/10"
      )}
      title={status.reason ?? undefined}
    >
      {status.open
        ? "🟢 Créneau d'appel ouvert"
        : `🔴 Appels non recommandés${status.reason ? ` (${status.reason})` : ""}`}
    </div>
  );
}

export default function Navbar({ variant = "app" }: { variant?: "landing" | "app" }) {
  const path = usePathname();

  if (variant === "landing") {
    return (
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white text-lg">ColdCaller</span>
            <span className="badge bg-brand-500/20 text-brand-300 border border-brand-500/30 ml-1">PRO</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/#features", label: "Fonctionnalités" },
              { href: "/pricing",   label: "Tarifs" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-lg hover:bg-white/[0.05] transition-all">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">
              Connexion
            </Link>
            <Link href="/pricing" className="btn-primary text-sm py-2 px-5 flex items-center gap-1.5">
              Essai gratuit <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/[0.06] bg-ink-950">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Phone className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white text-base">ColdCaller</span>
        </Link>
      </div>

      {/* Créneau d'appel légal */}
      <div className="px-3 pt-4">
        <CallWindowBadge />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-brand-500/15 text-brand-300 border border-brand-500/25"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              )}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Credits */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Leads restants</span>
            <span className="text-xs font-bold text-brand-400">143 / 300</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: "48%" }} />
          </div>
          <Link href="/pricing" className="mt-3 text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
            Passer au Pro <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
