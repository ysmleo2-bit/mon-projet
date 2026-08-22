"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Loader2, Zap, Download, Users, Mail, Building2,
  Phone, Globe, CheckCircle, AlertCircle, RefreshCw,
  Sparkles, X, ExternalLink, Copy, Star, TrendingUp,
  Target, PhoneCall, PhoneMissed, PhoneOff, MessageSquare,
  Hash, Calendar, Briefcase, Database, Clock, RotateCcw,
  Search, ChevronRight, Send, FileText, Plus, Trash2, Eye,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import type { Prospect, ProspectStatut, StatutAppel } from "@/lib/types-prospection";
import type { EmailTemplate } from "@/lib/db-templates";
import {
  STATUT_LABELS, STATUT_COLORS,
  STATUT_APPEL_LABELS, STATUT_APPEL_COLORS,
  TRANCHES_EFFECTIFS,
} from "@/lib/types-prospection";

// ── Secteurs → codes NAF ──────────────────────────────────────────────────────
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
  { label: "Transport / Logistique",    nafCodes: ["49.41A", "49.41B", "49.41C", "49.42Z", "52.10A", "52.10B", "52.21Z"] },
  { label: "Transport de personnes",    nafCodes: ["49.32Z", "49.39A", "49.39B", "49.31Z"] },
  { label: "Livraison / Coursiers",     nafCodes: ["53.20Z", "49.41B", "52.29A"] },
];

const DEPARTEMENTS = [
  "75","69","13","31","59","33","44","67","06","34","35","76","38",
  "92","93","94","78","91","95","77","29","22","56","14","30","42",
  "63","57","01","02","03","04","05","07","08","09","10","11","15",
  "16","17","18","19","21","23","24","25","26","27","28","32","36",
  "37","39","40","41","43","45","46","47","48","49","50","51","52",
  "53","54","55","58","60","61","62","64","65","66","68","70","71",
  "72","73","74","79","80","81","82","83","84","85","86","87","88",
  "89","90",
];

const DEPT_LABELS: Record<string, string> = {
  "75":"Paris (75)","69":"Rhône (69)","13":"Bouches-du-Rhône (13)",
  "31":"Haute-Garonne (31)","59":"Nord (59)","33":"Gironde (33)",
  "44":"Loire-Atlantique (44)","67":"Bas-Rhin (67)","06":"Alpes-Maritimes (06)",
  "34":"Hérault (34)","35":"Ille-et-Vilaine (35)","76":"Seine-Maritime (76)",
  "38":"Isère (38)","92":"Hauts-de-Seine (92)","93":"Seine-Saint-Denis (93)",
  "94":"Val-de-Marne (94)","78":"Yvelines (78)","91":"Essonne (91)",
  "95":"Val-d'Oise (95)","77":"Seine-et-Marne (77)","29":"Finistère (29)",
  "22":"Côtes-d'Armor (22)","56":"Morbihan (56)","14":"Calvados (14)",
  "30":"Gard (30)","42":"Loire (42)","63":"Puy-de-Dôme (63)","57":"Moselle (57)",
};

const STATUT_APPEL_ICONS: Record<StatutAppel, typeof PhoneCall> = {
  non_appele:         Clock,
  decroche:           PhoneCall,
  pas_decroche:       PhoneMissed,
  mail_envoye:        Mail,
  echange_sans_suite: MessageSquare,
  r1_booke:           Calendar,
  a_rappeler:         RotateCcw,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: ProspectStatut }) {
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border border-current/20 whitespace-nowrap", STATUT_COLORS[statut])}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

function AppelBadge({ statut }: { statut?: StatutAppel }) {
  const s = statut ?? "non_appele";
  const Icon = STATUT_APPEL_ICONS[s];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap", STATUT_APPEL_COLORS[s])}>
      <Icon className="w-2.5 h-2.5" />
      {STATUT_APPEL_LABELS[s]}
    </span>
  );
}

function EmailSourceIcon({ source }: { source?: string }) {
  if (!source) return null;
  if (source === "website_scraping") return <span title="Trouvé sur le site"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" /></span>;
  if (source === "pattern_email")    return <span title="Pattern email — à vérifier"><AlertCircle className="w-3 h-3 text-amber-400 shrink-0" /></span>;
  if (source === "google_places")    return <span title="Google Places"><Star className="w-3 h-3 text-brand-500 shrink-0" /></span>;
  return null;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 p-1 rounded text-gray-300 hover:text-gray-600 transition-colors shrink-0" title="Copier">
      {done ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {label && <span className="text-[10px]">{done ? "Copié !" : label}</span>}
    </button>
  );
}

function roleBadge(qualite?: string): string {
  if (!qualite) return "";
  const q = qualite.toLowerCase();
  if (q.includes("gérant"))    return "Gérant";
  if (q.includes("président")) return "Président";
  if (q.includes("directeur")) return "Directeur";
  if (q.includes("associé"))   return "Associé";
  if (q.includes("fondateur")) return "Fondateur";
  return qualite.split(" ").slice(0, 3).join(" ");
}

function InfoRow({ icon: Icon, label, value, copy }: {
  icon: typeof Hash; label: string; value?: string | null; copy?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
      <span className="text-[10px] text-gray-400 shrink-0 w-20">{label}</span>
      <span className="text-xs text-gray-700 flex-1 break-words">{value}</span>
      {copy && <CopyBtn text={value} />}
    </div>
  );
}

// ── Substitution variables template ──────────────────────────────────────────
function substituteVars(text: string, p: Prospect): string {
  const vars: Record<string, string> = {
    nom:       p.nom,
    ville:     p.ville ?? "",
    dirigeant: p.dirigeantPrincipal ?? "Madame, Monsieur",
    secteur:   p.libelleNaf || p.secteur || "",
    site:      p.siteWeb ?? "",
    siren:     p.siren,
    naf:       p.codeNaf ?? "",
  };
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

// ── Composant modal email ─────────────────────────────────────────────────────
function EmailComposerModal({
  prospect, onClose,
}: {
  prospect: Prospect;
  onClose: () => void;
}) {
  const [templates,    setTemplates]    = useState<EmailTemplate[]>([]);
  const [selTpl,       setSelTpl]       = useState<string | null>(null);
  const [subject,      setSubject]      = useState(prospect.emailObjet ?? "");
  const [body,         setBody]         = useState(prospect.emailCorps ?? "");
  const [loadingTpl,   setLoadingTpl]   = useState(true);
  const [showNewTpl,   setShowNewTpl]   = useState(false);
  const [newName,      setNewName]      = useState("");
  const [newSubject,   setNewSubject]   = useState("");
  const [newBody,      setNewBody]      = useState("");
  const [savingTpl,    setSavingTpl]    = useState(false);
  const [copiedAll,    setCopiedAll]    = useState(false);

  useEffect(() => {
    fetch("/api/prospection/templates")
      .then((r) => r.json())
      .then((d) => { setTemplates(d.templates ?? []); setLoadingTpl(false); })
      .catch(() => setLoadingTpl(false));
  }, []);

  const applyTemplate = (tpl: EmailTemplate) => {
    setSelTpl(tpl.id);
    setSubject(substituteVars(tpl.subject, prospect));
    setBody(substituteVars(tpl.body, prospect));
  };

  const saveNewTemplate = async () => {
    if (!newName || !newSubject || !newBody) return;
    setSavingTpl(true);
    try {
      const res = await fetch("/api/prospection/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, subject: newSubject, body: newBody }),
      });
      const data = await res.json() as { template?: EmailTemplate };
      if (data.template) {
        setTemplates((prev) => [...prev, data.template!]);
        setNewName(""); setNewSubject(""); setNewBody(""); setShowNewTpl(false);
      }
    } finally { setSavingTpl(false); }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/prospection/templates", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selTpl === id) setSelTpl(null);
  };

  const mailto = `mailto:${prospect.emailDirigeant ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyAll = () => {
    navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[960px] max-h-[90vh] bg-ink-950 border border-white/[0.12] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Composer un email — {prospect.nom}</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Pour : <span className="text-violet-300 font-mono">{prospect.emailDirigeant ?? "(aucun email — email non trouvé)"}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Colonne gauche : templates */}
          <div className="w-64 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Modèles</p>
              <button onClick={() => setShowNewTpl(!showNewTpl)}
                className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> Nouveau
              </button>
            </div>

            {showNewTpl && (
              <div className="p-3 border-b border-white/[0.04] space-y-2 bg-white/[0.02]">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom du modèle" className="input w-full text-xs py-1.5" />
                <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Objet (ex: {{nom}} — …)" className="input w-full text-xs py-1.5" />
                <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Corps (utilisez {{nom}}, {{dirigeant}}, {{ville}}…)" rows={4}
                  className="input w-full text-xs py-1.5 resize-none" />
                <div className="flex gap-1.5">
                  <button onClick={saveNewTemplate} disabled={savingTpl || !newName || !newSubject || !newBody}
                    className="btn-primary text-xs py-1.5 px-3 flex-1 disabled:opacity-50">
                    {savingTpl ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Enregistrer"}
                  </button>
                  <button onClick={() => setShowNewTpl(false)}
                    className="text-white/40 hover:text-white text-xs px-2 transition-colors">
                    Annuler
                  </button>
                </div>
                <p className="text-[9px] text-white/25">Variables : {"{{nom}}"} {"{{dirigeant}}"} {"{{ville}}"} {"{{secteur}}"} {"{{site}}"}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* Sans template */}
              <button
                onClick={() => { setSelTpl(null); setSubject(prospect.emailObjet ?? ""); setBody(prospect.emailCorps ?? ""); }}
                className={cn("w-full px-4 py-3 text-left border-b border-white/[0.04] text-xs transition-colors",
                  selTpl === null ? "bg-brand-500/10 text-brand-300" : "text-white/40 hover:bg-white/[0.03] hover:text-white/70")}>
                <div className="font-medium">Sans modèle</div>
                <div className="text-[10px] mt-0.5 opacity-70">Utiliser l'email IA ou écrire librement</div>
              </button>
              {loadingTpl && <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin text-white/30 mx-auto" /></div>}
              {templates.map((tpl) => (
                <button key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className={cn("w-full px-4 py-3 text-left border-b border-white/[0.04] text-xs transition-colors group",
                    selTpl === tpl.id ? "bg-brand-500/10 text-brand-300" : "text-white/60 hover:bg-white/[0.03] hover:text-white/80")}>
                  <div className="flex items-start justify-between">
                    <span className="font-medium pr-2">{tpl.name}</span>
                    <button onClick={(e) => deleteTemplate(tpl.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] mt-0.5 opacity-60 truncate">{tpl.subject}</div>
                  {tpl.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tpl.variables.slice(0, 4).map((v) => (
                        <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30">{"{{" + v + "}}"}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Colonne droite : compositeur */}
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-3">
            <div>
              <label className="text-[10px] text-white/40 mb-1.5 block">Objet</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet de votre email…"
                className="input w-full text-sm font-medium" />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-[10px] text-white/40 mb-1.5 block">Corps</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Rédigez votre message ici…&#10;&#10;Utilisez {{nom}}, {{dirigeant}}, {{ville}} pour personnaliser."
                className="flex-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm resize-none placeholder:text-white/20 focus:outline-none focus:border-brand-500/50 transition-colors font-mono leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/25">
              <span>{body.split(/\s+/).filter(Boolean).length} mots · {body.length} caractères</span>
              <span>Variables restantes : {(subject + body).match(/\{\{[^}]+\}\}/g)?.length ?? 0} non substituées</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-white/40 hover:text-white transition-colors">Annuler</button>
          <div className="flex items-center gap-3">
            <button onClick={copyAll}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-4 py-2 transition-all">
              {copiedAll ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copiedAll ? "Copié !" : "Copier le message"}
            </button>
            <a href={mailto}
              className="flex items-center gap-2 text-sm btn-primary px-4 py-2 rounded-lg">
              <Send className="w-4 h-4" /> Ouvrir dans ma messagerie
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ProspectionPage() {
  // ── Formulaire ───────────────────────────────────────────────────────────
  const [secteurIdx,  setSecteurIdx]  = useState(0);
  const [nafCustom,   setNafCustom]   = useState("");
  const [departement, setDepartement] = useState("69");
  const [tranche,     setTranche]     = useState("");
  const [trancheMax,  setTrancheMax]  = useState("");
  const [perPage,     setPerPage]     = useState(50);
  const [showSearch,  setShowSearch]  = useState(true);

  // ── État ─────────────────────────────────────────────────────────────────
  const [prospects,      setProspects]      = useState<Prospect[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [searched,       setSearched]       = useState(false);
  const [enriching,      setEnriching]      = useState<Set<string>>(new Set());
  const [generating,     setGenerating]     = useState<Set<string>>(new Set());
  const [selected,       setSelected]       = useState<Prospect | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const [showComposer,   setShowComposer]   = useState(false);

  // ── localStorage persistence ──────────────────────────────────────────────
  const [hydrated, setHydrated] = useState(false);

  // Notes locales
  const [editNotes,  setEditNotes]  = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    setEditNotes(selected?.notesCommercial ?? "");
    setNotesDirty(false);
  }, [selected?.id]);

  // Restore state from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("coldcaller_prospection_state");
      if (raw) {
        const saved = JSON.parse(raw) as {
          secteurIdx?: number; nafCustom?: string; departement?: string;
          tranche?: string; trancheMax?: string; perPage?: number;
          prospects?: Prospect[]; searched?: boolean; showSearch?: boolean;
        };
        if (saved.secteurIdx  !== undefined) setSecteurIdx(saved.secteurIdx);
        if (saved.nafCustom   !== undefined) setNafCustom(saved.nafCustom);
        if (saved.departement !== undefined) setDepartement(saved.departement);
        if (saved.tranche     !== undefined) setTranche(saved.tranche);
        if (saved.trancheMax  !== undefined) setTrancheMax(saved.trancheMax);
        if (saved.perPage     !== undefined) setPerPage(saved.perPage);
        if (Array.isArray(saved.prospects) && saved.prospects.length > 0) {
          setProspects(saved.prospects);
          setSearched(true);
          // If there are results, hide the search panel by default
          setShowSearch(false);
        } else {
          if (saved.searched  !== undefined) setSearched(saved.searched);
          if (saved.showSearch !== undefined) setShowSearch(saved.showSearch);
        }
      }
    } catch { /* ignore storage errors */ } finally {
      setHydrated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist search params + results to localStorage after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("coldcaller_prospection_state", JSON.stringify({
        secteurIdx, nafCustom, departement, tranche, trancheMax, perPage,
        prospects, searched, showSearch,
      }));
    } catch { /* ignore storage errors */ }
  }, [hydrated, secteurIdx, nafCustom, departement, tranche, trancheMax, perPage, prospects, searched, showSearch]);

  // ── Mise à jour optimiste ─────────────────────────────────────────────────
  const updateProspect = useCallback(async (id: string, patch: Partial<Prospect>) => {
    // Optimistic update
    setProspects((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } : x));
    setSelected((prev) => prev?.id === id ? { ...prev, ...patch } as Prospect : prev);
    try {
      const res  = await fetch("/api/prospection/prospects", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, patch }),
      });
      const data = await res.json() as { prospect?: Prospect; crmSynced?: boolean };
      // If CRM was synced server-side, update local state to reflect danscrm=true
      if (data.crmSynced && data.prospect) {
        setProspects((prev) => prev.map((x) => x.id === id ? data.prospect! : x));
        setSelected((prev) => prev?.id === id ? data.prospect! : prev);
      }
    } catch { /* silencieux */ }
  }, []);

  // ── Enrichissement ────────────────────────────────────────────────────────
  const enrich = useCallback(async (p: Prospect) => {
    setEnriching((prev) => new Set([...Array.from(prev), p.id]));
    try {
      const res  = await fetch("/api/prospection/enrich", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prospectId:          p.id,
          siren:               p.siren,
          nom:                 p.nom,
          ville:               p.ville,
          adresse:             p.adresse,
          codePostal:          p.codePostal,
          siteWeb:             p.siteWeb,
          telephonePro:        p.telephonePro,
          dirigeantPrincipal:  p.dirigeantPrincipal,
          libelleNaf:          p.libelleNaf,
        }),
      });
      const data = await res.json() as { prospect?: Prospect };
      if (data.prospect) {
        setProspects((prev) => prev.map((x) => x.id === p.id ? data.prospect! : x));
        setSelected((prev) => prev?.id === p.id ? data.prospect! : prev);
      }
    } catch { /* silencieux */ } finally {
      setEnriching((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  }, []);

  // ── Enrichissement en masse ───────────────────────────────────────────────
  const enrichAll = useCallback(async (list: Prospect[]) => {
    const BATCH = 6;
    setEnrichProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      await Promise.all(batch.map((p) => enrich(p)));
      setEnrichProgress({ done: Math.min(i + BATCH, list.length), total: list.length });
    }
    setEnrichProgress(null);
  }, [enrich]);

  // ── Email IA ──────────────────────────────────────────────────────────────
  const generateEmail = useCallback(async (p: Prospect) => {
    setGenerating((prev) => new Set([...Array.from(prev), p.id]));
    try {
      const res  = await fetch("/api/prospection/generate-email", {
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
        const patch: Partial<Prospect> = {
          problematique: data.generated.problematique,
          observation:   data.generated.observation,
          angleApproche: data.generated.angleApproche,
          emailObjet:    data.generated.objet,
          emailCorps:    data.generated.corps,
          scoreQualif:   data.generated.scoreQualif,
          statut:        "pret_a_envoyer",
        };
        setProspects((prev) => prev.map((x) => x.id === p.id ? { ...x, ...patch } : x));
        setSelected((prev) => prev?.id === p.id ? { ...prev, ...patch } as Prospect : prev);
      }
    } catch (e) { setError(String(e)); } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  }, []);

  // ── CRM Sync ──────────────────────────────────────────────────────────────
  const syncToCrm = useCallback(async (p: Prospect) => {
    setIsSyncing(true);
    try {
      const res  = await fetch("/api/prospection/crm-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prospect: p }),
      });
      const data = await res.json() as { ok: boolean; leadId?: string; error?: string };
      if (data.ok) {
        await updateProspect(p.id, { danscrm: true, dateCrm: new Date().toISOString() });
      } else if (data.error) {
        setError("Sync CRM : " + data.error);
      }
    } catch (e) { setError(String(e)); } finally { setIsSyncing(false); }
  }, [updateProspect]);

  // ── Recherche SIRENE ─────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    setLoading(true); setSearched(true); setError(null);
    setSelected(null); setEnrichProgress(null);

    const secteur  = SECTEURS[secteurIdx];
    const nafCodes = nafCustom
      ? nafCustom.split(",").map((s) => s.trim()).filter(Boolean)
      : secteur.nafCodes;

    try {
      const res  = await fetch("/api/prospection/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nafCodes, secteur: secteur.label, departement, trancheMin: tranche || undefined, trancheMax: trancheMax || undefined, perPage, page: 1 }),
      });
      const data = await res.json() as { prospects: Prospect[]; total: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      setProspects(data.prospects);
      setShowSearch(false);
      if (data.prospects.length > 0) enrichAll(data.prospects).catch(() => setEnrichProgress(null));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, [secteurIdx, nafCustom, departement, tranche, trancheMax, perPage, enrichAll]);

  // ── Save notes ────────────────────────────────────────────────────────────
  const saveNotes = useCallback(() => {
    if (!selected || !notesDirty) return;
    updateProspect(selected.id, { notesCommercial: editNotes });
    setNotesDirty(false);
  }, [selected, notesDirty, editNotes, updateProspect]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const header = ["SIREN","SIRET","Société","Secteur","NAF","Ville","Dept","Effectifs","Création","Dirigeant","Fonction","Email","Source email","Tél","Site","Statut pipeline","Statut appel","Dans CRM","Score","Notes"];
    const rows = prospects.map((p) => [
      p.siren, p.siret ?? "", p.nom, p.secteur, p.codeNaf,
      p.ville ?? "", p.departement ?? "", TRANCHES_EFFECTIFS[p.trancheEffectifs ?? ""] ?? "",
      p.dateCreation?.slice(0, 4) ?? "", p.dirigeantPrincipal ?? "", p.fonctionDirigeant ?? "",
      p.emailDirigeant ?? "", p.emailSource ?? "", p.telephonePro ?? "", p.siteWeb ?? "",
      STATUT_LABELS[p.statut], STATUT_APPEL_LABELS[p.statutAppel ?? "non_appele"],
      p.danscrm ? "Oui" : "Non", p.scoreQualif ?? "", p.notesCommercial ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));
    const csv  = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "prospects-b2b.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [prospects]);

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const withEmail = prospects.filter((p) => p.emailDirigeant).length;
  const withSite  = prospects.filter((p) => p.siteWeb).length;
  const withTel   = prospects.filter((p) => p.telephonePro).length;
  const appeles   = prospects.filter((p) => p.statutAppel && p.statutAppel !== "non_appele").length;

  // ── Copy all contact info ─────────────────────────────────────────────────
  const copyContactCard = (p: Prospect) => {
    const lines = [
      `Société : ${p.nom}`,
      p.dirigeantPrincipal ? `Dirigeant : ${p.dirigeantPrincipal}${p.fonctionDirigeant ? ` (${p.fonctionDirigeant})` : ""}` : null,
      p.emailDirigeant ? `Email : ${p.emailDirigeant}` : null,
      p.telephonePro ? `Tél : ${p.telephonePro}` : null,
      p.siteWeb ? `Site : ${p.siteWeb}` : null,
      `SIREN : ${p.siren}`,
      p.siret ? `SIRET : ${p.siret}` : null,
      p.adresse ? `Adresse : ${[p.adresse, p.codePostal, p.ville].filter(Boolean).join(", ")}` : null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Navbar />

      {/* ── Email composer modal ── */}
      {showComposer && selected && (
        <EmailComposerModal prospect={selected} onClose={() => setShowComposer(false)} />
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Liste principale ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="shrink-0 px-6 pt-5 pb-3 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-base font-bold text-gray-900">Agent de prospection B2B</h1>
                <p className="text-xs text-gray-400 mt-0.5">SIRENE → enrichissement auto → suivi commercial → CRM</p>
              </div>
              <div className="flex items-center gap-2">
                {prospects.length > 0 && (
                  <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-all bg-white">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
                <button onClick={() => setShowSearch(!showSearch)}
                  className="flex items-center gap-1.5 text-xs text-brand-600 border border-brand-300 hover:bg-brand-50 rounded-lg px-3 py-1.5 transition-all bg-white font-medium">
                  <Search className="w-3.5 h-3.5" />
                  {showSearch ? "Masquer" : "Nouvelle recherche"}
                </button>
              </div>
            </div>

            {showSearch && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase tracking-wider">Secteur d'activité</label>
                    <select value={secteurIdx} onChange={(e) => setSecteurIdx(Number(e.target.value))} className="select w-full text-xs">
                      {SECTEURS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase tracking-wider">Codes NAF (optionnel)</label>
                    <input value={nafCustom} onChange={(e) => setNafCustom(e.target.value)}
                      placeholder="ex: 62.01Z, 70.22Z" className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase tracking-wider">Département</label>
                    <select value={departement} onChange={(e) => setDepartement(e.target.value)} className="select w-full text-xs">
                      {DEPARTEMENTS.map((d) => <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase tracking-wider">Effectifs min.</label>
                    <select value={tranche} onChange={(e) => setTranche(e.target.value)} className="select w-full text-xs">
                      <option value="">Aucun</option>
                      {(["00","01","02","03","11","12","21","22","31","32","41","42","51","52","53"] as const).map((k) => (
                        <option key={k} value={k}>{TRANCHES_EFFECTIFS[k]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase tracking-wider">Effectifs max.</label>
                    <select value={trancheMax} onChange={(e) => setTrancheMax(e.target.value)} className="select w-full text-xs">
                      <option value="">Aucun</option>
                      {(["00","01","02","03","11","12","21","22","31","32","41","42","51","52","53"] as const).map((k) => (
                        <option key={k} value={k}>{TRANCHES_EFFECTIFS[k]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleSearch} disabled={loading}
                    className={cn("btn-primary flex items-center gap-2 text-sm px-6 py-2.5", loading && "opacity-70 cursor-not-allowed")}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche…</> : <><Zap className="w-4 h-4" /> Trouver des prospects</>}
                  </button>
                  <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="bg-white border border-gray-200 rounded-lg px-2 py-2 text-gray-500 text-xs focus:outline-none focus:border-brand-400">
                    <option value={25}>25 résultats</option>
                    <option value={50}>50 résultats</option>
                    <option value={100}>100 résultats</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-600 text-xs flex items-center gap-2">
                <X className="w-3.5 h-3.5 shrink-0" /> {error}
                <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-600"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>

          {/* ── Stats + progress ── */}
          {searched && !loading && prospects.length > 0 && (
            <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white space-y-2">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Prospects",  value: prospects.length, icon: Users,     color: "text-gray-600" },
                  { label: "Avec site",  value: withSite,         icon: Globe,     color: "text-sky-500" },
                  { label: "Avec email", value: withEmail,        icon: Mail,      color: "text-violet-500" },
                  { label: "Avec tél.",  value: withTel,          icon: Phone,     color: "text-brand-500" },
                  { label: "Appelés",    value: appeles,          icon: PhoneCall, color: "text-green-500" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center gap-2 shadow-sm">
                    <Icon className={cn("w-4 h-4 shrink-0", color)} />
                    <div>
                      <div className="text-sm font-bold text-gray-900">{value}</div>
                      <div className="text-[9px] text-gray-400">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
              {enrichProgress && (
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Enrichissement en cours…</span>
                      <span className="text-gray-900 font-semibold">{enrichProgress.done}/{enrichProgress.total}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((enrichProgress.done / enrichProgress.total) * 100)}%` }} />
                    </div>
                  </div>
                  <button onClick={() => setEnrichProgress(null)} className="text-gray-300 hover:text-gray-600"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}

          {/* ── Tableau ── */}
          <div className="flex-1 overflow-auto bg-slate-50">
            {searched && !loading && prospects.length > 0 && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Entreprise</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Dirigeant</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Site</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Email</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Tél.</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Appel</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Pipeline</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">Score</th>
                    <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => {
                    const isEnriching = enriching.has(p.id);
                    return (
                      <tr key={p.id} onClick={() => setSelected(p)}
                        className={cn(
                          "border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors bg-white",
                          selected?.id === p.id && "bg-brand-50 border-l-2 border-l-brand-500"
                        )}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-gray-900 truncate max-w-[160px]">{p.nom}</div>
                          <div className="text-gray-400 text-[10px] mt-0.5">{p.ville} · {p.codeNaf}</div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.dirigeantPrincipal
                            ? <><div className="text-gray-700 truncate max-w-[140px]">{p.dirigeantPrincipal}</div>
                               <div className="text-gray-400 text-[10px]">{roleBadge(p.fonctionDirigeant)}</div></>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isEnriching && !p.siteWeb
                            ? <Loader2 className="w-3 h-3 text-brand-400/50 animate-spin" />
                            : p.siteWeb
                              ? <a href={`https://${p.siteWeb}`} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-sky-600 hover:text-sky-700 text-[10px] font-mono max-w-[130px] truncate">
                                  <Globe className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{p.siteWeb.replace(/^www\./, "")}</span>
                                </a>
                              : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap max-w-[170px]">
                          {p.emailDirigeant
                            ? <div className="flex items-center gap-1"><EmailSourceIcon source={p.emailSource} />
                                <span className="font-mono text-violet-600 text-[10px] truncate">{p.emailDirigeant}</span></div>
                            : isEnriching
                              ? <span className="text-gray-300 text-[10px] animate-pulse">Recherche…</span>
                              : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.telephonePro
                            ? <a href={`tel:${p.telephonePro.replace(/\s/g,"")}`} onClick={(e)=>e.stopPropagation()}
                                className="font-mono text-brand-600 hover:text-brand-700 text-[10px] font-medium">{p.telephonePro}</a>
                            : isEnriching ? <span className="text-gray-300 text-[10px] animate-pulse">…</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap"><AppelBadge statut={p.statutAppel} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap"><StatutBadge statut={p.statut} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.scoreQualif != null
                            ? <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full", p.scoreQualif >= 70 ? "bg-green-500" : p.scoreQualif >= 40 ? "bg-amber-400" : "bg-red-400")}
                                    style={{ width: `${p.scoreQualif}%` }} />
                                </div>
                                <span className="text-gray-500 font-medium">{p.scoreQualif}</span>
                              </div>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.danscrm
                            ? <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-medium"><CheckCircle className="w-3 h-3" /> CRM</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {searched && !loading && prospects.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Users className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">Aucun prospect trouvé.</p>
                <p className="text-gray-300 text-xs mt-1">Essayez un autre département ou secteur.</p>
              </div>
            )}
            {!searched && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Target className="w-8 h-8 text-brand-200 mb-3" />
                <p className="text-gray-500 text-sm font-medium">Lancez votre première recherche</p>
                <p className="text-gray-300 text-xs mt-1">Sélectionnez un secteur et un département ci-dessus.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau détail ── */}
        {selected && (
          <div className="w-[460px] shrink-0 border-l border-gray-200 flex flex-col bg-white overflow-hidden">

            {/* Header sticky */}
            <div className="shrink-0 px-5 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">{selected.nom}</h3>
                  {selected.nomCommercial && selected.nomCommercial !== selected.nom && (
                    <p className="text-[10px] text-gray-400">« {selected.nomCommercial} »</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">{selected.libelleNaf || selected.secteur}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-700 transition-colors shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <StatutBadge statut={selected.statut} />
                <AppelBadge statut={selected.statutAppel} />
                {selected.danscrm && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                    <Database className="w-2.5 h-2.5" /> Dans le CRM
                  </span>
                )}
                {selected.scoreQualif != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                    <TrendingUp className="w-2.5 h-2.5 text-green-500" /> Score {selected.scoreQualif}/100
                  </span>
                )}
              </div>
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Actions rapides ── */}
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                {selected.telephonePro && (
                  <a href={`tel:${selected.telephonePro.replace(/\s/g,"")}`}
                    className="flex items-center gap-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
                    <PhoneCall className="w-3.5 h-3.5" /> Appeler
                  </a>
                )}
                <button onClick={() => setShowComposer(true)}
                  className="flex items-center gap-1.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button onClick={() => generateEmail(selected)} disabled={generating.has(selected.id)}
                  className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50">
                  {generating.has(selected.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Email IA
                </button>
                <button onClick={() => enrich(selected)} disabled={enriching.has(selected.id)}
                  className="flex items-center gap-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50">
                  {enriching.has(selected.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Enrichir
                </button>
              </div>

              {/* ── Suivi commercial ── */}
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Suivi commercial</p>

                {/* Statuts d'appel */}
                <p className="text-[10px] text-gray-500 font-medium mb-2">État de l'appel</p>
                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  {(Object.entries(STATUT_APPEL_LABELS) as [StatutAppel, string][]).map(([k, v]) => {
                    const Icon   = STATUT_APPEL_ICONS[k];
                    const active = (selected.statutAppel ?? "non_appele") === k;
                    return (
                      <button key={k}
                        onClick={() => updateProspect(selected.id, { statutAppel: k, dateAppel: new Date().toISOString() })}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                          active ? STATUT_APPEL_COLORS[k] : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        )}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />{v}
                      </button>
                    );
                  })}
                </div>

                {/* CRM Sync */}
                {selected.danscrm ? (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-green-50 border-green-200 text-green-700 text-xs font-medium">
                      <Database className="w-4 h-4" />
                      Dans le CRM
                      {selected.dateCrm && <span className="ml-auto text-green-500 text-[10px]">{new Date(selected.dateCrm).toLocaleDateString("fr-FR")}</span>}
                    </div>
                    <a href="/dashboard" target="_blank"
                      className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 text-xs transition-all">
                      <ExternalLink className="w-3.5 h-3.5" /> CRM
                    </a>
                    <a href="/scripts"
                      className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 text-xs transition-all">
                      <PhoneCall className="w-3.5 h-3.5" /> Scripts d'appel
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => syncToCrm(selected)}
                    disabled={isSyncing}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-xs font-medium transition-all mb-3 bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50">
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {isSyncing ? "Synchronisation…" : "Ajouter au CRM & file d'appel"}
                    {!isSyncing && <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-300" />}
                  </button>
                )}

                {/* Notes */}
                <p className="text-[10px] text-gray-500 font-medium mb-1.5">Notes commerciales</p>
                <textarea
                  value={editNotes}
                  onChange={(e) => { setEditNotes(e.target.value); setNotesDirty(true); }}
                  onBlur={saveNotes}
                  placeholder="Observations, prochaine action, contexte…"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-xs resize-none placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-colors"
                />
                {notesDirty && (
                  <button onClick={saveNotes} className="mt-1 text-[10px] text-brand-500 hover:text-brand-600 font-medium">Sauvegarder →</button>
                )}
              </div>

              {/* ── Fiche entreprise ── */}
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Fiche entreprise</p>
                <div className="space-y-2">
                  <InfoRow icon={Hash}     label="SIREN"          value={selected.siren}   copy />
                  {selected.siret && <InfoRow icon={Hash} label="SIRET (siège)" value={selected.siret} copy />}
                  <InfoRow icon={Briefcase} label="Activité"       value={selected.libelleNaf ? `${selected.libelleNaf} (${selected.codeNaf})` : selected.codeNaf} />
                  {selected.adresse && <InfoRow icon={Building2}   label="Adresse"          value={[selected.adresse, selected.codePostal, selected.ville].filter(Boolean).join(", ")} />}
                  {selected.trancheEffectifs && <InfoRow icon={Users} label="Effectifs" value={TRANCHES_EFFECTIFS[selected.trancheEffectifs] ?? selected.trancheEffectifs} />}
                  {selected.dateCreation && <InfoRow icon={Calendar} label="Création" value={selected.dateCreation.slice(0, 4)} />}
                </div>
              </div>

              {/* ── Dirigeant ── */}
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Dirigeant principal</p>
                {selected.dirigeantPrincipal ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                        {selected.dirigeantPrincipal.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{selected.dirigeantPrincipal}</p>
                        <p className="text-[10px] text-gray-400">{selected.fonctionDirigeant ?? "—"}</p>
                      </div>
                      {selected.linkedinDirigeant && (
                        <a href={selected.linkedinDirigeant} target="_blank" rel="noopener noreferrer"
                          title="Rechercher sur LinkedIn"
                          className="shrink-0 w-6 h-6 rounded bg-[#0077b5]/20 flex items-center justify-center hover:bg-[#0077b5]/40 transition-colors">
                          <svg className="w-3.5 h-3.5 fill-[#0077b5]" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      )}
                    </div>
                    {selected.dirigeants.length > 1 && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">{selected.dirigeants.length} dirigeants au total</summary>
                        <div className="mt-2 space-y-1 pl-2 border-l border-gray-200">
                          {selected.dirigeants.map((d, i) => (
                            <div key={i} className="text-[10px] text-gray-500">
                              <span className="text-gray-700">{[d.prenoms, d.nom].filter(Boolean).join(" ")}</span>
                              {d.qualite && <span className="text-gray-400"> · {d.qualite}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : <p className="text-xs text-gray-400 italic">Non identifié — cliquer sur Enrichir</p>}
              </div>

              {/* ── Contact ── */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Contact</p>
                  <button onClick={() => copyContactCard(selected)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
                    <Copy className="w-3 h-3" /> Tout copier
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Email */}
                  {selected.emailDirigeant ? (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <EmailSourceIcon source={selected.emailSource} />
                      <Mail className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="font-mono text-violet-600 text-xs truncate flex-1">{selected.emailDirigeant}</span>
                      <CopyBtn text={selected.emailDirigeant} />
                      <button onClick={() => setShowComposer(true)} title="Composer un email"
                        className="p-1 rounded text-gray-300 hover:text-violet-500 transition-colors">
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200">
                      <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="text-gray-400 text-xs italic">Email non trouvé — cliquer sur Enrichir</span>
                    </div>
                  )}
                  {/* Téléphone */}
                  {selected.telephonePro ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <Phone className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <a href={`tel:${selected.telephonePro.replace(/\s/g,"")}`}
                          className="font-mono text-brand-600 hover:text-brand-700 text-xs flex-1 transition-colors font-semibold">
                          {selected.telephonePro}
                        </a>
                        <CopyBtn text={selected.telephonePro} />
                        <a href={`tel:${selected.telephonePro.replace(/\s/g,"")}`}
                          className="p-1 rounded text-gray-300 hover:text-green-600 transition-colors" title="Appeler">
                          <PhoneCall className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 px-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Numéro source SIRENE — peut être obsolète. Vérifiez avant d'appeler.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200">
                      <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="text-gray-400 text-xs italic">Téléphone non trouvé</span>
                    </div>
                  )}
                  {/* Site */}
                  {selected.siteWeb ? (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <a href={`https://${selected.siteWeb}`} target="_blank" rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-700 text-xs flex-1 truncate transition-colors">
                        {selected.siteWeb}
                      </a>
                      <ExternalLink className="w-3 h-3 text-gray-300" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200">
                      <Globe className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="text-gray-400 text-xs italic">Site non trouvé</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Qualification IA ── */}
              {(selected.problematique || selected.observation || selected.angleApproche) && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Qualification IA</p>
                  <div className="space-y-2.5">
                    {selected.problematique && <div><p className="text-[10px] text-gray-400 font-medium mb-1">Problématique</p><p className="text-xs text-gray-600 leading-relaxed">{selected.problematique}</p></div>}
                    {selected.observation   && <div><p className="text-[10px] text-gray-400 font-medium mb-1">Observation</p><p className="text-xs text-gray-600 leading-relaxed">{selected.observation}</p></div>}
                    {selected.angleApproche && <div><p className="text-[10px] text-gray-400 font-medium mb-1">Angle d'approche</p><p className="text-xs text-gray-600 leading-relaxed">{selected.angleApproche}</p></div>}
                  </div>
                </div>
              )}

              {/* ── Email généré ── */}
              {selected.emailObjet && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Email généré</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowComposer(true)}
                        className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 transition-colors font-medium">
                        <FileText className="w-3 h-3" /> Ouvrir compositeur
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(`Objet: ${selected.emailObjet}\n\n${selected.emailCorps ?? ""}`)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
                        <Copy className="w-3 h-3" /> Copier
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">Objet</span>
                      <span className="text-xs text-gray-900 font-medium flex-1">{selected.emailObjet}</span>
                      <CopyBtn text={selected.emailObjet} />
                    </div>
                    {selected.emailCorps && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[10px] text-gray-400">Corps</span>
                          <CopyBtn text={selected.emailCorps} />
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{selected.emailCorps}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Historique ── */}
              {selected.actions && selected.actions.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Historique</p>
                  <div className="space-y-1.5">
                    {[...selected.actions].reverse().slice(0, 8).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px]">
                        <Clock className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />
                        <span className="text-gray-400 shrink-0">{new Date(a.date).toLocaleDateString("fr-FR")}</span>
                        <span className="text-gray-600">{a.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
