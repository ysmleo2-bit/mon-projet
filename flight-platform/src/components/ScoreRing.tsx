"use client";

import { cn } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoring";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

export default function ScoreRing({ score, size = 56, strokeWidth = 4, showLabel = true, className }: Props) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  const color =
    score >= 80 ? "#34d399" :
    score >= 65 ? "#7c94ff" :
    score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-sm font-bold leading-none", getScoreColor(score))}>
            {score}
          </span>
          <span className="text-[9px] text-white/40 mt-0.5">/100</span>
        </div>
      )}
    </div>
  );
}
