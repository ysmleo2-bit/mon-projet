"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import DealCard from "./DealCard";
import AirportSelector from "./AirportSelector";
import type { GlitchDeal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getAirport } from "@/lib/airports";

const TABS = ["Tous", "GLITCH", "FLASH", "DEAL", "WATCH"] as const;
type Tab = typeof TABS[number];

const STORAGE_KEY = "glitch_airport";
const DEFAULT_AIRPORT = "BVA";

export default function DealFeedSection({ initialDeals }: { initialDeals: GlitchDeal[] }) {
  const [deals,   setDeals]   = useState<GlitchDeal[]>(initialDeals);
  const [loading, setLoading] = useState(false);
  const [airport, setAirport] = useState(DEFAULT_AIRPORT);
  const [tab,     setTab]     = useState<Tab>("Tous");

  const filtered = tab === "Tous" ? deals : deals.filter(d => d.analysis.category === tab);

  const fetchDeals = useCallback(async (ap: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/deals?from=${ap}`);
      const json = await res.json();
      setDeals(json.deals ?? []);
    } catch {
      // garde les deals actuels
    } finally {
      setLoading(false);
    }
  }, []);

  function handleAirportChange(code: string) {
    setAirport(code);
    localStorage.setItem(STORAGE_KEY, code);
    setTab("Tous");
    fetchDeals(code);
  }

  // Restaurer l'aéroport sauvegardé au montage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== DEFAULT_AIRPORT) {
      setAirport(saved);
      fetchDeals(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ap = getAirport(airport);

  return (
    <section className="max-w-4xl mx-auto px-4 pb-20">
      {/* Header avec sélecteur */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs text-white/30 mono mb-2 uppercase tracking-widest">Votre aéroport de départ</div>
          <AirportSelector value={airport} onChange={handleAirportChange} size="lg" />
          {ap && (
            <div className="mt-1.5 text-[11px] text-white/25 mono">
              {ap.liveData
                ? "✓ Données temps réel · mises à jour toutes les 30 min"
                : "Liens Kayak · prix réels à la réservation"}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Link href={`/feed?from=${airport}`}
            className="text-xs text-glitch-green hover:text-emerald-400 flex items-center gap-1 transition-colors mono">
            Voir tout depuis {airport} <ChevronRight className="w-3 h-3" />
          </Link>
          {!loading && (
            <span className="text-[10px] text-white/25 mono">
              {deals.filter(d => d.status === "live").length} offres actives
            </span>
          )}
        </div>
      </div>

      {/* Onglets catégories */}
      <div className="flex gap-1 bg-ink-800 border border-white/[0.06] rounded-xl p-1 mb-5 w-fit">
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

      {/* Deals */}
      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-glitch-green" />
            <span>Scan des deals depuis {airport}…</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass rounded-2xl h-28 animate-pulse border border-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.slice(0, 6).map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>

          {filtered.length > 6 && (
            <div className="text-center mt-6">
              <Link href={`/feed?from=${airport}`} className="btn-outline inline-flex items-center gap-2">
                Voir les {filtered.length - 6} autres offres <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
