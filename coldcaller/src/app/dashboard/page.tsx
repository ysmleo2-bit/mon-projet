"use client";

import { useState } from "react";
import { Phone, TrendingUp, Users, Calendar, Plus, Filter, BarChart2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import { MOCK_LEADS, PIPELINE_COLS } from "@/lib/mock-data";
import type { Lead, LeadStatus } from "@/lib/types";
import { cn, statusLabel } from "@/lib/utils";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteInput, setNoteInput] = useState("");

  function moveLead(id: string, newStatus: LeadStatus) {
    setLeads((prev) =>
      prev.map((l) => l.id === id ? { ...l, status: newStatus, lastContact: new Date().toISOString() } : l)
    );
  }

  function saveNote(id: string) {
    if (!noteInput.trim()) return;
    setLeads((prev) =>
      prev.map((l) => l.id === id ? { ...l, notes: noteInput } : l)
    );
    setSelectedLead((prev) => prev ? { ...prev, notes: noteInput } : null);
    setNoteInput("");
  }

  const stats = {
    total:   leads.length,
    rdv:     leads.filter((l) => l.status === "rdv").length,
    clients: leads.filter((l) => l.status === "client").length,
    appels:  leads.reduce((s, l) => s + l.callCount, 0),
  };

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-brand-400" /> Pipeline CRM
          </h1>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-xs flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filtrer
            </button>
            <button className="btn-primary text-xs py-2 flex items-center gap-1.5">
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

          {/* Pipeline Kanban */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {PIPELINE_COLS.map((col) => {
              const colLeads = leads.filter((l) => l.status === col.id);
              return (
                <div key={col.id} className="min-h-[300px]">
                  {/* Column header */}
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl border mb-2",
                    col.bg, col.border
                  )}>
                    <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                    <span className="text-[10px] text-white/30 font-mono">{colLeads.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="glass rounded-xl p-3 cursor-pointer hover:border-white/15 transition-all group"
                      >
                        <p className="text-xs font-semibold text-white truncate mb-1">{lead.name}</p>
                        <p className="text-[10px] text-white/35 truncate mb-2">{lead.category}</p>
                        <p className="text-[10px] font-mono text-brand-400/80">{lead.phone}</p>
                        {lead.notes && (
                          <p className="text-[10px] text-white/30 mt-1.5 line-clamp-1 italic">{lead.notes}</p>
                        )}
                        {lead.rdvDate && (
                          <div className="mt-1.5 text-[10px] text-violet-400">
                            📅 {new Date(lead.rdvDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Lead detail sidebar */}
      {selectedLead && (
        <aside className="w-80 shrink-0 border-l border-white/[0.06] bg-ink-900/50 flex flex-col h-full overflow-auto">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white truncate">{selectedLead.name}</h2>
            <button onClick={() => setSelectedLead(null)} className="text-white/30 hover:text-white text-lg leading-none">&times;</button>
          </div>

          <div className="p-5 flex-1 space-y-4">
            {/* Info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Téléphone</span>
                <span className="text-brand-400 font-mono">{selectedLead.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Catégorie</span>
                <span className="text-white/70">{selectedLead.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Ville</span>
                <span className="text-white/70">{selectedLead.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Note Google</span>
                <span className="text-amber-400">★ {selectedLead.rating} ({selectedLead.reviewCount})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Appels</span>
                <span className="text-white/70">{selectedLead.callCount}</span>
              </div>
            </div>

            {/* Status selector */}
            <div>
              <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Statut</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PIPELINE_COLS.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => moveLead(selectedLead.id, col.id)}
                    className={cn(
                      "text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all",
                      selectedLead.status === col.id
                        ? cn(col.bg, col.border, col.color)
                        : "border-white/[0.06] text-white/30 hover:text-white"
                    )}>
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Notes</p>
              {selectedLead.notes && (
                <div className="glass rounded-xl p-3 mb-2 text-xs text-white/60 italic">
                  {selectedLead.notes}
                </div>
              )}
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ajouter une note…"
                rows={3}
                className="input text-xs resize-none"
              />
              <button
                onClick={() => saveNote(selectedLead.id)}
                className="mt-2 w-full text-xs btn-primary py-2">
                Sauvegarder
              </button>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <a href={`tel:${selectedLead.phone.replace(/\s/g, "")}`}
                className="btn-primary flex items-center justify-center gap-2 text-sm w-full">
                <Phone className="w-4 h-4" /> Appeler maintenant
              </a>
              <a href={`/app?id=${selectedLead.id}`}
                className="btn-outline flex items-center justify-center gap-2 text-sm w-full">
                Ouvrir l&apos;interface appel
              </a>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
