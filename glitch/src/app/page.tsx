"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Zap, Bell, ArrowRight, ShieldCheck,
  TrendingDown, Radio, BarChart3, ChevronRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveTicker from "@/components/LiveTicker";
import DealCard from "@/components/DealCard";
import { LIVE_DEALS, STATS } from "@/lib/mock-deals";
import { categoryMeta } from "@/lib/detector";
import { cn, timeAgo } from "@/lib/utils";

const CATEGORY_TABS = ["Tous", "GLITCH", "FLASH", "DEAL", "WATCH"] as const;
type Tab = typeof CATEGORY_TABS[number];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("Tous");

  const filtered = tab === "Tous"
    ? LIVE_DEALS
    : LIVE_DEALS.filter(d => d.analysis.category === tab);

  const topDeal  = LIVE_DEALS.sort((a,b) => b.analysis.confidence - a.analysis.confidence)[0];
  const glitches = LIVE_DEALS.filter(d => d.analysis.category === "GLITCH");

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />

      {/* Live ticker */}
      <div className="pt-14">
        <LiveTicker />
      </div>

      {/* Hero */}
      <section className="relative px-4 py-16 overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-grid-ink bg-grid opacity-100 pointer-events-none" />
        {/* Green glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-glitch-green/5 rounded-full blur-[100px] pointer-events-none" />
        {/* Scan line */}
        <div className="scanline" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 bg-ink-800 border border-glitch-green/25 rounded-full px-4 py-1.5 mb-8 mono text-xs text-glitch-green">
            <span className="w-1.5 h-1.5 rounded-full bg-glitch-green live-dot" />
            {STATS.liveNow} erreurs tarifaires actives · dernier scan {timeAgo(STATS.lastScanAt)}
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.02] mb-6 mono">
            Votre radar d'<br />
            <span className="text-glitch-gradient flicker">erreurs tarifaires</span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
            GLITCH scanne en permanence les prix des compagnies aériennes et détecte automatiquement
            les anomalies. Alerte instantanée dès qu'une erreur apparaît —{" "}
            <strong className="text-white/80">avant que tout le monde la voie.</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link href="/alerts" className="btn-green flex items-center gap-2 justify-center text-sm">
              <Bell className="w-4 h-4" />
              Activer mes alertes Telegram
            </Link>
            <Link href="/feed" className="btn-outline flex items-center gap-2 justify-center">
              Voir toutes les offres <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden max-w-2xl mx-auto">
            {[
              { v: `${STATS.totalDealsToday}`,   l: "deals détectés aujourd'hui" },
              { v: `${STATS.avgSaving}%`,         l: "économie moyenne" },
              { v: `${STATS.confirmedToday}`,     l: "erreurs confirmées" },
              { v: `${STATS.liveNow}`,            l: "actives en ce moment" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-ink-950 px-4 py-4 text-center">
                <div className="text-xl font-black mono text-glitch-green">{v}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top GLITCH right now */}
      {topDeal && (
        <section className="max-w-4xl mx-auto px-4 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
            <h2 className="text-sm font-bold text-white mono uppercase tracking-widest">
              Top GLITCH en ce moment
            </h2>
          </div>
          <DealCard deal={topDeal} featured />
        </section>
      )}

      {/* Deals feed */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-ink-800 border border-white/[0.06] rounded-xl p-1">
            {CATEGORY_TABS.map((t) => {
              const count = t === "Tous" ? LIVE_DEALS.length : LIVE_DEALS.filter(d => d.analysis.category === t).length;
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-medium mono transition-all",
                    tab === t
                      ? t === "GLITCH" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                        t === "FLASH"  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" :
                        t === "DEAL"   ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        t === "WATCH"  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" :
                                         "bg-white/10 text-white border border-white/15"
                      : "text-white/40 hover:text-white"
                  )}>
                  {t} {count > 0 && <span className="ml-1 opacity-50">({count})</span>}
                </button>
              );
            })}
          </div>

          <Link href="/feed" className="text-xs text-glitch-green hover:text-emerald-400 flex items-center gap-1 transition-colors mono">
            Voir tout <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-3">
          {filtered.slice(0, 6).map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>

        {filtered.length > 6 && (
          <div className="text-center mt-6">
            <Link href="/feed" className="btn-outline inline-flex items-center gap-2">
              Voir les {filtered.length - 6} autres offres <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.05] px-4 py-16 bg-ink-900/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black mono text-white mb-2">
              Comment fonctionne le moteur GLITCH ?
            </h2>
            <p className="text-white/40 text-sm max-w-lg mx-auto">
              Un algorithme de détection d'anomalies, pas un simple comparateur de prix.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                icon: <Radio className="w-5 h-5" />,
                color: "text-glitch-green",
                title: "Scan permanent",
                desc: "Le moteur interroge les APIs des compagnies et des GDS toutes les 15 minutes sur 50 000+ routes.",
              },
              {
                icon: <BarChart3 className="w-5 h-5" />,
                color: "text-purple-400",
                title: "Analyse statistique",
                desc: "Chaque prix est comparé à son historique 30j, 7j, et au plus bas absolu. 9 signaux sont analysés.",
              },
              {
                icon: <Bell className="w-5 h-5" />,
                color: "text-orange-400",
                title: "Alerte instantanée",
                desc: "Dès qu'une anomalie est détectée avec >55% de confiance, une alerte Telegram part en moins de 30 secondes.",
              },
            ].map((item) => (
              <div key={item.title} className="glass rounded-2xl p-5">
                <div className={cn("mb-3", item.color)}>{item.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1 mono">{item.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Categories explained */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["GLITCH","FLASH","DEAL","WATCH"] as const).map((cat) => {
              const m = categoryMeta(cat);
              return (
                <div key={cat} className={cn("glass rounded-xl p-3 border", m.border)}>
                  <div className={cn("text-xs font-black mono mb-1", m.text)}>{m.label}</div>
                  <div className="text-[10px] text-white/40 leading-relaxed">{m.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="px-4 py-12 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center">
          <ShieldCheck className="w-8 h-8 text-glitch-green mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-2 mono">Zéro commission. Zéro partenariat.</h3>
          <p className="text-sm text-white/40 leading-relaxed">
            GLITCH ne reçoit aucune commission sur les réservations. Les liens pointent directement vers les compagnies.
            Notre seul revenu : un abonnement premium optionnel pour les alertes avancées.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 mono text-sm text-white/30">
            <Zap className="w-3.5 h-3.5 text-glitch-green" />
            GLITCH — Fare Error Intelligence
          </div>
          <div className="flex gap-4 text-xs text-white/25">
            {["À propos","API","Contact","Telegram"].map(l => (
              <a key={l} href="#" className="hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
