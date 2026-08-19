"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, User, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Vols" },
  { href: "/hotels", label: "Hôtels" },
  { href: "/alerts", label: "Alertes" },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-4 sm:px-6">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-aeris-600 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight gradient-text">AERIS</span>
          <span className="hidden sm:inline text-xs text-white/30 font-normal ml-1 mt-0.5">True Price Engine</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                path === href
                  ? "bg-aeris-600/20 text-aeris-300 border border-aeris-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {label}
            </Link>
          ))}
          <button className="ml-2 flex items-center gap-1 text-sm text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-all">
            Plus <ChevronDown className="w-3 h-3" />
          </button>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="relative p-2 rounded-lg hover:bg-white/[0.08] text-white/60 hover:text-white transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aeris-500 rounded-full border border-sky-950" />
          </button>
          <button className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 transition-all">
            <div className="w-7 h-7 rounded-full bg-aeris-700 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-aeris-200" />
            </div>
            <span className="hidden sm:inline text-sm text-white/70">Mon compte</span>
          </button>
        </div>
      </div>

      {/* Blur backdrop */}
      <div className="absolute inset-0 -z-10 bg-sky-950/80 backdrop-blur-xl border-b border-white/[0.06]" />
    </header>
  );
}
