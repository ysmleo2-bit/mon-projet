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

const OUTCOME_CONFIG: Record<CallOutcome, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  no_answer:      { label: "Pas répondu",   color: "text-white/50",    bg: "bg-white/[0.04]",     border: "border-white/[0.08]",  emoji: "📵" },
  interested:     { label: "Intéressé",      color: "text-amber-400",   bg: "bg-amber-500/10",     border: "border-amber-500/25",  emoji: "🙌" },
  not_interested: { label: "Pas intéressé", color: "text-red-400",     bg: "bg-red-500/10",       border: "border-red-500/25",    emoji: "❌" },
  rdv:            { label: "RDV pris ✅",    color: "text-violet-400",  bg: "bg-violet-500/10",    border: "border-violet-500/25", emoji: "📅" },
  callback:       { label: "À rappeler",     color: "text-brand-400",   bg: "bg-brand-500/10",     border: "border-brand-500/25",  emoji: "🔁" },
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
        // Mélanger + ajouter les "contacted" à la fin
        const fresh    = d.leads ?? [];
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

  // ── Enregistrer l'outcome via l'API ─────────────────────────────────────
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
      <div className="flex h-screen bg-ink-950">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex h-screen bg-ink-950">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-white/30">
          <div className="text-center">
            <div className="text-4xl mb-4">🎉</div>
            <p className="text-lg font-bold text-white mb-2">File d&apos;appel vide !</p>
            <p className="text-sm mb-6">Tu as contacté tous tes leads «&nbsp;Nouveaux&nbsp;».</p>
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
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-400" /> Interface d&apos;appel
            </h1>
            <p className="text-xs text-white/30 mt-0.5">
              Lead {idx + 1} / {queue.length} · {queue.length - idx - 1} restants dans la file
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevLead} disabled={idx === 0} className="btn-ghost p-2 disabled:opacity-20">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextLead} disabled={idx === queue.length - 1}
              className="flex items-center gap-1.5 btn-ghost text-xs disabled:opacity-20">
              Passer <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Lead info + appel ── */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-white">{lead.name}</h2>
                  <p className="text-sm text-white/40">{lead.category} · {lead.city}</p>
                </div>
                {lead.rating > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-amber-400 font-bold">★ {lead.rating}</div>
                    <div className="text-[10px] text-white/30">{lead.reviewCount} avis</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm mb-5">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-400" />
                  <span className="font-mono text-brand-300 text-lg font-bold">{lead.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <MapPin className="w-4 h-4" />
                  <span>{lead.address}</span>
                </div>
                {lead.website && (
                  <div className="flex items-center gap-2 text-white/50">
                    <Globe className="w-4 h-4" />
                    <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                      className="text-brand-400 hover:underline">{lead.website}</a>
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
                  <div className="text-3xl font-black text-brand-400 font-mono mb-2">
                    {formatDuration(elapsed)}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-xs text-white/30 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 live-dot" /> Appel en cours
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
                  <div className="text-xs text-white/30 mt-0.5">
                    Durée : {formatDuration(elapsed)}
                    {saving && <span className="ml-2"><Loader2 className="w-3 h-3 inline animate-spin" /> Sauvegarde…</span>}
                    {!saving && " · Sauvegardé ✓"}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="glass rounded-2xl p-4">
              <label className="text-xs text-white/30 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
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
            <div className="glass rounded-2xl p-5 h-full">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-brand-400" /> Script d&apos;appel
              </h3>
              <pre className="text-xs text-white/60 leading-loose whitespace-pre-wrap font-sans">{script}</pre>
            </div>
          </div>

          {/* ── Historique session ── */}
          <div>
            <div className="glass rounded-2xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-brand-400" /> Historique de session
              </h3>
              {callLog.length === 0 ? (
                <p className="text-xs text-white/25 text-center py-6">Aucun appel pour l&apos;instant</p>
              ) : (
                <div className="space-y-2">
                  {callLog.map((entry, i) => {
                    const cfg = OUTCOME_CONFIG[entry.outcome];
                    return (
                      <div key={i} className={cn("rounded-xl p-3 border", cfg.bg, cfg.border)}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-white truncate">{entry.lead.name}</span>
                          <span className="text-[10px] font-mono text-white/30">{formatDuration(entry.duration)}</span>
                        </div>
                        <div className={cn("text-[10px] font-medium", cfg.color)}>{cfg.emoji} {cfg.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {callLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-black text-white">{callLog.length}</div>
                    <div className="text-[9px] text-white/30">appels</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-violet-400">
                      {callLog.filter((l) => l.outcome === "rdv").length}
                    </div>
                    <div className="text-[9px] text-white/30">RDV</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-amber-400">
                      {callLog.filter((l) => l.outcome === "interested").length}
                    </div>
                    <div className="text-[9px] text-white/30">intéressés</div>
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
