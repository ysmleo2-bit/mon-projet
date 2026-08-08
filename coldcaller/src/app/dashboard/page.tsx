"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, TrendingUp, Users, Calendar, Plus, Filter,
  BarChart2, Loader2, Trash2, X, Save,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { PIPELINE_COLS } from "@/lib/mock-data";
import type { Lead, LeadStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [leads,       setLeads]       = useState<Lead[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<Lead | null>(null);
  const [noteInput,   setNoteInput]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Fetch leads depuis l'API ─────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    try {
      const res  = await fetch("/api/leads");
      const json = await res.json();
      setLeads(json.leads ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Changer le statut d'un lead ─────────────────────────────────────────
  async function moveLead(id: string, newStatus: LeadStatus) {
    const res  = await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, lastContact: new Date().toISOString() }),
    });
    const json = await res.json();
    setLeads((prev) => prev.map((l) => l.id === id ? json.lead : l));
    setSelected((prev) => prev?.id === id ? json.lead : prev);
  }

  // ── Sauvegarder une note ─────────────────────────────────────────────────
  async function saveNote(id: string) {
    if (!noteInput.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: noteInput }),
    });
    const json = await res.json();
    setLeads((prev) => prev.map((l) => l.id === id ? json.lead : l));
    setSelected(json.lead);
    setNoteInput("");
    setSaving(false);
  }

  // ── Supprimer un lead ────────────────────────────────────────────────────
  async function deleteLead(id: string) {
    if (!confirm("Supprimer ce lead ?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const stats = {
    total:   leads.length,
    rdv:     leads.filter((l) => l.status === "rdv").length,
    clients: leads.filter((l) => l.status === "client").length,
    appels:  leads.reduce((s, l) => s + (l.callCount ?? 0), 0),
  };

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-brand-400" /> Pipeline CRM
            {!loading && <span className="text-xs text-white/30 font-normal">· {leads.length} leads</span>}
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={loadLeads} className="btn-ghost text-xs flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Actualiser
            </button>
            <button onClick={() => setShowAddForm(true)}
              className="btn-primary text-xs py-2 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Ajouter un lead
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total leads",   v: stats.total,   icon: <Users className="w-4 h-4" />,   color: "text-white" },
              { label: "Appels passés", v: stats.appels,  icon: <Phone className="w-4 h-4" />,   color: "text-brand-400" },
              { label: "RDV pris",      v: stats.rdv,     icon: <Calendar className="w-4 h-4" />,color: "text-violet-400" },
              { label: "Clients",       v: stats.clients, icon: <TrendingUp className="w-4 h-4" />,color: "text-emerald-400" },
            ].map(({ label, v, icon, color }) => (
              <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className={cn("opacity-60", color)}>{icon}</div>
                <div>
                  <div className={cn("text-xl font-black", color)}>{v}</div>
                  <div className="text-xs text-white/35">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 text-white/30">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
            </div>
          )}

          {/* Pipeline Kanban */}
          {!loading && (
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {PIPELINE_COLS.map((col) => {
                const colLeads = leads.filter((l) => l.status === col.id);
                return (
                  <div key={col.id}>
                    <div className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-xl border mb-2",
                      col.bg, col.border
                    )}>
                      <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                      <span className="text-[10px] text-white/30 font-mono">{colLeads.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colLeads.map((lead) => (
                        <div key={lead.id}
                          onClick={() => { setSelected(lead); setNoteInput(lead.notes ?? ""); }}
                          className={cn(
                            "glass rounded-xl p-3 cursor-pointer transition-all group",
                            selected?.id === lead.id ? "border-brand-500/40" : "hover:border-white/15"
                          )}>
                          <p className="text-xs font-semibold text-white truncate mb-1">{lead.name}</p>
                          <p className="text-[10px] text-white/35 truncate mb-1.5">{lead.category}</p>
                          <p className="text-[10px] font-mono text-brand-400/80">{lead.phone}</p>
                          {lead.notes && (
                            <p className="text-[10px] text-white/30 mt-1.5 line-clamp-1 italic">{lead.notes}</p>
                          )}
                          {lead.rdvDate && (
                            <div className="mt-1.5 text-[10px] text-violet-400">
                              📅 {formatDate(lead.rdvDate)}
                            </div>
                          )}
                          {(lead.callCount ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-white/25">
                              <Phone className="w-2.5 h-2.5" /> {lead.callCount} appel{lead.callCount > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      ))}
                      {colLeads.length === 0 && (
                        <div className="text-center py-6 text-[10px] text-white/15 border border-dashed border-white/[0.06] rounded-xl">
                          vide
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Sidebar détail ── */}
      {selected && (
        <aside className="w-80 shrink-0 border-l border-white/[0.06] bg-ink-900/60 flex flex-col h-full overflow-auto">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white truncate">{selected.name}</h2>
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-5 overflow-auto">
            {/* Infos */}
            <div className="space-y-2 text-sm">
              {[
                { l: "Téléphone",  v: selected.phone,       cls: "text-brand-400 font-mono" },
                { l: "Catégorie",  v: selected.category,    cls: "text-white/70" },
                { l: "Ville",      v: selected.city,        cls: "text-white/70" },
                { l: "Adresse",    v: selected.address,     cls: "text-white/60 text-xs" },
                { l: "Note Google",v: `★ ${selected.rating} (${selected.reviewCount} avis)`, cls: "text-amber-400" },
                { l: "Appels",     v: String(selected.callCount ?? 0), cls: "text-white/70" },
              ].map(({ l, v, cls }) => (
                <div key={l} className="flex items-start justify-between gap-2">
                  <span className="text-white/35 shrink-0">{l}</span>
                  <span className={cls}>{v}</span>
                </div>
              ))}
              {selected.website && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white/35">Site</span>
                  <a href={`https://${selected.website}`} target="_blank" rel="noopener noreferrer"
                    className="text-brand-400 hover:underline text-xs truncate max-w-[160px]">
                    {selected.website}
                  </a>
                </div>
              )}
              {selected.lastContact && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white/35">Dernier contact</span>
                  <span className="text-white/50 text-xs">{formatDate(selected.lastContact)}</span>
                </div>
              )}
            </div>

            {/* Statut */}
            <div>
              <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Déplacer vers</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PIPELINE_COLS.map((col) => (
                  <button key={col.id} onClick={() => moveLead(selected.id, col.id)}
                    className={cn(
                      "text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all",
                      selected.status === col.id
                        ? cn(col.bg, col.border, col.color)
                        : "border-white/[0.06] text-white/30 hover:text-white hover:border-white/20"
                    )}>
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Notes</p>
              {selected.notes && (
                <div className="glass rounded-xl p-3 mb-2 text-xs text-white/60 italic leading-relaxed">
                  {selected.notes}
                </div>
              )}
              <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ajouter une note…" rows={3}
                className="input text-xs resize-none" />
              <button onClick={() => saveNote(selected.id)} disabled={saving}
                className="mt-2 w-full text-xs btn-primary py-2 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <a href={`tel:${selected.phone.replace(/\s/g,"")}`}
                className="btn-primary flex items-center justify-center gap-2 text-sm w-full">
                <Phone className="w-4 h-4" /> Appeler
              </a>
              <a href={`/app?id=${selected.id}`}
                className="btn-outline flex items-center justify-center gap-2 text-sm w-full">
                Interface d&apos;appel complète
              </a>
              <button onClick={() => deleteLead(selected.id)}
                className="w-full flex items-center justify-center gap-2 text-xs text-red-400/60 hover:text-red-400 py-2 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer ce lead
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Modal ajout lead ── */}
      {showAddForm && <AddLeadModal onClose={() => setShowAddForm(false)} onSaved={() => { setShowAddForm(false); loadLeads(); }} />}
    </div>
  );
}

// ── Formulaire ajout ─────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name:"", category:"", phone:"", city:"", address:"", website:"" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: `manual-${Date.now()}`,
        ...form,
        rating: 0, reviewCount: 0,
        status: "new", notes: "",
        detectedAt: new Date().toISOString(),
        source: "manual", callCount: 0,
      }]),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Ajouter un lead manuellement</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-white/40 hover:text-white" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key:"name",     label:"Nom de l'entreprise *", placeholder:"Plomberie Dupont" },
            { key:"category", label:"Secteur",               placeholder:"Plombier" },
            { key:"phone",    label:"Téléphone *",           placeholder:"06 12 34 56 78" },
            { key:"city",     label:"Ville",                 placeholder:"Lyon" },
            { key:"address",  label:"Adresse",               placeholder:"12 rue de la Paix" },
            { key:"website",  label:"Site web",              placeholder:"dupont.fr" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-white/40 mb-1 block">{label}</label>
              <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder} className="input text-sm" />
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
