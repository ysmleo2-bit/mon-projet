/**
 * search-client.ts — appels API côté navigateur
 * Overpass, Nominatim et api.gouv.fr supportent tous CORS.
 * On évite ainsi les timeouts Vercel Hobby (10 s).
 */

import type { Lead } from "@/lib/types";

// ── Types OSM ────────────────────────────────────────────────────────────────
interface OsmElement {
  type: "node" | "way" | "relation";
  id:   number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Mapping niche → tags OSM ─────────────────────────────────────────────────
const NICHE_TO_OSM: Record<string, string[]> = {
  Plombier:     ["craft=plumber", "craft=hvac_technician"],
  Électricien:  ["craft=electrician"],
  Maçon:        ["craft=mason", "craft=construction", "craft=bricklayer"],
  Serrurier:    ["craft=locksmith", "shop=locksmith", "emergency=locksmith"],
  Peintre:      ["craft=painter"],
  Couvreur:     ["craft=roofer"],
  Carreleur:    ["craft=tiler", "craft=floor_layer"],
  Menuisier:    ["craft=carpenter", "craft=joiner", "craft=cabinet_maker"],
  Chauffagiste: ["craft=hvac_technician", "craft=heating_engineer", "craft=plumber"],
  Paysagiste:   ["craft=gardener", "shop=garden_centre"],
  Nettoyage:    ["shop=cleaning_service", "craft=cleaning_service"],
  Restaurant:   ["amenity=restaurant", "amenity=fast_food", "amenity=cafe"],
  Boulangerie:  ["shop=bakery", "craft=bakery"],
  Coiffeur:     ["shop=hairdresser", "shop=beauty"],
  Comptable:    ["office=accountant", "office=tax_advisor"],
};

const NICHE_KEYWORDS: Record<string, string> = {
  Plombier:     "plombier|plomberie|sanitaire",
  Électricien:  "électricien|electricien|électricité",
  Maçon:        "maçon|maconnerie|maçonnerie|btp",
  Serrurier:    "serrurier|serrurerie",
  Peintre:      "peintre|peinture|décoration",
  Couvreur:     "couvreur|couverture|toiture",
  Carreleur:    "carreleur|carrelage",
  Menuisier:    "menuisier|menuiserie|ébéniste",
  Chauffagiste: "chauffagiste|chauffage|climatisation",
  Paysagiste:   "paysagiste|jardinage",
  Nettoyage:    "nettoyage|propreté",
  Restaurant:   "restaurant|brasserie|bistrot",
  Boulangerie:  "boulangerie|boulanger",
  Coiffeur:     "coiffeur|coiffure|barbier",
  Comptable:    "comptable|comptabilité",
};

// ── Mapping niche → codes NAF ─────────────────────────────────────────────────
const NICHE_TO_NAF: Record<string, string[]> = {
  Plombier:     ["43.21A", "43.22A"],
  Électricien:  ["43.21A", "43.21B"],
  Maçon:        ["43.99C", "41.20A", "43.12A"],
  Serrurier:    ["43.22B", "43.32B"],
  Peintre:      ["43.34Z"],
  Couvreur:     ["43.91A", "43.91B"],
  Carreleur:    ["43.33Z"],
  Menuisier:    ["43.32A", "43.32B", "16.23Z"],
  Chauffagiste: ["43.22A", "43.22C"],
  Paysagiste:   ["81.30Z"],
  Nettoyage:    ["81.21Z", "81.22Z"],
  Restaurant:   ["56.10A", "56.10B", "56.21Z"],
  Boulangerie:  ["10.71A", "10.71B", "47.24Z"],
  Coiffeur:     ["96.02A", "96.02B"],
  Comptable:    ["69.20Z"],
};

// ── Haversine ────────────────────────────────────────────────────────────────
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 1. Géocodage Nominatim ──────────────────────────────────────────────────
export async function clientGeocode(
  city: string
): Promise<{ lat: number; lon: number; dept?: string } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(city)},France&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "ColdCaller/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      lat: string; lon: string;
      address?: { postcode?: string };
    }>;
    if (!data.length) return null;
    const postcode = data[0].address?.postcode ?? "";
    const dept = postcode.slice(0, 2) || undefined;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), dept };
  } catch {
    return null;
  }
}

// ── 2. Recherche OpenStreetMap (Overpass) ────────────────────────────────────
function cleanPhone(raw: string): string {
  return raw.replace(/^\+33\s?/, "0").replace(/\s+/g, " ").trim();
}

function osmToLead(el: OsmElement, niche: string, city: string): Lead | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:fr"] ?? tags.operator ?? null;
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;
  const website =
    tags.website?.replace(/^https?:\/\//, "") ??
    tags["contact:website"]?.replace(/^https?:\/\//, "") ??
    undefined;
  const address =
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") ||
    tags["addr:full"] ||
    `${lat?.toFixed(4) ?? ""}, ${lon?.toFixed(4) ?? ""}`;

  return {
    id:          `osm-${el.type}-${el.id}`,
    name,
    category:    niche,
    phone:       phone ? cleanPhone(phone) : "(pas de tél.)",
    address,
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

export async function clientSearchOsm(
  lat: number,
  lon: number,
  radiusM: number,
  niche: string,
  city: string,
): Promise<Lead[]> {
  try {
    const tags    = NICHE_TO_OSM[niche] ?? [];
    const keyword = NICHE_KEYWORDS[niche] ?? "";
    if (!tags.length && !keyword) return [];

    const radius = Math.min(radiusM, 50_000);
    const parts: string[] = [];

    for (const tag of tags) {
      const [k, v] = tag.split("=");
      for (const t of ["node", "way"]) {
        parts.push(`${t}["${k}"="${v}"](around:${radius},${lat},${lon});`);
      }
    }
    if (keyword) {
      for (const t of ["node", "way"]) {
        parts.push(`${t}["name"~"${keyword}",i](around:${radius},${lat},${lon});`);
      }
    }

    const query = `[out:json][timeout:25][maxsize:6000000];\n(\n${parts.join("\n")}\n);\nout center tags 200;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const json = await res.json() as { elements: OsmElement[] };
    return (json.elements ?? []).map((el) => osmToLead(el, niche, city)).filter(Boolean) as Lead[];
  } catch {
    return [];
  }
}

// ── 3. Recherche Annuaire des Entreprises ────────────────────────────────────
interface SireneHit {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  siege: {
    libelle_commune: string;
    numero_voie?: string;
    libelle_voie?: string;
    latitude?: number;
    longitude?: number;
  };
}

async function sireneOnePage(naf: string, dept: string): Promise<SireneHit[]> {
  try {
    const url =
      `https://recherche-entreprises.api.gouv.fr/search` +
      `?activite_principale=${encodeURIComponent(naf)}` +
      `&departement=${dept}&page=1&per_page=25&statut_diffusion_etablissement=O`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { results: SireneHit[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

export async function clientSearchSirene(
  niche: string,
  dept: string,
  cityLat: number,
  cityLon: number,
  radiusKm: number,
): Promise<Lead[]> {
  if (!dept) return [];
  const nafCodes = NICHE_TO_NAF[niche] ?? [];
  if (!nafCodes.length) return [];

  // Toutes les pages en parallèle
  const pages = await Promise.all(nafCodes.map((naf) => sireneOnePage(naf, dept)));
  const all   = pages.flat();

  // Dédupliquer
  const seen = new Set<string>();
  const unique = all.filter((r) => {
    if (!r?.siren || seen.has(r.siren)) return false;
    seen.add(r.siren);
    return true;
  });

  // Filtrer par distance
  const inRadius = unique.filter((r) => {
    const lat = r.siege?.latitude;
    const lon = r.siege?.longitude;
    if (!lat || !lon) return true;
    return distKm(cityLat, cityLon, lat, lon) <= radiusKm;
  });

  const now = new Date().toISOString();
  return inRadius.slice(0, 80).map((r): Lead => {
    const s = r.siege;
    return {
      id:          `sirene-${r.siren}`,
      name:        r.nom_raison_sociale ?? r.nom_complet,
      category:    niche,
      phone:       "",
      address:     [s.numero_voie, s.libelle_voie].filter(Boolean).join(" "),
      city:        s.libelle_commune,
      rating:      0,
      reviewCount: 0,
      status:      "new",
      notes:       "",
      source:      "openstreetmap",
      detectedAt:  now,
      callCount:   0,
    };
  });
}
