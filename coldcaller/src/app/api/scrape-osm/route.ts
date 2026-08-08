import { NextRequest, NextResponse } from "next/server";
import { searchOverpass, osmToLead } from "@/lib/overpass";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { lat, lon, radius = 20, niche } = await req.json();
  if (!lat || !lon || !niche) {
    return NextResponse.json({ error: "lat, lon, niche required" }, { status: 400 });
  }

  const radiusM = Math.min(radius * 1000, 50000);

  // 8 s hard guard — Overpass query already uses [timeout:7]
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);

  let elements: Awaited<ReturnType<typeof searchOverpass>> = [];
  try {
    elements = await searchOverpass(lat, lon, radiusM, niche, 150);
  } catch {
    // timeout or network error — return empty
  } finally {
    clearTimeout(timer);
  }

  const leads: Lead[] = [];
  for (const el of elements) {
    const lead = osmToLead(el, niche, "");
    if (lead) leads.push(lead);
  }

  return NextResponse.json({ leads, total: leads.length });
}
