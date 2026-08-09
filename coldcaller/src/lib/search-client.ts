/**
 * search-client.ts — scraping côté navigateur + appels aux routes API
 * • /api/scrape-maps          → Google Maps (Google Places API si clé définie)
 * • api-adresse.data.gouv.fr  → géocodage officiel français (CORS natif)
 * • recherche-entreprises.api.gouv.fr → Annuaire des Entreprises (CORS)
 * • overpass-api.de           → OpenStreetMap (CORS: *)
 */

import type { Lead } from "@/lib/types";

// ── Mapping niche → tags OSM ─────────────────────────────────────────────────
const NICHE_TO_OSM: Record<string, string[]> = {
  Plombier:     ["craft=plumber", "craft=hvac_technician"],
  Électricien:  ["craft=electrician"],
  Maçon:        ["craft=mason", "craft=construction", "craft=bricklayer"],
  Serrurier:    ["craft=locksmith", "shop=locksmith"],
  Peintre:      ["craft=painter"],
  Couvreur:     ["craft=roofer"],
  Carreleur:    ["craft=tiler", "craft=floor_layer"],
  Menuisier:    ["craft=carpenter", "craft=joiner", "craft=cabinet_maker"],
  Chauffagiste: ["craft=hvac_technician", "craft=heating_engineer"],
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
  Maçon:        "maçon|maçonnerie|btp",
  Serrurier:    "serrurier|serrurerie",
  Peintre:      "peintre|peinture",
  Couvreur:     "couvreur|toiture|couverture",
  Carreleur:    "carreleur|carrelage",
  Menuisier:    "menuisier|menuiserie",
  Chauffagiste: "chauffagiste|chauffage|climatisation",
  Paysagiste:   "paysagiste|jardinage",
  Nettoyage:    "nettoyage|propreté",
  Restaurant:   "restaurant|brasserie|bistrot",
  Boulangerie:  "boulangerie|boulanger|pain",
  Coiffeur:     "coiffeur|coiffure|barbier",
  Comptable:    "comptable|comptabilité",
};

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

// ── 1. Géocodage — api-adresse.data.gouv.fr ──────────────────────────────────
export async function clientGeocode(
  city: string
): Promise<{ lat: number; lon: number; dept: string } | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      features: Array<{
        geometry: { coordinates: [number, number] };
        properties: { postcode?: string; citycode?: string };
      }>;
    };
    const f = data.features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    const citycode   = f.properties.citycode ?? "";
    const dept       = citycode.slice(0, 2) || f.properties.postcode?.slice(0, 2) || "";
    return { lat, lon, dept };
  } catch {
    return null;
  }
}

// ── 2. OpenStreetMap via Overpass ─────────────────────────────────────────────
interface OsmElement {
  type: "node" | "way" | "relation"; id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function osmToLead(el: OsmElement, niche: string, city: string): Lead | null {
  const t = el.tags ?? {};
  const name = t.name ?? t["name:fr"] ?? t.operator ?? null;
  if (!name) return null;
  const phone =
    t.phone ??
    t["contact:phone"] ??
    t["contact:mobile"] ??
    t["phone:mobile"] ??
    t.mobile ??
    null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const addr = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ")
    || t["addr:full"]
    || `${lat?.toFixed(4) ?? ""}, ${lon?.toFixed(4) ?? ""}`;
  const website = (t.website ?? t["contact:website"])?.replace(/^https?:\/\//, "");
  return {
    id:          `osm-${el.type}-${el.id}`,
    name,
    category:    niche,
    phone:       phone ? phone.replace(/^\+33\s?/, "0").replace(/\s+/g, " ").trim() : "",
    address:     addr,
    city:        t["addr:city"] || city,
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
  lat: number, lon: number, radiusM: number, niche: string, city: string,
): Promise<Lead[]> {
  try {
    const tags = NICHE_TO_OSM[niche] ?? [];
    const kw   = NICHE_KEYWORDS[niche] ?? "";
    if (!tags.length && !kw) return [];

    const r = Math.min(radiusM, 50_000);

    // Requête simple et fiable : tag métier + mot-clé dans nom
    const parts: string[] = [];
    for (const tag of tags) {
      const [k, v] = tag.split("=");
      parts.push(`node["${k}"="${v}"](around:${r},${lat},${lon});`);
      parts.push(`way["${k}"="${v}"](around:${r},${lat},${lon});`);
    }
    if (kw) {
      parts.push(`node["name"~"${kw}",i](around:${r},${lat},${lon});`);
      parts.push(`way["name"~"${kw}",i](around:${r},${lat},${lon});`);
    }

    const query = `[out:json][timeout:25][maxsize:5000000];\n(\n${parts.join("\n")}\n);\nout center tags 200;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return [];
    const json = await res.json() as { elements: OsmElement[] };
    const leads = (json.elements ?? [])
      .map((el) => osmToLead(el, niche, city))
      .filter(Boolean) as Lead[];

    // Trier : leads avec téléphone en premier
    return leads.sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0));
  } catch {
    return [];
  }
}

// ── 3. Annuaire des Entreprises SIRENE ───────────────────────────────────────
interface SireneHit {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  siege: {
    siret?: string;
    libelle_commune: string;
    numero_voie?: string;
    libelle_voie?: string;
    latitude?: number;
    longitude?: number;
    site_internet?: string;
    telephone?: string;
  };
}

export async function clientSearchSirene(
  niche: string, dept: string,
  cityLat: number, cityLon: number, radiusKm: number,
): Promise<Lead[]> {
  if (!dept) return [];
  const nafCodes = NICHE_TO_NAF[niche] ?? [];
  if (!nafCodes.length) return [];

  const fetches = nafCodes.map((naf) =>
    fetch(
      `https://recherche-entreprises.api.gouv.fr/search` +
      `?activite_principale=${encodeURIComponent(naf)}` +
      `&departement=${dept}&page=1&per_page=25&statut_diffusion_etablissement=O`,
      { signal: AbortSignal.timeout(8_000) }
    )
      .then((r) => r.ok ? r.json() as Promise<{ results: SireneHit[] }> : { results: [] })
      .then((j) => j.results ?? [])
      .catch(() => [] as SireneHit[])
  );

  const pages   = await Promise.all(fetches);
  const all     = pages.flat();
  const seen    = new Set<string>();
  const unique  = all.filter((r) => {
    if (!r?.siren || seen.has(r.siren)) return false;
    seen.add(r.siren); return true;
  });

  const inRadius = unique.filter((r) => {
    const la = r.siege?.latitude, lo = r.siege?.longitude;
    if (!la || !lo) return true;
    return distKm(cityLat, cityLon, la, lo) <= radiusKm;
  });

  const now = new Date().toISOString();
  return inRadius.slice(0, 80).map((r): Lead => {
    const rawPhone = r.siege.telephone ?? "";
    const phone = rawPhone
      ? rawPhone.replace(/^\+33\s?/, "0").replace(/^0033\s?/, "0").replace(/[\s.\-]/g, " ").trim()
      : "";
    const website = r.siege.site_internet?.replace(/^https?:\/\//, "");
    return {
      id:          `sirene-${r.siren}`,
      siret:       r.siege.siret,
      name:        r.nom_raison_sociale ?? r.nom_complet,
      category:    niche,
      phone,
      address:     [r.siege.numero_voie, r.siege.libelle_voie].filter(Boolean).join(" "),
      city:        r.siege.libelle_commune,
      rating:      0,
      reviewCount: 0,
      website,
      status:      "new",
      notes:       "",
      source:      "sirene",
      detectedAt:  now,
      callCount:   0,
    };
  });
}

// ── 3b. Cross-référence SIRET→OSM (enrichissement téléphone gratuit) ──────────
// Beaucoup de commerces français dans OSM ont un tag "ref:FR:SIRET".
// On cherche tous les nodes OSM avec SIRET dans le rayon et on retourne
// le mapping SIRET → {phone, website} pour enrichir les leads SIRENE.
export async function clientOsmBySiret(
  lat: number, lon: number, radiusM: number
): Promise<Map<string, { phone: string; website?: string }>> {
  try {
    const r = Math.min(radiusM, 50_000);
    const query =
      `[out:json][timeout:20][maxsize:3000000];\n` +
      `(\n` +
      `  node["ref:FR:SIRET"](around:${r},${lat},${lon});\n` +
      `  way["ref:FR:SIRET"](around:${r},${lat},${lon});\n` +
      `);\n` +
      `out center tags 500;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) return new Map();
    const json = await res.json() as { elements: OsmElement[] };

    const result = new Map<string, { phone: string; website?: string }>();
    for (const el of json.elements ?? []) {
      const t   = el.tags ?? {};
      const siret = t["ref:FR:SIRET"];
      if (!siret) continue;
      const rawPhone =
        t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ??
        t["phone:mobile"] ?? t.mobile ?? "";
      const phone = rawPhone
        ? rawPhone.replace(/^\+33\s?/, "0").replace(/\s+/g, " ").trim()
        : "";
      const website = (t.website ?? t["contact:website"])?.replace(/^https?:\/\//, "");
      if (phone || website) {
        result.set(siret, { phone, website });
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

// ── 3c. Foursquare Places (clé gratuite developer.foursquare.com) ─────────────
// NEXT_PUBLIC_FSQ_API_KEY — 100 000 appels/mois gratuits, retourne les tél.
interface FsqPlace {
  fsq_id: string;
  name: string;
  tel?: string;
  website?: string;
  rating?: number;
  location?: {
    address?: string;
    locality?: string;
    formatted_address?: string;
  };
}

export async function clientSearchFoursquare(
  lat: number, lon: number, radiusM: number,
  niche: string, city: string,
): Promise<Lead[]> {
  const key =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FSQ_API_KEY) ?? "";
  if (!key) return [];

  try {
    const r = Math.min(radiusM, 50_000);
    const url =
      `https://api.foursquare.com/v3/places/search` +
      `?query=${encodeURIComponent(niche)}` +
      `&ll=${lat},${lon}` +
      `&radius=${r}` +
      `&limit=50` +
      `&fields=fsq_id,name,tel,website,rating,location`;

    const res = await fetch(url, {
      headers: {
        "Authorization": key,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return [];
    const data = await res.json() as { results: FsqPlace[] };
    const now  = new Date().toISOString();

    return (data.results ?? [])
      .filter((p) => !!p.name)
      .map((p): Lead => {
        const rawPhone = p.tel ?? "";
        const phone    = rawPhone
          ? rawPhone.replace(/^\+33\s?/, "0").replace(/^0033\s?/, "0")
                    .replace(/[\s.\-]/g, " ").trim()
          : "";
        const addrParts = [
          p.location?.address,
          p.location?.locality ?? city,
        ].filter(Boolean);
        return {
          id:          `fsq-${p.fsq_id}`,
          name:        p.name,
          category:    niche,
          phone,
          address:     addrParts.join(", "),
          city:        p.location?.locality ?? city,
          rating:      p.rating ?? 0,
          reviewCount: 0,
          website:     p.website?.replace(/^https?:\/\//, ""),
          status:      "new",
          notes:       "",
          source:      "foursquare",
          detectedAt:  now,
          callCount:   0,
        };
      });
  } catch {
    return [];
  }
}

// ── 4. Pages Jaunes (bot stealth Playwright — asynchrone, non bloquant) ────────
// Scrape les vrais numéros de tél. depuis Pages Jaunes via navigateur stealth.
// S'exécute en arrière-plan, ajoute les numéros aux leads existants par nom.
export async function clientSearchPagesJaunes(
  niche: string, city: string,
): Promise<Array<{ name: string; phone: string; address: string; city: string }>> {
  try {
    const res = await fetch("/api/scrape-pagesjaunes", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ niche, city }),
      signal:  AbortSignal.timeout(55_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      results: Array<{ name: string; phone: string; address: string; city: string }>;
    };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ── 5. Google Maps (via bot serveur — asynchrone, non bloquant) ──────────────
export async function clientSearchMaps(
  niche: string, city: string, radius: number, maxResults = 20
): Promise<Lead[]> {
  try {
    const res = await fetch("/api/scrape-maps", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ niche, city, radius, maxResults }),
      signal:  AbortSignal.timeout(55_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { leads: Lead[] };
    return data.leads ?? [];
  } catch {
    return [];
  }
}
