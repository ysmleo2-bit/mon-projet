"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { PriceSnapshot } from "@/lib/types";

function PriceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-2 py-1.5 text-xs mono">
      <div className="text-white/40">{label}</div>
      <div className="text-glitch-green font-bold">{payload[0].value}€</div>
    </div>
  );
}

export default function PriceChart({
  history,
  currentPrice,
}: {
  history: PriceSnapshot[];
  currentPrice: number;
}) {
  const data = history.map(p => ({
    date:  new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    price: p.price,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#00e676" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
          axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip content={<PriceTooltip />} />
        <ReferenceLine
          y={currentPrice}
          stroke="#00e676" strokeDasharray="4 4" strokeWidth={1.5}
          label={{ value: `${currentPrice}€`, position: "right", fill: "#00e676", fontSize: 10 }}
        />
        <Area type="monotone" dataKey="price" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}
          fill="url(#g)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
