"use client";

import { useState, useEffect } from "react";
import {
  Search, MapPin, Star, Phone, Globe, Download,
  Loader2, Filter, ChevronDown, Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { MOCK_LEADS, NICHES, CITIES } from "@/lib/mock-data";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

function generateLeads(niche: string, city: string, count: number): Lead[] {
  const streets = ["rue de la Paix", "avenue du Général de Gaulle", "bd Victor Hugo", "chemin des Acacias", "impasse des Lilas", "rue Gambetta", "avenue Foch", "rue du Commerce"];
  const names   = ["Dupont", "Martin", "Bernard", "Lefèvre", "Moreau", "Simon", "Laurent", "Garnier", "Fontaine", "Rousseau", "Blanc", "Girard", "Petit", "Renaud", "Morel"];
  return Array.from({ length: count }, (_, i) => ({
    id:           `gen-${Date.now()}-${i}`,
    name:         `${niche} ${names[i % names.length]}`,
    category:     niche,
    phone:        `06 ${String(Math.floor(10 + Math.random() * 90)).padStart(2,"0")} ${String(Math.floor(10 + Math.random() * 90)).padStart(2,"0")} ${String(Math.floor(10 + Math.random() * 90)).padStart(2,"0")} ${String(Math.floor(10 + Math.random() * 90)).padStart(2,"0")}`,
    address:      `${Math.floor(1 + Math.random() * 200)} ${streets[i % streets.length]}`,
    city,
    rating:       Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    reviewCount:  Math.floor(5 + Math.random() * 500),
    website:      Math.random() > 0.4 ? `${niche.toLowerCase().replace(/\s/g, "-")}-${names[i % names.length].toLowerCase()}.fr` : undefined,
    status:       "new" as const,
    notes:        "",
    detectedAt:   new Date().toISOString(),
    source:       "google_maps" as const,
    callCount:    0,
  }));
}

export default function LeadsPage() {
  const [niche,      setNiche]      = useState("Plombier");
  const [city,       setCity]       = useState("Lyon");
  const [radius,     setRadius]     = useState(20);
  const [minRating,  setMinRating]  = useState(0);
  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [sortBy,     setSortBy]     = useState<"rating" | "reviews" | "name">("rating");

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 1800));
    const count = Math.floor(80 + Math.random() * 420);
    const raw   = generateLeads(niche, city, count);
    setLeads(raw.filter((l) => l.rating >= minRating));
    setLoading(false);
  }

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
    const a    = document.createElement("a"); a.href = url; a.download = `leads-${niche}-${city}.csv`; a.click();
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
            <h2 className="text-sm font-bold text-white mb-4">
              Configure ta recherche Google Maps
            </h2>
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
                <label className="text-xs text-white/40 mb-1.5 block">Note minimum : {minRating > 0 ? `★ ${minRating}+` : "Toutes"}</label>
                <input type="range" min={0} max={4} step={0.5} value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1 mt-3" />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className={cn(
                "btn-primary flex items-center gap-2 text-sm px-8 py-3",
                loading && "opacity-70 cursor-not-allowed"
              )}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping en cours…</>
                : <><Zap className="w-4 h-4" /> Lancer la recherche</>
              }
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="glass rounded-2xl p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Scraping Google Maps…</p>
              <p className="text-sm text-white/40">
                Extraction des {niche.toLowerCase()}s à {city} dans un rayon de {radius} km
              </p>
              <div className="mt-4 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-xs mx-auto">
                <div className="h-full bg-brand-500 rounded-full animate-[progress_1.8s_ease-in-out]" />
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && searched && leads.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{leads.length} leads trouvés</span>
                  <span className="text-white/40 text-sm">— {niche}s à {city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-white/30" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="select w-auto text-xs py-1.5 px-3">
                    <option value="rating">Trier par note</option>
                    <option value="reviews">Trier par avis</option>
                    <option value="name">Trier par nom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map((lead) => (
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
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] btn-primary py-1.5 px-2">
                        <Phone className="w-3 h-3" /> Appeler
                      </a>
                      <a href="/dashboard"
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] btn-outline py-1.5 px-2">
                        + CRM
                      </a>
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
