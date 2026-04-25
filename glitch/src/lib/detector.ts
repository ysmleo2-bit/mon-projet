/**
 * GLITCH Detection Engine v1
 *
 * Détecte les anomalies de prix en analysant l'écart entre le prix actuel
 * et la moyenne historique pondérée. Combine plusieurs signaux pour
 * produire un score de confiance et une catégorie.
 */

import type { GlitchAnalysis, GlitchCategory, DetectionSignal, UrgencyLevel } from "./types";

export interface PriceContext {
  currentPrice: number;
  avg30d: number;
  avg7d: number;
  lowestEver: number;
  normalPrice: number;       // median 30d (more robust than mean)
  stops: number;
  cabin: "economy" | "business" | "first";
  airline: string;           // some airlines are known for errors
  route: string;             // "CDG-JFK"
  daysUntilDeparture: number;
}

// Airlines known to honor fare errors
const ERROR_PRONE_AIRLINES = ["AF", "BA", "LH", "KL", "QR", "EK", "TK", "IB"];
const PREMIUM_ROUTES = ["CDG-JFK", "CDG-NRT", "CDG-SYD", "LHR-JFK", "CDG-LAX"];

export function analyzePrice(ctx: PriceContext): GlitchAnalysis {
  const { currentPrice, avg30d, avg7d, lowestEver, normalPrice } = ctx;

  // Core deviation from 30-day average
  const deviation30d = ((avg30d - currentPrice) / avg30d) * 100;
  // Deviation from 7-day (catch if recent drop already happened)
  const deviation7d  = ((avg7d  - currentPrice) / avg7d)  * 100;
  // Distance from lowest ever
  const belowLowest  = currentPrice < lowestEver;
  const belowLowestPct = belowLowest ? ((lowestEver - currentPrice) / lowestEver) * 100 : 0;

  // --- Build detection signals ---
  const signals: DetectionSignal[] = [
    {
      name: "major_deviation",
      triggered: deviation30d > 50,
      weight: 35,
      description: `Prix ${Math.round(deviation30d)}% sous la moyenne 30j`,
    },
    {
      name: "moderate_deviation",
      triggered: deviation30d > 30 && deviation30d <= 50,
      weight: 20,
      description: `Prix ${Math.round(deviation30d)}% sous la moyenne 30j`,
    },
    {
      name: "below_7d_average",
      triggered: deviation7d > 20,
      weight: 15,
      description: `Également ${Math.round(deviation7d)}% sous la moyenne 7j`,
    },
    {
      name: "new_historical_low",
      triggered: belowLowest,
      weight: 20,
      description: `Nouveau plus bas historique (${Math.round(belowLowestPct)}% sous le précédent)`,
    },
    {
      name: "error_prone_airline",
      triggered: ERROR_PRONE_AIRLINES.includes(ctx.airline),
      weight: 10,
      description: `${ctx.airline} a un historique d'erreurs tarifaires`,
    },
    {
      name: "premium_route",
      triggered: PREMIUM_ROUTES.includes(ctx.route),
      weight: 8,
      description: "Route à fort trafic — erreurs plus fréquentes",
    },
    {
      name: "business_at_economy_price",
      triggered: ctx.cabin !== "economy" && currentPrice < avg30d * 0.3,
      weight: 25,
      description: `Cabine ${ctx.cabin} au prix d'un billet économique`,
    },
    {
      name: "far_departure",
      triggered: ctx.daysUntilDeparture > 60,
      weight: 5,
      description: "Départ lointain — plus de chance d'être honoré",
    },
    {
      name: "suspiciously_cheap",
      triggered: currentPrice < normalPrice * 0.15,
      weight: 30,
      description: `Prix à ${Math.round((currentPrice / normalPrice) * 100)}% du tarif normal — anomalie évidente`,
    },
  ];

  // Weighted confidence score
  const triggeredWeight = signals
    .filter(s => s.triggered)
    .reduce((sum, s) => sum + s.weight, 0);
  const maxWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const rawConfidence = (triggeredWeight / maxWeight) * 100;

  // Boost confidence if multiple strong signals align
  const strongSignals = signals.filter(s => s.triggered && s.weight >= 20).length;
  const confidenceBoost = strongSignals >= 2 ? 10 : strongSignals >= 3 ? 20 : 0;
  const confidence = Math.min(99, Math.round(rawConfidence + confidenceBoost));

  // Category classification
  let category: GlitchCategory;
  let urgency: UrgencyLevel;
  let bookingWindowHours: number;

  if (deviation30d > 60 || (belowLowest && deviation30d > 45)) {
    category = "GLITCH";
    urgency = "critical";
    bookingWindowHours = 3;
  } else if (deviation30d > 40) {
    category = "GLITCH";
    urgency = "high";
    bookingWindowHours = 8;
  } else if (deviation30d > 28) {
    category = "FLASH";
    urgency = "high";
    bookingWindowHours = 24;
  } else if (deviation30d > 18) {
    category = "DEAL";
    urgency = "medium";
    bookingWindowHours = 72;
  } else {
    category = "WATCH";
    urgency = "low";
    bookingWindowHours = 168;
  }

  // Business class error = always GLITCH
  if (ctx.cabin !== "economy" && deviation30d > 30) {
    category = "GLITCH";
    urgency = "critical";
    bookingWindowHours = 4;
  }

  const saving    = Math.round(avg30d - currentPrice);
  const savingPct = Math.round(deviation30d);

  const reasons = signals
    .filter(s => s.triggered)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(s => s.description);

  return { category, confidence, deviation: Math.round(deviation30d), saving, savingPct, urgency, bookingWindowHours, reasons, signals };
}

// Classify confidence label
export function confidenceLabel(score: number): string {
  if (score >= 90) return "Quasi-certain";
  if (score >= 75) return "Très probable";
  if (score >= 55) return "Probable";
  if (score >= 35) return "Possible";
  return "Incertain";
}

export function categoryMeta(cat: GlitchCategory) {
  const map = {
    GLITCH: { label: "GLITCH",    color: "#d500f9", bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-300",  desc: "Erreur tarifaire probable — réservez immédiatement" },
    FLASH:  { label: "FLASH",     color: "#ff6d00", bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-300",  desc: "Vente flash limitée — quelques heures seulement" },
    DEAL:   { label: "DEAL",      color: "#00e676", bg: "bg-emerald-500/15",border: "border-emerald-500/40",text: "text-emerald-300", desc: "Très bon deal — fenêtre de 2-3 jours" },
    WATCH:  { label: "À SUIVRE",  color: "#00b0ff", bg: "bg-sky-500/15",    border: "border-sky-500/40",    text: "text-sky-300",     desc: "Prix intéressant — à surveiller" },
  } as const;
  return map[cat];
}

export function urgencyMeta(u: UrgencyLevel) {
  const map = {
    critical: { label: "URGENT",     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
    high:     { label: "Rapidement", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
    medium:   { label: "Ce week-end",color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
    low:      { label: "À surveiller",color: "text-sky-400",   bg: "bg-sky-500/10 border-sky-500/30" },
  } as const;
  return map[u];
}

export function formatWindow(hours: number): string {
  if (hours <= 2)  return `Agissez dans les ${hours}h`;
  if (hours <= 8)  return `Fenêtre de ${hours}h`;
  if (hours <= 24) return "Jusqu'à demain";
  if (hours <= 72) return "2-3 jours";
  return "Cette semaine";
}
