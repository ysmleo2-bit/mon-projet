/**
 * GET /api/deals
 * Délègue à src/lib/fetch-deals.ts (Ryanair → Kiwi → Mock)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchDeals, DEFAULT_AIRPORTS, getRyanairDeals, getKiwiDeals, getMockDeals } from "@/lib/fetch-deals";
import { LIVE_AIRPORTS } from "@/lib/airports";
import type { GlitchDeal } from "@/lib/types";

export const dynamic = "force-dynamic"; // lit les searchParams → pas de static render

export async function GET(req: NextRequest) {
  try {
    const hasKiwiKey = !!process.env.KIWI_API_KEY;

    const fromParam = req.nextUrl.searchParams.get("from");
    let airportsToScan: string[];
    if (fromParam) {
      const requested = fromParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      const liveRequested = requested.filter(c => LIVE_AIRPORTS.includes(c));
      airportsToScan = liveRequested.length > 0 ? liveRequested : DEFAULT_AIRPORTS;
    } else {
      airportsToScan = DEFAULT_AIRPORTS;
    }

    const [ryanairDeals, kiwiDeals] = await Promise.all([
      getRyanairDeals(airportsToScan).catch(() => [] as GlitchDeal[]),
      hasKiwiKey ? getKiwiDeals().catch(() => [] as GlitchDeal[]) : Promise.resolve([] as GlitchDeal[]),
    ]);

    let deals: GlitchDeal[] = [...ryanairDeals, ...kiwiDeals];

    if (deals.length < 3) {
      const mockDeals = getMockDeals();
      const filteredMock = fromParam
        ? mockDeals.filter(d => fromParam.toUpperCase().split(",").includes(d.fromCode))
        : mockDeals;
      deals = [...deals, ...(filteredMock.length > 0 ? filteredMock : mockDeals)];
    }

    deals.sort((a, b) => b.analysis.confidence - a.analysis.confidence);

    const source = ryanairDeals.length > 0 ? "ryanair+live" : (hasKiwiKey ? "kiwi" : "mock");
    return NextResponse.json({
      source, airports: airportsToScan,
      ryanairCount: ryanairDeals.length, kiwiCount: kiwiDeals.length, deals,
    }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });

  } catch (err) {
    console.error("[/api/deals]", err);
    const deals = getMockDeals().sort((a, b) => b.analysis.confidence - a.analysis.confidence);
    return NextResponse.json({ source: "mock-fallback", deals }, { status: 200 });
  }
}
