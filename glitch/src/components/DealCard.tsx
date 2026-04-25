"use client";

import Link from "next/link";
import { ThumbsUp, AlertTriangle, ExternalLink, Clock, Users, Zap } from "lucide-react";
import type { GlitchDeal } from "@/lib/types";
import { categoryMeta, urgencyMeta, formatWindow } from "@/lib/detector";
import { cn, timeAgo, timeLeft, isExpired, formatPrice, formatDate } from "@/lib/utils";
import ConfidenceMeter from "./ConfidenceMeter";

interface Props {
  deal: GlitchDeal;
  featured?: boolean;
}

export default function DealCard({ deal, featured = false }: Props) {
  const { analysis } = deal;
  const cat     = categoryMeta(analysis.category);
  const urg     = urgencyMeta(analysis.urgency);
  const expired = isExpired(deal.expiresEstimate) || deal.status === "expired";
  const saving  = deal.normalPrice - deal.currentPrice;

  return (
    <div className={cn(
      "group glass rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/15",
      featured && "border-glitch-green/20 shadow-[0_0_30px_rgba(0,230,118,0.06)]",
      expired  && "opacity-50 pointer-events-none",
      analysis.category === "GLITCH" && !expired && "hover:shadow-[0_0_20px_rgba(213,0,249,0.1)]"
    )}>
      {/* Top bar */}
      <div className={cn("h-0.5",
        analysis.category === "GLITCH" ? "bg-gradient-to-r from-purple-500 via-purple-400 to-transparent" :
        analysis.category === "FLASH"  ? "bg-gradient-to-r from-orange-500 to-transparent" :
        analysis.category === "DEAL"   ? "bg-gradient-to-r from-emerald-500 to-transparent" :
                                          "bg-gradient-to-r from-sky-500 to-transparent"
      )} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl select-none">{deal.flag}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white mono">
                  {deal.fromCode} → {deal.toCode}
                </span>
                <span className={cn("pill",
                  analysis.category === "GLITCH" ? "pill-glitch" :
                  analysis.category === "FLASH"  ? "pill-flash"  :
                  analysis.category === "DEAL"   ? "pill-deal"   : "pill-watch"
                )}>
                  {analysis.category === "GLITCH" && <Zap className="w-2.5 h-2.5 fill-current" />}
                  {cat.label}
                </span>
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {deal.airline} · {deal.stops === 0 ? "Direct" : `${deal.stops} escale${deal.stops > 1 ? "s" : ""}`} · {deal.cabin}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <div className="text-xs text-white/30 line-through mono">{deal.normalPrice}€</div>
            <div className={cn("text-2xl font-black mono leading-none", cat.text)}>
              {deal.currentPrice}€
            </div>
            <div className="text-xs text-emerald-400 font-bold mono">
              -{analysis.savingPct}% · {saving}€ économisés
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-3 mb-4 text-xs text-white/40">
          <span>✈ {formatDate(deal.departDate)}</span>
          {deal.returnDate && <><span>—</span><span>{formatDate(deal.returnDate)}</span></>}
          <span className="text-white/20">·</span>
          <span>{deal.source}</span>
        </div>

        {/* Confidence meter */}
        <div className="mb-4">
          <ConfidenceMeter score={analysis.confidence} size="sm" />
        </div>

        {/* Reasons */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {analysis.reasons.slice(0, 2).map((r, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-white/40">
              {r}
            </span>
          ))}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />{deal.confirmations}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{deal.comments} commentaires
            </span>
            <span className="text-white/20">·</span>
            <span>Détecté {timeAgo(deal.detectedAt)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Time left badge */}
            {!expired && (
              <span className={cn(
                "flex items-center gap-1 text-[10px] font-bold mono px-2 py-1 rounded-lg border",
                analysis.urgency === "critical" ? "text-red-400 bg-red-500/10 border-red-500/30 urgent-ring" :
                analysis.urgency === "high"     ? "text-orange-400 bg-orange-500/10 border-orange-500/30" :
                                                   "text-white/40 bg-white/[0.04] border-white/[0.08]"
              )}>
                <Clock className="w-2.5 h-2.5" />
                {timeLeft(deal.expiresEstimate)}
              </span>
            )}

            <Link href={`/deal/${deal.id}`}
              className="text-xs border border-white/15 hover:border-glitch-green/40 text-white/60 hover:text-glitch-green px-3 py-1.5 rounded-lg transition-all">
              Détails
            </Link>

            <a href={deal.bookingUrl} target="_blank" rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                analysis.urgency === "critical"
                  ? "bg-glitch-green text-black hover:bg-emerald-400"
                  : "bg-white/[0.08] hover:bg-white/15 text-white"
              )}>
              Réserver <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
