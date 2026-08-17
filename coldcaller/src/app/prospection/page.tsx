"use client";

import { useState, useCallback } from "react";
import {
  Search, Loader2, Zap, Download, Users, Mail,
  Building2, MapPin, Phone, Globe, ChevronDown,
  CheckCircle, AlertCircle, Clock, RefreshCw,
  Sparkles, X, ExternalLink, Copy, ChevronRight,
  Star, TrendingUp, Target,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import type { Prospect, ProspectStatut } from "@/lib/types-prospection";
import { STATUT_LABELS, STATUT_COLORS, TRANCHES_EFFECTIFS } from "@/lib/types-prospection";

// ── Niches → codes NAF ───────────────────────────────────────────────────────
const SECTEURS: Array<{ label: string; nafCodes: string[] }> = [
  { label: "Plomberie / Chauffage",     nafCodes: ["43.22A", "43.22C"] },
  { label: "Électricité",               nafCodes: ["43.21A", "43.21B"] },
  { label: "Maçonnerie / BTP",          nafCodes: ["43.99C", "41.20A", "43.12A"] },
  { label: "Peinture / Décoration",     nafCodes: ["43.34Z"] },
  { label: "Couverture / Toiture",      nafCodes: ["43.91A", "43.91B"] },
  { label: "Menuiserie",                nafCodes: ["43.32A", "43.32B"] },
  { label: "Paysagisme / Jardinage",    nafCodes: ["81.30Z"] },
  { label: "Nettoyage / Propreté",      nafCodes: ["81.21Z", "81.22Z"] },
  { label: "Immobilier / Agences",      nafCodes: ["68.31Z", "68.10Z"] },
  { label: "Conseil / Marketing",       nafCodes: ["70.22Z", "73.11Z", "73.12Z"] },
  { label: "Informatique / IT",         nafCodes: ["62.01Z", "62.02Z", "62.09Z"] },
  { label: "Comptabilité / Finance",    nafCodes: ["69.20Z"] },
  { label: "Avocat / Juridique",        nafCodes: ["69.10Z"] },
  { label: "Architecture",              nafCodes: ["71.11Z"] },
  { label: "Restaurant / Restauration", nafCodes: ["56.10A", "56.10B"] },
  { label: "Coiffure / Beauté",         nafCodes: ["96.02A", "96.02B"] },
  { label: "Auto / Garage",             nafCodes: ["45.20A", "45.20B"] },
  { label: "Médecin / Santé",           nafCodes: ["86.21Z", "86.22A"] },
  { label: "Kiné / Para-médical",       nafCodes: ["86.90A", "86.90B"] },
  { label: "Assurance / Courtage",      nafCodes: ["65.12Z", "66.22Z"] },
];

const DEPARTEMENTS = [
  "75", "69", "13", "31", "59", "33", "44", "67", "06", "34",
  "35", "76", "38", "92", "93", "94", "78", "91", "95", "77",
  "01", "02", "03", "04", "05", "07", "08", "09", "10", "11",
  "14", "15", "16", "17", "18", "19", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30", "32", "36", "37", "39",
  "40", "41", "42", "43", "45", "46", "47", "48", "49", "50",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61",
  "62", "63", "64", "65", "66", "68", "70", "71", "72", "73",
  "74", "79", "80", "81", "82", "83", "84", "85", "86", "87",
  "88", "89", "90",
];

const DEPT_LABELS: Record<string, string> = {
  "75": "Paris (75)", "69": "Rhône (69)", "13": "Bouches-du-Rhône (13)",
  "31": "Haute-Garonne (31)", "59": "Nord (59)", "33": "Gironde (33)",
  "44": "Loire-Atlantique (44)", "67": "Bas-Rhin (67)", "06": "Alpes-Maritimes (06)",
  "34": "Hérault (34)", "35": "Ille-et-Vilaine (35)", "76": "Seine-Maritime (76)",
  "38": "Isère (38)", "92": "Hauts-de-Seine (92)", "93": "Seine-Saint-Denis (93)",
  "94": "Val-de-Marne (94)", "78": "Yvelines (78)", "91": "Essonne (91)",
  "95": "Val-d'Oise (95)", "77": "Seine-et-Marne (77)", "29": "Finistère (29)",
};

// ── Badge statut ─────────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: ProspectStatut }) {
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border border-current/20", STATUT_COLORS[statut])}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

// ── Icône source email ────────────────────────────────────────────────────────
function EmailSourceIcon({ source }: { source?: string }) {
  if (!source) return null;
  if (source === "website_scraping") return <span title="Trouvé sur le site"><CheckCircle className="w-3 h-3 text-green-400" /></span>;
  if (source === "pattern_email")    return <span title="Email pattern (à vérifier)"><AlertCircle className="w-3 h-3 text-amber-400" /></span>;
  if (source === "google_places")    return <span title="Google Places"><Star className="w-3 h-3 text-brand-400" /></span>;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProspectionPage() {
  // ── Search form ──────────────────────────────────────────────────────────
  const [secteurIdx,  setSecteurIdx]  = useState(0);
  const [nafCustom,   setNafCustom]   = useState("");   // codes NAF manuels
  const [departement, setDepartement] = useState("69");
  const [tranche,     setTranche]     = useState("");
  const [perPage,     setPerPage]     = useState(50);

  // ── État ─────────────────────────────────────────────────────────────────
  const [prospects,   setProspects]   = useState<Prospect[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [searched,    setSearched]    = useState(false);
  const [enriching,   setEnriching]   = useState<Set<string>>(new Set());
  const [generating,  setGenerating]  = useState<Set<string>>(new Set());
  const [selected,    setSelected]    = useState<Prospect | null>(null);
  const [copied,      setCopied]      = useState(false);

  // ── Recherche ────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setError(null);
    setSelected(null);

    const secteur   = SECTEURS[secteurIdx];
    const nafCodes  = nafCustom
      ? nafCustom.split(",").map((s) => s.trim()).filter(Boolean)
      : secteur.nafCodes;

    try {
      const res = await fetch("/api/prospection/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nafCodes,
          secteur:     secteur.label,
          departement,
          trancheMin:  tranche || undefined,
          perPage,
          page: 1,
        }),
      });
      const data = await res.json() as { prospects: Prospect[]; total: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      setProspects(data.prospects);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [secteurIdx, nafCustom, departement, tranche, perPage]);

  // ── Charger les prospects sauvegardés ────────────────────────────────────
  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/prospection/prospects");
      const data = await res.json() as { prospects: Prospect[] };
      setProspects(data.prospects);
      setSearched(true);
    } catch { /* silencieux */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Enrichir un prospect ─────────────────────────────────────────────────
  const enrich = useCallback(async (p: Prospect) => {
    setEnriching((prev) => new Set([...Array.from(prev), p.id]));
    try {
      const res = await fetch("/api/prospection/enrich", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prospectId:         p.id,
          siren:              p.siren,
          nom:                p.nom,
          ville:              p.ville,
          siteWeb:            p.siteWeb,
          dirigeantPrincipal: p.dirigeantPrincipal,
        }),
      });
      const data = await res.json() as { prospect?: Prospect };
      if (data.prospect) {
        setProspects((prev) => prev.map((x) => x.id === p.id ? data.prospect! : x));
        if (selected?.id === p.id) setSelected(data.prospect);
      }
    } catch { /* silencieux */ } finally {
      setEnriching((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  }, [selected]);

  // ── Générer l'email ──────────────────────────────────────────────────────
  const generateEmail = useCallback(async (p: Prospect) => {
    setGenerating((prev) => new Set([...Array.from(prev), p.id]));
    try {
      const res = await fetch("/api/prospection/generate-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prospectId: p.id, prospect: p }),
      });
      const data = await res.json() as {
        generated?: { problematique: string; observation: string; angleApproche: string; objet: string; corps: string; scoreQualif: number };
        error?: string;
      };
      if (data.error) { setError(data.error); return; }
      if (data.generated) {
        const updated: Prospect = {
          ...p,
          problematique: data.generated.problematique,
          observation:   data.generated.observation,
          angleApproche: data.generated.angleApproche,
          emailObjet:    data.generated.objet,
          emailCorps:    data.generated.corps,
          scoreQualif:   data.generated.scoreQualif,
          statut:        "pret_a_envoyer",
        };
        setProspects((prev) => prev.map((x) => x.id === p.id ? updated : x));
        if (selected?.id === p.id) setSelected(updated);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  }, [selected]);

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const header = "SIREN,SIRET,Nom,Secteur,Ville,Département,Site,Dirigeant,Fonction,Email,Email source,Tél,Statut,Score,Problématique,Angle,Objet email";
    const rows   = prospects.map((p) =>
      [
        p.siren, p.siret ?? "", `"${p.nom}"`, `"${p.secteur}"`,
        p.ville ?? "", p.departement ?? "", p.siteWeb ?? "",
        p.dirigeantPrincipal ?? "", p.fonctionDirigeant ?? "",
        p.emailDirigeant ?? "", p.emailSource ?? "",
        p.telephonePro ?? "", p.statut,
        p.scoreQualif ?? "",
        `"${(p.problematique ?? "").replace(/"/g, "'")}"`,
        `"${(p.angleApproche ?? "").replace(/"/g, "'")}"`,
        `"${(p.emailObjet ?? "").replace(/"/g, "'")}"`,
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `prospects-b2b-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }, [prospects]);

  const withEmail = prospects.filter((p) => p.emailDirigeant).length;
  const prets     = prospects.filter((p) => p.statut === "pret_a_envoyer" || p.statut === "email_trouve" || p.statut === "email_verifie").length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />
      <main className="flex-1 flex overflow-hidden">

        {/* ── Colonne principale ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Top bar */}
          <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-5 h-14 flex items-center justify-between shrink-0">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-400" /> Prospection B2B
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={loadSaved} className="btn-outline text-xs py-1.5 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Mes prospects
              </button>
              {prospects.length > 0 && (
                <button onClick={exportCsv} className="btn-outline text-xs py-1.5 flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> Export CSV ({prospects.length})
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5">

            {/* ── Formulaire de recherche ── */}
            <div className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-sm font-bold text-white mb-0.5">Agent de prospection B2B</h2>
              <p className="text-xs text-white/35 mb-4">
                SIRENE → identification dirigeant → enrichissement → email IA personnalisé
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Secteur */}
                <div className="col-span-2 lg:col-span-1">
                  <label className="text-xs text-white/40 mb-1.5 block">Secteur d'activité</label>
                  <div className="relative">
                    <select value={secteurIdx} onChange={(e) => setSecteurIdx(Number(e.target.value))} className="select pr-8 w-full">
                      {SECTEURS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* NAF custom */}
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Codes NAF (optionnel)</label>
                  <input
                    type="text"
                    value={nafCustom}
                    onChange={(e) => setNafCustom(e.target.value)}
                    placeholder="ex: 62.01Z, 70.22Z"
                    className="input text-xs"
                  />
                </div>

                {/* Département */}
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Département</label>
                  <div className="relative">
                    <select value={departement} onChange={(e) => setDepartement(e.target.value)} className="select pr-8">
                      {DEPARTEMENTS.map((d) => (
                        <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* Taille */}
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Taille min.</label>
                  <div className="relative">
                    <select value={tranche} onChange={(e) => setTranche(e.target.value)} className="select pr-8">
                      <option value="">Toutes</option>
                      {Object.entries(TRANCHES_EFFECTIFS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button onClick={handleSearch} disabled={loading}
                  className={cn("btn-primary flex items-center gap-2 text-sm px-8 py-3", loading && "opacity-70 cursor-not-allowed")}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche SIRENE…</>
                    : <><Zap className="w-4 h-4" /> Trouver des prospects</>}
                </button>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white/50">
                    <option value={25}>25 résultats</option>
                    <option value={50}>50 résultats</option>
                    <option value={100}>100 résultats</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Erreur ── */}
            {error && (
              <div className="glass rounded-xl p-4 mb-4 flex items-start gap-3 border-red-500/20 bg-red-500/[0.05]">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm">{error}</p>
                  {error.includes("ANTHROPIC") && (
                    <p className="text-red-400/60 text-xs mt-1">
                      Ajoutez <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code> dans les variables Vercel pour activer la génération d'email IA.
                    </p>
                  )}
                </div>
                <button onClick={() => setError(null)} className="ml-auto shrink-0 text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Stats ── */}
            {searched && !loading && prospects.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Prospects",   value: prospects.length,  icon: Users,     color: "text-white" },
                  { label: "Avec email",  value: withEmail,         icon: Mail,      color: "text-violet-400" },
                  { label: "Prêts",       value: prets,             icon: CheckCircle, color: "text-green-400" },
                  { label: "Avec site",   value: prospects.filter((p) => p.siteWeb).length, icon: Globe, color: "text-sky-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="glass rounded-xl p-3 flex items-center gap-3">
                    <Icon className={cn("w-5 h-5 shrink-0", color)} />
                    <div>
                      <div className="text-lg font-bold text-white">{value}</div>
                      <div className="text-[10px] text-white/40">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Table des prospects ── */}
            {searched && !loading && prospects.length > 0 && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Entreprise</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Dirigeant</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Email</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Tél.</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Statut</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Score</th>
                        <th className="text-left text-white/30 font-medium px-4 py-3 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.map((p) => {
                        const isEnriching  = enriching.has(p.id);
                        const isGenerating = generating.has(p.id);
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelected(p)}
                            className={cn(
                              "border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors",
                              selected?.id === p.id && "bg-violet-500/[0.08]"
                            )}
                          >
                            {/* Entreprise */}
                            <td className="px-4 py-3 whitespace-nowrap max-w-[200px]">
                              <div className="font-medium text-white truncate">{p.nom}</div>
                              <div className="text-white/35 text-[10px]">{p.ville} · {p.codeNaf}</div>
                            </td>

                            {/* Dirigeant */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {p.dirigeantPrincipal
                                ? <><div className="text-white/80">{p.dirigeantPrincipal}</div><div className="text-white/30 text-[10px]">{p.fonctionDirigeant}</div></>
                                : <span className="text-white/20 italic">—</span>}
                            </td>

                            {/* Email */}
                            <td className="px-4 py-3 whitespace-nowrap max-w-[180px]">
                              {p.emailDirigeant ? (
                                <div className="flex items-center gap-1.5">
                                  <EmailSourceIcon source={p.emailSource} />
                                  <span className="font-mono text-violet-300 text-[10px] truncate">{p.emailDirigeant}</span>
                                </div>
                              ) : (
                                <span className="text-white/20 italic text-[10px]">Non trouvé</span>
                              )}
                            </td>

                            {/* Tél */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {p.telephonePro
                                ? <span className="font-mono text-brand-300 text-[10px]">{p.telephonePro}</span>
                                : <span className="text-white/20">—</span>}
                            </td>

                            {/* Statut */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatutBadge statut={p.statut} />
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {p.scoreQualif != null ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full", p.scoreQualif >= 70 ? "bg-green-400" : p.scoreQualif >= 40 ? "bg-amber-400" : "bg-red-400")}
                                      style={{ width: `${p.scoreQualif}%` }}
                                    />
                                  </div>
                                  <span className="text-white/50 text-[10px]">{p.scoreQualif}</span>
                                </div>
                              ) : <span className="text-white/20">—</span>}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => enrich(p)}
                                  disabled={isEnriching}
                                  title="Enrichir (site, email)"
                                  className="p-1.5 rounded-lg text-white/30 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                                >
                                  {isEnriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => generateEmail(p)}
                                  disabled={isGenerating}
                                  title="Générer email IA"
                                  className="p-1.5 rounded-lg text-white/30 hover:text-violet-300 hover:bg-violet-500/10 transition-all"
                                >
                                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── État vide ── */}
            {searched && !loading && prospects.length === 0 && (
              <div className="glass rounded-2xl p-12 text-center">
                <Users className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Aucun prospect trouvé pour ces critères.</p>
                <p className="text-white/25 text-xs mt-1">Essayez un autre département ou secteur.</p>
              </div>
            )}

            {!searched && (
              <div className="glass rounded-2xl p-12 text-center">
                <Target className="w-8 h-8 text-violet-400/40 mx-auto mb-3" />
                <p className="text-white/40 text-sm font-medium">Agent B2B prêt</p>
                <p className="text-white/25 text-xs mt-1">Sélectionnez un secteur et un département, puis lancez la recherche.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau de détail ── */}
        {selected && (
          <div className="w-[420px] shrink-0 border-l border-white/[0.06] overflow-auto bg-ink-950/50 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-ink-950/95 backdrop-blur px-5 py-4 border-b border-white/[0.06] flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{selected.nom}</h3>
                <p className="text-xs text-white/35 mt-0.5">{selected.libelleNaf || selected.secteur}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors ml-2 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* Statut + Score */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatutBadge statut={selected.statut} />
                {selected.scoreQualif != null && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-white/60">Score : <span className="font-bold text-white">{selected.scoreQualif}/100</span></span>
                  </div>
                )}
              </div>

              {/* Infos société */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Entreprise</h4>
                <InfoRow icon={Building2} label="SIREN" value={selected.siren} mono />
                {selected.siret && <InfoRow icon={Building2} label="SIRET" value={selected.siret} mono />}
                <InfoRow icon={MapPin} label="Adresse" value={[selected.adresse, selected.codePostal, selected.ville].filter(Boolean).join(" ")} />
                {selected.trancheEffectifs && (
                  <InfoRow icon={Users} label="Effectifs" value={TRANCHES_EFFECTIFS[selected.trancheEffectifs] ?? selected.trancheEffectifs} />
                )}
                {selected.dateCreation && (
                  <InfoRow icon={Clock} label="Création" value={selected.dateCreation.slice(0, 4)} />
                )}
                {selected.siteWeb && (
                  <InfoRow
                    icon={Globe}
                    label="Site web"
                    value={selected.siteWeb}
                    link={`https://${selected.siteWeb}`}
                  />
                )}
              </div>

              {/* Dirigeant */}
              {(selected.dirigeantPrincipal || selected.emailDirigeant || selected.telephonePro) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Dirigeant / Contact</h4>
                  {selected.dirigeantPrincipal && <InfoRow icon={Users} label="Nom" value={selected.dirigeantPrincipal} />}
                  {selected.fonctionDirigeant && <InfoRow icon={Users} label="Fonction" value={selected.fonctionDirigeant} />}
                  {selected.emailDirigeant && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-violet-300 truncate">{selected.emailDirigeant}</span>
                          <EmailSourceIcon source={selected.emailSource} />
                          {selected.emailSource === "pattern_email" && (
                            <span className="text-[9px] text-amber-400/70 border border-amber-400/20 rounded px-1">pattern</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(selected.emailDirigeant!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                        className="shrink-0 text-white/20 hover:text-white/60 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {selected.telephonePro && <InfoRow icon={Phone} label="Tél." value={selected.telephonePro} mono />}
                </div>
              )}

              {/* Qualification IA */}
              {(selected.problematique || selected.observation || selected.angleApproche) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Qualification IA</h4>
                  {selected.problematique && (
                    <div className="rounded-xl bg-white/[0.04] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Problématique identifiée</p>
                      <p className="text-xs text-white/80">{selected.problematique}</p>
                    </div>
                  )}
                  {selected.observation && (
                    <div className="rounded-xl bg-white/[0.04] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Observation</p>
                      <p className="text-xs text-white/80">{selected.observation}</p>
                    </div>
                  )}
                  {selected.angleApproche && (
                    <div className="rounded-xl bg-violet-500/[0.08] border border-violet-500/20 p-3">
                      <p className="text-[10px] text-violet-300/60 mb-1">Angle d'approche</p>
                      <p className="text-xs text-violet-200">{selected.angleApproche}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Email généré */}
              {selected.emailCorps && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Email personnalisé</h4>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`Objet : ${selected.emailObjet}\n\n${selected.emailCorps}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      <Copy className="w-3 h-3" /> {copied ? "Copié !" : "Copier"}
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Objet</p>
                      <p className="text-xs font-medium text-white">{selected.emailObjet}</p>
                    </div>
                    <div className="h-px bg-white/[0.06]" />
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Corps</p>
                      <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{selected.emailCorps}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => enrich(selected)}
                  disabled={enriching.has(selected.id)}
                  className="w-full btn-outline flex items-center justify-center gap-2 text-sm py-2.5"
                >
                  {enriching.has(selected.id)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enrichissement…</>
                    : <><RefreshCw className="w-4 h-4" /> Enrichir (site + email)</>}
                </button>
                <button
                  onClick={() => generateEmail(selected)}
                  disabled={generating.has(selected.id)}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2.5 bg-violet-600 hover:bg-violet-500"
                >
                  {generating.has(selected.id)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération IA…</>
                    : <><Sparkles className="w-4 h-4" /> Générer email IA</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Composant ligne d'info ────────────────────────────────────────────────────
function InfoRow({
  icon: Icon, label, value, mono, link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value?: string; mono?: boolean; link?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-white/35 text-[10px]">{label} · </span>
        {link
          ? <a href={link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors truncate inline-flex items-center gap-0.5">
              {value} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          : <span className={cn("text-xs text-white/70", mono && "font-mono")}>{value}</span>}
      </div>
    </div>
  );
}
