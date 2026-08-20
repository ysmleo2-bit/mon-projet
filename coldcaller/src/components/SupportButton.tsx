"use client";

import { useState } from "react";
import { MessageCircle, X, Send, Loader2, CheckCircle, Bug, HelpCircle, Lightbulb, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TicketType = "bug" | "technique" | "question" | "suggestion" | "autre";

const TYPE_CONFIG: Record<TicketType, { label: string; icon: typeof Bug; color: string }> = {
  bug:        { label: "Bug",              icon: Bug,           color: "text-red-600"     },
  technique:  { label: "Problème tech.",   icon: AlertTriangle, color: "text-amber-600"   },
  question:   { label: "Question",         icon: HelpCircle,    color: "text-brand-600"   },
  suggestion: { label: "Suggestion",       icon: Lightbulb,     color: "text-violet-600"  },
  autre:      { label: "Autre",            icon: MessageCircle, color: "text-gray-600"    },
};

export default function SupportButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TicketType>("bug");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) return;
    setSending(true);
    try {
      await fetch("/api/support/tickets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type,
          description: description.trim(),
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOpen(false);
        setDescription("");
        setType("bug");
      }, 2500);
    } catch { /* silencieux */ } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200",
          open
            ? "bg-gray-800 text-white"
            : "bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/30"
        )}
        aria-label="Support"
      >
        {open ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        <span className="text-sm font-medium">{open ? "Fermer" : "Aide & Support"}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[68px] right-5 z-50 w-[360px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-violet-50">
            <h3 className="text-sm font-bold text-gray-900">💬 Aide & Signalement</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Bug, question ou suggestion — on vous répond vite.</p>
          </div>

          {sent ? (
            <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="text-sm font-bold text-gray-900">Message envoyé !</p>
              <p className="text-xs text-gray-400">Nous reviendrons vers vous rapidement.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Type */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Type de message</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(TYPE_CONFIG) as [TicketType, typeof TYPE_CONFIG[TicketType]][]).map(([k, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        className={cn(
                          "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-medium transition-all",
                          type === k
                            ? "bg-brand-50 border-brand-300 text-brand-700"
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", type === k ? "text-brand-600" : cfg.color)} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === "bug"        ? "Décrivez le bug : page, ce que vous faisiez, ce qui s'est passé…" :
                    type === "technique"  ? "Décrivez le problème technique rencontré…" :
                    type === "question"   ? "Posez votre question…" :
                    type === "suggestion" ? "Décrivez votre idée d'amélioration…" :
                                           "Décrivez votre message…"
                  }
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 text-xs resize-none placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-colors"
                />
                <p className="text-[10px] text-gray-400 mt-1">Page actuelle transmise automatiquement.</p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!description.trim() || sending}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
