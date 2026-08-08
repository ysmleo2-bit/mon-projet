import { NextRequest, NextResponse } from "next/server";
import { dbUpsertLeads } from "@/lib/db";
import { geocodeCity, searchOverpass, osmToLead } from "@/lib/overpass";
import { searchSirene } from "@/lib/sirene";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { niche, city, radius = 20, minRating = 0 } = await req.json();
  if (!niche || !city) {
    return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
  }

  // ── 1. Géocoder la ville ──────────────────────────────────────────────────
  const coords = await geocodeCity(city);
  if (!coords) {
    return NextResponse.json({ error: `Ville introuvable : ${city}` }, { status: 422 });
  }

  const radiusKm = radius;
  const radiusM  = radius * 1000;

  // ── 2. Sources en parallèle : OSM + Annuaire des Entreprises ─────────────
  const [osmElements, sireneLeads] = await Promise.allSettled([
    searchOverpass(coords.lat, coords.lon, radiusM, niche, 200),
    searchSirene(niche, coords.dept ?? "", coords.lat, coords.lon, radiusKm, 100),
  ]);

  // ── 3. Convertir OSM → Lead ───────────────────────────────────────────────
  const osmLeads: Lead[] = [];
  if (osmElements.status === "fulfilled") {
    for (const el of osmElements.value) {
      const lead = osmToLead(el, niche, city);
      if (lead) osmLeads.push(lead);
    }
  }

  // ── 4. Fusionner : OSM en priorité (a les téléphones), SIRENE en complément
  const seen = new Map<string, Lead>();

  // D'abord les leads OSM (ont des vrais téléphones)
  for (const l of osmLeads) seen.set(l.id, l);

  // Ensuite SIRENE (on ajoute seulement si pas déjà trouvé par nom similaire)
  const sLeads = sireneLeads.status === "fulfilled" ? sireneLeads.value : [];
  for (const l of sLeads) {
    if (!seen.has(l.id)) seen.set(l.id, l);
  }

  const allLeads = Array.from(seen.values());
  const filtered  = minRating > 0 ? allLeads.filter((l) => l.rating >= minRating) : allLeads;

  // ── 5. Persister ───────────────────────────────────────────────────────────
  if (filtered.length) await dbUpsertLeads(filtered);

  return NextResponse.json({
    leads:   filtered,
    total:   filtered.length,
    osm:     osmLeads.length,
    sirene:  sLeads.length,
    query:   { niche, city, radius, minRating },
    coords,
  });
}
