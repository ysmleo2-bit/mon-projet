import Link from "next/link";
import {
  Phone, Search, BarChart2, Calendar, Users, Star,
  ChevronRight, Check, ArrowRight, MapPin, Clock, Zap,
  Shield, TrendingUp, MessageSquare,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PricingCard from "@/components/PricingCard";
import { PLANS } from "@/lib/mock-data";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar variant="landing" />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid-dark bg-grid opacity-100 pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-72 bg-brand-500/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/25 rounded-full px-4 py-1.5 mb-8 text-xs text-brand-300">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 live-dot" />
            Scraper Google Maps inclus · Garantie 30 jours · Prêt en 2 minutes
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.02] tracking-tight mb-6">
            Arrête de scroller<br />
            <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              Google Maps.
            </span>
          </h1>

          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-4 leading-relaxed">
            500 entreprises à appeler en 10 minutes.
          </p>
          <p className="text-base text-white/35 max-w-xl mx-auto mb-10 leading-relaxed">
            Tu scrapes, tu appelles, tu laisses les rappels programmer ta journée.
            Fini les Sheets. Fini les Notes iPhone.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Link href="/dashboard" className="btn-primary flex items-center gap-2 justify-center text-base">
              Créer mon compte
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/app" className="btn-outline flex items-center gap-2 justify-center">
              Voir la démo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden max-w-2xl mx-auto">
            {[
              { v: "500",   l: "leads en 10 min"       },
              { v: "12,4%", l: "taux de conversion moyen" },
              { v: "30j",   l: "garantie satisfait"     },
              { v: "2 min", l: "pour démarrer"          },
            ].map(({ v, l }) => (
              <div key={l} className="bg-ink-950 px-4 py-4 text-center">
                <div className="text-xl font-black text-brand-400">{v}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Preview ── */}
      <section className="px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
            {/* Fake browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-ink-900/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 bg-ink-800 rounded-lg px-3 py-1 text-xs text-white/30 font-mono">
                app.coldcaller.pro/dashboard
              </div>
            </div>

            {/* Mini dashboard preview */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Pipeline preview */}
              <div className="sm:col-span-2">
                <p className="text-xs text-white/30 mb-3 uppercase tracking-widest">Pipeline</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Nouveaux", count: 47, color: "text-white/60" },
                    { label: "Contactés", count: 23, color: "text-brand-400" },
                    { label: "Intéressés", count: 11, color: "text-amber-400" },
                    { label: "RDV", count: 6, color: "text-violet-400" },
                  ].map((col) => (
                    <div key={col.label} className="glass-blue rounded-xl p-3 text-center">
                      <div className={`text-xl font-black ${col.color}`}>{col.count}</div>
                      <div className="text-[9px] text-white/30 mt-0.5">{col.label}</div>
                    </div>
                  ))}
                </div>
                {/* Mini lead cards */}
                <div className="mt-3 space-y-2">
                  {[
                    { name: "Plomberie Dupont", phone: "06 12 34 56 78", status: "RDV mercredi 14h", color: "text-violet-400" },
                    { name: "Électricité Martin", phone: "06 87 65 43 21", status: "Intéressé — rappeler jeudi", color: "text-amber-400" },
                    { name: "Maçonnerie Lefèvre", phone: "06 55 44 33 22", status: "Pas répondu", color: "text-white/30" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center justify-between glass rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <p className="text-[10px] text-white/30 font-mono">{item.phone}</p>
                      </div>
                      <span className={`text-[10px] font-medium ${item.color}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats sidebar */}
              <div className="space-y-3">
                <p className="text-xs text-white/30 uppercase tracking-widest">Aujourd&apos;hui</p>
                {[
                  { label: "Appels passés",  v: "34",   color: "text-white" },
                  { label: "RDV obtenus",    v: "4",    color: "text-violet-400" },
                  { label: "Taux conv.",     v: "11.8%",color: "text-emerald-400" },
                  { label: "Leads restants", v: "143",  color: "text-brand-400" },
                ].map(({ label, v, color }) => (
                  <div key={label} className="glass rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-white/40">{label}</span>
                    <span className={`text-sm font-black ${color}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="features" className="px-4 py-20 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-white mb-3">Comment ça fonctionne ?</h2>
            <p className="text-white/40 max-w-lg mx-auto">
              De 0 à 500 prospects qualifiés en moins de 10 minutes. Sans Sheets. Sans copier-coller.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
            {[
              {
                step: "01",
                icon: <Search className="w-6 h-6" />,
                color: "text-brand-400",
                bg: "bg-brand-500/10 border-brand-500/20",
                title: "Tu scrapes",
                desc: "Entre un secteur (« Plombier ») et une ville. L'algo extrait 500 fiches Google Maps avec numéros de téléphone, adresses, notes et avis.",
              },
              {
                step: "02",
                icon: <Phone className="w-6 h-6" />,
                color: "text-violet-400",
                bg: "bg-violet-500/10 border-violet-500/20",
                title: "Tu appelles",
                desc: "L'interface d'appel affiche le script, les infos de l'entreprise et tes notes en même temps. Un clic pour passer à la fiche suivante.",
              },
              {
                step: "03",
                icon: <Calendar className="w-6 h-6" />,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10 border-emerald-500/20",
                title: "Le CRM bosse",
                desc: "Les rappels se planifient automatiquement. Le pipeline classe tes prospects en temps réel. Rien ne tombe à l'eau.",
              },
            ].map((item) => (
              <div key={item.step} className="glass rounded-2xl p-6">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${item.bg}`}>
                  <span className={item.color}>{item.icon}</span>
                </div>
                <div className="text-xs text-white/20 font-mono mb-1">{item.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <MapPin className="w-4 h-4" />,    label: "Scraper Maps",     desc: "Extraction automatique de Google Maps" },
              { icon: <Phone className="w-4 h-4" />,     label: "Interface appel",  desc: "Script visible pendant chaque appel" },
              { icon: <BarChart2 className="w-4 h-4" />, label: "CRM visuel",       desc: "Pipeline Kanban drag & drop" },
              { icon: <Calendar className="w-4 h-4" />,  label: "Rappels auto",     desc: "Agenda synchronisé Google Cal" },
              { icon: <Users className="w-4 h-4" />,     label: "Multi-agents",     desc: "Jusqu'à 5 commerciaux en parallèle" },
              { icon: <Star className="w-4 h-4" />,      label: "Tri par note",     desc: "Cible d'abord les mieux notés" },
              { icon: <MessageSquare className="w-4 h-4" />,label: "Rappels WhatsApp",desc: "Notifications automatiques" },
              { icon: <TrendingUp className="w-4 h-4" />,label: "Analytics",        desc: "Taux de conversion, appels, RDV" },
            ].map((item) => (
              <div key={item.label} className="glass rounded-xl p-4">
                <div className="text-brand-400 mb-2">{item.icon}</div>
                <div className="text-xs font-bold text-white mb-1">{item.label}</div>
                <div className="text-[10px] text-white/35 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="px-4 py-16 border-t border-white/[0.05] bg-ink-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-black text-white mb-6">
                Fini les outils qui ne marchent pas ensemble
              </h2>
              <div className="space-y-4">
                {[
                  { before: "Scroller Google Maps à la main", after: "500 leads en 10 min avec le scraper" },
                  { before: "Copier-coller dans un Sheet", after: "CRM automatique dès la recherche" },
                  { before: "Notes iPhone perdues", after: "Historique complet de chaque appel" },
                  { before: "Oublier de rappeler", after: "Rappels planifiés automatiquement" },
                ].map(({ before, after }) => (
                  <div key={before} className="flex items-start gap-4">
                    <div className="flex-1 glass rounded-xl p-3">
                      <div className="text-xs text-red-400 line-through mb-0.5 opacity-70">❌ {before}</div>
                      <div className="text-xs text-emerald-400">✅ {after}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-black">
                  T
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Thomas M.</div>
                  <div className="text-xs text-white/40">Commercial indépendant, Lyon</div>
                </div>
                <div className="ml-auto text-amber-400 text-sm">★★★★★</div>
              </div>
              <p className="text-sm text-white/60 leading-relaxed italic">
                &quot;Avant je passais 2h le matin à compiler des listes. Maintenant j&apos;ouvre l&apos;app,
                je tape mon secteur et ma ville, et j&apos;ai 500 numéros à appeler en moins de 10 minutes.
                J&apos;ai obtenu 3 RDV dès le premier jour.&quot;
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-4 text-xs">
                <span className="text-white/30">Résultats du 1er mois :</span>
                <span className="text-violet-400 font-bold">12 clients signés</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="px-4 py-20 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-3">Tarifs simples, sans surprise</h2>
            <p className="text-white/40">
              Tu searches autant que tu veux. Les crédits ne s&apos;utilisent qu&apos;à la livraison du lead.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => <PricingCard key={plan.id} plan={plan} />)}
          </div>
          <p className="text-center mt-8 text-xs text-white/30">
            Garantie 30 jours satisfait ou remboursé · Pas de CB requise pour l&apos;essai · Résiliation en 1 clic
          </p>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="px-4 py-20 border-t border-white/[0.05] bg-brand-500/[0.04]">
        <div className="max-w-2xl mx-auto text-center">
          <Zap className="w-10 h-10 text-brand-400 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-white mb-4">
            Ton premier batch de 500 prospects t&apos;attend
          </h2>
          <p className="text-white/40 mb-8">Crée ton compte en 2 minutes. Tes premiers leads arrivent en moins de 10 min.</p>
          <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-4">
            Trouver mes 500 premiers prospects <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Phone className="w-4 h-4 text-brand-400" />
            ColdCaller — Prospection B2B automatisée
          </div>
          <div className="flex items-center gap-2 text-xs text-white/20">
            <Shield className="w-3.5 h-3.5" />
            Garantie 30 jours · RGPD · Données hébergées en France
          </div>
          <div className="flex gap-4 text-xs text-white/25">
            {["CGV", "Confidentialité", "Contact"].map((l) => (
              <a key={l} href="#" className="hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
