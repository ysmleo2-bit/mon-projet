"use client";

import { Phone, Globe, Star, MapPin, ChevronRight, Clock } from "lucide-react";
import type { Lead } from "@/lib/types";
import { cn, statusLabel } from "@/lib/utils";

const STATUS_STYLE: Record<Lead["status"], string> = {
  new:        "bg-white/[0.06]      text-white/60   border-white/10",
  contacted:  "bg-brand-500/10      text-brand-300  border-brand-500/25",
  interested: "bg-amber-500/10      text-amber-300  border-amber-500/25",
  rdv:        "bg-violet-500/10     text-violet-300 border-violet-500/25",
  client:     "bg-emerald-500/10    text-emerald-300 border-emerald-500/25",
  lost:       "bg-red-500/10        text-red-300    border-red-500/25",
};

interface Props {
  lead: Lead;
  onClick?: () => void;
  compact?: boolean;
}

export default function LeadCard({ lead, onClick, compact }: Props) {
  const stars = Math.round(lead.rating);

  return (
    <div
      onClick={onClick}
      className={cn(
        "glass rounded-xl p-4 cursor-pointer hover:border-white/15 transition-all group",
        compact && "p-3"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("badge border", STATUS_STYLE[lead.status])}>{statusLabel(lead.status)}</span>
            {lead.callCount > 0 && (
              <span className="text-[10px] text-white/30">
                <Phone className="w-3 h-3 inline mr-0.5" />{lead.callCount}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{lead.name}</h3>
          <p className="text-xs text-white/40 truncate">{lead.category}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0 mt-0.5" />
      </div>

      <div className="space-y-1.5 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="font-mono">{lead.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.address}, {lead.city}</span>
        </div>
        {!compact && (
          <div className="flex items-center gap-2">
            <Star className="w-3 h-3 shrink-0 text-amber-400" />
            <span className="text-amber-400 font-medium">{lead.rating}</span>
            <span className="text-white/30">({lead.reviewCount} avis)</span>
          </div>
        )}
        {lead.website && !compact && (
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate text-brand-400">{lead.website}</span>
          </div>
        )}
      </div>

      {lead.notes && !compact && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-start gap-1.5 text-xs text-white/40">
            <Clock className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{lead.notes}</span>
          </div>
        </div>
      )}
    </div>
  );
}
