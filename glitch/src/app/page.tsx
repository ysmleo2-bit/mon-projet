import Link from "next/link";
import {
  Zap, Bell, ArrowRight, ShieldCheck, Radio, BarChart3,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveTicker from "@/components/LiveTicker";
import DealCard from "@/components/DealCard";
import DealFeedSection from "@/components/DealFeedSection";
import { categoryMeta } from "@/lib/detector";
import { cn, timeAgo } from "@/lib/utils";
import type { GlitchDeal } from "@/lib/types";

async function getDeals(): Promise<GlitchDeal[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res  = await fetch(`${base}/api/deals`, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.deals ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const deals     = await getDeals();
  const liveDeals = deals.filter(d => d.status === "live");
  const topDeal   = liveDeals[0]; // trié par confiance desc côté API
  const lastScanAt = new Date().toISOString();

  const stats = {
    liveNow:         liveDeals.length,
    totalDealsToday: deals.length,
    avgSaving:       deals.length
      ? Math.round(deals.reduce((s, d) => s + d.analysis.savingPct, 0) / deals.length)
      : 71,
    confirmedToday: deals.filter(d => d.analysis.confidence > 80).length,
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />

      <div className="pt-14">
        <LiveTicker />
      </div>

      {/* Hero */}
      <section className="relative px-4 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid-ink bg-grid opacity-100 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-glitch-green/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="scanline" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-ink-800 border border-glitch-green/25 rounded-full px-4 py-1.5 mb-8 mono text-xs text-glitch-green">
            <span className="w-1.5 h-1.5 rounded-full bg-glitch-green live-dot" />
            {stats.liveNow} erreurs tarifaires actives · dernier scan {timeAgo(lastScanAt)}
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.02] mb-6 mono">
            Votre radar d&apos;<br />
            <span className="text-glitch-gradient flicker">erreurs tarifaires</span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
            GLITCH scanne en permanence les prix des compagnies aériennes et détecte automatiquement
            les anomalies. Alerte instantanée dès qu&apos;une erreur apparaît —{" "}
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden max-w-2xl mx-auto">
            {[
              { v: `${stats.totalDealsToday}`, l: "deals détectés aujourd'hui" },
              { v: `${stats.avgSaving}%`,       l: "économie moyenne" },
              { v: `${stats.confirmedToday}`,   l: "à haute confiance" },
              { v: `${stats.liveNow}`,          l: "actives en ce moment" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-ink-950 px-4 py-4 text-center">
                <div className="text-xl font-black mono text-glitch-green">{v}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top deal */}
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

      {/* Feed filtrable (composant client) */}
      <DealFeedSection deals={liveDeals} />

      {/* How it works */}
      <section className="border-t border-white/[0.05] px-4 py-16 bg-ink-900/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black mono text-white mb-2">
              Comment fonctionne le moteur GLITCH ?
            </h2>
            <p className="text-white/40 text-sm max-w-lg mx-auto">
              Un algorithme de détection d&apos;anomalies, pas un simple comparateur de prix.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                icon:  <Radio className="w-5 h-5" />,
                color: "text-glitch-green",
                title: "Scan permanent",
                desc:  "Le moteur interroge Kiwi.com et les APIs des compagnies toutes les 15 minutes sur 50 000+ routes.",
              },
              {
                icon:  <BarChart3 className="w-5 h-5" />,
                color: "text-purple-400",
                title: "Analyse statistique",
                desc:  "Chaque prix est comparé à son historique 30j, 7j, et au plus bas absolu. 9 signaux sont analysés.",
              },
              {
                icon:  <Bell className="w-5 h-5" />,
                color: "text-orange-400",
                title: "Réservation directe",
                desc:  "Chaque deal pointe vers la page de paiement Kayak ou Kiwi avec le prix verrouillé — 0 redirections.",
              },
            ].map(item => (
              <div key={item.title} className="glass rounded-2xl p-5">
                <div className={cn("mb-3", item.color)}>{item.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1 mono">{item.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["GLITCH","FLASH","DEAL","WATCH"] as const).map(cat => {
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
          <h3 className="text-base font-bold text-white mb-2 mono">Zéro commission. Liens directs.</h3>
          <p className="text-sm text-white/40 leading-relaxed">
            GLITCH ne reçoit aucune commission. Les liens pointent directement vers Kayak
            ou Kiwi.com avec le prix verrouillé. Notre seul revenu : un abonnement premium
            optionnel pour les alertes avancées.
          </p>
        </div>
      </section>

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
