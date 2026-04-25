"use client";

import type { FlightScore } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABELS: Record<keyof FlightScore["breakdown"], string> = {
  price: "Prix",
  duration: "Durée",
  airline: "Compagnie",
  schedule: "Horaires",
  comfort: "Confort",
  baggage: "Bagages",
  reliability: "Ponctualité",
  reviews: "Avis",
};

interface Props {
  breakdown: FlightScore["breakdown"];
  compact?: boolean;
}

export default function ScoreBreakdown({ breakdown, compact = false }: Props) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-1")}>
      {(Object.keys(breakdown) as (keyof FlightScore["breakdown"])[]).map((key) => {
        const val = breakdown[key];
        const color =
          val >= 80 ? "bg-emerald-400" :
          val >= 65 ? "bg-aeris-400" :
          val >= 50 ? "bg-amber-400" : "bg-red-400";
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-white/50 w-20 shrink-0">{LABELS[key]}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", color)}
                style={{ width: `${val}%` }}
              />
            </div>
            <span className="text-xs font-medium text-white/70 w-7 text-right">{val}</span>
          </div>
        );
      })}
    </div>
  );
}
