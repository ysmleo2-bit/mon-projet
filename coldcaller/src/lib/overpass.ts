import type { Lead } from "@/lib/types";

// ── Mapping niche → tags OSM ─────────────────────────────────────────────────
const NICHE_TO_OSM: Record<string, string[]> = {
  Plombier:     ['craft=plumber'],
  Électricien:  ['craft=electrician'],
  Maçon:        ['craft=mason','craft=construction'],
  Serrurier:    ['craft=locksmith'],
  Peintre:      ['craft=painter'],
  Couvreur:     ['craft=roofer'],
  Carreleur:    ['craft=tiler'],
  Menuisier:    ['craft=carpenter','craft=joiner'],
  Chauffagiste: ['craft=hvac_technician','craft=heating_engineer'],
  Paysagiste:   ['craft=gardener','landuse=garden_centre'],
  Nettoyage:    ['shop=cleaning_service','craft=cleaning_service'],
  Restaurant:   ['amenity=restaurant'],
  Boulangerie:  ['shop=bakery'],
  Coiffeur:     ['shop=hairdresser'],
  Comptable:    ['office=accountant'],
};

// ── Géocodage Nominatim ──────────────────────────────────────────────────────
export async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},France&format=json&limit=1`;
  const res  = await fetch(url, {
    headers: {
      "User-Agent": "ColdCaller/1.0 (contact@coldcaller.app)",
      "Accept":     "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// ── Requête Overpass ─────────────────────────────────────────────────────────
interface OsmElement {
  type: "node" | "way" | "relation";
  id:   number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function searchOverpass(
  lat: number,
  lon: number,
  radiusM: number,
  niche: string,
  limit = 120,
): Promise<OsmElement[]> {
  const tags = NICHE_TO_OSM[niche] ?? [];
  if (!tags.length) return [];

  // Bâtir les clauses de filtre (union de toutes les combinaisons type×tag)
  const radius = Math.min(radiusM, 50000); // cap 50 km pour limiter la taille
  const parts: string[] = [];
  for (const tag of tags) {
    const [k, v] = tag.split("=");
    for (const t of ["node","way","relation"]) {
      parts.push(`${t}["${k}"="${v}"](around:${radius},${lat},${lon});`);
    }
  }

  const query = `
[out:json][timeout:25][maxsize:2000000];
(
${parts.join("\n")}
);
out center tags ${limit};
`.trim();

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept":       "application/json",
      "User-Agent":   "ColdCaller/1.0 (contact@coldcaller.app)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) return [];

  const json = await res.json() as { elements: OsmElement[] };
  return json.elements ?? [];
}

// ── Convertir un élément OSM en Lead ────────────────────────────────────────
function cleanPhone(raw: string): string {
  // Normalise +33 4 78 68 04 60 → 04 78 68 04 60 ou garde le format international
  return raw.replace(/^\+33\s?/, "0").replace(/\s+/g, " ").trim();
}

export function osmToLead(el: OsmElement, niche: string, city: string): Lead | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:fr"] ?? tags.operator ?? null;
  const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;

  // On garde même sans téléphone (enrichissement possible côté UI plus tard)
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const website =
    tags.website?.replace(/^https?:\/\//,"") ??
    tags["contact:website"]?.replace(/^https?:\/\//,"") ??
    undefined;

  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
  ].filter(Boolean).join(" ") || tags["addr:full"] || undefined;

  return {
    id:          `osm-${el.type}-${el.id}`,
    name,
    category:    niche,
    phone:       phone ? cleanPhone(phone) : "(pas de tél.)",
    address:     address ?? `${lat?.toFixed(4) ?? ""}, ${lon?.toFixed(4) ?? ""}`,
    city,
    rating:      0,
    reviewCount: 0,
    website,
    status:      "new",
    notes:       "",
    detectedAt:  new Date().toISOString(),
    source:      "openstreetmap",
    callCount:   0,
  };
}
