import Link from "next/link";
import { Check, Shield, RefreshCw, Zap, HelpCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import PricingCard from "@/components/PricingCard";
import { PLANS } from "@/lib/mock-data";

const FAQ = [
  {
    q: "Que se passe-t-il si je n'utilise pas tous mes leads ?",
    a: "Les leads non utilisés sont reportés sur le mois suivant. Les crédits achetés en supplément n'expirent jamais tant que ton abonnement est actif.",
  },
  {
    q: "Est-ce que la recherche est vraiment illimitée ?",
    a: "Oui. Tu peux lancer autant de recherches que tu veux. Les crédits ne sont consommés qu'à la livraison effective d'un lead avec numéro de téléphone validé.",
  },
  {
    q: "Comment fonctionne la garantie 30 jours ?",
    a: "Si tu n'es pas satisfait dans les 30 jours suivant ton inscription, on te rembourse intégralement, sans question.",
  },
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui. Tu passes en Pro ou Agence en un clic depuis ton espace client. La différence est proratisée automatiquement.",
  },
  {
    q: "Les données sont-elles conformes au RGPD ?",
    a: "Les données sont issues de Google Maps (données publiques). Nos serveurs sont hébergés en France. Nous respectons le RGPD.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar variant="landing" />

      <div className="pt-28 pb-20 px-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h1 className="text-4xl font-black text-white mb-4">
            Tarifs simples, sans surprise
          </h1>
          <p className="text-white/45 text-lg">
            Tu scrapes librement. Les crédits ne s&apos;utilisent qu&apos;à la livraison du lead.
            Garantie remboursement 30 jours.
          </p>
        </div>

        {/* Plans */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 items-start mb-12">
          {PLANS.map((plan) => <PricingCard key={plan.id} plan={plan} />)}
        </div>

        {/* Guarantees */}
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          {[
            { icon: <Shield className="w-5 h-5" />, title: "Garantie 30 jours", desc: "Remboursement intégral si pas satisfait, sans condition" },
            { icon: <RefreshCw className="w-5 h-5" />, title: "Résiliation 1 clic", desc: "Aucun engagement. Tu stop quand tu veux, immédiatement" },
            { icon: <Zap className="w-5 h-5" />, title: "Prêt en 2 minutes", desc: "Compte créé, premiers leads livrés en moins de 10 min" },
          ].map((item) => (
            <div key={item.title} className="glass rounded-2xl p-5 text-center">
              <div className="text-brand-400 flex justify-center mb-3">{item.icon}</div>
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-xl font-black text-white mb-6 text-center">Comparatif détaillé</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-4 text-white/40 font-medium">Fonctionnalité</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="px-5 py-4 text-center">
                      <span className={`font-bold ${p.highlighted ? "text-brand-400" : "text-white"}`}>
                        {p.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Leads / mois",          values: ["300",    "900",    "2 000"]    },
                  { label: "Sièges inclus",          values: ["1",      "2",      "5"]        },
                  { label: "Scraper Google Maps",    values: [true,     true,     true]       },
                  { label: "CRM pipeline visuel",    values: [true,     true,     true]       },
                  { label: "Interface d'appel",      values: [true,     true,     true]       },
                  { label: "Export CSV",             values: [true,     true,     true]       },
                  { label: "Intégration Calendar",   values: [false,    true,     true]       },
                  { label: "Rappels WhatsApp",       values: [false,    true,     true]       },
                  { label: "Analytics avancés",      values: [false,    true,     true]       },
                  { label: "Tableau multi-clients",  values: [false,    false,    true]       },
                  { label: "API access",             values: [false,    false,    true]       },
                  { label: "Account manager",        values: [false,    false,    true]       },
                ].map(({ label, values }) => (
                  <tr key={label} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-white/60">{label}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-5 py-3.5 text-center">
                        {typeof v === "boolean" ? (
                          v
                            ? <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                            : <span className="text-white/15">—</span>
                        ) : (
                          <span className="font-semibold text-white">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-white mb-6 text-center flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5 text-white/40" /> Questions fréquentes
          </h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-2">{q}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-white/30 text-sm mb-4">D&apos;autres questions ? On te répond en moins de 24h.</p>
            <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
              Commencer l&apos;essai gratuit <Check className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
