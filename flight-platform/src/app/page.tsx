"use client";

import Link from "next/link";
import {
  Zap, ShieldCheck, TrendingDown, Bell, ArrowRight, Globe,
  Sparkles, Lock, BarChart3, Search, Star, Brain,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import { POPULAR_ROUTES } from "@/lib/mock-data";

const STATS = [
  { value: "247", label: "sources scannées", suffix: "" },
  { value: "0", label: "résultats sponsorisés", suffix: "" },
  { value: "4.2s", label: "temps moyen de recherche", suffix: "" },
  { value: "31%", label: "économies moyennes vs OTA", suffix: "" },
];

const FEATURES = [
  {
    icon: <Zap className="w-5 h-5" />,
    color: "from-aeris-600/30 to-aeris-800/10",
    border: "border-aeris-500/20",
    title: "Moteur ultra-rapide",
    desc: "247 sources scanées simultanément en moins de 4 secondes. Compagnies directes, OTA, agences locales, erreurs tarifaires.",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    color: "from-violet-600/30 to-violet-900/10",
    border: "border-violet-500/20",
    title: "AERIS Score™",
    desc: "Score IA sur 100 combinant prix, durée, compagnie, confort, bagages et ponctualité. Pas juste le moins cher — le meilleur.",
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "from-emerald-600/20 to-emerald-900/10",
    border: "border-emerald-500/20",
    title: "Zéro biais commercial",
    desc: "Aucun résultat sponsorisé. Aucune commission cachée. Aucun partenariat influençant le classement. Transparent par design.",
  },
  {
    icon: <TrendingDown className="w-5 h-5" />,
    color: "from-amber-600/20 to-amber-900/10",
    border: "border-amber-500/20",
    title: "IA prédictive",
    desc: "Prédit la hausse ou baisse des prix avec 82% de précision. Sait quand réserver pour vous économiser jusqu'à 40%.",
  },
  {
    icon: <Bell className="w-5 h-5" />,
    color: "from-rose-600/20 to-rose-900/10",
    border: "border-rose-500/20",
    title: "Alertes intelligentes",
    desc: "Notifications Telegram ou email dès qu'un prix atteint votre cible. Détection automatique erreurs tarifaires.",
  },
  {
    icon: <Globe className="w-5 h-5" />,
    color: "from-sky-600/20 to-sky-900/10",
    border: "border-sky-500/20",
    title: "Mode Nomad & Anywhere",
    desc: "Recherche flexible 'n'importe où', tour du monde, deals weekend, multi-villes. Explorez sans contraintes.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-sky-950">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-aeris-700/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-64 h-64 bg-violet-800/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-sky-700/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-aeris-600/15 border border-aeris-500/30 rounded-full px-4 py-1.5 mb-8 text-sm text-aeris-300 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 fill-aeris-400" />
            <span>True Price Engine — Zéro sponsoring. Zéro manipulation.</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05] mb-6 animate-slide-up">
            Le moteur de vols
            <br />
            <span className="gradient-text">sans compromis</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in">
            AERIS scanne 247 sources en temps réel, classe les résultats selon
            <strong className="text-white/70"> vos vrais critères</strong> et vous dit exactement
            quand réserver — sans jamais vendre votre attention au plus offrant.
          </p>

          {/* Search Bar */}
          <div className="animate-slide-up">
            <SearchBar />
          </div>

          {/* Quick actions */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {["🌍 N'importe où", "📅 Dates flexibles", "🔥 Deals du weekend", "✈️ Tour du monde"].map((a) => (
              <button key={a} className="text-sm text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/15 px-4 py-2 rounded-full transition-all">
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 w-full max-w-3xl mx-auto mt-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {STATS.map((s) => (
              <div key={s.label} className="bg-sky-950 hover:bg-white/[0.03] px-5 py-5 text-center transition-colors">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular routes */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Destinations populaires</h2>
            <p className="text-sm text-white/40 mt-0.5">Meilleurs prix détectés maintenant</p>
          </div>
          <Link href="/search" className="text-sm text-aeris-400 hover:text-aeris-300 flex items-center gap-1 transition-colors">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {POPULAR_ROUTES.map((route) => (
            <Link
              key={route.to}
              href={`/search?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}&depart=2025-06-15&adults=1&cabin=economy&type=round-trip`}
              className="glass glass-hover rounded-2xl p-4 flex flex-col gap-2 group"
            >
              <div className="text-3xl">{route.flag}</div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-aeris-300 transition-colors">
                  {route.to}
                </div>
                <div className="text-xs text-white/40">depuis {route.from}</div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-bold text-aeris-300">{route.price}€</span>
                <span className="text-[10px] text-emerald-400 font-medium">Meilleur deal</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Conçu pour ceux qui{" "}
            <span className="gradient-text">refusent de payer trop cher</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">
            Chaque fonctionnalité a été pensée pour vous donner un avantage réel sur le marché.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className={`glass glass-hover rounded-2xl p-5 border ${f.border}`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4`}>
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Score explanation */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="glass rounded-3xl p-8 sm:p-12 border border-aeris-500/15 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-aeris-900/20 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-aeris-400 text-sm font-medium mb-4">
                  <Zap className="w-4 h-4 fill-aeris-400" />
                  AERIS Score™
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                  Pourquoi le moins cher
                  <br />
                  <span className="gradient-text">n'est pas toujours le meilleur</span>
                </h2>
                <p className="text-white/50 leading-relaxed mb-6">
                  Notre algorithme analyse 8 dimensions pour calculer le score réel de chaque vol.
                  Un vol 30€ moins cher avec 2 escales, bagages payants et compagnie peu fiable
                  peut vous coûter 2× plus en stress et temps.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Prix", val: 30, pct: "30% du score" },
                    { label: "Durée totale", val: 20, pct: "20% du score" },
                    { label: "Qualité compagnie", val: 15, pct: "15% du score" },
                    { label: "Confort + bagages", val: 15, pct: "15% du score" },
                    { label: "Ponctualité + avis", val: 20, pct: "20% du score" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-32 text-sm text-white/60 shrink-0">{item.label}</div>
                      <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-aeris-500 rounded-full"
                          style={{ width: `${item.val * 3.33}%` }}
                        />
                      </div>
                      <div className="text-xs text-white/40 w-24 text-right">{item.pct}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score example */}
              <div className="space-y-4">
                <ScoreExample
                  rank="A"
                  title="Vol Ryanair — 198€"
                  desc="2 escales · 14h15 · Sans bagage · Note 3.1/5"
                  score={34}
                  label="Peu recommandé"
                  color="text-red-400"
                />
                <ScoreExample
                  rank="B"
                  title="Air France — 487€"
                  desc="Direct · 7h30 · 23kg inclus · Note 4.2/5"
                  score={78}
                  label="Meilleur rapport qualité/prix"
                  color="text-aeris-400"
                  highlighted
                />
                <ScoreExample
                  rank="C"
                  title="Singapore Airlines — 523€"
                  desc="1 escale · 10h15 · 30kg inclus · Note 4.9/5"
                  score={88}
                  label="Le plus confortable"
                  color="text-emerald-400"
                />
                <p className="text-xs text-white/30 text-center">
                  AERIS recommande B en priorité selon les préférences par défaut.
                  <br />Personnalisez les poids selon vos propres critères.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency pledge */}
      <section className="px-4 pb-20 max-w-3xl mx-auto text-center">
        <Lock className="w-10 h-10 text-aeris-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-4">Notre engagement de transparence</h2>
        <p className="text-white/50 mb-8 leading-relaxed">
          AERIS ne reçoit aucune commission de la part des compagnies aériennes, hôtels ou OTA.
          Le classement est 100% algorithmique, basé sur vos préférences personnelles.
          Aucun résultat ne peut être acheté, sponsorisé ou mis en avant de manière artificielle.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "🚫", label: "0 résultat sponsorisé" },
            { icon: "💰", label: "0 commission cachée" },
            { icon: "🤝", label: "0 partenariat commercial" },
          ].map((item) => (
            <div key={item.label} className="glass rounded-2xl p-4 border border-white/[0.06]">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-xs text-white/60 font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-aeris-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white fill-white" />
          </div>
          <span className="font-semibold gradient-text">AERIS</span>
        </div>
        <p className="text-xs text-white/30">
          © 2025 AERIS — True Price Engine. Le comparateur de vols sans compromis.
        </p>
        <div className="flex items-center justify-center gap-6 mt-3">
          {["À propos", "Transparence", "APIs", "Contact"].map((l) => (
            <a key={l} href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function ScoreExample({
  rank, title, desc, score, label, color, highlighted = false,
}: {
  rank: string; title: string; desc: string;
  score: number; label: string; color: string; highlighted?: boolean;
}) {
  const scoreColor =
    score >= 80 ? "#34d399" :
    score >= 65 ? "#7c94ff" :
    score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className={`glass rounded-2xl p-4 flex items-center gap-4 ${highlighted ? "border border-aeris-500/30" : ""}`}>
      <div className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center text-sm font-bold text-white/60 shrink-0">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-white/40">{desc}</div>
        <div className={`text-xs font-medium mt-1 ${color}`}>{label}</div>
      </div>
      <div className="shrink-0">
        <div className="relative w-14 h-14">
          <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
            <circle
              cx={28} cy={28} r={22} fill="none" stroke={scoreColor} strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 138.2} 138.2`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-sm font-bold leading-none ${color}`}>{score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
