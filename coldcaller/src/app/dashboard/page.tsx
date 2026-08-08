"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone, Plus, Download, Upload, Loader2,
  X, Save, Trash2, Mail, MapPin, ChevronLeft, ChevronRight,
  Search, Globe,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import type { Lead, LeadStatus } from "@/lib/types";
import { cn, formatDate, formatTime, formatDuration } from "@/lib/utils";

const PAGE_SIZE = 20;

// ── Couleur avatar par initiale ───────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-violet-500","bg-blue-500","bg-emerald-500",
  "bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500",
];
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Config statuts ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new:        { label: "À appeler",  color: "text-white/50",    bg: "bg-white/[0.04]",     border: "border-white/[0.08]"  },
  contacted:  { label: "Rappeler",   color: "text-amber-400",   bg: "bg-amber-500/10",     border: "border-amber-500/25"  },
  interested: { label: "Intéressé",  color: "text-emerald-400", bg: "bg-emerald-500/10",   border: "border-emerald-500/25"},
  rdv:        { label: "RDV Pris",   color: "text-violet-400",  bg: "bg-violet-500/10",    border: "border-violet-500/25" },
  client:     { label: "Client",     color: "text-brand-400",   bg: "bg-brand-500/10",     border: "border-brand-500/25"  },
  lost:       { label: "Perdu",      color: "text-red-400",     bg: "bg-red-500/10",       border: "border-red-500/25"    },
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  no_answer:      { label: "Pas répondu",  color: "text-white/40"    },
  interested:     { label: "Intéressé",    color: "text-emerald-400" },
  not_interested: { label: "Pas intéressé",color: "text-red-400"     },
  rdv:            { label: "RDV pris",     color: "text-violet-400"  },
  callback:       { label: "À rappeler",   color: "text-amber-400"   },
};

const FILTER_TABS: Array<{ id: LeadStatus | "all"; label: string }> = [
  { id: "all",        label: "Tous"      },
  { id: "new",        label: "À appeler" },
  { id: "contacted",  label: "Rappeler"  },
  { id: "interested", label: "Intéressé" },
  { id: "rdv",        label: "RDV Pris"  },
  { id: "client",     label: "Client"    },
  { id: "lost",       label: "Perdu"     },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Lead | null>(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [page,         setPage]         = useState(1);
  const [noteInput,    setNoteInput]    = useState("");
  const [saving,       setSaving]       = useState(false);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    try {
      const res  = await fetch("/api/leads");
      const json = await res.json();
      setLeads(json.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Filtrage + pagination ────────────────────────────────────────────────────
  const filtered = leads.filter((l) => {
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    const q           = search.toLowerCase();
    const matchSearch = !q ||
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.city.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStatus]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const today    = new Date().toDateString();
  const stats    = {
    total:      leads.length,
    interested: leads.filter((l) => l.status === "interested").length,
    rappels:    leads.filter((l) => l.status === "contacted").length,
    today:      leads.filter((l) => l.lastContact && new Date(l.lastContact).toDateString() === today).length,
  };

  // ── Actions leads ────────────────────────────────────────────────────────────
  async function moveLead(id: string, newStatus: LeadStatus) {
    const res  = await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    setLeads((prev) => prev.map((l) => l.id === id ? json.lead : l));
    setSelected((prev) => prev?.id === id ? json.lead : prev);
  }

  async function saveNote(id: string) {
    if (!noteInput.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notes: noteInput }),
    });
    const json = await res.json();
    setLeads((prev) => prev.map((l) => l.id === id ? json.lead : l));
    setSelected(json.lead);
    setNoteInput("");
    setSaving(false);
  }

  async function deleteLead(id: string) {
    if (!confirm("Supprimer ce lead ?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  // ── Export CSV ───────────────────────────────────────────────────────────────
  function exportCsv() {
    const header = "Nom,Catégorie,Téléphone,Email,Adresse,Ville,Note,Statut";
    const rows   = leads.map((l) =>
      `"${l.name}","${l.category}","${l.phone}","${l.email ?? ""}","${l.address}","${l.city}",${l.rating},"${STATUS_CFG[l.status].label}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "leads-crm.csv"; a.click();
  }

  // ── Import CSV ───────────────────────────────────────────────────────────────
  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
    const imported: Lead[] = [];
    for (const line of lines.slice(1)) {
      const vals = line.split(",").map((v) => v.replace(/"/g, "").trim());
      const get  = (k: string) => vals[header.indexOf(k)] ?? "";
      const name = get("nom") || get("name"); if (!name) continue;
      const phone = get("téléphone") || get("phone"); if (!phone) continue;
      imported.push({
        id:          `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name, phone,
        category:    get("catégorie") || get("category") || "",
        email:       get("email") || undefined,
        address:     get("adresse") || get("address") || "",
        city:        get("ville") || get("city") || "",
        rating: 0, reviewCount: 0,
        status: "new", notes: "",
        detectedAt: new Date().toISOString(),
        source: "import", callCount: 0,
      });
    }
    if (imported.length) {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(imported),
      });
      loadLeads();
    }
    e.target.value = "";
  }

  // ── Pagination helpers ───────────────────────────────────────────────────────
  function pageNumbers(): number[] {
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      range.push(i);
    }
    return range;
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      {/* ── Panneau gauche stats + filtres ── */}
      <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden bg-ink-900/40">

        {/* Stats */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Prospects",   v: stats.total,      color: "text-white"        },
              { label: "Intéressés",  v: stats.interested, color: "text-emerald-400"  },
              { label: "Rappels",     v: stats.rappels,    color: "text-amber-400"    },
              { label: "Aujourd'hui", v: stats.today,      color: "text-brand-400"    },
            ].map(({ label, v, color }) => (
              <div key={label} className="glass rounded-xl p-3">
                <div className={cn("text-xl font-black", color)}>{v}</div>
                <div className="text-[9px] text-white/35 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recherche */}
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="input text-xs pl-8 py-2"
            />
          </div>
        </div>

        {/* Filtres statut */}
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2 px-2 pt-1">Statut</p>
          {FILTER_TABS.map((tab) => {
            const count  = tab.id === "all" ? leads.length : leads.filter((l) => l.status === tab.id).length;
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as LeadStatus | "all")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                  active
                    ? "bg-white/[0.08] text-white font-semibold"
                    : "text-white/35 hover:text-white hover:bg-white/[0.04]"
                )}>
                <span>{tab.label}</span>
                <span className={cn("text-[10px] font-mono", active ? "text-white/50" : "text-white/15")}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Plan / CRM */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-brand-400">Plan Free</span>
              <span className="text-[9px] text-white/25">{leads.length} leads</span>
            </div>
            <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (leads.length / 500) * 100)}%` }} />
            </div>
            <p className="text-[9px] text-white/25 mt-1.5">● CRM actif</p>
          </div>
        </div>
      </aside>

      {/* ── Liste principale ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-5 h-14 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            Prospects
            {!loading && (
              <span className="text-[10px] font-mono text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">
                {filtered.length}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCsv} />
            <button onClick={() => fileRef.current?.click()}
              className="btn-outline text-xs py-1.5 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Importer
            </button>
            <button onClick={exportCsv}
              className="btn-outline text-xs py-1.5 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => setShowAddForm(true)}
              className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">Aucun lead trouvé</p>
            </div>
          ) : (
            paginated.map((lead) => {
              const cfg        = STATUS_CFG[lead.status];
              const isSelected = selected?.id === lead.id;
              return (
                <div
                  key={lead.id}
                  onClick={() => { setSelected(lead); setNoteInput(""); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] cursor-pointer transition-colors",
                    isSelected ? "bg-white/[0.06] border-l-2 border-l-brand-500" : "hover:bg-white/[0.025]"
                  )}>
                  {/* Avatar */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0",
                    avatarColor(lead.name)
                  )}>
                    {lead.name[0]?.toUpperCase() ?? "?"}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
                      {lead.rating > 0 && (
                        <span className="text-[10px] text-amber-400 shrink-0">★ {lead.rating}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/35">
                      <span>{lead.city}</span>
                      <span className="font-mono text-brand-400/60">{lead.phone}</span>
                    </div>
                  </div>

                  {/* Badge statut */}
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0",
                    cfg.bg, cfg.border, cfg.color
                  )}>
                    {cfg.label}
                  </span>

                  {/* Bouton appel */}
                  <a
                    href={`tel:${lead.phone.replace(/\s/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                      lead.status === "rdv"
                        ? "bg-emerald-500 text-white"
                        : "bg-white/[0.05] text-white/30 hover:bg-brand-500 hover:text-white"
                    )}>
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-white/[0.06] px-5 py-3 flex items-center justify-between shrink-0 bg-ink-950/80">
            <span className="text-xs text-white/25">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-ghost p-1.5 disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>

              {page > 3 && (
                <>
                  <button onClick={() => setPage(1)} className="w-7 h-7 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/[0.06]">1</button>
                  <span className="text-white/20 text-xs px-0.5">…</span>
                </>
              )}

              {pageNumbers().map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("w-7 h-7 rounded-lg text-xs font-mono transition-all",
                    p === page ? "bg-brand-500 text-white" : "text-white/40 hover:text-white hover:bg-white/[0.06]"
                  )}>
                  {p}
                </button>
              ))}

              {page < totalPages - 2 && (
                <>
                  <span className="text-white/20 text-xs px-0.5">…</span>
                  <button onClick={() => setPage(totalPages)} className="w-7 h-7 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/[0.06]">{totalPages}</button>
                </>
              )}

              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-ghost p-1.5 disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </main>

      {/* ── Panneau droit détail ── */}
      {selected && (
        <aside className="w-72 shrink-0 border-l border-white/[0.06] bg-ink-900/60 flex flex-col h-full overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-sm font-bold text-white truncate">{selected.name}</h2>
              </div>
              <span className={cn(
                "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                STATUS_CFG[selected.status].bg, STATUS_CFG[selected.status].border, STATUS_CFG[selected.status].color
              )}>
                {STATUS_CFG[selected.status].label}
              </span>
              {selected.rating > 0 && (
                <span className="text-xs text-amber-400 ml-2">★ {selected.rating}</span>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto">

            {/* Coordonnées */}
            <div className="p-4 space-y-3 border-b border-white/[0.06]">
              <ContactRow icon={<Phone className="w-3.5 h-3.5 text-brand-400" />} iconBg="bg-brand-500/15" label="Téléphone">
                <a href={`tel:${selected.phone.replace(/\s/g, "")}`}
                  className="text-sm font-mono text-brand-300 hover:text-brand-200">{selected.phone}</a>
              </ContactRow>

              {selected.email && (
                <ContactRow icon={<Mail className="w-3.5 h-3.5 text-violet-400" />} iconBg="bg-violet-500/15" label="Email">
                  <a href={`mailto:${selected.email}`}
                    className="text-xs text-violet-300 hover:text-violet-200 break-all">{selected.email}</a>
                </ContactRow>
              )}

              <ContactRow icon={<MapPin className="w-3.5 h-3.5 text-white/40" />} iconBg="bg-white/[0.06]" label="Ville">
                <span className="text-sm text-white/70">{selected.city}</span>
              </ContactRow>

              {selected.website && (
                <ContactRow icon={<Globe className="w-3.5 h-3.5 text-white/40" />} iconBg="bg-white/[0.06]" label="Site">
                  <a href={`https://${selected.website}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-400 hover:underline truncate">{selected.website}</a>
                </ContactRow>
              )}
            </div>

            {/* Changer statut */}
            <div className="p-4 border-b border-white/[0.06]">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-2">Déplacer vers</p>
              <div className="grid grid-cols-3 gap-1">
                {(Object.entries(STATUS_CFG) as [LeadStatus, (typeof STATUS_CFG)[LeadStatus]][]).map(([id, cfg]) => (
                  <button key={id} onClick={() => moveLead(selected.id, id)}
                    className={cn(
                      "text-[9px] font-bold py-1.5 px-1 rounded-lg border transition-all truncate",
                      selected.status === id
                        ? cn(cfg.bg, cfg.border, cfg.color)
                        : "border-white/[0.06] text-white/25 hover:text-white hover:border-white/20"
                    )}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="p-4 border-b border-white/[0.06]">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-2">Notes</p>
              {selected.notes && (
                <div className="glass rounded-xl p-3 mb-2 text-xs text-white/55 italic leading-relaxed">
                  {selected.notes}
                </div>
              )}
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ajouter une note…"
                rows={3}
                className="input text-xs resize-none"
              />
              <button onClick={() => saveNote(selected.id)} disabled={saving}
                className="mt-2 w-full text-xs btn-primary py-2 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>

            {/* Historique d'appels */}
            {(selected.callHistory?.length ?? 0) > 0 && (
              <div className="p-4 border-b border-white/[0.06]">
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-2">
                  Historique d&apos;appels
                </p>
                <div className="space-y-1.5">
                  {[...(selected.callHistory ?? [])].reverse().map((rec, i) => {
                    const oc = OUTCOME_LABELS[rec.outcome] ?? { label: rec.outcome, color: "text-white/40" };
                    return (
                      <div key={i} className="glass rounded-xl p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] text-white/35">
                            {formatDate(rec.at)} · {formatTime(rec.at)}
                          </p>
                          <p className={cn("text-[10px] font-semibold mt-0.5", oc.color)}>{oc.label}</p>
                        </div>
                        <span className="text-[10px] font-mono text-white/30 shrink-0">
                          {formatDuration(rec.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 space-y-2">
              <a href={`tel:${selected.phone.replace(/\s/g, "")}`}
                className="btn-primary flex items-center justify-center gap-2 text-sm w-full py-3">
                <Phone className="w-4 h-4" /> Appeler maintenant
              </a>
              {selected.email && (
                <a href={`mailto:${selected.email}`}
                  className="btn-outline flex items-center justify-center gap-2 text-sm w-full">
                  <Mail className="w-4 h-4" /> Envoyer email
                </a>
              )}
              <a href="/app"
                className="btn-outline flex items-center justify-center gap-2 text-xs w-full">
                Interface d&apos;appel complète
              </a>
              <button onClick={() => deleteLead(selected.id)}
                className="w-full flex items-center justify-center gap-2 text-xs text-red-400/50 hover:text-red-400 py-2 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer ce lead
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Modal ajout ── */}
      {showAddForm && (
        <AddLeadModal
          onClose={() => setShowAddForm(false)}
          onSaved={() => { setShowAddForm(false); loadLeads(); }}
        />
      )}
    </div>
  );
}

// ── Composant ligne coordonnée ────────────────────────────────────────────────
function ContactRow({ icon, iconBg, label, children }: {
  icon: React.ReactNode; iconBg: string; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-white/25 mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ── Modal ajout lead ──────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form,   setForm]   = useState({ name:"", category:"", phone:"", email:"", city:"", address:"", website:"" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id:          `manual-${Date.now()}`,
        ...form,
        email:       form.email || undefined,
        website:     form.website || undefined,
        rating: 0, reviewCount: 0,
        status: "new", notes: "",
        detectedAt: new Date().toISOString(),
        source: "manual", callCount: 0,
      }]),
    });
    setSaving(false);
    onSaved();
  }

  const fields = [
    { key:"name",     label:"Nom de l'entreprise *", placeholder:"Plomberie Dupont" },
    { key:"category", label:"Secteur",               placeholder:"Plombier" },
    { key:"phone",    label:"Téléphone *",           placeholder:"06 12 34 56 78" },
    { key:"email",    label:"Email",                 placeholder:"contact@dupont.fr" },
    { key:"city",     label:"Ville",                 placeholder:"Lyon" },
    { key:"address",  label:"Adresse",               placeholder:"12 rue de la Paix" },
    { key:"website",  label:"Site web",              placeholder:"dupont.fr" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Ajouter un lead</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-white/40 hover:text-white" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-white/40 mb-1 block">{label}</label>
              <input
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="input text-sm"
              />
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="w-full btn-primary flex items-center justify-center gap-2 mt-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </form>
      </div>
    </div>
  );
}
