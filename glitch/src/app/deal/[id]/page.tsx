import Link from "next/link";
import {
  ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown,
  Clock, AlertTriangle, CheckCircle, BarChart3, Share2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import BookingSteps from "@/components/BookingSteps";
import PriceChart from "@/components/PriceChart";
import { categoryMeta, urgencyMeta, formatWindow } from "@/lib/detector";
import { cn, timeAgo, timeLeft, isExpired, formatDate } from "@/lib/utils";
import { kayakLink, skyscannerLink } from "@/lib/booking-links";
import type { GlitchDeal } from "@/lib/types";

async function getDealById(id: string): Promise<GlitchDeal | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res  = await fetch(`${base}/api/deals`, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const json = await res.json();
    const deals: GlitchDeal[] = json.deals ?? [];
    return deals.find(d => d.id === id) ?? null;
  } catch {
    return null;
  }
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal    = await getDealById(id);

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

  // Lien Kayak direct (résultats filtrés pour cette route + date)
  const kayak = kayakLink({
    from:       deal.fromCode,
    to:         deal.toCode,
    departDate: deal.departDate,
    returnDate: deal.returnDate,
    cabin:      deal.cabin as any,
  });
  // Lien Skyscanner alternatif
  const skyscanner = skyscannerLink({
    from:       deal.fromCode,
    to:         deal.toCode,
    departDate: deal.departDate,
    returnDate: deal.returnDate,
    cabin:      deal.cabin as any,
  });

  // URL de réservation principale (Kiwi deep_link si disponible, sinon Kayak)
  const primaryBookingUrl = deal.bookingUrl?.startsWith("http") ? deal.bookingUrl : kayak;

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-20 pb-20">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white mono mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour au feed
        </Link>

        {/* Bannière critique */}
        {analysis.urgency === "critical" && !expired && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 urgent-ring">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="text-sm text-red-300 font-medium">
              Erreur tarifaire critique — Agissez dans les prochaines heures avant qu&apos;elle disparaisse.
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
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header du deal */}
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
                    {deal.airline} · {deal.stops === 0 ? "Direct" : `${deal.stops} escale${deal.stops > 1 ? "s" : ""}`} · {deal.cabin}
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

              {/* Confiance */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Score de confiance GLITCH</span>
                  <span className={cn("text-lg font-black mono", cat.text)}>{analysis.confidence}%</span>
                </div>
                <ConfidenceMeter score={analysis.confidence} size="lg" />
              </div>

              {/* Signaux */}
              <div className="mb-6">
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

              {/* CTA principal */}
              {!expired && (
                <div className="space-y-3">
                  {/* Bouton principal */}
                  <a href={primaryBookingUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full btn-green flex items-center justify-center gap-2 text-base py-4">
                    Réserver maintenant — {deal.currentPrice}€
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Liens alternatifs */}
                  <div className="flex gap-2">
                    <a href={kayak} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-all">
                      <ExternalLink className="w-3 h-3" />
                      Voir sur Kayak
                    </a>
                    <a href={skyscanner} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-all">
                      <ExternalLink className="w-3 h-3" />
                      Voir sur Skyscanner
                    </a>
                  </div>

                  <p className="text-[10px] text-white/25 text-center">
                    Les liens ouvrent directement les résultats pour cette route et cette date.
                    {deal.source === "Kiwi.com" && " Le prix affiché est verrouillé via Kiwi.com."}
                  </p>
                </div>
              )}
            </div>

            {/* Graphique historique */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-semibold text-white">Historique des prix — 30 derniers jours</h3>
              </div>
              <PriceChart history={deal.priceHistory} currentPrice={deal.currentPrice} />
              <div className="flex items-center justify-between mt-2 text-[10px] mono text-white/30">
                <span>Moy. 30j : {deal.normalPrice}€</span>
                <span className="text-glitch-green">Actuel : {deal.currentPrice}€ (-{analysis.savingPct}%)</span>
              </div>
            </div>

            {/* Communauté */}
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
                {deal.reports > 0 && ` ${deal.reports} signalement${deal.reports > 1 ? "s" : ""} reçu${deal.reports > 1 ? "s" : ""}.`}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Fenêtre de réservation */}
            {!expired && (
              <div className={cn(
                "glass rounded-2xl p-4 border",
                analysis.urgency === "critical" ? "border-red-500/25" : "border-white/[0.06]"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={cn("w-4 h-4", analysis.urgency === "critical" ? "text-red-400" : "text-white/40")} />
                  <span className="text-xs font-semibold text-white">Fenêtre de réservation</span>
                </div>
                <div className={cn("text-2xl font-black mono mb-1",
                  analysis.urgency === "critical" ? "text-red-400" : "text-orange-400"
                )}>
                  {timeLeft(deal.expiresEstimate)}
                </div>
                <div className="text-xs text-white/40">
                  {formatWindow(analysis.bookingWindowHours)} estimé pour ce type d&apos;erreur
                </div>

                {/* CTA sidebar répété */}
                <a href={primaryBookingUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 w-full btn-green flex items-center justify-center gap-1.5 text-sm py-2.5">
                  Réserver {deal.currentPrice}€ <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Stats rapides */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06] space-y-3">
              {[
                { l: "Prix normal",          v: `${deal.normalPrice}€`,                    c: "text-white/50" },
                { l: "Prix actuel",          v: `${deal.currentPrice}€`,                   c: cat.text },
                { l: "Économie",             v: `${saving}€ (-${analysis.savingPct}%)`,    c: "text-emerald-400" },
                { l: "Plus bas historique",  v: `${deal.lowestEver}€`,                     c: "text-white/50" },
                { l: "Confiance GLITCH",     v: `${analysis.confidence}%`,                 c: cat.text },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{l}</span>
                  <span className={cn("text-xs font-bold mono", c)}>{v}</span>
                </div>
              ))}
            </div>

            {/* Guide de réservation */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06]">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mono mb-3">
                Guide de réservation
              </h3>
              <BookingSteps />
            </div>

            {/* Note légale */}
            <div className="text-[10px] text-white/25 leading-relaxed px-1">
              Les erreurs tarifaires sont légalement contraignantes dans la plupart des pays si
              la compagnie a émis une confirmation de réservation. GLITCH ne garantit pas que le vol
              sera honoré, mais la majorité des grandes compagnies l&apos;honorent pour éviter les controverses.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
