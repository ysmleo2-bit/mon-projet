import { analyzePrice } from "./detector";
import type { GlitchDeal, GlitchStats, PriceSnapshot } from "./types";

function history(base: number, days = 30): PriceSnapshot[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const variation = Math.sin(i * 0.5) * base * 0.12 + (Math.random() - 0.5) * base * 0.08;
    return {
      date: d.toISOString().slice(0, 10),
      price: Math.round(base + variation),
      source: "Amadeus",
    };
  });
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function fromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

// Raw deals — algorithm will compute analysis
const RAW: Omit<GlitchDeal, "analysis">[] = [
  {
    id: "d001",
    from: "Paris", fromCode: "CDG",
    to: "New York", toCode: "JFK", flag: "🇺🇸",
    airline: "Air France", airlineCode: "AF",
    cabin: "economy", currentPrice: 89, normalPrice: 512,
    avg7d: 495, lowestEver: 298, currency: "EUR",
    departDate: "2025-07-14", returnDate: "2025-07-28",
    bookingUrl: "https://www.airfrance.fr",
    source: "Air France Direct",
    detectedAt: ago(8), expiresEstimate: fromNow(2),
    status: "live", stops: 0, confirmations: 47, reports: 2, comments: 23,
    priceHistory: [...history(512), { date: new Date().toISOString().slice(0,10), price: 89, source: "AF" }],
  },
  {
    id: "d002",
    from: "Paris", fromCode: "CDG",
    to: "Tokyo", toCode: "NRT", flag: "🇯🇵",
    airline: "Japan Airlines", airlineCode: "JL",
    cabin: "business", currentPrice: 340, normalPrice: 2800,
    avg7d: 2750, lowestEver: 1890, currency: "EUR",
    departDate: "2025-08-01", returnDate: "2025-08-15",
    bookingUrl: "https://www.jal.com",
    source: "JAL Direct",
    detectedAt: ago(23), expiresEstimate: fromNow(1),
    status: "live", stops: 1, confirmations: 89, reports: 1, comments: 41,
    priceHistory: [...history(2800), { date: new Date().toISOString().slice(0,10), price: 340, source: "JAL" }],
  },
  {
    id: "d003",
    from: "Paris", fromCode: "CDG",
    to: "Bangkok", toCode: "BKK", flag: "🇹🇭",
    airline: "Thai Airways", airlineCode: "TG",
    cabin: "economy", currentPrice: 148, normalPrice: 498,
    avg7d: 481, lowestEver: 312, currency: "EUR",
    departDate: "2025-09-10", returnDate: "2025-09-24",
    bookingUrl: "https://www.thaiairways.com",
    source: "Thai Airways Direct",
    detectedAt: ago(45), expiresEstimate: fromNow(5),
    status: "live", stops: 1, confirmations: 31, reports: 0, comments: 14,
    priceHistory: [...history(498), { date: new Date().toISOString().slice(0,10), price: 148, source: "TG" }],
  },
  {
    id: "d004",
    from: "Londres", fromCode: "LHR",
    to: "Sydney", toCode: "SYD", flag: "🇦🇺",
    airline: "Qantas", airlineCode: "QF",
    cabin: "economy", currentPrice: 290, normalPrice: 920,
    avg7d: 905, lowestEver: 598, currency: "EUR",
    departDate: "2025-10-05",
    bookingUrl: "https://www.qantas.com",
    source: "Qantas Direct",
    detectedAt: ago(15), expiresEstimate: fromNow(3),
    status: "live", stops: 1, confirmations: 62, reports: 4, comments: 35,
    priceHistory: [...history(920), { date: new Date().toISOString().slice(0,10), price: 290, source: "QF" }],
  },
  {
    id: "d005",
    from: "Madrid", fromCode: "MAD",
    to: "Miami", toCode: "MIA", flag: "🇺🇸",
    airline: "Iberia", airlineCode: "IB",
    cabin: "economy", currentPrice: 178, normalPrice: 450,
    avg7d: 440, lowestEver: 290, currency: "EUR",
    departDate: "2025-07-20", returnDate: "2025-07-30",
    bookingUrl: "https://www.iberia.com",
    source: "Iberia Direct",
    detectedAt: ago(120), expiresEstimate: fromNow(18),
    status: "live", stops: 0, confirmations: 28, reports: 0, comments: 11,
    priceHistory: [...history(450), { date: new Date().toISOString().slice(0,10), price: 178, source: "IB" }],
  },
  {
    id: "d006",
    from: "Amsterdam", fromCode: "AMS",
    to: "Bali", toCode: "DPS", flag: "🇮🇩",
    airline: "KLM", airlineCode: "KL",
    cabin: "economy", currentPrice: 380, normalPrice: 780,
    avg7d: 765, lowestEver: 520, currency: "EUR",
    departDate: "2025-08-15", returnDate: "2025-08-29",
    bookingUrl: "https://www.klm.com",
    source: "KLM Direct",
    detectedAt: ago(200), expiresEstimate: fromNow(36),
    status: "live", stops: 1, confirmations: 19, reports: 1, comments: 8,
    priceHistory: [...history(780), { date: new Date().toISOString().slice(0,10), price: 380, source: "KL" }],
  },
  {
    id: "d007",
    from: "Paris", fromCode: "CDG",
    to: "Los Angeles", toCode: "LAX", flag: "🇺🇸",
    airline: "Air France", airlineCode: "AF",
    cabin: "premium_economy" as any, currentPrice: 295, normalPrice: 1450,
    avg7d: 1420, lowestEver: 890, currency: "EUR",
    departDate: "2025-09-01", returnDate: "2025-09-15",
    bookingUrl: "https://www.airfrance.fr",
    source: "Air France Direct",
    detectedAt: ago(5), expiresEstimate: fromNow(2),
    status: "live", stops: 0, confirmations: 103, reports: 3, comments: 67,
    priceHistory: [...history(1450), { date: new Date().toISOString().slice(0,10), price: 295, source: "AF" }],
  },
  {
    id: "d008",
    from: "Rome", fromCode: "FCO",
    to: "New York", toCode: "JFK", flag: "🇺🇸",
    airline: "Alitalia/ITA", airlineCode: "AZ",
    cabin: "economy", currentPrice: 234, normalPrice: 520,
    avg7d: 510, lowestEver: 340, currency: "EUR",
    departDate: "2025-06-28",
    bookingUrl: "https://www.ita-airways.com",
    source: "ITA Airways Direct",
    detectedAt: ago(380), expiresEstimate: fromNow(60),
    status: "live", stops: 0, confirmations: 15, reports: 2, comments: 6,
    priceHistory: [...history(520), { date: new Date().toISOString().slice(0,10), price: 234, source: "AZ" }],
  },
  {
    id: "d009",
    from: "Paris", fromCode: "CDG",
    to: "Dubaï", toCode: "DXB", flag: "🇦🇪",
    airline: "Emirates", airlineCode: "EK",
    cabin: "first", currentPrice: 450, normalPrice: 4200,
    avg7d: 4100, lowestEver: 2800, currency: "EUR",
    departDate: "2025-08-20", returnDate: "2025-08-27",
    bookingUrl: "https://www.emirates.com",
    source: "Emirates Direct",
    detectedAt: ago(2), expiresEstimate: fromNow(1),
    status: "live", stops: 0, confirmations: 204, reports: 8, comments: 112,
    priceHistory: [...history(4200), { date: new Date().toISOString().slice(0,10), price: 450, source: "EK" }],
  },
  {
    id: "d010",
    from: "Paris", fromCode: "CDG",
    to: "Barcelone", toCode: "BCN", flag: "🇪🇸",
    airline: "Vueling", airlineCode: "VY",
    cabin: "economy", currentPrice: 19, normalPrice: 85,
    avg7d: 82, lowestEver: 35, currency: "EUR",
    departDate: "2025-06-20",
    bookingUrl: "https://www.vueling.com",
    source: "Vueling Direct",
    detectedAt: ago(600), expiresEstimate: fromNow(120),
    status: "live", stops: 0, confirmations: 8, reports: 0, comments: 3,
    priceHistory: [...history(85), { date: new Date().toISOString().slice(0,10), price: 19, source: "VY" }],
  },
  {
    id: "d011",
    from: "Paris", fromCode: "CDG",
    to: "Sydney", toCode: "SYD", flag: "🇦🇺",
    airline: "Qatar Airways", airlineCode: "QR",
    cabin: "business", currentPrice: 890, normalPrice: 5200,
    avg7d: 5100, lowestEver: 3400, currency: "EUR",
    departDate: "2025-10-10", returnDate: "2025-10-31",
    bookingUrl: "https://www.qatarairways.com",
    source: "Qatar Direct",
    detectedAt: ago(35), expiresEstimate: fromNow(4),
    status: "live", stops: 1, confirmations: 78, reports: 2, comments: 44,
    priceHistory: [...history(5200), { date: new Date().toISOString().slice(0,10), price: 890, source: "QR" }],
  },
  // Expired for reference
  {
    id: "d012",
    from: "Paris", fromCode: "CDG",
    to: "Toronto", toCode: "YYZ", flag: "🇨🇦",
    airline: "Air Transat", airlineCode: "TS",
    cabin: "economy", currentPrice: 127, normalPrice: 480,
    avg7d: 465, lowestEver: 280, currency: "EUR",
    departDate: "2025-07-02",
    bookingUrl: "#",
    source: "Air Transat Direct",
    detectedAt: ago(1800), expiresEstimate: ago(600),
    status: "expired", stops: 0, confirmations: 134, reports: 5, comments: 78,
    priceHistory: history(480),
  },
];

// Apply algorithm to all deals
export const MOCK_DEALS: GlitchDeal[] = RAW.map((raw) => {
  const daysUntil = Math.ceil(
    (new Date(raw.departDate).getTime() - Date.now()) / (86400000)
  );
  const analysis = analyzePrice({
    currentPrice: raw.currentPrice,
    avg30d: raw.normalPrice,
    avg7d: raw.avg7d,
    lowestEver: raw.lowestEver,
    normalPrice: raw.normalPrice,
    stops: raw.stops,
    cabin: raw.cabin as "economy" | "business" | "first",
    airline: raw.airlineCode,
    route: `${raw.fromCode}-${raw.toCode}`,
    daysUntilDeparture: daysUntil,
  });
  return { ...raw, analysis };
});

export const LIVE_DEALS = MOCK_DEALS.filter(d => d.status === "live");

export function getDeal(id: string): GlitchDeal | undefined {
  return MOCK_DEALS.find(d => d.id === id);
}

export const STATS: GlitchStats = {
  totalDealsToday: 34,
  avgSaving: 71,
  topRoute: "CDG → JFK",
  liveNow: LIVE_DEALS.length,
  confirmedToday: 8,
  lastScanAt: new Date().toISOString(),
};

export const TICKER_ITEMS = [
  "✈ CDG→JFK — 89€ au lieu de 512€ — GLITCH détecté il y a 8 min",
  "✈ CDG→SYD — 890€ Business au lieu de 5 200€ — Classe Affaires GLITCH",
  "✈ CDG→LAX — 295€ Premium Eco au lieu de 1 450€ — GLITCH détecté",
  "✈ LHR→SYD — 290€ au lieu de 920€ — GLITCH confirmé par 62 membres",
  "✈ CDG→DXB — 450€ Première au lieu de 4 200€ — Erreur Emirates LIVE",
  "✈ MAD→MIA — 178€ direct au lieu de 450€ — FLASH Iberia 18h restantes",
  "✈ CDG→BKK — 148€ au lieu de 498€ — GLITCH Thai Airways",
  "✈ AMS→DPS — 380€ au lieu de 780€ — DEAL KLM 36h restantes",
];
