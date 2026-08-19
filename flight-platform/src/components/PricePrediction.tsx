"use client";

import { TrendingDown, TrendingUp, Minus, Brain, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PRICE_PREDICTION } from "@/lib/mock-data";

type Prediction = typeof PRICE_PREDICTION;

export default function PricePrediction({ prediction }: { prediction: Prediction }) {
  const isDown = prediction.trend === "falling";
  const isUp = prediction.trend === "rising";

  return (
    <div className="glass rounded-2xl p-5 border border-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-aeris-600/20 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-aeris-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">IA Prédiction Prix</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-aeris-600/20 text-aeris-300 border border-aeris-500/30">
              {prediction.confidence}% confiance
            </span>
          </div>
          <p className="text-xs text-white/50 mb-4">{prediction.reason}</p>

          {/* Recommendation */}
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold mb-4",
            isDown
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          )}>
            {isDown ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            {prediction.recommendation}
          </div>

          {/* Future prices */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Dans 7j", price: prediction.priceIn7Days },
              { label: "Dans 14j", price: prediction.priceIn14Days },
              { label: "Dans 30j", price: prediction.priceIn30Days },
            ].map(({ label, price }) => {
              const current = prediction.priceIn7Days; // reference
              const diff = price - 487;
              const isHigh = diff > 0;
              return (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/[0.08]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-white/30" />
                    <span className="text-[10px] text-white/40">{label}</span>
                  </div>
                  <div className="text-sm font-bold text-white">{price}€</div>
                  <div className={cn("text-[10px] font-medium mt-0.5", isHigh ? "text-red-400" : "text-emerald-400")}>
                    {isHigh ? "+" : ""}{diff}€
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
