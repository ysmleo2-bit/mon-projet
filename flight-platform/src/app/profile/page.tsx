"use client";

import { useState } from "react";
import {
  User, Settings, Sliders, Shield, Check,
  Zap, Globe, Plane, Building2, Bell,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import type { CabinClass } from "@/lib/types";

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Économique",
  premium_economy: "Premium Eco",
  business: "Affaires",
  first: "Première",
};

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [budgetMax, setBudgetMax] = useState(1500);
  const [maxDuration, setMaxDuration] = useState(14);
  const [maxStops, setMaxStops] = useState(1);
  const [baggageRequired, setBaggageRequired] = useState(true);
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [flexibleDates, setFlexibleDates] = useState(true);

  // Score weights
  const [wPrice, setWPrice] = useState(30);
  const [wDuration, setWDuration] = useState(20);
  const [wAirline, setWAirline] = useState(15);
  const [wComfort, setWComfort] = useState(15);
  const [wReliability, setWReliability] = useState(20);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-sky-950">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-aeris-700/30 flex items-center justify-center border border-aeris-500/20">
            <User className="w-8 h-8 text-aeris-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Mes préférences</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Personnalisez le moteur AERIS selon vos standards de voyage.
            </p>
          </div>
        </div>

        {/* Saved banner */}
        {saved && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
            <Check className="w-4 h-4" />
            Préférences sauvegardées. Le moteur s'adapte à vos critères.
          </div>
        )}

        <div className="space-y-4">
          {/* Budget & constraints */}
          <Section icon={<Sliders className="w-4 h-4" />} title="Contraintes de recherche">
            <div className="space-y-5">
              <SliderField
                label="Budget maximum" value={budgetMax} min={100} max={5000}
                display={`${budgetMax}€`} suffix="" unit="€"
                onChange={setBudgetMax}
              />
              <SliderField
                label="Durée max de trajet" value={maxDuration} min={1} max={30}
                display={`${maxDuration}h`}
                onChange={setMaxDuration}
              />
              <div>
                <label className="text-xs text-white/60 block mb-2">Escales maximum</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 99].map((s) => (
                    <button key={s} onClick={() => setMaxStops(s)}
                      className={cn(
                        "flex-1 py-2 rounded-xl border text-sm transition-all",
                        maxStops === s
                          ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300 font-medium"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}>
                      {s === 0 ? "Direct" : s === 99 ? "∞" : `${s} escale${s > 1 ? "s" : ""}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60 block mb-2">Classe préférée</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
                    <button key={c} onClick={() => setCabinClass(c)}
                      className={cn(
                        "px-4 py-2 rounded-xl border text-sm transition-all",
                        cabinClass === c
                          ? "bg-aeris-600/30 border-aeris-500/40 text-aeris-300 font-medium"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}>
                      {CABIN_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <ToggleField label="Bagage en soute obligatoire" value={baggageRequired} onChange={setBaggageRequired} />
                <ToggleField label="Dates flexibles (±3 jours)" value={flexibleDates} onChange={setFlexibleDates} />
              </div>
            </div>
          </Section>

          {/* Score weights */}
          <Section icon={<Zap className="w-4 h-4" />} title="Poids du score AERIS™">
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              Ajustez l'importance de chaque critère selon vos priorités personnelles.
              Le score sur 100 sera recalculé en temps réel avec vos poids.
            </p>
            <div className="space-y-4">
              <WeightField label="Prix" value={wPrice} onChange={setWPrice} color="aeris" />
              <WeightField label="Durée" value={wDuration} onChange={setWDuration} color="violet" />
              <WeightField label="Qualité compagnie" value={wAirline} onChange={setWAirline} color="sky" />
              <WeightField label="Confort + bagages" value={wComfort} onChange={setWComfort} color="amber" />
              <WeightField label="Ponctualité + avis" value={wReliability} onChange={setWReliability} color="emerald" />
            </div>
            <div className="mt-4 text-xs text-white/30 text-center">
              Total: {wPrice + wDuration + wAirline + wComfort + wReliability}%
              {wPrice + wDuration + wAirline + wComfort + wReliability !== 100 && (
                <span className="text-amber-400 ml-2">⚠ Doit être égal à 100%</span>
              )}
            </div>
          </Section>

          {/* Notifications */}
          <Section icon={<Bell className="w-4 h-4" />} title="Notifications">
            <div className="space-y-3">
              <ToggleField label="Alertes prix par email" value={true} onChange={() => {}} />
              <ToggleField label="Alertes prix par Telegram" value={false} onChange={() => {}} />
              <ToggleField label="Deals du weekend (envoi vendredi matin)" value={true} onChange={() => {}} />
              <ToggleField label="Erreurs tarifaires détectées" value={true} onChange={() => {}} />
            </div>
            <div className="mt-4">
              <label className="text-xs text-white/60 block mb-2">ID Telegram (optionnel)</label>
              <input
                className="aeris-input w-full text-sm"
                placeholder="@votre_pseudo ou votre Chat ID"
              />
            </div>
          </Section>

          {/* Privacy */}
          <Section icon={<Shield className="w-4 h-4" />} title="Confidentialité">
            <div className="space-y-3">
              <ToggleField label="Mode anonyme (aucune donnée transmise aux OTA)" value={true} onChange={() => {}} />
              <ToggleField label="Ne pas partager les recherches avec des partenaires" value={true} onChange={() => {}} />
            </div>
            <p className="mt-4 text-xs text-white/30 leading-relaxed">
              AERIS ne vend jamais vos données de recherche. Votre comportement de navigation n'est pas monétisé.
              Le modèle économique repose exclusivement sur un abonnement premium facultatif.
            </p>
          </Section>
        </div>

        <button onClick={save} className="btn-primary w-full mt-6 py-3.5 text-base flex items-center justify-center gap-2">
          <Check className="w-5 h-5" />
          Sauvegarder mes préférences
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/[0.06]">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
        <span className="text-aeris-400">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, display, onChange }: {
  label: string; value: number; min: number; max: number;
  display: string; suffix?: string; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs text-white/60">{label}</label>
        <span className="text-xs font-bold text-aeris-300">{display}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-aeris-500 cursor-pointer" />
      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function WeightField({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  const barColor = {
    aeris: "bg-aeris-500",
    violet: "bg-violet-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
  }[color] ?? "bg-aeris-500";

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm text-white/60 shrink-0">{label}</div>
      <input type="range" min={0} max={60} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-aeris-500 cursor-pointer" />
      <div className="w-10 text-right">
        <span className="text-sm font-bold text-white">{value}%</span>
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-sm text-white/60">{label}</span>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)}
        className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", value ? "bg-aeris-600" : "bg-white/15")}>
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
          value ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </label>
  );
}
