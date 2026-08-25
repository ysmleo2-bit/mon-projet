"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone, Plus, Download, Upload, Loader2,
  X, Save, Trash2, Mail, MapPin, ChevronLeft, ChevronRight,
  Search, Globe, PhoneCall, PhoneMissed, PhoneOff, MessageSquare as MessageIcon, RotateCcw,
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

// ── Config statuts — light theme ──────────────────────────────────────────────
const STATUS_CFG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new:        { label: "À appeler",  color: "text-gray-500",    bg: "bg-gray-100",     border: "border-gray-200"   },
  contacted:  { label: "Rappeler",   color: "text-amber-700",   bg: "bg-amber-50",     border: "border-amber-200"  },
  interested: { label: "Intéressé",  color: "text-emerald-700", bg: "bg-emerald-50",   border: "border-emerald-200"},
  rdv:        { label: "RDV Pris",   color: "text-violet-700",  bg: "bg-violet-50",    border: "border-violet-200" },
  client:     { label: "Client",     color: "text-brand-700",   bg: "bg-brand-50",     border: "border-brand-200"  },
  lost:       { label: "Perdu",      color: "text-red-600",     bg: "bg-red-50",       border: "border-red-200"    },
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  no_answer:      { label: "Pas répondu",   color: "text-gray-500"    },
  interested:     { label: "Intéressé",     color: "text-emerald-700" },
  not_interested: { label: "Pas intéressé", color: "text-red-600"     },
  rdv:            { label: "RDV pris",      color: "text-violet-700"  },
  callback:       { label: "À rappeler",    color: "text-amber-700"   },
};

const CALL_STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pas_decroche:       { label: "Pas décroché",      color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200"  },
  decroche:           { label: "Décroché",           color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200"  },
  mail_envoye:        { label: "Mail envoyé",        color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  echange_sans_suite: { label: "Échange sans suite", color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200"   },
  r1_booke:           { label: "R1 booké",           color: "text-brand-700",  bg: "bg-brand-50",  border: "border-brand-200"  },
  a_rappeler:         { label: "À rappeler",         color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
};

const CALL_FILTER_TABS = [
  { id: "all",              label: "Tous les appels" },
  { id: "pas_decroche",     label: "Pas décroché" },
  { id: "decroche",         label: "Décroché" },
  { id: "mail_envoye",      label: "Mail envoyé" },
  { id: "echange_sans_suite", label: "Échange sans suite" },
  { id: "r1_booke",         label: "R1 booké" },
  { id: "a_rappeler",       label: "À rappeler" },
];

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
  const [leads,          setLeads]          = useState<Lead[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState<Lead | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState<LeadStatus | "all">("all");
  const [page,           setPage]           = useState(1);
  const [viewMode,       setViewMode]       = useState<"pipeline" | "appels">("pipeline");
  const [callStatusFilter, setCallStatusFilter] = useState<string>("all");
  const [noteInput,    setNoteInput]    = useState("");
  const [saving,       setSaving]       = useState(false);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Panneaux redimensionnables ───────────────────────────────────────────────
  const [leftWidth,  setLeftWidth]  = useState(208);
  const [rightWidth, setRightWidth] = useState(288);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ panel: "left" | "right"; startX: number; startWidth: number } | null>(null);
  const moveHandler = useRef<(e: MouseEvent) => void>(() => {});
  const upHandler   = useRef<() => void>(() => {});

  function startResize(panel: "left" | "right", e: React.MouseEvent) {
    const startWidth = panel === "left" ? leftWidth : rightWidth;
    dragState.current = { panel, startX: e.clientX, startWidth };
    setIsDragging(true);

    moveHandler.current = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const delta = ev.clientX - dragState.current.startX;
      if (panel === "left")  setLeftWidth (Math.max(160, Math.min(400, startWidth + delta)));
      else                   setRightWidth(Math.max(220, Math.min(480, startWidth - delta)));
    };
    upHandler.current = () => {
      dragState.current = null;
      setIsDragging(false);
      document.removeEventListener("mousemove", moveHandler.current);
      document.removeEventListener("mouseup",   upHandler.current);
    };
    document.addEventListener("mousemove", moveHandler.current);
    document.addEventListener("mouseup",   upHandler.current);
  }

  // ── Chargement ──────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async (mode?: "pipeline" | "appels", csFilter?: string) => {
    try {
      const currentMode = mode ?? "pipeline";
      const currentCs   = csFilter ?? "all";
      const url = currentMode === "appels" && currentCs !== "all"
        ? `/api/leads?callStatus=${currentCs}`
        : "/api/leads";
      const res  = await fetch(url);
      const json = await res.json();
      setLeads(json.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(viewMode, callStatusFilter); }, [loadLeads, viewMode, callStatusFilter]);

  // ── Filtrage + pagination ────────────────────────────────────────────────────
  const filtered = leads.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q) && !l.city.toLowerCase().includes(q) && !(l.email ?? "").toLowerCase().includes(q)) return false;
    }
    if (viewMode === "pipeline") {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
    } else {
      // In appels mode, only show leads with call status
      if (!l.callStatus || l.callStatus === "non_appele") return false;
      if (callStatusFilter !== "all" && l.callStatus !== callStatusFilter) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStatus, viewMode, callStatusFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const today = new Date().toDateString();
  const stats = {
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
    <div className={cn("flex h-screen bg-slate-50 overflow-hidden", isDragging && "select-none cursor-col-resize")}>
      <Navbar />

      {/* ── Panneau gauche stats + filtres ── */}
      <aside style={{ width: leftWidth }} className="shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white relative">

        {/* Stats */}
        <div className="p-3 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-2">
            {(viewMode === "appels" ? [
              { label: "Appelés total",  v: leads.filter(l => l.callStatus && l.callStatus !== "non_appele").length, color: "text-brand-600"   },
              { label: "Pas décroché",   v: leads.filter(l => l.callStatus === "pas_decroche").length,               color: "text-amber-600"  },
              { label: "Décroché",       v: leads.filter(l => l.callStatus === "decroche" || l.callStatus === "echange_effectue").length, color: "text-green-600" },
              { label: "Pas intéressés", v: leads.filter(l => l.callStatus === "pas_interesse").length,              color: "text-red-600"    },
            ] : [
              { label: "Prospects",   v: stats.total,      color: "text-gray-900"    },
              { label: "Intéressés",  v: stats.interested, color: "text-emerald-600" },
              { label: "Rappels",     v: stats.rappels,    color: "text-amber-600"   },
              { label: "Aujourd'hui", v: stats.today,      color: "text-brand-600"   },
            ]).map(({ label, v, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                <div className={cn("text-xl font-black", color)}>{v}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recherche */}
        <div className="px-3 py-2.5 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
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
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            {(["pipeline", "appels"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setFilterStatus("all"); setCallStatusFilter("all"); }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {mode === "pipeline" ? "📊 Pipeline" : "📞 Appels"}
              </button>
            ))}
          </div>

          {viewMode === "pipeline" && (
            <>
              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-2 pt-1">Statut</p>
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
                        ? "bg-brand-50 text-brand-700 font-semibold border border-brand-200"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}>
                    <span>{tab.label}</span>
                    <span className={cn("text-[10px] font-mono", active ? "text-brand-500" : "text-gray-300")}>{count}</span>
                  </button>
                );
              })}
            </>
          )}

          {viewMode === "appels" && (
            <>
              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-2 pt-1">Statut d&apos;appel</p>
              <div className="space-y-0.5">
                {CALL_FILTER_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setCallStatusFilter(id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left",
                      callStatusFilter === id
                        ? "bg-brand-50 text-brand-700 border border-brand-200"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <span>{label}</span>
                    <span className="text-gray-400 text-[10px]">
                      {id === "all"
                        ? leads.filter((l) => l.callStatus && l.callStatus !== "non_appele").length
                        : leads.filter((l) => l.callStatus === id).length}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Plan / CRM */}
        <div className="p-3 border-t border-gray-100">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-brand-600">Plan Free</span>
              <span className="text-[9px] text-gray-400">{leads.length} leads</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (leads.length / 500) * 100)}%` }} />
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5 font-medium">● CRM actif</p>
          </div>
        </div>
      </aside>

      {/* ── Poignée gauche ── */}
      <div
        onMouseDown={(e) => startResize("left", e)}
        className="w-1 shrink-0 bg-gray-200 hover:bg-brand-400 active:bg-brand-500 cursor-col-resize transition-colors relative group"
        title="Redimensionner">
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* ── Liste principale ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="border-b border-gray-200 bg-white px-5 h-14 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            Prospects
            {!loading && (
              <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
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
        <div className="flex-1 overflow-auto bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
              <Search className="w-8 h-8 opacity-50" />
              <p className="text-sm text-gray-400">Aucun lead trouvé</p>
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
                    "flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 cursor-pointer transition-colors bg-white",
                    isSelected ? "bg-brand-50 border-l-2 border-l-brand-500" : "hover:bg-blue-50/40"
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
                      <span className="text-sm font-semibold text-gray-900 truncate">{lead.name}</span>
                      {lead.rating > 0 && (
                        <span className="text-[10px] text-amber-500 shrink-0">★ {lead.rating}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{lead.city}</span>
                      <span className="font-mono text-brand-500">{lead.phone}</span>
                      {lead.assignedTo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium truncate max-w-[90px]">
                          {lead.assignedTo.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge statut */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                      cfg.bg, cfg.border, cfg.color
                    )}>
                      {cfg.label}
                    </span>
                    {lead.callStatus && lead.callStatus !== "non_appele" && CALL_STATUS_CFG[lead.callStatus] && (
                      <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
                        CALL_STATUS_CFG[lead.callStatus].bg,
                        CALL_STATUS_CFG[lead.callStatus].border,
                        CALL_STATUS_CFG[lead.callStatus].color
                      )}>
                        {CALL_STATUS_CFG[lead.callStatus].label}
                      </span>
                    )}
                  </div>

                  {/* Bouton appel */}
                  <a
                    href={`tel:${lead.phone.replace(/\s/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                      lead.status === "rdv"
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-brand-500 hover:text-white"
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
          <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between shrink-0 bg-white">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>

              {page > 3 && (
                <>
                  <button onClick={() => setPage(1)} className="w-7 h-7 rounded-lg text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-100">1</button>
                  <span className="text-gray-300 text-xs px-0.5">…</span>
                </>
              )}

              {pageNumbers().map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("w-7 h-7 rounded-lg text-xs font-mono transition-all",
                    p === page ? "bg-brand-500 text-white" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                  )}>
                  {p}
                </button>
              ))}

              {page < totalPages - 2 && (
                <>
                  <span className="text-gray-300 text-xs px-0.5">…</span>
                  <button onClick={() => setPage(totalPages)} className="w-7 h-7 rounded-lg text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-100">{totalPages}</button>
                </>
              )}

              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </main>

      {/* ── Panneau droit détail ── */}
      {selected && (
        <>
        {/* Poignée droite */}
        <div
          onMouseDown={(e) => startResize("right", e)}
          className="w-1 shrink-0 bg-gray-200 hover:bg-brand-400 active:bg-brand-500 cursor-col-resize transition-colors relative"
          title="Redimensionner">
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
        <aside style={{ width: rightWidth }} className="shrink-0 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-sm font-bold text-gray-900 truncate">{selected.name}</h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn(
                  "text-[9px] font-semibold px-2 py-0.5 rounded-full border",
                  STATUS_CFG[selected.status].bg, STATUS_CFG[selected.status].border, STATUS_CFG[selected.status].color
                )}>
                  {STATUS_CFG[selected.status].label}
                </span>
                {selected.callStatus && selected.callStatus !== "non_appele" && CALL_STATUS_CFG[selected.callStatus] && (
                  <span className={cn(
                    "text-[9px] font-semibold px-2 py-0.5 rounded-full border",
                    CALL_STATUS_CFG[selected.callStatus].bg,
                    CALL_STATUS_CFG[selected.callStatus].border,
                    CALL_STATUS_CFG[selected.callStatus].color
                  )}>
                    {CALL_STATUS_CFG[selected.callStatus].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {selected.rating > 0 && (
                  <span className="text-xs text-amber-500">★ {selected.rating}{selected.reviewCount > 0 && <span className="text-gray-400 ml-0.5">({selected.reviewCount})</span>}</span>
                )}
                {selected.priceLevel && (
                  <span className="text-xs text-gray-500 font-medium">{selected.priceLevel}</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-700 shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">

            {/* ── Grandes cartes de contact ── */}
            <BigContactCard
              icon={<Phone className="w-5 h-5 text-white" />}
              iconBg="bg-brand-500"
              label="Téléphone">
              <a href={`tel:${selected.phone.replace(/\s/g, "")}`}
                className="text-base font-semibold text-gray-900 hover:text-brand-600 break-all">
                {selected.phone}
              </a>
            </BigContactCard>

            {selected.email && (
              <BigContactCard
                icon={<Mail className="w-5 h-5 text-white" />}
                iconBg="bg-sky-500"
                label="Email">
                <a href={`mailto:${selected.email}`}
                  className="text-base font-semibold text-gray-900 hover:text-sky-600 break-all">
                  {selected.email}
                </a>
              </BigContactCard>
            )}

            <BigContactCard
              icon={<MapPin className="w-5 h-5 text-white" />}
              iconBg="bg-violet-500"
              label="Localisation">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-gray-900">{selected.city}</span>
                {selected.address && (
                  <span className="text-xs text-gray-400 leading-tight">{selected.address}</span>
                )}
                {(selected.lat && selected.lng) && (
                  <span className="text-[10px] font-mono text-gray-400 mt-0.5">
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </span>
                )}
                {selected.googleMapsUrl && (
                  <a href={selected.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-violet-600 hover:text-violet-700 font-medium mt-1 inline-flex items-center gap-1 transition-colors">
                    <MapPin className="w-3 h-3" /> Voir sur Google Maps
                  </a>
                )}
              </div>
            </BigContactCard>
            {selected.hours && selected.hours.length > 0 && (
              <BigContactCard
                icon={<span className="text-base leading-none">🕐</span>}
                iconBg="bg-teal-500"
                label="Horaires">
                <ul className="space-y-0.5">
                  {selected.hours.map((h, i) => (
                    <li key={i} className="text-xs text-gray-700 font-mono leading-tight">{h}</li>
                  ))}
                </ul>
              </BigContactCard>
            )}

            {selected.website && (
              <BigContactCard
                icon={<Globe className="w-5 h-5 text-white" />}
                iconBg="bg-slate-500"
                label="Site web">
                <a href={`https://${selected.website}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 hover:text-brand-600 break-all">
                  {selected.website}
                </a>
              </BigContactCard>
            )}

            {/* ── Notes ── */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
              {selected.notes ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed mb-2">
                  {selected.notes}
                </div>
              ) : null}
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ajouter une note…"
                rows={3}
                className="input text-sm resize-none rounded-xl"
              />
              <button onClick={() => saveNote(selected.id)} disabled={saving}
                className="mt-2 w-full text-sm btn-primary py-2.5 flex items-center justify-center gap-1.5 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>

            {/* ── Historique d'appels ── */}
            {(selected.callHistory?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Historique d&apos;appels
                </p>
                <div className="space-y-2">
                  {[...(selected.callHistory ?? [])].reverse().map((rec, i) => {
                    const oc = OUTCOME_LABELS[rec.outcome] ?? { label: rec.outcome, color: "text-gray-500" };
                    return (
                      <div key={i} className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {new Date(rec.at).toLocaleDateString("fr-FR", { year:"numeric", month:"2-digit", day:"2-digit" })}
                            {" "}{formatTime(rec.at)}
                          </span>
                          <span className="text-sm font-mono text-gray-500 font-semibold">
                            {formatDuration(rec.duration)}
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs font-semibold px-3 py-1 rounded-full border",
                          oc.color,
                          rec.outcome === "interested"     ? "border-emerald-200 bg-emerald-50" :
                          rec.outcome === "rdv"            ? "border-violet-200 bg-violet-50"   :
                          rec.outcome === "callback"       ? "border-amber-200 bg-amber-50"     :
                          rec.outcome === "not_interested" ? "border-red-200 bg-red-50"         :
                                                             "border-gray-200 bg-gray-100"
                        )}>
                          {oc.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Changer statut ── */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Déplacer vers</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.entries(STATUS_CFG) as [LeadStatus, (typeof STATUS_CFG)[LeadStatus]][]).map(([id, cfg]) => (
                  <button key={id} onClick={() => moveLead(selected.id, id)}
                    className={cn(
                      "text-[10px] font-semibold py-2 px-1 rounded-xl border transition-all truncate",
                      selected.status === id
                        ? cn(cfg.bg, cfg.border, cfg.color)
                        : "border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50"
                    )}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="space-y-2 pb-4">
              <a href={`tel:${selected.phone.replace(/\s/g, "")}`}
                className="flex items-center justify-center gap-2 text-sm w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">
                <Phone className="w-4 h-4" /> Appeler maintenant
              </a>
              {selected.email && (
                <a href={`mailto:${selected.email}`}
                  className="btn-outline flex items-center justify-center gap-2 text-sm w-full py-3 rounded-xl">
                  <Mail className="w-4 h-4" /> Envoyer email
                </a>
              )}
              <a href="/app"
                className="btn-outline flex items-center justify-center gap-2 text-xs w-full py-3 rounded-xl">
                Interface d&apos;appel complète
              </a>
              <button onClick={() => deleteLead(selected.id)}
                className="w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-600 py-2 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer ce lead
              </button>
            </div>
          </div>
        </aside>
        </>
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

// ── Grande carte de contact ───────────────────────────────────────────────────
function BigContactCard({ icon, iconBg, label, children }: {
  icon: React.ReactNode; iconBg: string; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3.5">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">Ajouter un lead</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-700" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
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
