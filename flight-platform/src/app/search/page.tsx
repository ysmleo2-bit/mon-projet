"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown, Loader2, RefreshCw, Radio,
  TrendingDown, TrendingUp, Info, BarChart3,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import FlightCard from "@/components/FlightCard";
import FilterPanel from "@/components/FilterPanel";
import PricePrediction from "@/components/PricePrediction";
import PriceChart from "@/components/PriceChart";
import { MOCK_FLIGHTS, PRICE_PREDICTION, generateCalendarPrices } from "@/lib/mock-data";
import { scoreFlights } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { SortBy, FlightOffer } from "@/lib/types";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "score", label: "AERIS Score™" },
  { value: "price", label: "Prix" },
  { value: "duration", label: "Durée" },
  { value: "departure", label: "Départ" },
];

const SOURCES = [
  "Air France Direct", "Emirates", "Qatar Airways", "Expedia", "Skyscanner",
  "Booking.com", "Kiwi.com", "Opodo", "British Airways", "Lufthansa",
];

function SearchResults() {
  const params = useSearchParams();
  const from = params.get("from") ?? "Paris CDG";
  const to = params.get("to") ?? "New York JFK";

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [scannedSources, setScannedSources] = useState<string[]>([]);
  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [showChart, setShowChart] = useState(false);
  const [filters, setFilters] = useState({
    maxPrice: 99999,
    maxDuration: 99999,
    maxStops: 99,
    airlines: [] as string[],
    baggageOnly: false,
    refundableOnly: false,
    departAfter: 0,
    departBefore: 24,
  });

  const calendarPrices = useMemo(() => generateCalendarPrices(450), []);
  const bestPrice = MOCK_FLIGHTS.reduce((m, f) => Math.min(m, f.price), Infinity);

  // Simulate live search with streaming sources
  useEffect(() => {
    setLoading(true);
    setProgress(0);
    setScannedSources([]);
    const scored = scoreFlights(MOCK_FLIGHTS);
    let idx = 0;

    const interval = setInterval(() => {
      idx++;
      const pct = Math.min((idx / SOURCES.length) * 100, 100);
      setProgress(pct);
      if (idx <= SOURCES.length) {
        setScannedSources((prev) => [...prev, SOURCES[idx - 1]]);
      }
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setFlights(scored);
          setLoading(false);
        }, 400);
      }
    }, 280);

    return () => clearInterval(interval);
  }, [from, to]);

  const filtered = useMemo(() => {
    return flights.filter((f) => {
      if (f.price > filters.maxPrice) return false;
      if (f.totalDuration > filters.maxDuration) return false;
      if (f.totalStops > filters.maxStops) return false;
      if (filters.baggageOnly && f.baggage.checkedIncluded === 0) return false;
      if (filters.refundableOnly && !f.isRefundable) return false;
      if (filters.airlines.length > 0 && !filters.airlines.includes(f.segments[0].airline.name)) return false;
      return true;
    });
  }, [flights, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "score") return (b.score?.total ?? 0) - (a.score?.total ?? 0);
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "duration") return a.totalDuration - b.totalDuration;
      if (sortBy === "departure") return a.segments[0].departure.localeCompare(b.segments[0].departure);
      return 0;
    });
  }, [filtered, sortBy]);

  const priceRange = useMemo(() => ({
    min: Math.min(...MOCK_FLIGHTS.map((f) => f.price)),
    max: Math.max(...MOCK_FLIGHTS.map((f) => f.price)),
  }), []);

  return (
    <div className="min-h-screen bg-sky-950">
      <Navbar />

      {/* Top search bar */}
      <div className="pt-16 px-4 bg-gradient-to-b from-sky-950 to-transparent">
        <div className="max-w-7xl mx-auto py-4">
          <SearchBar compact />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Radio className="w-5 h-5 text-aeris-400 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-aeris-500 rounded-full animate-ping" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Recherche en cours…</div>
                <div className="text-xs text-white/40">Scan de {SOURCES.length} sources simultanément</div>
              </div>
              <div className="ml-auto text-sm font-bold text-aeris-300">{Math.round(progress)}%</div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-aeris-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Sources being scanned */}
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((src) => (
                <span key={src} className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-all duration-300",
                  scannedSources.includes(src)
                    ? "bg-aeris-600/20 border-aeris-500/40 text-aeris-300"
                    : "bg-white/5 border-white/10 text-white/30"
                )}>
                  {scannedSources.includes(src) ? "✓ " : ""}{src}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-4 pb-20">
          {/* Route header */}
          <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">
                {from} → {to}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
                <span>{sorted.length} résultats sur {flights.length}</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Mis à jour il y a 30s
                </span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Meilleur prix: {bestPrice}€
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Price chart toggle */}
              <button
                onClick={() => setShowChart(!showChart)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all",
                  showChart
                    ? "bg-aeris-600/20 border-aeris-500/40 text-aeris-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                Graphique
              </button>

              {/* Sort */}
              <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg transition-all",
                      sortBy === opt.value
                        ? "bg-aeris-600/30 text-aeris-300 font-medium"
                        : "text-white/50 hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <FilterPanel onFiltersChange={setFilters} priceRange={priceRange} />

              <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main results */}
            <div className="lg:col-span-2 space-y-3">
              {/* Transparency notice */}
              <div className="flex items-start gap-2 glass rounded-xl px-4 py-3 text-xs text-white/40 border border-white/[0.06]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-aeris-400/70" />
                <span>
                  {flights.length} vols trouvés sur {SOURCES.length} sources. Classés par{" "}
                  <strong className="text-aeris-400/80">AERIS Score™</strong> — aucun résultat sponsorisé ou mis en avant par commissions.
                </span>
              </div>

              {sorted.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  Aucun vol ne correspond à vos filtres. Essayez d'élargir les critères.
                </div>
              ) : (
                sorted.map((flight, i) => (
                  <FlightCard
                    key={flight.id}
                    flight={flight}
                    rank={i + 1}
                    isTop={i === 0}
                  />
                ))
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Price prediction */}
              <PricePrediction prediction={PRICE_PREDICTION} />

              {/* Price chart */}
              {showChart && (
                <div className="glass rounded-2xl p-5 border border-white/[0.06]">
                  <PriceChart
                    data={sorted[0]?.priceHistory ?? []}
                    currentPrice={sorted[0]?.price ?? 487}
                  />
                </div>
              )}

              {/* Price calendar mini */}
              <div className="glass rounded-2xl p-5 border border-white/[0.06]">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Calendrier des prix
                </h4>
                <div className="grid grid-cols-7 gap-1">
                  {calendarPrices.slice(0, 28).map((day, i) => {
                    const date = new Date(day.date);
                    const d = date.getDate();
                    return (
                      <div
                        key={i}
                        title={`${day.date}: ${day.price}€`}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all text-center",
                          day.isDeal
                            ? "bg-emerald-400/15 border border-emerald-400/30"
                            : day.isLowest
                            ? "bg-aeris-600/30 border border-aeris-500/40"
                            : "bg-white/5 hover:bg-white/[0.08]"
                        )}
                      >
                        <span className="text-[9px] text-white/40">{d}</span>
                        {day.price && (
                          <span className={cn(
                            "text-[8px] font-bold leading-none",
                            day.isDeal ? "text-emerald-400" : day.isLowest ? "text-aeris-300" : "text-white/50"
                          )}>
                            {day.price}€
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-white/30">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-400/50" />Deal
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-aeris-500/50" />Meilleur prix
                  </span>
                </div>
              </div>

              {/* Transparency card */}
              <div className="glass rounded-2xl p-5 border border-white/[0.06]">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Nos sources
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {scannedSources.map((src) => (
                    <span key={src} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-white/40">
                      {src}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-white/30 leading-relaxed">
                  Toutes les sources sont scannées de manière indépendante. Aucune ne paie pour être incluse ou mise en avant.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-sky-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-aeris-400 animate-spin" />
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
