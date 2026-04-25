"use client";

import { cn } from "@/lib/utils";
import { confidenceLabel } from "@/lib/detector";

interface Props {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function ConfidenceMeter({ score, showLabel = true, size = "md" }: Props) {
  const color =
    score >= 85 ? "#d500f9" :   // purple — glitch certainty
    score >= 70 ? "#ff6d00" :   // orange — flash
    score >= 50 ? "#00e676" :   // green — deal
                  "#00b0ff";    // blue — watch

  const segments = 20;
  const filled   = Math.round((score / 100) * segments);

  return (
    <div className={cn("flex flex-col gap-1", size === "sm" && "gap-0.5")}>
      {/* Segment bar */}
      <div className="flex gap-[2px]">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-[1px] transition-all duration-700",
              size === "sm"  ? "h-1 flex-1" :
              size === "lg"  ? "h-2.5 flex-1" : "h-1.5 flex-1"
            )}
            style={{
              backgroundColor: i < filled ? color : "rgba(255,255,255,0.08)",
              opacity: i < filled ? (0.5 + (i / filled) * 0.5) : 1,
            }}
          />
        ))}
      </div>

      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30 mono">Confiance</span>
          <span className="text-[10px] font-bold mono" style={{ color }}>
            {score}% — {confidenceLabel(score)}
          </span>
        </div>
      )}
    </div>
  );
}
