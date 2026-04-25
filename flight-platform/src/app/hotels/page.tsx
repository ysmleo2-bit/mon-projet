"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, Star, SlidersHorizontal, ArrowUpDown, Loader2, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import HotelCard from "@/components/HotelCard";
import { MOCK_HOTELS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type HotelSort = "score" | "price" | "rating" | "distance";

const SORT_OPTS: { value: HotelSort; label: string }[] = [
  { value: "score", label: "Score AERIS" },
  { value: "price", label: "Prix" },
  { value: "rating", label: "Note" },
  { value: "distance", label: "Distance" },
];

function HotelsContent() {
  const params = useSearchParams();
  const city = params.get("city") ?? "New York";

  const [sortBy, setSortBy] = useState<HotelSort>("score");
  const [maxPrice, setMaxPrice] = useState(500);
  const [minStars, setMinStars] = useState(0);
  const [breakfast, setBreakfast] = useState(false);
  const [refundable, setRefundable] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return MOCK_HOTELS.filter((h) => {
      if (h.pricePerNight > maxPrice) return false;
      if (h.stars < minStars) return false;
      if (breakfast && !h.breakfast) return false;
      if (refundable && !h.isRefundable) return false;
      if (search && !h.name.toLowerCase().includes(search.toLowerCase()) &&
          !h.neighborhood.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "score") return b.score.total - a.score.total;
      if (sortBy === "price") return a.pricePerNight - b.pricePerNight;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "distance") return a.distanceCenter - b.distanceCenter;
      return 0;
    });
  }, [sortBy, maxPrice, minStars, breakfast, refundable, search]);

  const priceMin = Math.min(...MOCK_HOTELS.map((h) => h.pricePerNight));
  const priceMax = Math.max(...MOCK_HOTELS.map((h) => h.pricePerNight));

  return (
    <div className="min-h-screen bg-sky-950">
      <Navbar />

      {/* Header */}
      <div className="pt-24 pb-8 px-4 bg-gradient-to-b from-sky-950/80 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-aeris-600/20 flex items-center justify-center border border-aeris-500/20">
              <Building2 className="w-6 h-6 text-aeris-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Hôtels à {city}</h1>
              <p className="text-white/50 mt-0.5">
                {filtered.length} hôtels · Meilleur prix trouvé sur {MOCK_HOTELS.reduce((max, h) => Math.max(max, h.sources.length), 0)} sources
              </p>
            </div>
          </div>

          {/* Search + filters bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Rechercher par nom ou quartier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-aeris-400/60 transition-all"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              {SORT_OPTS.map((opt) => (
                <button key={opt.value} onClick={() => setSortBy(opt.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                    sortBy === opt.value
                      ? "bg-aeris-600/30 text-aeris-300 font-medium"
                      : "text-white/50 hover:text-white"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar filters */}
          <aside className="lg:col-span-1">
            <div className="glass rounded-2xl p-5 border border-white/[0.06] sticky top-20">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
                <SlidersHorizontal className="w-4 h-4 text-aeris-400" />
                Filtres
              </h3>

              {/* Price range */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-white/60">Prix max / nuit</label>
                  <span className="text-xs font-bold text-aeris-300">{maxPrice}€</span>
                </div>
                <input type="range" min={priceMin} max={priceMax} value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-aeris-500 cursor-pointer" />
                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                  <span>{priceMin}€</span><span>{priceMax}€</span>
                </div>
              </div>

              {/* Stars */}
              <div className="mb-5">
                <label className="text-xs text-white/60 block mb-2">Étoiles minimum</label>
                <div className="flex gap-2">
                  {[0, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setMinStars(s)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-sm border transition-all",
                        minStars === s
                          ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}>
                      {s === 0 ? "Tous" : `${s}★`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <FilterToggle label="Petit-déjeuner inclus" value={breakfast} onChange={setBreakfast} />
                <FilterToggle label="Annulation gratuite" value={refundable} onChange={setRefundable} />
              </div>

              {/* Neighborhoods */}
              <div className="mt-5">
                <label className="text-xs text-white/60 block mb-2">Quartiers</label>
                <div className="space-y-1.5">
                  {["Manhattan", "Brooklyn", "DUMBO", "Meatpacking", "Financial District"].map((q) => (
                    <label key={q} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-aeris-500 rounded" />
                      <span className="text-xs text-white/60">{q}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Hotel list */}
          <div className="lg:col-span-3 space-y-4">
            {/* Pack vol + hôtel CTA */}
            <div className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✈️🏨</span>
                <div>
                  <div className="text-sm font-semibold text-white">Pack Vol + Hôtel</div>
                  <div className="text-xs text-white/50">Économisez jusqu'à 23% en réservant ensemble</div>
                </div>
              </div>
              <button className="btn-ghost text-sm whitespace-nowrap">Voir les packs</button>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                Aucun hôtel ne correspond à vos filtres.
              </div>
            ) : (
              filtered.map((hotel, i) => (
                <HotelCard key={hotel.id} hotel={hotel} rank={i + 1} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotelsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-sky-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-aeris-400 animate-spin" />
      </div>
    }>
      <HotelsContent />
    </Suspense>
  );
}

function FilterToggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-xs text-white/60">{label}</span>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)}
        className={cn("relative w-9 h-5 rounded-full transition-colors", value ? "bg-aeris-600" : "bg-white/15")}>
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
          value ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </label>
  );
}
