/**
 * GET /api/deals
 *
 * Si KIWI_API_KEY est configurée → données réelles Kiwi.com avec deep_link direct.
 * Sinon → données mock avec liens Kayak fonctionnels (vraie page de résultats).
 *
 * Le moteur GLITCH est appliqué dans les deux cas.
 */

import { NextResponse } from "next/server";
import { analyzePrice } from "@/lib/detector";
import { MONITORED_ROUTES } from "@/lib/routes-config";
import { CABIN_CODE, searchRouteCheapest } from "@/lib/api/kiwi";
import { kayakLink } from "@/lib/booking-links";
import type { GlitchDeal } from "@/lib/types";

// Cache 15 min pour ne pas saturer l'API Kiwi
export const revalidate = 900;

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function fromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}
function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Génère un historique de prix synthétique plausible autour d'une moyenne */
function priceHistory(avg: number, currentPrice: number, days = 30) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const v = Math.sin(i * 0.6) * avg * 0.1 + (Math.random() - 0.5) * avg * 0.07;
    return {
      date:   d.toISOString().slice(0, 10),
      price:  i === days - 1 ? currentPrice : Math.round(avg + v),
      source: "Kiwi",
    };
  });
}

/** Construit un GlitchDeal à partir d'un résultat Kiwi */
function kiwiResultToDeal(
  result: Awaited<ReturnType<typeof searchRouteCheapest>>,
  route: typeof MONITORED_ROUTES[0],
  detectedAt: string,
): GlitchDeal | null {
  if (!result) return null;

  const currentPrice = result.price;
  const daysUntil    = Math.ceil(
    (new Date(result.local_departure).getTime() - Date.now()) / 86_400_000,
  );

  const analysis = analyzePrice({
    currentPrice,
    avg30d:            route.normalPrice,
    avg7d:             route.avg7d,
    lowestEver:        route.lowestEver,
    normalPrice:       route.normalPrice,
    stops:             result.route.length - 1,
    cabin:             route.cabin,
    airline:           result.airlines[0] ?? "XX",
    route:             `${route.from}-${route.to}`,
    daysUntilDeparture: daysUntil,
  });

  // Ne garder que les deals avec au moins 15% de déviation
  if (analysis.savingPct < 15) return null;

  return {
    id:            `${route.from}-${route.to}-${route.cabin}-${result.id.slice(0, 8)}`,
    from:          route.fromCity,
    fromCode:      route.from,
    to:            route.toCity,
    toCode:        route.to,
    flag:          route.flag,
    airline:       result.airlines.join("/"),
    airlineCode:   result.airlines[0] ?? "XX",
    cabin:         route.cabin,
    currentPrice,
    normalPrice:   route.normalPrice,
    avg7d:         route.avg7d,
    lowestEver:    route.lowestEver,
    currency:      "EUR",
    departDate:    result.local_departure.slice(0, 10),
    bookingUrl:    result.deep_link,   // ← URL directe Kiwi avec prix verrouillé
    source:        "Kiwi.com",
    detectedAt,
    expiresEstimate: fromNow(analysis.bookingWindowHours),
    status:        "live",
    stops:         result.route.length - 1,
    confirmations: 0,
    reports:       0,
    comments:      0,
    priceHistory:  priceHistory(route.normalPrice, currentPrice),
    analysis,
  };
}

/** Données mock enrichies avec vrais liens Kayak */
function getMockDeals(): GlitchDeal[] {
  const rawDeals = [
    {
      from: "Paris",      fromCode: "CDG", to: "New York",    toCode: "JFK",  flag: "🇺🇸",
      airline: "Air France", airlineCode: "AF", cabin: "economy" as const,
      currentPrice: 89,   normalPrice: 520, avg7d: 495, lowestEver: 280,
      departDate: addDays(79), returnDate: addDays(93),
      detectedAt: ago(8), expiresEstimate: fromNow(2), stops: 0,
      confirmations: 47, reports: 2, comments: 23,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Tokyo",       toCode: "NRT",  flag: "🇯🇵",
      airline: "Japan Airlines", airlineCode: "JL", cabin: "business" as const,
      currentPrice: 340,  normalPrice: 4500, avg7d: 4200, lowestEver: 2200,
      departDate: addDays(97), returnDate: addDays(111),
      detectedAt: ago(23), expiresEstimate: fromNow(1), stops: 1,
      confirmations: 89, reports: 1, comments: 41,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Bangkok",     toCode: "BKK",  flag: "🇹🇭",
      airline: "Thai Airways", airlineCode: "TG", cabin: "economy" as const,
      currentPrice: 148,  normalPrice: 520, avg7d: 490, lowestEver: 310,
      departDate: addDays(137), returnDate: addDays(151),
      detectedAt: ago(45), expiresEstimate: fromNow(5), stops: 1,
      confirmations: 31, reports: 0, comments: 14,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Dubaï",       toCode: "DXB",  flag: "🇦🇪",
      airline: "Emirates", airlineCode: "EK", cabin: "first" as const,
      currentPrice: 450,  normalPrice: 6500, avg7d: 6200, lowestEver: 3800,
      departDate: addDays(116), returnDate: addDays(123),
      detectedAt: ago(2), expiresEstimate: fromNow(1), stops: 0,
      confirmations: 204, reports: 8, comments: 112,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Los Angeles", toCode: "LAX",  flag: "🇺🇸",
      airline: "Air France", airlineCode: "AF", cabin: "economy" as const,
      currentPrice: 295,  normalPrice: 680, avg7d: 650, lowestEver: 380,
      departDate: addDays(128), returnDate: addDays(142),
      detectedAt: ago(5), expiresEstimate: fromNow(2), stops: 0,
      confirmations: 103, reports: 3, comments: 67,
    },
    {
      from: "Londres",    fromCode: "LHR", to: "Sydney",      toCode: "SYD",  flag: "🇦🇺",
      airline: "Qantas",   airlineCode: "QF", cabin: "economy" as const,
      currentPrice: 290,  normalPrice: 980, avg7d: 950, lowestEver: 540,
      departDate: addDays(162), returnDate: undefined,
      detectedAt: ago(15), expiresEstimate: fromNow(3), stops: 1,
      confirmations: 62, reports: 4, comments: 35,
    },
    {
      from: "Madrid",     fromCode: "MAD", to: "Miami",       toCode: "MIA",  flag: "🇺🇸",
      airline: "Iberia",   airlineCode: "IB", cabin: "economy" as const,
      currentPrice: 178,  normalPrice: 470, avg7d: 450, lowestEver: 280,
      departDate: addDays(85), returnDate: addDays(95),
      detectedAt: ago(120), expiresEstimate: fromNow(18), stops: 0,
      confirmations: 28, reports: 0, comments: 11,
    },
    {
      from: "Amsterdam",  fromCode: "AMS", to: "Bali",        toCode: "DPS",  flag: "🇮🇩",
      airline: "KLM",      airlineCode: "KL", cabin: "economy" as const,
      currentPrice: 380,  normalPrice: 820, avg7d: 800, lowestEver: 490,
      departDate: addDays(111), returnDate: addDays(125),
      detectedAt: ago(200), expiresEstimate: fromNow(36), stops: 1,
      confirmations: 19, reports: 1, comments: 8,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Sydney",      toCode: "SYD",  flag: "🇦🇺",
      airline: "Qatar Airways", airlineCode: "QR", cabin: "business" as const,
      currentPrice: 890,  normalPrice: 6800, avg7d: 6500, lowestEver: 3500,
      departDate: addDays(167), returnDate: addDays(188),
      detectedAt: ago(35), expiresEstimate: fromNow(4), stops: 1,
      confirmations: 78, reports: 2, comments: 44,
    },
    {
      from: "Paris",      fromCode: "CDG", to: "Séoul",       toCode: "ICN",  flag: "🇰🇷",
      airline: "Korean Air", airlineCode: "KE", cabin: "economy" as const,
      currentPrice: 312,  normalPrice: 780, avg7d: 750, lowestEver: 410,
      departDate: addDays(105), returnDate: addDays(119),
      detectedAt: ago(55), expiresEstimate: fromNow(6), stops: 0,
      confirmations: 44, reports: 0, comments: 22,
    },
  ];

  return rawDeals.map((raw, i) => {
    const daysUntil = Math.ceil(
      (new Date(raw.departDate).getTime() - Date.now()) / 86_400_000,
    );
    const analysis = analyzePrice({
      currentPrice:       raw.currentPrice,
      avg30d:             raw.normalPrice,
      avg7d:              raw.avg7d,
      lowestEver:         raw.lowestEver,
      normalPrice:        raw.normalPrice,
      stops:              raw.stops,
      cabin:              raw.cabin,
      airline:            raw.airlineCode,
      route:              `${raw.fromCode}-${raw.toCode}`,
      daysUntilDeparture: daysUntil,
    });

    return {
      ...raw,
      id:          `mock-${String(i + 1).padStart(3, "0")}`,
      currency:    "EUR",
      returnDate:  raw.returnDate,
      status:      "live" as const,
      source:      "Kiwi.com",
      // Vrai lien Kayak — ouvre directement les résultats pour cette route et date
      bookingUrl:  kayakLink({
        from:       raw.fromCode,
        to:         raw.toCode,
        departDate: raw.departDate,
        returnDate: raw.returnDate,
        cabin:      raw.cabin,
      }),
      priceHistory: priceHistory(raw.normalPrice, raw.currentPrice),
      analysis,
    } satisfies GlitchDeal;
  });
}

export async function GET() {
  try {
    const hasApiKey = !!process.env.KIWI_API_KEY;

    if (hasApiKey) {
      // ── Données réelles Kiwi ──────────────────────────────────────────────
      const detectedAt = new Date().toISOString();
      const settled = await Promise.allSettled(
        MONITORED_ROUTES.map(route =>
          searchRouteCheapest(route.from, route.to, CABIN_CODE[route.cabin] ?? "M")
            .then(result => kiwiResultToDeal(result, route, detectedAt))
        )
      );

      const deals: GlitchDeal[] = settled
        .filter((r): r is PromiseFulfilledResult<GlitchDeal> => r.status === "fulfilled" && r.value !== null)
        .map(r => r.value)
        .sort((a, b) => b.analysis.confidence - a.analysis.confidence);

      return NextResponse.json({ source: "kiwi", deals }, {
        headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
      });
    }

    // ── Fallback : données mock avec vrais liens Kayak ────────────────────
    const deals = getMockDeals().sort((a, b) => b.analysis.confidence - a.analysis.confidence);
    return NextResponse.json({ source: "mock", deals }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });

  } catch (err) {
    console.error("[/api/deals]", err);
    const deals = getMockDeals();
    return NextResponse.json({ source: "mock-fallback", deals }, { status: 200 });
  }
}
