"use client";

import { useState } from "react";
import {
  Bell, Plus, TrendingDown, TrendingUp, Minus,
  Mail, MessageCircle, Trash2, ToggleLeft, ToggleRight,
  Zap, Check,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { MOCK_ALERTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { PriceAlert } from "@/lib/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(MOCK_ALERTS);
  const [showNew, setShowNew] = useState(false);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newChannel, setNewChannel] = useState<"email" | "telegram" | "both">("both");
  const [saved, setSaved] = useState(false);

  function toggleAlert(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, active: !a.active } : a));
  }

  function deleteAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function createAlert() {
    if (!newFrom || !newTo || !newTarget) return;
    const alert: PriceAlert = {
      id: `a${Date.now()}`,
      route: `${newFrom} → ${newTo}`,
      from: newFrom,
      to: newTo,
      targetPrice: Number(newTarget),
      currentPrice: Number(newTarget) + Math.floor(Math.random() * 200 + 50),
      trend: Math.random() > 0.5 ? "falling" : "rising",
      channel: newChannel,
      active: true,
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [alert, ...prev]);
    setNewFrom(""); setNewTo(""); setNewTarget("");
    setShowNew(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <div className="min-h-screen bg-sky-950">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-aeris-600/20 flex items-center justify-center border border-aeris-500/20">
                <Bell className="w-5 h-5 text-aeris-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Alertes prix</h1>
            </div>
            <p className="text-white/50 text-sm">
              {activeCount} alerte{activeCount > 1 ? "s" : ""} active{activeCount > 1 ? "s" : ""} · Notification Telegram ou email dès que le prix atteint votre cible.
            </p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle alerte
          </button>
        </div>

        {/* Success toast */}
        {saved && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm animate-fade-in">
            <Check className="w-4 h-4" />
            Alerte créée avec succès !
          </div>
        )}

        {/* New alert form */}
        {showNew && (
          <div className="glass rounded-2xl p-6 border border-aeris-500/20 mb-6 animate-slide-up">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-aeris-400 fill-aeris-400" />
              Créer une nouvelle alerte
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <input className="aeris-input" placeholder="Départ (ex: Paris CDG)"
                value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
              <input className="aeris-input" placeholder="Destination (ex: New York JFK)"
                value={newTo} onChange={(e) => setNewTo(e.target.value)} />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">€</span>
                <input className="aeris-input pl-7 w-full" type="number" placeholder="Prix cible"
                  value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
              </div>
            </div>

            {/* Channel selector */}
            <div className="mb-4">
              <label className="text-xs text-white/50 block mb-2">Canal de notification</label>
              <div className="flex gap-2">
                {([
                  { value: "email" as const, icon: <Mail className="w-3.5 h-3.5" />, label: "Email" },
                  { value: "telegram" as const, icon: <MessageCircle className="w-3.5 h-3.5" />, label: "Telegram" },
                  { value: "both" as const, icon: <Bell className="w-3.5 h-3.5" />, label: "Les deux" },
                ] as const).map((ch) => (
                  <button key={ch.value} onClick={() => setNewChannel(ch.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all",
                      newChannel === ch.value
                        ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                    )}>
                    {ch.icon}{ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={createAlert} className="btn-primary text-sm flex items-center gap-2">
                <Bell className="w-4 h-4" /> Créer l'alerte
              </button>
              <button onClick={() => setShowNew(false)} className="btn-ghost text-sm">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Alerts list */}
        <div className="space-y-3">
          {alerts.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Aucune alerte créée.</p>
              <p className="text-sm mt-1">Créez votre première alerte pour être notifié dès que le prix baisse.</p>
            </div>
          )}

          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onToggle={() => toggleAlert(alert.id)}
              onDelete={() => deleteAlert(alert.id)}
            />
          ))}
        </div>

        {/* How it works */}
        <div className="mt-12 glass rounded-2xl p-6 border border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white mb-4">Comment fonctionnent les alertes AERIS ?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Définissez votre prix cible", desc: "Indiquez le prix maximum que vous souhaitez payer pour cette route." },
              { step: "2", title: "AERIS surveille 24/7", desc: "Notre moteur scanne toutes les sources toutes les 15 minutes pour détecter les baisses de prix." },
              { step: "3", title: "Alerte instantanée", desc: "Dès que le prix passe sous votre seuil, vous recevez une notification immédiate par Telegram ou email." },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-aeris-600/20 border border-aeris-500/30 flex items-center justify-center text-aeris-300 text-xs font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">{item.title}</div>
                  <div className="text-xs text-white/40 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({
  alert, onToggle, onDelete,
}: {
  alert: PriceAlert;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const diff = alert.currentPrice - alert.targetPrice;
  const pct = Math.round((diff / alert.targetPrice) * 100);
  const isNear = diff < alert.targetPrice * 0.15;

  return (
    <div className={cn(
      "glass glass-hover rounded-2xl p-5 border transition-all",
      !alert.active && "opacity-50",
      isNear && alert.active && "border-emerald-500/25"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Route */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base font-semibold text-white">{alert.route}</span>
            {isNear && alert.active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 font-medium">
                Proche de la cible !
              </span>
            )}
          </div>

          {/* Prices */}
          <div className="flex items-center gap-4 mb-3">
            <div>
              <div className="text-xs text-white/40">Prix actuel</div>
              <div className="text-lg font-bold text-white">{alert.currentPrice}€</div>
            </div>
            <div className="flex flex-col items-center">
              {alert.trend === "falling" ? (
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              ) : alert.trend === "rising" ? (
                <TrendingUp className="w-4 h-4 text-red-400" />
              ) : (
                <Minus className="w-4 h-4 text-white/30" />
              )}
            </div>
            <div>
              <div className="text-xs text-white/40">Votre cible</div>
              <div className="text-lg font-bold text-aeris-300">{alert.targetPrice}€</div>
            </div>
            <div className={cn(
              "px-2 py-1 rounded-lg text-sm font-medium",
              diff > 0 ? "text-red-400 bg-red-400/10" : "text-emerald-400 bg-emerald-400/10"
            )}>
              {diff > 0 ? "+" : ""}{diff}€ ({pct > 0 ? "+" : ""}{pct}%)
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-white/30">
            {alert.channel === "email" && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />Email</span>}
            {alert.channel === "telegram" && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />Telegram</span>}
            {alert.channel === "both" && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /><MessageCircle className="w-3 h-3" />Email + Telegram
              </span>
            )}
            {alert.lastTriggered && (
              <span>Dernière alerte: {new Date(alert.lastTriggered).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggle} className="text-white/40 hover:text-white transition-colors">
            {alert.active
              ? <ToggleRight className="w-6 h-6 text-aeris-400" />
              : <ToggleLeft className="w-6 h-6" />}
          </button>
          <button onClick={onDelete} className="text-white/30 hover:text-red-400 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
