import { NextRequest, NextResponse } from "next/server";
import { dbUpsertLeads } from "@/lib/db";
import { geocodeCity, searchOverpass, osmToLead } from "@/lib/overpass";
import { searchSirene } from "@/lib/sirene";
import { normalizePhone } from "@/lib/compliance";
import { isBlacklisted } from "@/lib/blacklist";
import type { Lead } from "@/lib/types";

// ── Source Google Maps (Playwright) ──────────────────────────────────────────
function idFromUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return `gmaps-${Math.abs(hash)}`;
}

async function scrapeGoogleMapsSource(niche: string, city: string, limit: number, minRating: number): Promise<Lead[]> {
  const { scrapeGoogleMaps } = await import("@/lib/google-maps-scraper");
  const records = await scrapeGoogleMaps({ query: niche, location: city, limit });

  const leads: Lead[] = records
    .filter((r) => r.name)
    .map((r) => {
      const phoneNormalized = normalizePhone(r.phone);
      return {
        id:          idFromUrl(r.source_url),
        name:        r.name as string,
        category:    niche,
        phone:       r.phone || "(pas de tél.)",
        address:     r.address || "",
        city,
        rating:      r.rating ?? 0,
        reviewCount: r.review_count ?? 0,
        website:     r.website ?? undefined,
        status:      "new",
        notes:       "",
        detectedAt:  new Date().toISOString(),
        source:      "google_maps" as const,
        callCount:   0,
        doNotCall:   isBlacklisted(phoneNormalized),
        doNotCallAt: isBlacklisted(phoneNormalized) ? new Date().toISOString() : undefined,
      } as Lead;
    });

  return minRating > 0 ? leads.filter((l) => l.rating >= minRating) : leads;
}

export const dynamic = "force-dynamic";
// Vercel Pro : 60 s max — on fixe 55 s pour laisser de la marge
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  const { niche, city, radius = 20, minRating = 0, source = "openstreetmap", limit = 30 } = await req.json();

  // ── Source Google Maps ───────────────────────────────────────────────────────
  if (source === "google_maps") {
    try {
      const filtered = await scrapeGoogleMapsSource(niche, city, limit, minRating);
      if (filtered.length) await dbUpsertLeads(filtered);
      return NextResponse.json({ leads: filtered, total: filtered.length, source: "google_maps" });
    } catch (err) {
      return NextResponse.json(
        { error: `Échec du scraping Google Maps : ${(err as Error).message}` },
        { status: 502 }
      );
    }
  }
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
  // Race each source against a 20 s guard so neither can block the entire response
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
      p,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  }

  const [osmResult, sireneResult] = await Promise.all([
    withTimeout(searchOverpass(coords.lat, coords.lon, radiusM, niche, 200), 20_000),
    withTimeout(searchSirene(niche, coords.dept ?? "", coords.lat, coords.lon, radiusKm, 100), 20_000),
  ]);

  // ── 3. Convertir OSM → Lead ───────────────────────────────────────────────
  const osmLeads: Lead[] = [];
  for (const el of osmResult ?? []) {
    const lead = osmToLead(el, niche, city);
    if (lead) osmLeads.push(lead);
  }

  // ── 4. Fusionner : OSM en priorité (a les téléphones), SIRENE en complément
  const seen = new Map<string, Lead>();

  for (const l of osmLeads) seen.set(l.id, l);

  const sLeads = sireneResult ?? [];
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
