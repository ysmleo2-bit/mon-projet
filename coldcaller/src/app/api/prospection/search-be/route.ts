/**
 * POST /api/prospection/search-be
 * Recherche d'entreprises en Belgique via OpenStreetMap Overpass API.
 * Couvre les provinces belges, aucune clé requise, données avec téléphone quand dispo.
 * L'enrichissement automatique complète ensuite les contacts manquants.
 *
 * Overpass: https://overpass-api.de
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 40;

// ── Mapping secteur → tags OSM ────────────────────────────────────────────────
const SECTOR_OSM_TAGS: Record<string, string[]> = {
  "Plomberie / Chauffage":     ["craft=plumber", "craft=hvac_technician"],
  "Électricité":               ["craft=electrician"],
  "Maçonnerie / BTP":          ["craft=mason", "craft=construction"],
  "Peinture / Décoration":     ["craft=painter"],
  "Couverture / Toiture":      ["craft=roofer"],
  "Menuiserie":                ["craft=carpenter", "craft=joiner"],
  "Paysagisme / Jardinage":    ["craft=gardener"],
  "Nettoyage / Propreté":      ["craft=cleaning_service", "shop=cleaning_service"],
  "Immobilier / Agences":      ["office=real_estate_agent"],
  "Conseil / Marketing":       ["office=consulting", "office=marketing"],
  "Informatique / IT":         ["shop=computer", "craft=computer_technician"],
  "Comptabilité / Finance":    ["office=accountant"],
  "Avocat / Juridique":        ["office=lawyer"],
  "Architecture":              ["office=architect"],
  "Restaurant / Restauration": ["amenity=restaurant", "amenity=fast_food"],
  "Établissement de nuit":     ["amenity=nightclub", "amenity=bar", "amenity=pub"],
  "Plage privée / Beach Club": ["leisure=beach_resort", "amenity=beach", "leisure=swimming_area"],
  "Coiffure / Beauté":         ["shop=hairdresser", "shop=beauty"],
  "Auto / Garage":             ["shop=car_repair", "amenity=car_repair"],
  "Médecin / Santé":           ["amenity=doctors", "healthcare=doctor"],
  "Cabinet Dentaire":          ["amenity=dentist"],
  "Vétérinaire":               ["amenity=veterinary"],
  "Ostéopathe / Thérapies":    ["healthcare=osteopath", "healthcare=alternative"],
  "Kiné / Para-médical":       ["healthcare=physiotherapist"],
  "Infirmier libéral":         ["healthcare=nurse"],
  "Pharmacie":                 ["amenity=pharmacy"],
  "Optique / Audiologie":      ["shop=optician"],
  // Médecine esthétique & spécialistes
  "💉 Médecine esthétique":   ["healthcare=doctor", "amenity=clinic"],
  "🏥 Clinique esthétique":   ["amenity=clinic", "healthcare=hospital"],
  "✂️ Chirurgie esthétique":  ["amenity=clinic", "healthcare=hospital"],
  "🔦 Centre laser":          ["healthcare=doctor", "amenity=clinic"],
  "🏢 Centre dentaire":       ["amenity=dentist"],
  "🦷 Orthodontiste":         ["amenity=dentist"],
  "🦷 Implantologue":         ["amenity=dentist"],
  "🏥 Centre médical":        ["amenity=clinic", "amenity=doctors"],
  "🏨 Clinique privée":       ["amenity=hospital", "amenity=clinic"],
  "🩺 Centre de santé":       ["amenity=clinic", "amenity=doctors"],
  "👩‍⚕️ Dermatologue":       ["healthcare=doctor"],
  "👁️ Ophtalmologue":        ["healthcare=doctor"],
  "👩‍⚕️ Gynécologue":       ["healthcare=doctor"],
  "🔪 Chirurgien":            ["healthcare=doctor", "amenity=clinic"],
  "💅 Centre esthétique":     ["shop=beauty"],
  "🌸 Institut de beauté":    ["shop=beauty", "shop=cosmetics"],
  "⚖️ Centre minceur":        ["shop=beauty", "healthcare=alternative"],
  "🧖 Spa / Bien-être":       ["leisure=spa", "leisure=sauna", "amenity=spa"],
  "Assurance / Courtage":      ["office=insurance"],
  "Transport / Logistique":    ["office=logistics"],
  "Transport de personnes":    ["amenity=taxi"],
  "Livraison / Coursiers":     ["shop=courier"],
};

// ISO3166-2 codes pour les provinces belges
const PROVINCE_OSM: Record<string, string> = {
  "BXL": "BE-BRU", // Bruxelles-Capitale
  "ANT": "BE-VAN", // Anvers / Antwerpen
  "LGE": "BE-WLG", // Liège
  "HAI": "BE-WHT", // Hainaut
  "OVL": "BE-VOV", // Flandre-Orientale
  "WVL": "BE-VWV", // Flandre-Occidentale
  "VBR": "BE-VBR", // Brabant flamand
  "WBR": "BE-WBR", // Brabant wallon
  "NAM": "BE-WNA", // Namur
  "LUX": "BE-WLX", // Luxembourg belge
  "LIM": "BE-VLI", // Limbourg
};

interface OsmElement {
  type: "node" | "way" | "relation";
  id:   number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildOverpassQuery(tags: string[], keyword: string, provinceIso?: string): string {
  const areaFilter = provinceIso
    ? `area["ISO3166-2"="${provinceIso}"]->.prov;\n`
    : `area["ISO3166-1"="BE"]["boundary"="administrative"][admin_level=2]->.prov;\n`;

  const parts: string[] = [];
  for (const tag of tags) {
    const [k, v] = tag.split("=");
    parts.push(`  node["${k}"="${v}"](area.prov);`);
    parts.push(`  way["${k}"="${v}"](area.prov);`);
  }
  // Recherche par mot-clé dans le nom (fallback / complément)
  if (keyword) {
    const kw = keyword.toLowerCase().replace(/[^a-zàâäéèêëîïôùûü]/gi, "|").replace(/\|+/g, "|");
    parts.push(`  node["name"~"${kw}",i](area.prov);`);
    parts.push(`  way["name"~"${kw}",i](area.prov);`);
  }

  return (
    `[out:json][timeout:30][maxsize:6000000];\n` +
    areaFilter +
    `(\n${parts.join("\n")}\n);\n` +
    `out center tags 200;`
  );
}

function osmToProspect(
  el: OsmElement,
  secteur: string,
  user?: { userId: string; name: string }
): Prospect | null {
  const t    = el.tags ?? {};
  const name = t.name ?? t["name:fr"] ?? t["name:nl"] ?? t.operator ?? null;
  if (!name) return null;

  const now  = new Date().toISOString();
  const id   = `prospect-be-osm-${el.type}-${el.id}`;

  const rawPhone =
    t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ??
    t["phone:mobile"] ?? t.mobile ?? undefined;
  const phone = rawPhone
    ? rawPhone.replace(/^(\+32|0032)\s?/, "0").replace(/\s+/g, " ").trim()
    : undefined;

  const web = (t.website ?? t["contact:website"])
    ?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const email = t.email ?? t["contact:email"] ?? undefined;

  const addrParts = [t["addr:housenumber"], t["addr:street"]].filter(Boolean);
  const addr  = addrParts.join(" ") || t["addr:full"] || "";
  const ville = t["addr:city"] ?? t["addr:municipality"] ?? "";
  const cp    = t["addr:postcode"] ?? "";
  const statut = web ? "a_enrichir" : "nouveau";

  return {
    id,
    siren:              id,
    nom:                name,
    codeNaf:            "",
    libelleNaf:         t.craft ?? t.amenity ?? t.shop ?? t.office ?? t.healthcare ?? "",
    secteur,
    adresse:            addr,
    ville,
    codePostal:         cp,
    departement:        "",
    siteWeb:            web,
    emailDirigeant:     email,
    telephonePro:       phone,
    statut,
    dirigeants:         [],
    sources:            ["openstreetmap"],
    actions:            [{ date: now, type: "enrichissement", detail: "Prospect créé depuis OpenStreetMap (BE)" }],
    createdAt:          now,
    updatedAt:          now,
    assignedToId:       user?.userId,
    assignedTo:         user?.name,
  };
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = requireAuth(req);
  if (authError) return authError;

  const body    = await req.json() as { secteur?: string; keyword?: string; province?: string; perPage?: number };
  const { secteur = "", keyword = secteur, province = "ALL", perPage = 50 } = body;

  if (!secteur.trim() && !keyword.trim()) {
    return NextResponse.json({ error: "secteur ou keyword requis" }, { status: 400 });
  }

  try {
    const osmTags      = SECTOR_OSM_TAGS[secteur] ?? [];
    const provinceIso  = province !== "ALL" ? PROVINCE_OSM[province] : undefined;
    const searchKw     = keyword.split(/[/\s]/)[0]?.trim() ?? keyword;
    const query        = buildOverpassQuery(osmTags, searchKw, provinceIso);

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    `data=${encodeURIComponent(query)}`,
      signal:  AbortSignal.timeout(35_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Overpass error ${res.status}` }, { status: 502 });
    }

    const json     = await res.json() as { elements: OsmElement[] };
    const elements = json.elements ?? [];

    // Déduplique par id OSM
    const seen   = new Set<number>();
    const unique = elements.filter((el) => {
      if (seen.has(el.id)) return false;
      seen.add(el.id); return true;
    });

    const prospects = unique
      .map((el) => osmToProspect(el, secteur, user ?? undefined))
      .filter(Boolean)
      .slice(0, perPage) as Prospect[];

    // Sauvegarder en DB
    let merged = prospects;
    try {
      const { dbUpsertProspects, dbGetProspectsByIds } = await import("@/lib/db-prospection");
      await dbUpsertProspects(prospects);
      const dbMap = await dbGetProspectsByIds(prospects.map((p) => p.id));
      merged = prospects.map((p) => dbMap.get(p.id) ?? p);
    } catch (dbErr) {
      console.warn("[search-be] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      prospects: merged,
      total:     merged.length,
      raw:       unique.length,
      source:    "openstreetmap",
    });
  } catch (err) {
    console.error("[search-be]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
