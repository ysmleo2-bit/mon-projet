"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown,
  Clock, AlertTriangle, CheckCircle, BarChart3, Share2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import BookingSteps from "@/components/BookingSteps";
import { getDeal } from "@/lib/mock-deals";
import { categoryMeta, urgencyMeta, formatWindow } from "@/lib/detector";
import { cn, timeAgo, timeLeft, isExpired, formatDate } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

function PriceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-2 py-1.5 text-xs mono">
      <div className="text-white/40">{label}</div>
      <div className="text-glitch-green font-bold">{payload[0].value}€</div>
    </div>
  );
}

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const deal = getDeal(id);

  if (!deal) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="text-center mono">
          <div className="text-4xl mb-4">404</div>
          <div className="text-white/40 mb-4">Offre introuvable ou expirée</div>
          <Link href="/" className="text-glitch-green hover:underline">← Retour au feed</Link>
        </div>
      </div>
    );
  }

  const { analysis } = deal;
  const cat     = categoryMeta(analysis.category);
  const urg     = urgencyMeta(analysis.urgency);
  const expired = isExpired(deal.expiresEstimate) || deal.status === "expired";
  const saving  = deal.normalPrice - deal.currentPrice;

  const chartData = deal.priceHistory.map(p => ({
    date: new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    price: p.price,
  }));

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-20 pb-20">
        {/* Breadcrumb */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white mono mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour au feed
        </Link>

        {/* Alert banner for critical */}
        {analysis.urgency === "critical" && !expired && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 urgent-ring">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="text-sm text-red-300 font-medium">
              Erreur tarifaire critique — Agissez dans les prochaines heures avant qu'elle disparaisse.
            </div>
            <div className="ml-auto text-sm font-black text-red-400 mono shrink-0">
              {timeLeft(deal.expiresEstimate)}
            </div>
          </div>
        )}

        {expired && (
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 mb-6">
            <Clock className="w-4 h-4 text-white/30 shrink-0" />
            <div className="text-sm text-white/40">Cette offre a expiré — conservée pour référence.</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Deal header */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("pill",
                      analysis.category === "GLITCH" ? "pill-glitch" :
                      analysis.category === "FLASH"  ? "pill-flash"  :
                      analysis.category === "DEAL"   ? "pill-deal"   : "pill-watch"
                    )}>
                      {cat.label}
                    </span>
                    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full border", urg.bg)}>
                      <span className={urg.color}>{urg.label}</span>
                    </span>
                  </div>
                  <h1 className="text-2xl font-black mono text-white">
                    {deal.from} ({deal.fromCode}) → {deal.to} ({deal.toCode}) {deal.flag}
                  </h1>
                  <div className="text-sm text-white/40 mt-1">
                    {deal.airline} · {deal.stops === 0 ? "Direct" : `${deal.stops} escale${deal.stops>1?"s":""}`} · {deal.cabin}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-white/30 line-through mono">{deal.normalPrice}€</div>
                  <div className={cn("text-4xl font-black mono", cat.text)}>{deal.currentPrice}€</div>
                  <div className="text-sm text-emerald-400 font-bold mono">
                    -{analysis.savingPct}% · {saving}€ économisés
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-wrap gap-4 text-sm text-white/50 mb-5 pb-5 border-b border-white/[0.06]">
                <span>✈ Départ : <strong className="text-white">{formatDate(deal.departDate)}</strong></span>
                {deal.returnDate && <span>🔄 Retour : <strong className="text-white">{formatDate(deal.returnDate)}</strong></span>}
                <span>📌 Source : <strong className="text-white">{deal.source}</strong></span>
                <span>🔍 Détecté {timeAgo(deal.detectedAt)}</span>
              </div>

              {/* Confidence */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Score de confiance GLITCH</span>
                  <span className={cn("text-lg font-black mono", cat.text)}>{analysis.confidence}%</span>
                </div>
                <ConfidenceMeter score={analysis.confidence} size="lg" />
              </div>

              {/* Signals */}
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Signaux détectés</div>
                <div className="space-y-1.5">
                  {analysis.signals.filter(s => s.triggered).map(s => (
                    <div key={s.name} className="flex items-center gap-2.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-glitch-green shrink-0" />
                      <span className="text-white/70">{s.description}</span>
                      <span className="ml-auto text-white/30 mono">poids ×{s.weight}</span>
                    </div>
                  ))}
                  {analysis.signals.filter(s => !s.triggered).slice(0, 2).map(s => (
                    <div key={s.name} className="flex items-center gap-2.5 text-xs opacity-30">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                      <span className="text-white/40">{s.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              {!expired && (
                <a href={deal.bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-5 w-full btn-green flex items-center justify-center gap-2 text-base">
                  Réserver maintenant sur {deal.airline}
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Price history chart */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-semibold text-white">Historique des prix — 30 derniers jours</h3>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
                    y={deal.currentPrice}
                    stroke="#00e676" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: `${deal.currentPrice}€`, position: "right", fill: "#00e676", fontSize: 10 }}
                  />
                  <Area type="monotone" dataKey="price" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}
                    fill="url(#g)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-2 text-[10px] mono text-white/30">
                <span>Moy. 30j : {deal.normalPrice}€</span>
                <span className="text-glitch-green">Actuel : {deal.currentPrice}€ (-{analysis.savingPct}%)</span>
              </div>
            </div>

            {/* Community */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Communauté</h3>
              <div className="flex items-center gap-4 mb-4">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-all">
                  <ThumbsUp className="w-4 h-4" /> Confirmé ({deal.confirmations})
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-all">
                  <ThumbsDown className="w-4 h-4" /> Signaler ({deal.reports})
                </button>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white text-sm transition-all ml-auto">
                  <Share2 className="w-4 h-4" /> Partager
                </button>
              </div>
              <p className="text-xs text-white/30">
                {deal.confirmations} membres ont confirmé avoir réussi à réserver à ce prix.
                {deal.reports > 0 && ` ${deal.reports} signalement${deal.reports>1?"s":""} reçu${deal.reports>1?"s":""}.`}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Booking window */}
            {!expired && (
              <div className={cn(
                "glass rounded-2xl p-4 border",
                analysis.urgency === "critical" ? "border-red-500/25" : "border-white/[0.06]"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={cn("w-4 h-4",
                    analysis.urgency === "critical" ? "text-red-400" : "text-white/40"
                  )} />
                  <span className="text-xs font-semibold text-white">Fenêtre de réservation</span>
                </div>
                <div className={cn("text-2xl font-black mono mb-1",
                  analysis.urgency === "critical" ? "text-red-400" : "text-orange-400"
                )}>
                  {timeLeft(deal.expiresEstimate)}
                </div>
                <div className="text-xs text-white/40">
                  {formatWindow(analysis.bookingWindowHours)} estimé pour ce type d'erreur
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06] space-y-3">
              {[
                { l: "Prix normal", v: `${deal.normalPrice}€`, c: "text-white/50" },
                { l: "Prix actuel", v: `${deal.currentPrice}€`, c: cat.text },
                { l: "Économie", v: `${saving}€ (-${analysis.savingPct}%)`, c: "text-emerald-400" },
                { l: "Plus bas historique", v: `${deal.lowestEver}€`, c: "text-white/50" },
                { l: "Confiance GLITCH", v: `${analysis.confidence}%`, c: cat.text },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{l}</span>
                  <span className={cn("text-xs font-bold mono", c)}>{v}</span>
                </div>
              ))}
            </div>

            {/* How to book */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06]">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mono mb-3">
                Guide de réservation
              </h3>
              <BookingSteps />
            </div>

            {/* Legal note */}
            <div className="text-[10px] text-white/25 leading-relaxed px-1">
              Les erreurs tarifaires sont légalement contraignantes dans la plupart des pays si
              la compagnie a émis une confirmation de réservation. GLITCH ne garantit pas que le vol
              sera honoré, mais la majorité des grandes compagnies l'honorent pour éviter les controverses.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
