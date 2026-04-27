"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, ChevronDown, Zap, X } from "lucide-react";
import { AIRPORTS, REGIONS, airportsByRegion, getAirport, type Airport } from "@/lib/airports";
import { cn } from "@/lib/utils";

interface Props {
  value:    string;           // IATA code
  onChange: (code: string) => void;
  size?:    "sm" | "md" | "lg";
}

export default function AirportSelector({ value, onChange, size = "md" }: Props) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");
  const ref                 = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const selected = getAirport(value);

  // Fermer en cliquant dehors
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus sur le champ de recherche à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const filtered = query.trim()
    ? AIRPORTS.filter(a =>
        a.code.toLowerCase().includes(query.toLowerCase()) ||
        a.city.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.country.toLowerCase().includes(query.toLowerCase())
      )
    : null;

  function select(code: string) {
    onChange(code);
    setOpen(false);
  }

  const sizeClass = {
    sm: "text-xs px-3 py-2",
    md: "text-sm px-4 py-2.5",
    lg: "text-base px-5 py-3",
  }[size];

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2.5 glass border rounded-xl font-medium mono transition-all",
          "border-white/[0.08] hover:border-glitch-green/40 hover:text-white text-white/80",
          open && "border-glitch-green/50 text-white",
          sizeClass,
        )}>
        <MapPin className="w-4 h-4 text-glitch-green shrink-0" />
        {selected ? (
          <>
            <span className="text-base leading-none">{selected.flag}</span>
            <span>{selected.city}</span>
            <span className="text-white/30 font-normal">{selected.code}</span>
            {selected.liveData && (
              <span className="w-1.5 h-1.5 rounded-full bg-glitch-green live-dot shrink-0" title="Données en temps réel" />
            )}
          </>
        ) : (
          <span className="text-white/40">Choisir un aéroport</span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 ml-auto transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-[420px] max-w-[calc(100vw-2rem)] glass border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Paris, CDG, London…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-glitch-green/40 mono"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04] text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-glitch-green" />
              Données temps réel
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Liens Kayak
            </span>
          </div>

          {/* Airport list */}
          <div className="overflow-y-auto max-h-72">
            {filtered ? (
              // Search results
              filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-white/30">Aucun aéroport trouvé</div>
              ) : (
                <div className="py-1">
                  {filtered.map(a => <AirportRow key={a.code} airport={a} selected={a.code === value} onSelect={select} />)}
                </div>
              )
            ) : (
              // Grouped by region
              REGIONS.map(region => {
                const airports = airportsByRegion(region);
                return (
                  <div key={region}>
                    <div className="px-4 py-2 text-[10px] font-bold text-white/25 uppercase tracking-widest mono sticky top-0 bg-ink-900/90 backdrop-blur-sm">
                      {region}
                    </div>
                    {airports.map(a => <AirportRow key={a.code} airport={a} selected={a.code === value} onSelect={select} />)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AirportRow({ airport: a, selected, onSelect }: { airport: Airport; selected: boolean; onSelect: (c: string) => void }) {
  return (
    <button
      onClick={() => onSelect(a.code)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left",
        selected && "bg-glitch-green/[0.08]"
      )}>
      <span className="text-xl w-7 text-center shrink-0">{a.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold mono", selected ? "text-glitch-green" : "text-white")}>
            {a.city}
          </span>
          <span className="text-xs text-white/30">{a.code}</span>
          {a.liveData && (
            <span className="w-1.5 h-1.5 rounded-full bg-glitch-green shrink-0" />
          )}
        </div>
        <div className="text-[11px] text-white/35 truncate">{a.name} · {a.country}</div>
      </div>
      {selected && <Zap className="w-3.5 h-3.5 text-glitch-green shrink-0" />}
    </button>
  );
}
