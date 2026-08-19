import { Check, Zap } from "lucide-react";
import type { PlanTier } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PricingCard({ plan }: { plan: PlanTier }) {
  return (
    <div className={cn(
      "relative rounded-2xl p-px transition-all",
      plan.highlighted
        ? "bg-gradient-to-b from-brand-500/60 to-brand-500/10 shadow-glow"
        : "bg-white/[0.08]"
    )}>
      {plan.highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            <Zap className="w-3 h-3" /> Plus populaire
          </span>
        </div>
      )}

      <div className={cn(
        "rounded-2xl p-6",
        plan.highlighted ? "bg-ink-900" : "bg-ink-900/60"
      )}>
        <div className="mb-5">
          <h3 className="text-lg font-black text-white mb-1">{plan.name}</h3>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-4xl font-black text-white">{plan.price}€</span>
            <span className="text-white/40 text-sm pb-1">/mois</span>
          </div>
          <p className="text-xs text-white/40">{plan.leads} leads / mois · {plan.seats} siège{plan.seats > 1 ? "s" : ""}</p>
        </div>

        <a href="/dashboard"
          className={cn(
            "block w-full text-center font-semibold py-3 rounded-xl text-sm transition-all mb-5",
            plan.highlighted
              ? "bg-brand-500 hover:bg-brand-400 text-white shadow-glow-sm hover:shadow-glow"
              : "border border-white/15 hover:border-white/30 text-white hover:bg-white/[0.05]"
          )}>
          {plan.cta}
        </a>

        <ul className="space-y-3">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-white/70">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
