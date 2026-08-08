"use client";

import { useState, useCallback } from "react";
import {
  Search, MapPin, Star, Phone, Globe, Download,
  Loader2, Filter, ChevronDown, Zap, Check, Database,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { NICHES, CITIES } from "@/lib/mock-data";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const [niche,      setNiche]      = useState("Plombier");
  const [city,       setCity]       = useState("Lyon");
  const [radius,     setRadius]     = useState(20);
  const [minRating,  setMinRating]  = useState(0);
  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [sortBy,     setSortBy]     = useState<"rating" | "reviews" | "name">("rating");
  const [progress,   setProgress]   = useState(0);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSavedCount(0);
    setProgress(0);

    // Animate progress bar
    const interval = setInterval(() => setProgress((p) => Math.min(p + 8, 92)), 120);

    try {
      const res  = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, city, radius, minRating }),
      });
      const json = await res.json();
      setLeads(json.leads ?? []);
      setSavedCount(json.total ?? 0);  // déjà sauvegardés dans l'API
      setProgress(100);
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [niche, city, radius, minRating]);

  const sorted = [...leads].sort((a, b) => {
    if (sortBy === "rating")  return b.rating - a.rating;
    if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
    return a.name.localeCompare(b.name);
  });

  function exportCsv() {
    const header = "Nom,Catégorie,Téléphone,Adresse,Ville,Note,Avis,Site";
    const rows   = leads.map((l) =>
      `"${l.name}","${l.category}","${l.phone}","${l.address}","${l.city}",${l.rating},${l.reviewCount},"${l.website ?? ""}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `leads-${niche}-${city}.csv`; a.click();
  }

  async function addToCrm(lead: Lead) {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([lead]),
    });
    // Visual feedback — on marque le lead comme ajouté
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, _added: true } as any : l));
  }

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-400" /> Recherche de leads
          </h1>
          {leads.length > 0 && (
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 text-xs btn-outline py-2">
              <Download className="w-3.5 h-3.5" /> Export CSV ({leads.length})
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Search form */}
          <div className="glass rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold text-white mb-1">Scraper Google Maps</h2>
            <p className="text-xs text-white/35 mb-4">Les leads trouvés sont automatiquement sauvegardés dans ton CRM.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Niche */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Secteur d&apos;activité</label>
                <div className="relative">
                  <select value={niche} onChange={(e) => setNiche(e.target.value)} className="select pr-8">
                    {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
              {/* City */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Ville / Zone</label>
                <div className="relative">
                  <select value={city} onChange={(e) => setCity(e.target.value)} className="select pr-8">
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
              {/* Radius */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Rayon : {radius} km</label>
                <input type="range" min={5} max={100} step={5} value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer h-1 mt-3" />
              </div>
              {/* Min rating */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Note min : {minRating > 0 ? `★ ${minRating}+` : "Toutes"}</label>
                <input type="range" min={0} max={4} step={0.5} value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1 mt-3" />
              </div>
            </div>

            <button onClick={handleSearch} disabled={loading}
              className={cn("btn-primary flex items-center gap-2 text-sm px-8 py-3", loading && "opacity-70 cursor-not-allowed")}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping en cours…</>
                : <><Zap className="w-4 h-4" /> Lancer la recherche</>}
            </button>
          </div>

          {/* Progress */}
          {loading && (
            <div className="glass rounded-2xl p-6 mb-6 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-brand-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Extraction Google Maps…</p>
              <p className="text-sm text-white/40">{niche}s à {city} dans un rayon de {radius} km</p>
              <div className="mt-4 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-xs mx-auto">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-white/25 mt-2">{progress}%</p>
            </div>
          )}

          {/* Saved banner */}
          {!loading && savedCount > 0 && (
            <div className="flex items-center gap-3 glass-blue rounded-xl px-4 py-3 mb-4 border border-brand-500/25">
              <Database className="w-4 h-4 text-brand-400 shrink-0" />
              <p className="text-sm text-brand-300">
                <strong>{savedCount} leads</strong> ajoutés automatiquement à ton CRM — va sur{" "}
                <a href="/dashboard" className="underline">le Dashboard</a> pour les voir.
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && leads.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{leads.length} leads trouvés</span>
                  <span className="text-white/40 text-sm">— {niche}s à {city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-white/30" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "rating" | "reviews" | "name")}
                    className="select w-auto text-xs py-1.5 px-3">
                    <option value="rating">Trier par note</option>
                    <option value="reviews">Trier par avis</option>
                    <option value="name">Trier par nom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map((lead: any) => (
                  <div key={lead.id} className="glass rounded-xl p-4 hover:border-white/15 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{lead.name}</h3>
                        <p className="text-xs text-white/40">{lead.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-amber-400 text-sm font-bold">★ {lead.rating}</div>
                        <div className="text-[10px] text-white/30">{lead.reviewCount} avis</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-white/50 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-brand-400 shrink-0" />
                        <span className="font-mono text-brand-400">{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{lead.address}</span>
                      </div>
                      {lead.website && (
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate text-brand-400/70">{lead.website}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a href={`tel:${lead.phone.replace(/\s/g,"")}`}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] btn-primary py-1.5">
                        <Phone className="w-3 h-3" /> Appeler
                      </a>
                      <button onClick={() => addToCrm(lead)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-xl border transition-all",
                          lead._added
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "btn-outline"
                        )}>
                        {lead._added ? <><Check className="w-3 h-3" /> Ajouté</> : <><Database className="w-3 h-3" /> CRM</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div className="text-center py-20 text-white/25">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-white/40 mb-2">Lance ta première recherche</p>
              <p className="text-sm">Configure le secteur et la ville, puis clique sur &quot;Lancer la recherche&quot;</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
