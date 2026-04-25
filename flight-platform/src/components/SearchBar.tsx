"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlaneTakeoff, PlaneLanding, Calendar, Users, Search,
  ArrowLeftRight, ChevronDown, Plus, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripType, CabinClass } from "@/lib/types";

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Économique",
  premium_economy: "Premium Eco",
  business: "Affaires",
  first: "Première",
};

const AIRPORTS_SUGGEST = [
  "Paris CDG", "Paris ORY", "Londres LHR", "New York JFK",
  "Dubaï DXB", "Bangkok BKK", "Tokyo NRT", "Barcelone BCN",
  "Rome FCO", "Amsterdam AMS", "Madrid MAD", "Miami MIA",
  "Los Angeles LAX", "Sydney SYD",
];

export default function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>("round-trip");
  const [from, setFrom] = useState("Paris CDG");
  const [to, setTo] = useState("New York JFK");
  const [depart, setDepart] = useState("2025-06-15");
  const [ret, setRet] = useState("2025-06-22");
  const [adults, setAdults] = useState(1);
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [showPax, setShowPax] = useState(false);
  const [showCabin, setShowCabin] = useState(false);
  const [fromSuggest, setFromSuggest] = useState(false);
  const [toSuggest, setToSuggest] = useState(false);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function search() {
    const params = new URLSearchParams({
      from, to, depart,
      ...(tripType === "round-trip" && ret ? { ret } : {}),
      adults: String(adults),
      cabin: cabinClass,
      type: tripType,
    });
    router.push(`/search?${params}`);
  }

  const inputCls = "w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none";

  return (
    <div className={cn("w-full", compact ? "max-w-5xl" : "max-w-4xl mx-auto")}>
      {/* Trip type tabs */}
      {!compact && (
        <div className="flex gap-1 mb-4">
          {(["round-trip", "one-way", "multi-city"] as TripType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTripType(t)}
              className={cn(
                "text-sm px-4 py-1.5 rounded-full transition-all",
                tripType === t
                  ? "bg-aeris-600/30 text-aeris-300 border border-aeris-500/40"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              {t === "round-trip" ? "Aller-retour" : t === "one-way" ? "Aller simple" : "Multi-villes"}
            </button>
          ))}
        </div>
      )}

      {/* Search form */}
      <div className={cn(
        "glass rounded-2xl p-2 flex flex-col gap-2",
        compact ? "sm:flex-row sm:items-center" : ""
      )}>
        {/* From / To */}
        <div className="flex gap-1 flex-1">
          {/* From */}
          <div className="relative flex-1">
            <div className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all cursor-text"
              onClick={() => { setFromSuggest(true); setToSuggest(false); }}>
              <PlaneTakeoff className="w-4 h-4 text-aeris-400 shrink-0" />
              <input
                className={inputCls}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onFocus={() => setFromSuggest(true)}
                onBlur={() => setTimeout(() => setFromSuggest(false), 200)}
                placeholder="Départ"
              />
            </div>
            {fromSuggest && (
              <SuggestDropdown
                query={from}
                options={AIRPORTS_SUGGEST}
                onSelect={(v) => { setFrom(v); setFromSuggest(false); }}
              />
            )}
          </div>

          {/* Swap */}
          <button
            onClick={swap}
            className="self-center p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* To */}
          <div className="relative flex-1">
            <div className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all cursor-text"
              onClick={() => { setToSuggest(true); setFromSuggest(false); }}>
              <PlaneLanding className="w-4 h-4 text-aeris-400 shrink-0" />
              <input
                className={inputCls}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onFocus={() => setToSuggest(true)}
                onBlur={() => setTimeout(() => setToSuggest(false), 200)}
                placeholder="Destination"
              />
            </div>
            {toSuggest && (
              <SuggestDropdown
                query={to}
                options={AIRPORTS_SUGGEST}
                onSelect={(v) => { setTo(v); setToSuggest(false); }}
              />
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="flex gap-1">
          <div className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all flex-1 sm:flex-none sm:w-36">
            <Calendar className="w-4 h-4 text-aeris-400 shrink-0" />
            <input
              type="date"
              className={cn(inputCls, "cursor-pointer")}
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
            />
          </div>
          {tripType === "round-trip" && (
            <div className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all flex-1 sm:flex-none sm:w-36">
              <Calendar className="w-4 h-4 text-aeris-400/60 shrink-0" />
              <input
                type="date"
                className={cn(inputCls, "cursor-pointer")}
                value={ret}
                onChange={(e) => setRet(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Pax + Cabin */}
        <div className="flex gap-1">
          {/* Passengers */}
          <div className="relative">
            <button
              onClick={() => { setShowPax(!showPax); setShowCabin(false); }}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all whitespace-nowrap text-sm text-white/80"
            >
              <Users className="w-4 h-4 text-aeris-400" />
              {adults} adult{adults > 1 ? "es" : "e"}
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>
            {showPax && (
              <div className="absolute top-full mt-1 left-0 z-50 glass rounded-xl p-4 w-48 shadow-card">
                <PaxRow label="Adultes" value={adults} min={1} max={9}
                  onDec={() => setAdults(Math.max(1, adults - 1))}
                  onInc={() => setAdults(Math.min(9, adults + 1))}
                />
              </div>
            )}
          </div>

          {/* Cabin */}
          <div className="relative">
            <button
              onClick={() => { setShowCabin(!showCabin); setShowPax(false); }}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-3 py-3 transition-all whitespace-nowrap text-sm text-white/80"
            >
              {CABIN_LABELS[cabinClass]}
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>
            {showCabin && (
              <div className="absolute top-full mt-1 right-0 z-50 glass rounded-xl p-2 w-44 shadow-card">
                {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCabinClass(c); setShowCabin(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                      c === cabinClass ? "bg-aeris-600/30 text-aeris-300" : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {CABIN_LABELS[c]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search CTA */}
        <button
          onClick={search}
          className="btn-primary flex items-center gap-2 justify-center py-3 px-6 rounded-xl whitespace-nowrap"
        >
          <Search className="w-4 h-4" />
          {!compact && <span>Rechercher</span>}
          {compact && <span>Rechercher</span>}
        </button>
      </div>
    </div>
  );
}

function SuggestDropdown({
  query, options, onSelect,
}: {
  query: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);
  if (!filtered.length) return null;
  return (
    <div className="absolute top-full mt-1 left-0 z-50 glass rounded-xl w-full shadow-card overflow-hidden">
      {filtered.map((opt) => (
        <button
          key={opt}
          onMouseDown={() => onSelect(opt)}
          className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function PaxRow({
  label, value, min, max, onDec, onInc,
}: {
  label: string; value: number; min: number; max: number;
  onDec: () => void; onInc: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={onDec} disabled={value <= min}
          className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/15 flex items-center justify-center text-white/70 disabled:opacity-30 transition-all">
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-sm font-medium text-white w-4 text-center">{value}</span>
        <button onClick={onInc} disabled={value >= max}
          className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/15 flex items-center justify-center text-white/70 disabled:opacity-30 transition-all">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
