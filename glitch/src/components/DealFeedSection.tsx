"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import DealCard from "./DealCard";
import type { GlitchDeal } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Tous", "GLITCH", "FLASH", "DEAL", "WATCH"] as const;
type Tab = typeof TABS[number];

export default function DealFeedSection({ deals }: { deals: GlitchDeal[] }) {
  const [tab, setTab] = useState<Tab>("Tous");

  const filtered = tab === "Tous"
    ? deals
    : deals.filter(d => d.analysis.category === tab);

  return (
    <section className="max-w-4xl mx-auto px-4 pb-20">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-ink-800 border border-white/[0.06] rounded-xl p-1">
          {TABS.map(t => {
            const count = t === "Tous" ? deals.length : deals.filter(d => d.analysis.category === t).length;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg font-medium mono transition-all",
                  tab === t
                    ? t === "GLITCH" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                      t === "FLASH"  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" :
                      t === "DEAL"   ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      t === "WATCH"  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" :
                                       "bg-white/10 text-white border border-white/15"
                    : "text-white/40 hover:text-white"
                )}>
                {t} {count > 0 && <span className="ml-1 opacity-50">({count})</span>}
              </button>
            );
          })}
        </div>

        <Link href="/feed" className="text-xs text-glitch-green hover:text-emerald-400 flex items-center gap-1 transition-colors mono">
          Voir tout <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {filtered.slice(0, 6).map(deal => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>

      {filtered.length > 6 && (
        <div className="text-center mt-6">
          <Link href="/feed" className="btn-outline inline-flex items-center gap-2">
            Voir les {filtered.length - 6} autres offres <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
