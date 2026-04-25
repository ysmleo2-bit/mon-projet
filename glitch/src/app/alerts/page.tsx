"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell, Plus, Trash2, Send, CheckCircle, AlertTriangle,
  Zap, Settings, ChevronDown, ChevronUp, X, ExternalLink,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import type { GlitchCategory, AlertPreference } from "@/lib/types";

const MOCK_ALERTS: AlertPreference[] = [
  {
    id: "a1",
    routes: ["CDG-JFK", "CDG-NYC"],
    categories: ["GLITCH", "FLASH"],
    minSaving: 200,
    minConfidence: 70,
    channel: "telegram",
    telegramChatId: "123456789",
    active: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    triggeredCount: 4,
  },
  {
    id: "a2",
    routes: ["*-BKK", "*-TYO", "*-NRT"],
    categories: ["GLITCH", "FLASH", "DEAL"],
    minSaving: 150,
    minConfidence: 60,
    channel: "both",
    telegramChatId: "123456789",
    email: "user@example.com",
    active: true,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    triggeredCount: 9,
  },
  {
    id: "a3",
    routes: ["CDG-*"],
    categories: ["GLITCH"],
    minSaving: 300,
    minConfidence: 80,
    channel: "telegram",
    telegramChatId: "123456789",
    active: false,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    triggeredCount: 2,
  },
];

const RECENT_TRIGGERS = [
  { route: "CDG → JFK", price: "89€", saving: "83%", cat: "GLITCH" as GlitchCategory, at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { route: "CDG → TYO", price: "340€", saving: "88%", cat: "GLITCH" as GlitchCategory, at: new Date(Date.now() - 3600000 * 18).toISOString() },
  { route: "CDG → BKK", price: "390€", saving: "51%", cat: "FLASH" as GlitchCategory, at: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const CATEGORY_COLORS: Record<GlitchCategory, string> = {
  GLITCH: "text-purple-300 bg-purple-500/15 border-purple-500/30",
  FLASH:  "text-orange-300 bg-orange-500/15 border-orange-500/30",
  DEAL:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  WATCH:  "text-sky-300 bg-sky-500/15 border-sky-500/30",
};

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `il y a ${d}j`;
  if (h > 0) return `il y a ${h}h`;
  return "à l'instant";
}

interface NewAlertForm {
  route: string;
  categories: GlitchCategory[];
  minSaving: number;
  minConfidence: number;
  channel: "telegram" | "email" | "both";
  telegramChatId: string;
  email: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts]           = useState<AlertPreference[]>(MOCK_ALERTS);
  const [showNew, setShowNew]         = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [telegramStep, setTelegramStep] = useState<1 | 2 | 3>(1);
  const [chatIdInput, setChatIdInput]  = useState("");
  const [chatIdVerified, setChatIdVerified] = useState(false);
  const [form, setForm] = useState<NewAlertForm>({
    route: "",
    categories: ["GLITCH", "FLASH"],
    minSaving: 100,
    minConfidence: 60,
    channel: "telegram",
    telegramChatId: "",
    email: "",
  });

  function toggleCategory(c: GlitchCategory) {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter(x => x !== c)
        : [...f.categories, c],
    }));
  }

  function toggleAlert(id: string) {
    setAlerts(a => a.map(al => al.id === id ? { ...al, active: !al.active } : al));
  }

  function deleteAlert(id: string) {
    setAlerts(a => a.filter(al => al.id !== id));
  }

  function createAlert() {
    if (!form.route.trim() || form.categories.length === 0) return;
    const newAlert: AlertPreference = {
      id: `a${Date.now()}`,
      routes: form.route.split(",").map(r => r.trim().toUpperCase()).filter(Boolean),
      categories: form.categories,
      minSaving: form.minSaving,
      minConfidence: form.minConfidence,
      channel: form.channel,
      telegramChatId: form.telegramChatId || undefined,
      email: form.email || undefined,
      active: true,
      createdAt: new Date().toISOString(),
      triggeredCount: 0,
    };
    setAlerts(a => [newAlert, ...a]);
    setShowNew(false);
    setForm({ route: "", categories: ["GLITCH","FLASH"], minSaving: 100, minConfidence: 60, channel: "telegram", telegramChatId: "", email: "" });
  }

  function verifyTelegram() {
    if (chatIdInput.trim().length > 5) {
      setChatIdVerified(true);
      setTelegramStep(3);
    }
  }

  const activeCount  = alerts.filter(a => a.active).length;
  const totalTriggers = alerts.reduce((s, a) => s + a.triggeredCount, 0);

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-20 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-black mono text-white">Mes alertes</h1>
            <button
              onClick={() => setShowNew(v => !v)}
              className="flex items-center gap-2 btn-green text-sm">
              <Plus className="w-4 h-4" />
              Nouvelle alerte
            </button>
          </div>
          <p className="text-sm text-white/40">
            {activeCount} alerte{activeCount > 1 ? "s" : ""} active{activeCount > 1 ? "s" : ""} · {totalTriggers} déclenchements au total
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { v: `${activeCount}`, l: "alertes actives", color: "text-glitch-green" },
            { v: `${totalTriggers}`, l: "déclenchements", color: "text-purple-400" },
            { v: "<30s", l: "délai de notification", color: "text-orange-400" },
          ].map(({ v, l, color }) => (
            <div key={l} className="glass rounded-xl p-4 border border-white/[0.06] text-center">
              <div className={cn("text-2xl font-black mono", color)}>{v}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* New alert form */}
            {showNew && (
              <div className="glass rounded-2xl p-5 border border-glitch-green/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-white">Nouvelle alerte</h2>
                  <button onClick={() => setShowNew(false)} className="text-white/30 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Route */}
                  <div>
                    <label className="text-xs text-white/40 block mb-1.5">
                      Route(s) <span className="text-white/20">— ex: CDG-JFK, *-BKK, CDG-* (virgule pour plusieurs)</span>
                    </label>
                    <input
                      value={form.route}
                      onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                      placeholder="CDG-JFK, *-TYO"
                      className="g-input w-full mono"
                    />
                  </div>

                  {/* Categories */}
                  <div>
                    <label className="text-xs text-white/40 block mb-2">Catégories</label>
                    <div className="flex gap-2">
                      {(["GLITCH","FLASH","DEAL","WATCH"] as GlitchCategory[]).map(c => (
                        <button key={c} onClick={() => toggleCategory(c)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-full border mono font-medium transition-all",
                            form.categories.includes(c) ? CATEGORY_COLORS[c] : "bg-transparent border-white/[0.08] text-white/30"
                          )}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thresholds */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Économie minimale</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min={50} max={500} step={25} value={form.minSaving}
                          onChange={e => setForm(f => ({ ...f, minSaving: Number(e.target.value) }))}
                          className="flex-1 accent-glitch-green cursor-pointer h-1" />
                        <span className="text-xs font-bold mono text-glitch-green w-14 text-right">{form.minSaving}€</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Confiance minimale</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min={40} max={95} step={5} value={form.minConfidence}
                          onChange={e => setForm(f => ({ ...f, minConfidence: Number(e.target.value) }))}
                          className="flex-1 accent-glitch-green cursor-pointer h-1" />
                        <span className="text-xs font-bold mono text-glitch-green w-14 text-right">{form.minConfidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="text-xs text-white/40 block mb-2">Canal de notification</label>
                    <div className="flex gap-2">
                      {(["telegram","email","both"] as const).map(ch => (
                        <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-lg border transition-all",
                            form.channel === ch
                              ? "bg-white/10 border-white/25 text-white"
                              : "bg-transparent border-white/[0.08] text-white/40"
                          )}>
                          {ch === "telegram" ? "Telegram" : ch === "email" ? "Email" : "Les deux"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(form.channel === "telegram" || form.channel === "both") && (
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Telegram Chat ID</label>
                      <input value={form.telegramChatId}
                        onChange={e => setForm(f => ({ ...f, telegramChatId: e.target.value }))}
                        placeholder="123456789"
                        className="g-input w-full mono" />
                    </div>
                  )}

                  {(form.channel === "email" || form.channel === "both") && (
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Email</label>
                      <input type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="vous@exemple.com"
                        className="g-input w-full" />
                    </div>
                  )}

                  <button onClick={createAlert}
                    disabled={!form.route.trim() || form.categories.length === 0}
                    className="w-full btn-green disabled:opacity-40 disabled:cursor-not-allowed">
                    Créer l'alerte
                  </button>
                </div>
              </div>
            )}

            {/* Alert list */}
            <div className="space-y-3">
              {alerts.length === 0 && (
                <div className="text-center py-12 text-white/30 mono">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Aucune alerte configurée.</p>
                </div>
              )}
              {alerts.map(alert => (
                <div key={alert.id} className={cn(
                  "glass rounded-2xl overflow-hidden border transition-all",
                  alert.active ? "border-white/[0.08]" : "border-white/[0.04] opacity-60"
                )}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Routes */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {alert.routes.map(r => (
                            <span key={r} className="text-xs font-bold mono bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-md text-white/70">
                              {r}
                            </span>
                          ))}
                        </div>
                        {/* Categories */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {alert.categories.map(c => (
                            <span key={c} className={cn("text-[10px] font-bold mono px-2 py-0.5 rounded-full border", CATEGORY_COLORS[c])}>
                              {c}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/30 mono">
                          <span>min {alert.minSaving}€ éco</span>
                          <span>·</span>
                          <span>conf ≥{alert.minConfidence}%</span>
                          <span>·</span>
                          <span>{alert.channel === "both" ? "Telegram + Email" : alert.channel}</span>
                          <span>·</span>
                          <span>{alert.triggeredCount} déclenchement{alert.triggeredCount > 1 ? "s" : ""}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedId(v => v === alert.id ? null : alert.id)}
                          className="text-white/25 hover:text-white/60 transition-colors">
                          {expandedId === alert.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {/* Toggle */}
                        <button onClick={() => toggleAlert(alert.id)}
                          className={cn(
                            "relative w-10 h-5 rounded-full border transition-all",
                            alert.active
                              ? "bg-glitch-green/20 border-glitch-green/50"
                              : "bg-white/[0.06] border-white/15"
                          )}>
                          <span className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full transition-all",
                            alert.active ? "left-5 bg-glitch-green" : "left-0.5 bg-white/30"
                          )} />
                        </button>

                        <button onClick={() => deleteAlert(alert.id)}
                          className="text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedId === alert.id && (
                    <div className="border-t border-white/[0.06] px-4 py-3 space-y-2 bg-white/[0.02]">
                      <div className="text-[10px] text-white/30 mono">
                        Créée {timeAgoShort(alert.createdAt)}
                        {alert.telegramChatId && ` · Chat ID: ${alert.telegramChatId}`}
                        {alert.email && ` · ${alert.email}`}
                      </div>
                      <button className="text-xs text-glitch-green hover:underline mono flex items-center gap-1">
                        <Send className="w-3 h-3" /> Envoyer une alerte test
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recent triggers */}
            {RECENT_TRIGGERS.length > 0 && (
              <div className="glass rounded-2xl p-5 border border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white mb-4">Dernières alertes déclenchées</h3>
                <div className="space-y-3">
                  {RECENT_TRIGGERS.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[10px] font-bold mono px-2 py-0.5 rounded-full border", CATEGORY_COLORS[t.cat])}>
                          {t.cat}
                        </span>
                        <span className="text-sm font-bold mono text-white">{t.route}</span>
                        <span className="text-xs text-glitch-green font-bold mono">{t.price} (-{t.saving})</span>
                      </div>
                      <span className="text-[10px] text-white/30 mono">{timeAgoShort(t.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Telegram setup */}
            <div className="glass rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Configurer Telegram</h3>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {[
                  {
                    n: 1,
                    title: "Ouvrir le bot",
                    desc: "Recherchez @GlitchFareBot sur Telegram et tapez /start",
                    action: (
                      <a href="https://t.me/GlitchFareBot" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-sky-400 hover:underline flex items-center gap-1 mt-1">
                        Ouvrir @GlitchFareBot <ExternalLink className="w-3 h-3" />
                      </a>
                    ),
                  },
                  {
                    n: 2,
                    title: "Obtenir votre Chat ID",
                    desc: 'Tapez /myid pour obtenir votre identifiant unique',
                    action: telegramStep >= 2 ? (
                      <div className="flex gap-2 mt-2">
                        <input value={chatIdInput} onChange={e => setChatIdInput(e.target.value)}
                          placeholder="Ex: 123456789"
                          className="g-input flex-1 mono text-xs py-1.5" />
                        <button onClick={verifyTelegram}
                          className="text-xs px-3 py-1.5 bg-sky-500/20 border border-sky-500/40 text-sky-300 rounded-lg hover:bg-sky-500/30 transition-all">
                          OK
                        </button>
                      </div>
                    ) : null,
                  },
                  {
                    n: 3,
                    title: "Vérification",
                    desc: chatIdVerified
                      ? "✓ Telegram connecté — vous recevrez les alertes en temps réel."
                      : "Entrez votre Chat ID ci-dessus pour valider la connexion.",
                  },
                ].map((step, idx) => (
                  <div
                    key={step.n}
                    onClick={() => { if (idx + 1 >= telegramStep) setTelegramStep(idx + 1 as 1|2|3); }}
                    className={cn(
                      "flex gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      telegramStep > idx
                        ? "bg-sky-500/[0.05] border-sky-500/20"
                        : "border-white/[0.06] opacity-50"
                    )}>
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black mono shrink-0 border",
                      chatIdVerified && idx === 2
                        ? "bg-glitch-green/20 border-glitch-green/40 text-glitch-green"
                        : telegramStep > idx + 1
                          ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                          : "border-white/15 text-white/40"
                    )}>
                      {chatIdVerified && idx === 2 ? <CheckCircle className="w-3 h-3" /> : step.n}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{step.title}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{step.desc}</div>
                      {step.action}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Route syntax guide */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-3.5 h-3.5 text-white/30" />
                <h3 className="text-xs font-bold text-white mono uppercase tracking-wider">Syntaxe des routes</h3>
              </div>
              <div className="space-y-2 text-[10px] mono">
                {[
                  ["CDG-JFK",  "Route exacte"],
                  ["*-BKK",    "Toutes origines → Bangkok"],
                  ["CDG-*",    "Depuis Paris → partout"],
                  ["*-*",      "Toutes routes (non recommandé)"],
                  ["CDG-NYC, CDG-LAX", "Plusieurs routes"],
                ].map(([ex, desc]) => (
                  <div key={ex} className="flex items-center justify-between gap-3">
                    <span className="text-glitch-green shrink-0">{ex}</span>
                    <span className="text-white/30 text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 px-1">
              <AlertTriangle className="w-3 h-3 text-orange-400/60 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/25 leading-relaxed">
                Les alertes sont envoyées en moins de 30 secondes après détection.
                Assurez-vous que votre Chat ID Telegram est correct pour recevoir les notifications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
