"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, Zap, Loader2 } from "lucide-react";
import DealCard from "./DealCard";
import AirportSelector from "./AirportSelector";
import type { GlitchDeal, GlitchCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "confidence" | "saving" | "detected" | "expiry";

const STORAGE_KEY = "glitch_airport";
const DEFAULT_AIRPORT = "BVA";

export default function FeedClient({ initialDeals }: { initialDeals: GlitchDeal[] }) {
  const [deals,        setDeals]        = useState<GlitchDeal[]>(initialDeals);
  const [loading,      setLoading]      = useState(false);
  const [airport,      setAirport]      = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_AIRPORT;
    return DEFAULT_AIRPORT;
  });

  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState<GlitchCategory | "ALL">("ALL");
  const [statusFilter, setStatus]       = useState<"live" | "all">("live");
  const [sortKey,      setSortKey]      = useState<SortKey>("confidence");
  const [minConf,      setMinConf]      = useState(0);
  const [cabinFilter,  setCabin]        = useState<"all"|"economy"|"business"|"first">("all");

  // Charger les deals depuis l'API pour un aéroport donné
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

  // Changer d'aéroport → persist + refetch
  function handleAirportChange(code: string) {
    setAirport(code);
    localStorage.setItem(STORAGE_KEY, code);
    fetchDeals(code);
    // Reset les filtres
    setSearch("");
    setCatFilter("ALL");
  }

  // Charger les deals de l'aéroport sauvegardé au montage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== DEFAULT_AIRPORT) {
      setAirport(saved);
      fetchDeals(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return deals
      .filter(d => {
        if (statusFilter === "live" && d.status !== "live") return false;
        if (catFilter !== "ALL" && d.analysis.category !== catFilter) return false;
        if (d.analysis.confidence < minConf) return false;
        if (cabinFilter !== "all" && d.cabin !== cabinFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!d.from.toLowerCase().includes(q) &&
              !d.to.toLowerCase().includes(q)   &&
              !d.fromCode.toLowerCase().includes(q) &&
              !d.toCode.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "confidence") return b.analysis.confidence - a.analysis.confidence;
        if (sortKey === "saving")     return b.analysis.saving - a.analysis.saving;
        if (sortKey === "detected")   return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        if (sortKey === "expiry")     return new Date(a.expiresEstimate).getTime() - new Date(b.expiresEstimate).getTime();
        return 0;
      });
  }, [deals, search, catFilter, statusFilter, sortKey, minConf, cabinFilter]);

  return (
    <>
      {/* Airport selector + controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Airport selector — élément principal */}
        <div className="sm:w-64 shrink-0">
          <AirportSelector value={airport} onChange={handleAirportChange} size="md" />
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Destination, code IATA…"
            className="g-input pl-9" />
        </div>

        {/* Sort */}
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="g-input w-auto cursor-pointer">
          <option value="confidence">Trier : Confiance</option>
          <option value="saving">Trier : Économies €</option>
          <option value="detected">Trier : Plus récent</option>
          <option value="expiry">Trier : Expire bientôt</option>
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["ALL","GLITCH","FLASH","DEAL","WATCH"] as const).map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border mono font-medium transition-all",
              catFilter === c
                ? c === "GLITCH" ? "bg-purple-500/25 border-purple-400/50 text-purple-300" :
                  c === "FLASH"  ? "bg-orange-500/25 border-orange-400/50 text-orange-300" :
                  c === "DEAL"   ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-300" :
                  c === "WATCH"  ? "bg-sky-500/25 border-sky-400/50 text-sky-300" :
                                   "bg-white/15 border-white/30 text-white"
                : "bg-transparent border-white/[0.08] text-white/40 hover:text-white"
            )}>
            {c === "ALL" ? "Tout" : c}
          </button>
        ))}

        <div className="w-px bg-white/[0.07] mx-1" />

        {(["live","all"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border mono transition-all",
              statusFilter === s ? "bg-white/10 border-white/25 text-white" : "bg-transparent border-white/[0.08] text-white/40 hover:text-white"
            )}>
            {s === "live" ? "🟢 Actives" : "Toutes"}
          </button>
        ))}

        <div className="w-px bg-white/[0.07] mx-1" />

        {([["all","Toutes classes"],["economy","Éco"],["business","Business"],["first","Première"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setCabin(v)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border mono transition-all",
              cabinFilter === v ? "bg-white/10 border-white/25 text-white" : "bg-transparent border-white/[0.08] text-white/40 hover:text-white"
            )}>
            {l}
          </button>
        ))}
      </div>

      {/* Confidence slider */}
      <div className="flex items-center gap-4 mb-6 glass rounded-xl px-4 py-3 border border-white/[0.06]">
        <SlidersHorizontal className="w-4 h-4 text-white/30 shrink-0" />
        <span className="text-xs text-white/40 shrink-0">Confiance min</span>
        <input type="range" min={0} max={90} step={5} value={minConf}
          onChange={e => setMinConf(Number(e.target.value))}
          className="flex-1 accent-glitch-green cursor-pointer h-1" />
        <span className="text-xs font-bold mono text-glitch-green w-10 text-right">{minConf}%</span>
      </div>

      {/* Count + loading indicator */}
      <div className="flex items-center gap-2 mb-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 className="w-4 h-4 animate-spin text-glitch-green" />
            <span>Chargement des deals depuis {airport}…</span>
          </div>
        ) : (
          <p className="text-sm text-white/40">
            {filtered.length} offre{filtered.length > 1 ? "s" : ""} depuis{" "}
            <span className="text-white font-semibold">{airport}</span>
            {" "}· classées par confiance
          </p>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="glass rounded-2xl h-32 animate-pulse border border-white/[0.04]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30 mono">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Aucune offre pour ces critères depuis {airport}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-8 glass rounded-xl p-4 border border-white/[0.06]">
        <div className="flex flex-wrap gap-6 text-xs text-white/30 mono">
          <span>Chargé : {deals.length} offres</span>
          <span>Actives : {deals.filter(d => d.status === "live").length}</span>
          <span>GLITCH : {deals.filter(d => d.analysis.category === "GLITCH").length}</span>
          <span>Confirmations : {deals.reduce((s, d) => s + d.confirmations, 0)}</span>
        </div>
      </div>
    </>
  );
}
