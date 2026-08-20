"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, ChevronRight, ChevronLeft, Clock,
  Loader2, MessageSquare, MapPin, Globe, SkipForward,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { CALL_SCRIPT } from "@/lib/mock-data";
import type { Lead } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

type CallOutcome = "no_answer" | "interested" | "not_interested" | "rdv" | "callback";

// Light-theme outcome config
const OUTCOME_CONFIG: Record<CallOutcome, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  no_answer:      { label: "Pas répondu",   color: "text-gray-500",    bg: "bg-gray-100",   border: "border-gray-200",   emoji: "📵" },
  interested:     { label: "Intéressé",      color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",  emoji: "🙌" },
  not_interested: { label: "Pas intéressé", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",    emoji: "❌" },
  rdv:            { label: "RDV pris ✅",    color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200", emoji: "📅" },
  callback:       { label: "À rappeler",     color: "text-brand-600",   bg: "bg-brand-50",   border: "border-brand-200",  emoji: "🔁" },
};

export default function AppPage() {
  const [queue,    setQueue]    = useState<Lead[]>([]);
  const [idx,      setIdx]      = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [calling,  setCalling]  = useState(false);
  const [elapsed,  setElapsed]  = useState(0);
  const [outcome,  setOutcome]  = useState<CallOutcome | null>(null);
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [callLog,  setCallLog]  = useState<Array<{ lead: Lead; outcome: CallOutcome; duration: number }>>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Charger la file d'appel depuis l'API ─────────────────────────────────
  useEffect(() => {
    fetch("/api/leads?status=new")
      .then((r) => r.json())
      .then((d) => {
        const fresh = d.leads ?? [];
        setQueue(fresh);
        setLoading(false);
      });
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (calling) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [calling]);

  function startCall() {
    setCalling(true);
    setElapsed(0);
    setOutcome(null);
  }

  async function endCall(o: CallOutcome) {
    setCalling(false);
    setOutcome(o);
    const lead = queue[idx];
    if (!lead) return;

    setSaving(true);
    await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, outcome: o, notes, duration: elapsed }),
    });
    setSaving(false);

    setCallLog((prev) => [{ lead, outcome: o, duration: elapsed }, ...prev.slice(0, 9)]);
  }

  function nextLead() {
    if (idx < queue.length - 1) {
      setIdx((i) => i + 1);
      setCalling(false);
      setElapsed(0);
      setOutcome(null);
      setNotes("");
    }
  }

  function prevLead() {
    if (idx > 0) { setIdx((i) => i - 1); setCalling(false); setElapsed(0); setOutcome(null); setNotes(""); }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🎉</div>
            <p className="text-lg font-bold text-gray-900 mb-2">File d&apos;appel vide !</p>
            <p className="text-sm text-gray-500 mb-6">Tu as contacté tous tes leads «&nbsp;Nouveaux&nbsp;».</p>
            <a href="/leads" className="btn-primary inline-flex items-center gap-2 text-sm">
              Charger de nouveaux leads
            </a>
          </div>
        </div>
      </div>
    );
  }

  const lead   = queue[idx];
  const script = CALL_SCRIPT
    .replace(/\[NOM\]/g,             lead.name.split(" ").pop() ?? "")
    .replace(/\[NOM_ENTREPRISE\]/g,  lead.name);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-500" /> Interface d&apos;appel
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Lead {idx + 1} / {queue.length} · {queue.length - idx - 1} restants dans la file
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevLead} disabled={idx === 0} className="btn-ghost p-2 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextLead} disabled={idx === queue.length - 1}
              className="flex items-center gap-1.5 btn-ghost text-xs disabled:opacity-30">
              Passer <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Lead info + appel ── */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">{lead.name}</h2>
                  <p className="text-sm text-gray-400">{lead.category} · {lead.city}</p>
                </div>
                {lead.rating > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-amber-500 font-bold">★ {lead.rating}</div>
                    <div className="text-[10px] text-gray-400">{lead.reviewCount} avis</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm mb-5">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-500" />
                  <span className="font-mono text-brand-600 text-lg font-bold">{lead.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4" />
                  <span>{lead.address}</span>
                </div>
                {lead.website && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Globe className="w-4 h-4" />
                    <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                      className="text-brand-600 hover:underline">{lead.website}</a>
                  </div>
                )}
              </div>

              {/* Appel */}
              {!calling && !outcome && (
                <a href={`tel:${lead.phone.replace(/\s/g,"")}`} onClick={startCall}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-base py-4">
                  <Phone className="w-5 h-5" /> Appeler
                </a>
              )}

              {/* Timer en cours */}
              {calling && (
                <div className="text-center py-4">
                  <div className="text-3xl font-black text-brand-600 font-mono mb-2">
                    {formatDuration(elapsed)}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 live-dot" /> Appel en cours
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(OUTCOME_CONFIG) as CallOutcome[]).map((o) => {
                      const cfg = OUTCOME_CONFIG[o];
                      return (
                        <button key={o} onClick={() => endCall(o)}
                          className={cn("text-xs font-semibold py-3 px-2 rounded-xl border transition-all", cfg.bg, cfg.border, cfg.color)}>
                          {cfg.emoji} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outcome saved */}
              {outcome && !calling && (
                <div className={cn("rounded-xl p-4 text-center border mb-3", OUTCOME_CONFIG[outcome].bg, OUTCOME_CONFIG[outcome].border)}>
                  <div className="text-2xl mb-1">{OUTCOME_CONFIG[outcome].emoji}</div>
                  <div className={cn("text-sm font-bold", OUTCOME_CONFIG[outcome].color)}>{OUTCOME_CONFIG[outcome].label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Durée : {formatDuration(elapsed)}
                    {saving && <span className="ml-2"><Loader2 className="w-3 h-3 inline animate-spin" /> Sauvegarde…</span>}
                    {!saving && " · Sauvegardé ✓"}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Notes d&apos;appel
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ce qu'il a dit, son objection, date de rappel…"
                rows={4} className="input text-xs resize-none" />
            </div>

            {outcome && (
              <button onClick={nextLead} className="w-full btn-primary flex items-center justify-center gap-2">
                Lead suivant <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Script ── */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 h-full shadow-sm">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-brand-500" /> Script d&apos;appel
              </h3>
              <pre className="text-xs text-gray-600 leading-loose whitespace-pre-wrap font-sans">{script}</pre>
            </div>
          </div>

          {/* ── Historique session ── */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-brand-500" /> Historique de session
              </h3>
              {callLog.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">Aucun appel pour l&apos;instant</p>
              ) : (
                <div className="space-y-2">
                  {callLog.map((entry, i) => {
                    const cfg = OUTCOME_CONFIG[entry.outcome];
                    return (
                      <div key={i} className={cn("rounded-xl p-3 border", cfg.bg, cfg.border)}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-900 truncate">{entry.lead.name}</span>
                          <span className="text-[10px] font-mono text-gray-400">{formatDuration(entry.duration)}</span>
                        </div>
                        <div className={cn("text-[10px] font-medium", cfg.color)}>{cfg.emoji} {cfg.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {callLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-black text-gray-900">{callLog.length}</div>
                    <div className="text-[9px] text-gray-400">appels</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-violet-600">
                      {callLog.filter((l) => l.outcome === "rdv").length}
                    </div>
                    <div className="text-[9px] text-gray-400">RDV</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-amber-600">
                      {callLog.filter((l) => l.outcome === "interested").length}
                    </div>
                    <div className="text-[9px] text-gray-400">intéressés</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
