"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Filters {
  maxPrice: number;
  maxDuration: number;
  maxStops: number;
  airlines: string[];
  baggageOnly: boolean;
  refundableOnly: boolean;
  departAfter: number;
  departBefore: number;
}

interface Props {
  onFiltersChange: (f: Filters) => void;
  priceRange: { min: number; max: number };
}

export default function FilterPanel({ onFiltersChange, priceRange }: Props) {
  const [open, setOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(priceRange.max);
  const [maxDuration, setMaxDuration] = useState(24);
  const [maxStops, setMaxStops] = useState(2);
  const [baggageOnly, setBaggageOnly] = useState(false);
  const [refundableOnly, setRefundableOnly] = useState(false);

  const AIRLINES = ["Air France", "Ryanair", "easyJet", "Emirates", "Qatar Airways", "British Airways", "Lufthansa", "Turkish Airlines", "Singapore Airlines"];
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);

  function toggleAirline(name: string) {
    const next = selectedAirlines.includes(name)
      ? selectedAirlines.filter((a) => a !== name)
      : [...selectedAirlines, name];
    setSelectedAirlines(next);
    emit({ airlines: next });
  }

  function emit(overrides: Partial<Filters> = {}) {
    onFiltersChange({
      maxPrice, maxDuration, maxStops,
      airlines: selectedAirlines,
      baggageOnly, refundableOnly,
      departAfter: 0, departBefore: 24,
      ...overrides,
    });
  }

  const activeCount = [
    maxPrice < priceRange.max,
    maxDuration < 24,
    maxStops < 2,
    selectedAirlines.length > 0,
    baggageOnly,
    refundableOnly,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
          open || activeCount > 0
            ? "bg-aeris-600/20 border-aeris-500/40 text-aeris-300"
            : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08]"
        )}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filtres
        {activeCount > 0 && (
          <span className="ml-0.5 w-5 h-5 rounded-full bg-aeris-600 text-white text-xs font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-40 glass rounded-2xl p-5 w-80 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Filtres</h3>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Max price */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-white/60">Prix max</label>
                <span className="text-xs font-bold text-aeris-300">{maxPrice}€</span>
              </div>
              <input type="range" min={priceRange.min} max={priceRange.max} value={maxPrice}
                onChange={(e) => { const v = Number(e.target.value); setMaxPrice(v); emit({ maxPrice: v }); }}
                className="w-full accent-aeris-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>{priceRange.min}€</span><span>{priceRange.max}€</span>
              </div>
            </div>

            {/* Max duration */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-white/60">Durée max</label>
                <span className="text-xs font-bold text-aeris-300">{maxDuration}h</span>
              </div>
              <input type="range" min={4} max={24} value={maxDuration}
                onChange={(e) => { const v = Number(e.target.value); setMaxDuration(v); emit({ maxDuration: v * 60 }); }}
                className="w-full accent-aeris-500 cursor-pointer" />
            </div>

            {/* Stops */}
            <div>
              <label className="text-xs text-white/60 block mb-2">Escales max</label>
              <div className="flex gap-2">
                {[0, 1, 2].map((s) => (
                  <button key={s} onClick={() => { setMaxStops(s); emit({ maxStops: s }); }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all",
                      maxStops === s
                        ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                    )}>
                    {s === 0 ? "Direct" : s === 1 ? "1 escale" : "2+"}
                  </button>
                ))}
              </div>
            </div>

            {/* Airlines */}
            <div>
              <label className="text-xs text-white/60 block mb-2">Compagnies</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {AIRLINES.map((a) => (
                  <button key={a} onClick={() => toggleAirline(a)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      selectedAirlines.includes(a)
                        ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                    )}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <Toggle
                label="Bagage en soute inclus"
                value={baggageOnly}
                onChange={(v) => { setBaggageOnly(v); emit({ baggageOnly: v }); }}
              />
              <Toggle
                label="Remboursable uniquement"
                value={refundableOnly}
                onChange={(v) => { setRefundableOnly(v); emit({ refundableOnly: v }); }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              setMaxPrice(priceRange.max); setMaxDuration(24); setMaxStops(2);
              setSelectedAirlines([]); setBaggageOnly(false); setRefundableOnly(false);
              emit({ maxPrice: priceRange.max, maxDuration: 24 * 60, maxStops: 2, airlines: [], baggageOnly: false, refundableOnly: false });
            }}
            className="mt-4 w-full text-xs text-white/40 hover:text-white/70 py-2 transition-colors"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-xs text-white/60">{label}</span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          value ? "bg-aeris-600" : "bg-white/15"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
          value ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </label>
  );
}
