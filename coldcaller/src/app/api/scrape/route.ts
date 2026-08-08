import { NextRequest, NextResponse } from "next/server";
import { dbUpsertLeads } from "@/lib/db";
import { geocodeCity, searchOverpass, osmToLead } from "@/lib/overpass";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { niche, city, radius = 20, minRating = 0 } = await req.json();

  if (!niche || !city) {
    return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
  }

  const coords = await geocodeCity(city);
  if (!coords) {
    return NextResponse.json({ error: `Ville introuvable : ${city}` }, { status: 422 });
  }

  const radiusM  = Math.round(radius * 1000);
  const elements = await searchOverpass(coords.lat, coords.lon, radiusM, niche, 150);

  const allLeads: Lead[] = [];
  for (const el of elements) {
    const lead = osmToLead(el, niche, city);
    if (lead) allLeads.push(lead);
  }

  // Déduplication par id OSM
  const seen  = new Set<string>();
  const leads: Lead[] = [];
  for (const l of allLeads) {
    if (!seen.has(l.id)) { seen.add(l.id); leads.push(l); }
  }

  const filtered = minRating > 0 ? leads.filter((l) => l.rating >= minRating) : leads;

  if (filtered.length) await dbUpsertLeads(filtered);

  return NextResponse.json({
    leads:  filtered,
    total:  filtered.length,
    query:  { niche, city, radius, minRating },
    source: "openstreetmap",
    coords,
  });
}
