"use client";

import { useState } from "react";
import { Star, MapPin, Wifi, Coffee, Dumbbell, Waves, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Hotel } from "@/lib/types";
import { cn } from "@/lib/utils";
import ScoreRing from "./ScoreRing";

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="w-3 h-3" />,
  Restaurant: <Coffee className="w-3 h-3" />,
  Gym: <Dumbbell className="w-3 h-3" />,
  Piscine: <Waves className="w-3 h-3" />,
};

export default function HotelCard({ hotel, rank }: { hotel: Hotel; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const bestSource = [...hotel.sources].sort((a, b) => a.price - b.price)[0];

  return (
    <div className="glass glass-hover rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Image placeholder */}
        <div className="sm:w-52 h-40 sm:h-auto bg-gradient-to-br from-aeris-900/60 to-aeris-950/80 flex items-center justify-center text-6xl shrink-0">
          🏨
        </div>

        {/* Content */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Stars */}
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: hotel.stars }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-xs text-white/40 ml-1">#{rank}</span>
              </div>

              <h3 className="text-base font-semibold text-white leading-tight">{hotel.name}</h3>

              <div className="flex items-center gap-1 mt-1.5 text-xs text-white/50">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{hotel.neighborhood}</span>
                <span className="text-white/25">·</span>
                <span>{hotel.distanceCenter.toFixed(1)} km du centre</span>
              </div>

              {/* Amenities */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hotel.amenities.slice(0, 5).map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-white/50">
                    {AMENITY_ICONS[a]}
                    {a}
                  </span>
                ))}
                {hotel.amenities.length > 5 && (
                  <span className="text-[11px] text-white/30">+{hotel.amenities.length - 5}</span>
                )}
              </div>

              {/* Reviews */}
              <div className="mt-3 flex flex-wrap gap-2">
                {hotel.reviewHighlights.slice(0, 2).map((r) => (
                  <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300">
                    ✓ {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Score + Price */}
            <div className="shrink-0 flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs text-white/40">Note voyageurs</div>
                  <div className="text-lg font-bold text-aeris-300">{hotel.rating}</div>
                  <div className="text-[10px] text-white/30">{hotel.reviewCount} avis</div>
                </div>
                <ScoreRing score={hotel.score.total} size={52} />
              </div>

              <div className="text-right">
                <div className="text-xs text-white/40">À partir de</div>
                <div className="text-xl font-bold text-white">{bestSource.price}€</div>
                <div className="text-[10px] text-white/30">/ nuit · {bestSource.name}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="btn-ghost text-xs py-2 flex items-center gap-1"
                >
                  Comparer {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <a href="#" className="btn-primary text-xs py-2 px-3 flex items-center gap-1">
                  Voir <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Source comparison */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Comparaison prix ({hotel.sources.length} sources)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {hotel.sources.map((src) => (
              <div key={src.name} className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl border",
                src.price === bestSource.price
                  ? "bg-aeris-600/15 border-aeris-500/30"
                  : "bg-white/[0.04] border-white/[0.08]"
              )}>
                <div>
                  <div className="text-xs font-medium text-white/80">{src.name}</div>
                  {!src.available && <div className="text-[10px] text-red-400">Complet</div>}
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-sm font-bold",
                    src.price === bestSource.price ? "text-aeris-300" : "text-white"
                  )}>
                    {src.price}€
                  </div>
                  {src.price === bestSource.price && (
                    <div className="text-[10px] text-aeris-400">Meilleur prix</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-white/30">
            Aucune commission perçue par AERIS — prix affichés en temps réel depuis les plateformes officielles.
          </p>
        </div>
      )}
    </div>
  );
}
