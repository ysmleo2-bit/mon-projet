"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { PricePoint } from "@/lib/types";

interface Props {
  data: PricePoint[];
  currentPrice: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-card">
      <div className="text-white/50">{label}</div>
      <div className="text-aeris-300 font-bold text-sm">{payload[0].value}€</div>
    </div>
  );
}

export default function PriceChart({ data, currentPrice }: Props) {
  const formatted = data.map((p) => ({
    date: new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    price: p.price,
  }));

  const min = Math.min(...data.map((d) => d.price));
  const max = Math.max(...data.map((d) => d.price));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Historique prix 30 jours
        </h4>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">Min: {min}€</span>
          <span className="text-red-400">Max: {max}€</span>
          <span className="text-aeris-300 font-medium">Actuel: {currentPrice}€</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5b6ef7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5b6ef7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={[min * 0.9, max * 1.1]} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="price" stroke="#7c94ff" strokeWidth={2}
            fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: "#7c94ff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
