/**
 * GET /api/deals
 *
 * Priorité :
 * 1. Ryanair public API (aucune clé) → vrais prix + liens directs Ryanair
 * 2. Kiwi.com API (si KIWI_API_KEY dispo) → toutes compagnies + deep_link verrouillé
 * 3. Mock + liens Kayak (fallback si les deux échouent)
 */

import { NextResponse } from "next/server";
import { analyzePrice } from "@/lib/detector";
import { MONITORED_ROUTES } from "@/lib/routes-config";
import { CABIN_CODE, searchRouteCheapest } from "@/lib/api/kiwi";
import { getCheapFares, getReferencePrice, ryanairBookingUrl, getFlag } from "@/lib/api/ryanair";
import { kayakLink } from "@/lib/booking-links";
import type { GlitchDeal } from "@/lib/types";

export const revalidate = 1800; // cache 30 min

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ago(minutes: number) { return new Date(Date.now() - minutes * 60_000).toISOString(); }
function fromNow(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function priceHistory(avg: number, currentPrice: number, days = 30) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i));
    const v = Math.sin(i * 0.6) * avg * 0.1 + (Math.random() - 0.5) * avg * 0.07;
    return { date: d.toISOString().slice(0, 10), price: i === days - 1 ? currentPrice : Math.round(avg + v), source: "Ryanair" };
  });
}

// ─── Source 1 : Ryanair (sans clé API) ───────────────────────────────────────

const RYANAIR_AIRPORTS = ["BVA", "STN", "BCN", "DUB", "BGY"];

const DEPARTURE_META: Record<string, { city: string; iata: string; flag: string }> = {
  BVA: { city: "Paris",           iata: "BVA", flag: "🇫🇷" },
  STN: { city: "Londres",         iata: "STN", flag: "🇬🇧" },
  BCN: { city: "Barcelone",       iata: "BCN", flag: "🇪🇸" },
  DUB: { city: "Dublin",          iata: "DUB", flag: "🇮🇪" },
  BGY: { city: "Milan Bergamo",   iata: "BGY", flag: "🇮🇹" },
};

async function getRyanairDeals(): Promise<GlitchDeal[]> {
  const allFares = await Promise.allSettled(
    RYANAIR_AIRPORTS.map(ap => getCheapFares(ap))
  );

  const deals: GlitchDeal[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < RYANAIR_AIRPORTS.length; i++) {
    const apCode = RYANAIR_AIRPORTS[i];
    const result = allFares[i];
    if (result.status !== "fulfilled") continue;

    const fares = result.value;
    // Trier par prix croissant — les tarifs les plus bas d'abord
    const sorted = [...fares].sort((a, b) => a.outbound.price.value - b.outbound.price.value);

    for (const fare of sorted) {
      const o           = fare.outbound;
      const currentPrice = o.price.value;
      const fromCode    = o.departureAirport.iataCode;
      const toCode      = o.arrivalAirport.iataCode;
      const normalPrice = getReferencePrice(fromCode, toCode);
      const avg7d       = Math.round(normalPrice * 0.95);
      const lowestEver  = Math.round(normalPrice * 0.45);
      const departDate  = o.departureDate.slice(0, 10);
      const daysUntil   = Math.ceil((new Date(departDate).getTime() - Date.now()) / 86_400_000);

      const analysis = analyzePrice({
        currentPrice, avg30d: normalPrice, avg7d, lowestEver,
        normalPrice, stops: 0, cabin: "economy",
        airline: o.flightNumber.slice(0, 2),
        route: `${fromCode}-${toCode}`,
        daysUntilDeparture: daysUntil,
      });

      // On ne garde que les vrais deals (>20% de réduction)
      if (analysis.savingPct < 20) continue;

      const depMeta = DEPARTURE_META[apCode] ?? { city: apCode, iata: apCode, flag: "🏳️" };
      const arrFlag = getFlag(o.arrivalAirport.city.countryCode);

      deals.push({
        id:           `ry-${fromCode}-${toCode}-${departDate}`,
        from:         depMeta.city,
        fromCode,
        to:           o.arrivalAirport.city.name,
        toCode,
        flag:         arrFlag,
        airline:      "Ryanair",
        airlineCode:  o.flightNumber.slice(0, 2),
        cabin:        "economy",
        currentPrice,
        normalPrice,
        avg7d,
        lowestEver,
        currency:     "EUR",
        departDate,
        bookingUrl:   ryanairBookingUrl(fromCode, toCode, departDate), // ← lien direct Ryanair
        source:       "Ryanair.com",
        detectedAt:   now,
        expiresEstimate: fromNow(analysis.bookingWindowHours),
        status:       "live",
        stops:        0,
        confirmations: 0,
        reports:      0,
        comments:     0,
        priceHistory: priceHistory(normalPrice, currentPrice),
        analysis,
      });
    }
  }

  // Dédoublonner (même route, garder le moins cher)
  const seen = new Map<string, GlitchDeal>();
  for (const d of deals) {
    const key = `${d.fromCode}-${d.toCode}`;
    const existing = seen.get(key);
    if (!existing || d.currentPrice < existing.currentPrice) seen.set(key, d);
  }

  return Array.from(seen.values()).sort((a, b) => b.analysis.confidence - a.analysis.confidence);
}

// ─── Source 2 : Kiwi.com (avec clé) ─────────────────────────────────────────

async function getKiwiDeals(): Promise<GlitchDeal[]> {
  const now = new Date().toISOString();
  const settled = await Promise.allSettled(
    MONITORED_ROUTES.map(route =>
      searchRouteCheapest(route.from, route.to, CABIN_CODE[route.cabin] ?? "M")
        .then(result => {
          if (!result) return null;
          const daysUntil = Math.ceil((new Date(result.local_departure).getTime() - Date.now()) / 86_400_000);
          const analysis = analyzePrice({
            currentPrice: result.price, avg30d: route.normalPrice, avg7d: route.avg7d,
            lowestEver: route.lowestEver, normalPrice: route.normalPrice,
            stops: result.route.length - 1, cabin: route.cabin,
            airline: result.airlines[0] ?? "XX", route: `${route.from}-${route.to}`,
            daysUntilDeparture: daysUntil,
          });
          if (analysis.savingPct < 15) return null;
          return {
            id:           `kw-${route.from}-${route.to}-${route.cabin}-${result.id.slice(0, 6)}`,
            from: route.fromCity, fromCode: route.from,
            to: route.toCity, toCode: route.to, flag: route.flag,
            airline: result.airlines.join("/"), airlineCode: result.airlines[0] ?? "XX",
            cabin: route.cabin, currentPrice: result.price,
            normalPrice: route.normalPrice, avg7d: route.avg7d, lowestEver: route.lowestEver,
            currency: "EUR", departDate: result.local_departure.slice(0, 10),
            bookingUrl: result.deep_link, // ← URL directe Kiwi prix verrouillé
            source: "Kiwi.com", detectedAt: now,
            expiresEstimate: fromNow(analysis.bookingWindowHours),
            status: "live" as const, stops: result.route.length - 1,
            confirmations: 0, reports: 0, comments: 0,
            priceHistory: priceHistory(route.normalPrice, result.price),
            analysis,
          } satisfies GlitchDeal;
        })
    )
  );
  const out: GlitchDeal[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value !== null) out.push(r.value);
  }
  return out.sort((a, b) => b.analysis.confidence - a.analysis.confidence);
}

// ─── Source 3 : Mock (fallback) ──────────────────────────────────────────────

function getMockDeals(): GlitchDeal[] {
  const raw = [
    { from: "Paris",     fromCode: "CDG", to: "New York",    toCode: "JFK", flag: "🇺🇸", airline: "Air France",    airlineCode: "AF", cabin: "economy"  as const, currentPrice: 89,  normalPrice: 520,  avg7d: 495,  lowestEver: 280,  departDate: addDays(79), returnDate: addDays(93),  detectedAt: ago(8),   expiresEstimate: fromNow(2),  stops: 0, confirmations: 47, reports: 2, comments: 23 },
    { from: "Paris",     fromCode: "CDG", to: "Tokyo",       toCode: "NRT", flag: "🇯🇵", airline: "Japan Airlines", airlineCode: "JL", cabin: "business" as const, currentPrice: 340, normalPrice: 4500, avg7d: 4200, lowestEver: 2200, departDate: addDays(97), returnDate: addDays(111), detectedAt: ago(23),  expiresEstimate: fromNow(1),  stops: 1, confirmations: 89, reports: 1, comments: 41 },
    { from: "Paris",     fromCode: "CDG", to: "Dubaï",       toCode: "DXB", flag: "🇦🇪", airline: "Emirates",       airlineCode: "EK", cabin: "first"    as const, currentPrice: 450, normalPrice: 6500, avg7d: 6200, lowestEver: 3800, departDate: addDays(116),returnDate: addDays(123), detectedAt: ago(2),   expiresEstimate: fromNow(1),  stops: 0, confirmations: 204,reports: 8, comments: 112 },
    { from: "Paris",     fromCode: "CDG", to: "Los Angeles", toCode: "LAX", flag: "🇺🇸", airline: "Air France",    airlineCode: "AF", cabin: "economy"  as const, currentPrice: 295, normalPrice: 680,  avg7d: 650,  lowestEver: 380,  departDate: addDays(128),returnDate: addDays(142), detectedAt: ago(5),   expiresEstimate: fromNow(2),  stops: 0, confirmations: 103,reports: 3, comments: 67 },
    { from: "Londres",   fromCode: "LHR", to: "Sydney",      toCode: "SYD", flag: "🇦🇺", airline: "Qantas",         airlineCode: "QF", cabin: "economy"  as const, currentPrice: 290, normalPrice: 980,  avg7d: 950,  lowestEver: 540,  departDate: addDays(162),                           detectedAt: ago(15),  expiresEstimate: fromNow(3),  stops: 1, confirmations: 62, reports: 4, comments: 35 },
    { from: "Paris",     fromCode: "CDG", to: "Sydney",      toCode: "SYD", flag: "🇦🇺", airline: "Qatar Airways",  airlineCode: "QR", cabin: "business" as const, currentPrice: 890, normalPrice: 6800, avg7d: 6500, lowestEver: 3500, departDate: addDays(167),returnDate: addDays(188), detectedAt: ago(35),  expiresEstimate: fromNow(4),  stops: 1, confirmations: 78, reports: 2, comments: 44 },
  ] as const;

  return raw.map((r, i) => {
    const daysUntil = Math.ceil((new Date(r.departDate).getTime() - Date.now()) / 86_400_000);
    const analysis = analyzePrice({ currentPrice: r.currentPrice, avg30d: r.normalPrice, avg7d: r.avg7d, lowestEver: r.lowestEver, normalPrice: r.normalPrice, stops: r.stops, cabin: r.cabin, airline: r.airlineCode, route: `${r.fromCode}-${r.toCode}`, daysUntilDeparture: daysUntil });
    return {
      ...r,
      id: `mock-${String(i + 1).padStart(3, "0")}`,
      currency: "EUR",
      returnDate: (r as any).returnDate,
      status: "live" as const,
      source: "Exemple historique",
      bookingUrl: kayakLink({ from: r.fromCode, to: r.toCode, departDate: r.departDate, returnDate: (r as any).returnDate, cabin: r.cabin as any }),
      priceHistory: priceHistory(r.normalPrice, r.currentPrice),
      analysis,
    };
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const hasKiwiKey = !!process.env.KIWI_API_KEY;

    // Lancer Ryanair (toujours) + Kiwi (si clé dispo) en parallèle
    const [ryanairDeals, kiwiDeals] = await Promise.all([
      getRyanairDeals().catch(() => [] as GlitchDeal[]),
      hasKiwiKey ? getKiwiDeals().catch(() => [] as GlitchDeal[]) : Promise.resolve([] as GlitchDeal[]),
    ]);

    // Combiner : Ryanair (réel) + Kiwi (réel) + mock long-haul si peu de résultats
    let deals: GlitchDeal[] = [...ryanairDeals, ...kiwiDeals];

    if (deals.length < 3) {
      // Fallback : ajouter les exemples mock si on n'a pas assez de deals réels
      deals = [...deals, ...getMockDeals()];
    }

    // Trier par confiance
    deals.sort((a, b) => b.analysis.confidence - a.analysis.confidence);

    const source = ryanairDeals.length > 0 ? "ryanair+live" : (hasKiwiKey ? "kiwi" : "mock");
    return NextResponse.json({ source, ryanairCount: ryanairDeals.length, kiwiCount: kiwiDeals.length, deals }, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });

  } catch (err) {
    console.error("[/api/deals]", err);
    const deals = getMockDeals().sort((a, b) => b.analysis.confidence - a.analysis.confidence);
    return NextResponse.json({ source: "mock-fallback", deals }, { status: 200 });
  }
}
