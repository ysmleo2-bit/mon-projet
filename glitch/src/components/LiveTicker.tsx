"use client";

import { TICKER_ITEMS } from "@/lib/mock-deals";

export default function LiveTicker() {
  // Duplicate items for seamless loop
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="overflow-hidden border-y border-white/[0.05] bg-ink-900/60 py-2.5">
      <div
        className="flex gap-12 whitespace-nowrap mono text-xs text-white/40"
        style={{ animation: "ticker 40s linear infinite" }}
      >
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-glitch-green live-dot shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
