"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Luggage, RefreshCw, Clock, Zap, Info, ExternalLink, TrendingDown } from "lucide-react";
import type { FlightOffer } from "@/lib/types";
import { getScoreColor, getScoreBg } from "@/lib/scoring";
import ScoreRing from "./ScoreRing";
import ScoreBreakdown from "./ScoreBreakdown";
import { cn, formatTime, timeAgo } from "@/lib/utils";

// Re-export helpers from scoring for use here
function formatDurationLocal(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h${min > 0 ? String(min).padStart(2, "0") : ""}`;
}

interface Props {
  flight: FlightOffer;
  rank: number;
  isTop?: boolean;
}

export default function FlightCard({ flight, rank, isTop }: Props) {
  const [expanded, setExpanded] = useState(false);
  const seg = flight.segments[0];
  const score = flight.score;
  const savings = flight.originalPrice ? flight.originalPrice - flight.price : 0;

  return (
    <div
      className={cn(
        "glass glass-hover rounded-2xl overflow-hidden transition-all duration-300",
        isTop && "border-aeris-500/40 shadow-glow-sm",
        flight.isDeal && "relative"
      )}
    >
      {/* Deal badge */}
      {flight.isDeal && (
        <div className="absolute top-0 right-0 m-3 z-10">
          <span className="deal-pulse inline-flex items-center gap-1 bg-aeris-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-aeris-400/40">
            <Zap className="w-3 h-3 fill-current" />
            {flight.dealLabel ?? "Deal"}
          </span>
        </div>
      )}

      {/* Main row */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Rank + Score */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">#{rank}</span>
            {score && <ScoreRing score={score.total} size={52} />}
          </div>

          {/* Flight info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              {/* Airline */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                  {seg.airline.code}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{seg.airline.name}</div>
                  <div className="text-[11px] text-white/40">{seg.flightNumber}</div>
                </div>
              </div>

              {/* Route + time */}
              <div className="flex items-center gap-3 flex-1">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{formatTime(seg.departure)}</div>
                  <div className="text-xs text-white/50">{seg.from.code}</div>
                </div>

                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-white/40">{formatDurationLocal(flight.totalDuration)}</div>
                  <div className="w-full flex items-center">
                    <div className="flex-1 h-px bg-white/15" />
                    {flight.totalStops === 0 ? (
                      <div className="mx-2 text-[10px] font-medium text-emerald-400">Direct</div>
                    ) : (
                      <div className="mx-2 flex gap-1">
                        {Array.from({ length: flight.totalStops }).map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                        ))}
                      </div>
                    )}
                    <div className="flex-1 h-px bg-white/15" />
                  </div>
                  {flight.totalStops > 0 && (
                    <div className="text-[10px] text-amber-400/80">
                      {flight.totalStops} escale{flight.totalStops > 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-lg font-bold text-white">{formatTime(seg.arrival)}</div>
                  <div className="text-xs text-white/50">{seg.to.code}</div>
                </div>
              </div>
            </div>

            {/* Tags row */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag icon={<Luggage className="w-3 h-3" />} active={flight.baggage.checkedIncluded > 0}>
                {flight.baggage.checkedIncluded > 0 ? `${flight.baggage.checkedIncluded}kg inclus` : "Bagage payant"}
              </Tag>
              {flight.isRefundable && (
                <Tag icon={<RefreshCw className="w-3 h-3" />} active>Remboursable</Tag>
              )}
              {flight.seatsLeft <= 5 && (
                <Tag className="bg-red-500/10 border-red-400/30 text-red-300">
                  {flight.seatsLeft} siège{flight.seatsLeft > 1 ? "s" : ""} restant{flight.seatsLeft > 1 ? "s" : ""}
                </Tag>
              )}
              <Tag className="bg-white/5 border-white/10 text-white/40">
                {flight.priceSource}
              </Tag>
              {score && (
                <Tag className={cn("border", getScoreBg(score.total))}>
                  <span className={getScoreColor(score.total)}>{score.label}</span>
                </Tag>
              )}
            </div>
          </div>

          {/* Price + CTA */}
          <div className="shrink-0 text-right flex flex-col items-end gap-2">
            {savings > 0 && (
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <TrendingDown className="w-3 h-3" />
                -{savings}€
              </div>
            )}
            {flight.originalPrice && (
              <div className="text-xs text-white/30 line-through">
                {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(flight.originalPrice)}
              </div>
            )}
            <div className="text-2xl font-bold text-white">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(flight.price)}
            </div>
            <div className="text-[10px] text-white/40">par personne</div>
            <a
              href={flight.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm py-2.5 px-5 flex items-center gap-1.5"
            >
              Réserver <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
            >
              Détails {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && score && (
        <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Score breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Analyse AERIS Score™
              </h4>
              <ScoreBreakdown breakdown={score.breakdown} />
            </div>

            {/* Flight details */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Détails du vol
              </h4>
              <div className="space-y-2 text-sm">
                <Row label="Avion" value={seg.aircraft} />
                <Row label="Classe" value={flight.cabinClass.replace("_", " ")} />
                <Row label="Cabine" value={flight.baggage.cabin ? "Inclus" : "Non inclus"} />
                <Row
                  label="Bagage soute"
                  value={
                    flight.baggage.checkedIncluded > 0
                      ? `${flight.baggage.checkedIncluded}kg inclus`
                      : `+${flight.baggage.extraCost}€`
                  }
                />
                <Row label="Sélection siège" value={flight.isSeatSelectable ? "Disponible" : "Non disponible"} />
                <Row label="Remboursable" value={flight.isRefundable ? "Oui" : "Non"} />
                <Row label="Mise à jour" value={timeAgo(flight.lastUpdated)} />
              </div>
            </div>
          </div>

          {/* Price note */}
          <div className="mt-4 flex items-start gap-2 text-xs text-white/35 border-t border-white/[0.06] pt-3">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-aeris-400/60" />
            <span>
              Prix vérifié sur <span className="text-aeris-400/80">{flight.priceSource}</span> — aucune commission perçue par AERIS sur cette réservation. Prix mis à jour {timeAgo(flight.lastUpdated)}.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({
  children,
  icon,
  active,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border",
        active
          ? "bg-aeris-500/10 border-aeris-400/30 text-aeris-300"
          : "bg-white/5 border-white/10 text-white/50",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 capitalize">{value}</span>
    </div>
  );
}
