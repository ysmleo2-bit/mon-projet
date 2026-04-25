export type GlitchCategory = "GLITCH" | "FLASH" | "DEAL" | "WATCH";
export type UrgencyLevel  = "critical" | "high" | "medium" | "low";
export type DealStatus    = "live" | "expired" | "unconfirmed" | "confirmed";

export interface PriceSnapshot {
  date: string;
  price: number;
  source: string;
}

export interface GlitchDeal {
  id: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  flag: string;
  airline: string;
  airlineCode: string;
  cabin: "economy" | "business" | "first";
  currentPrice: number;
  normalPrice: number;       // 30-day average
  avg7d: number;
  lowestEver: number;
  currency: string;
  departDate: string;
  returnDate?: string;
  bookingUrl: string;
  source: string;
  detectedAt: string;        // ISO
  expiresEstimate: string;   // ISO or label
  status: DealStatus;
  stops: number;

  // Algorithm output
  analysis: GlitchAnalysis;

  // Community
  confirmations: number;
  reports: number;           // "link broken" reports
  comments: number;

  // History
  priceHistory: PriceSnapshot[];
}

export interface GlitchAnalysis {
  category: GlitchCategory;
  confidence: number;        // 0-100
  deviation: number;         // % below normal
  saving: number;            // €
  savingPct: number;         // %
  urgency: UrgencyLevel;
  bookingWindowHours: number;
  reasons: string[];         // human-readable why flags
  signals: DetectionSignal[];
}

export interface DetectionSignal {
  name: string;
  triggered: boolean;
  weight: number;
  description: string;
}

export interface AlertPreference {
  id: string;
  routes: string[];          // ["CDG-JFK", "*-BKK", "CDG-*"]
  categories: GlitchCategory[];
  minSaving: number;
  minConfidence: number;
  channel: "telegram" | "email" | "both";
  telegramChatId?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  triggeredCount: number;
}

export interface GlitchStats {
  totalDealsToday: number;
  avgSaving: number;
  topRoute: string;
  liveNow: number;
  confirmedToday: number;
  lastScanAt: string;
}
