"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATS } from "@/lib/mock-deals";

const NAV = [
  { href: "/",       label: "Live Feed" },
  { href: "/feed",   label: "Toutes les offres" },
  { href: "/alerts", label: "Mes alertes" },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-glitch-green flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(0,230,118,0.5)] transition-all">
            <Zap className="w-3.5 h-3.5 text-black fill-black" />
          </div>
          <span className="text-base font-bold tracking-tight mono text-white group-hover:text-glitch-green transition-colors">
            GLITCH
          </span>
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/30 mono ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-glitch-green live-dot" />
            {STATS.liveNow} offres actives
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg transition-all",
                path === href
                  ? "text-glitch-green bg-glitch-green/10 font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              )}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link href="/alerts"
            className="flex items-center gap-1.5 text-xs font-medium bg-glitch-green/10 border border-glitch-green/30 text-glitch-green hover:bg-glitch-green/20 px-3 py-1.5 rounded-lg transition-all mono">
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Créer une alerte</span>
          </Link>
        </div>
      </div>

      {/* Border */}
      <div className="absolute inset-0 -z-10 bg-ink-950/90 backdrop-blur-xl border-b border-white/[0.05]" />
    </header>
  );
}
