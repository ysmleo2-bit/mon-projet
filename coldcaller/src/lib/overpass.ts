import type { Lead } from "@/lib/types";

// ── Mapping niche → tags OSM ─────────────────────────────────────────────────
const NICHE_TO_OSM: Record<string, string[]> = {
  Plombier:     ['craft=plumber','craft=hvac_technician'],
  Électricien:  ['craft=electrician'],
  Maçon:        ['craft=mason','craft=construction','craft=bricklayer'],
  Serrurier:    ['craft=locksmith','shop=locksmith','emergency=locksmith'],
  Peintre:      ['craft=painter'],
  Couvreur:     ['craft=roofer'],
  Carreleur:    ['craft=tiler','craft=floor_layer'],
  Menuisier:    ['craft=carpenter','craft=joiner','craft=cabinet_maker'],
  Chauffagiste: ['craft=hvac_technician','craft=heating_engineer','craft=plumber'],
  Paysagiste:   ['craft=gardener','shop=garden_centre','landuse=garden_centre'],
  Nettoyage:    ['shop=cleaning_service','craft=cleaning_service'],
  Restaurant:   ['amenity=restaurant','amenity=fast_food','amenity=cafe'],
  Boulangerie:  ['shop=bakery','craft=bakery'],
  Coiffeur:     ['shop=hairdresser','shop=beauty'],
  Comptable:    ['office=accountant','office=tax_advisor'],
};

// ── Mots-clés pour recherche par nom ──────────────────────────────────────
const NICHE_KEYWORDS: Record<string, string> = {
  Plombier:     "plombier|plomberie|sanitaire",
  Électricien:  "électricien|electricien|électricité",
  Maçon:        "maçon|maconnerie|maçonnerie|btp",
  Serrurier:    "serrurier|serrurerie",
  Peintre:      "peintre|peinture|décoration",
  Couvreur:     "couvreur|couverture|toiture|ardoise",
  Carreleur:    "carreleur|carrelage|mosaïque",
  Menuisier:    "menuisier|menuiserie|ébéniste",
  Chauffagiste: "chauffagiste|chauffage|climatisation|clim",
  Paysagiste:   "paysagiste|jardinage|espaces verts",
  Nettoyage:    "nettoyage|propreté|cleaning",
  Restaurant:   "restaurant|brasserie|bistrot",
  Boulangerie:  "boulangerie|boulanger|pain",
  Coiffeur:     "coiffeur|coiffure|barbier",
  Comptable:    "comptable|comptabilité|expert-comptable",
};

// ── Géocodage Nominatim ──────────────────────────────────────────────────────
export async function geocodeCity(city: string): Promise<{ lat: number; lon: number; dept?: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},France&format=json&limit=1&addressdetails=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ColdCaller/1.0 (contact@coldcaller.app)",
        "Accept":     "application/json",
      },
    });
  } catch { return null; } finally { clearTimeout(timer); }
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string; address?: { postcode?: string; county?: string } }>;
  if (!data.length) return null;
  const postcode = data[0].address?.postcode ?? "";
  const dept = postcode.slice(0, 2) || undefined;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), dept };
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
  limit = 150,
): Promise<OsmElement[]> {
  const tags    = NICHE_TO_OSM[niche] ?? [];
  const keyword = NICHE_KEYWORDS[niche] ?? "";
  if (!tags.length && !keyword) return [];

  const radius = Math.min(radiusM, 50000);
  const parts: string[] = [];

  // Par tag métier
  for (const tag of tags) {
    const [k, v] = tag.split("=");
    for (const t of ["node", "way"]) {
      parts.push(`${t}["${k}"="${v}"](around:${radius},${lat},${lon});`);
    }
  }

  // Par nom (catch les entreprises non taguées)
  if (keyword) {
    for (const t of ["node", "way"]) {
      parts.push(`${t}["name"~"${keyword}",i](around:${radius},${lat},${lon});`);
    }
  }

  const query = `
[out:json][timeout:7][maxsize:4000000];
(
${parts.join("\n")}
);
out center tags ${limit};
`.trim();

  const osmCtrl = new AbortController();
  const osmTimer = setTimeout(() => osmCtrl.abort(), 8_000);
  let osmRes: Response;
  try {
    osmRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      signal: osmCtrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
        "User-Agent":   "ColdCaller/1.0 (contact@coldcaller.app)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
  } catch { return []; } finally { clearTimeout(osmTimer); }

  if (!osmRes.ok) return [];

  const json = await osmRes.json() as { elements: OsmElement[] };
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
