/**
 * POST /api/apify/maps
 *
 * Scraping Google Maps via Apify (actor compass/google-maps-scraper)
 * Beaucoup plus riche que l'API Places : avis, photos, horaires, prix, etc.
 *
 * Body :
 *   searchQuery  : string   // ex: "plombier Paris 75001"
 *   maxResults?  : number   // défaut 20
 *
 * Retour : { leads: Lead[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { runApifyActor, ApifyError } from "@/lib/apify";
import type { Lead } from "@/lib/types";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// https://apify.com/compass/google-maps-scraper
const ACTOR_ID = "compass/google-maps-scraper";

interface ApifyMapsPlace {
  title?:              string;
  name?:               string;
  categoryName?:       string;
  address?:            string;
  city?:               string;
  postalCode?:         string;
  countryCode?:        string;
  phone?:              string;
  phoneUnformatted?:   string;
  website?:            string;
  url?:                string;
  totalScore?:         number;
  reviewsCount?:       number;
  permanentlyClosed?:  boolean;
  temporarilyClosed?:  boolean;
  location?: {
    lat?: number;
    lng?: number;
  };
  openingHours?: Array<{
    day:  string;
    hours: string;
  }>;
  priceRange?:         string;  // "$", "$$", etc.
  googleMapsUrl?:      string;
  placeId?:            string;
}

function priceLevelFromRange(range?: string): string | undefined {
  if (!range) return undefined;
  const map: Record<string, string> = { "$": "€", "$$": "€€", "$$$": "€€€", "$$$$": "€€€€" };
  return map[range] ?? range;
}

/** Normalise une chaîne : minuscules, sans accents, sans ponctuation */
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mots génériques à ignorer dans la comparaison (villes, articles, etc.)
const STOP_WORDS = new Set([
  "le","la","les","de","du","des","en","et","ou","dans","sur","au","aux",
  "un","une","par","pour","avec","sans","pas","plus","france","paris","lyon",
  "marseille","toulouse","nice","nantes","strasbourg","montpellier","bordeaux",
  "lille","rennes","reims","grenoble","toulon","brest","saint","ste","sarl",
  "sas","eurl","sa","snc","plomberie","chauffage","electricite","batiment",
]);

/**
 * Extrait les mots-clés métier depuis la searchQuery
 * Ex: "plombier Paris 75001" → ["plombier"]
 * Ex: "restaurant gastronomique Lyon" → ["restaurant","gastronomique"]
 */
function extractKeywords(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !STOP_WORDS.has(w));
}

/**
 * Vérifie que la catégorie Google Maps correspond au métier recherché.
 * Retourne true si match (garder), false si clairement hors-sujet (filtrer).
 *
 * Stratégie (du plus précis au plus souple) :
 * 1. Inclusion directe : "plombier" dans "Plombier chauffagiste" ✓
 * 2. Stem matching (5 chars) : "plomb" → "Plomberie", "restaurant" → "Restauration" ✓
 * 3. Mot-clé de catégorie contenu dans la query : sécurité filet
 */
function categoryMatchesQuery(categoryName: string | undefined, searchKeywords: string[]): boolean {
  if (!categoryName || !searchKeywords.length) return true;
  const cat      = normalize(categoryName);
  const catWords = cat.split(/\s+/).filter((w) => w.length >= 3);

  for (const kw of searchKeywords) {
    if (kw.length < 3) continue;

    // 1. Inclusion directe dans la catégorie complète
    if (cat.includes(kw)) return true;

    // 2. Stem matching : les 5 premiers caractères suffisent pour différencier les métiers
    //    "plombier" → stem "plomb" → match "plomberie", "plomberie-sanitaire"
    //    "restaurant" → stem "resta" → match "restauration", "restaurant rapide"
    const stemLen = Math.min(kw.length, 5);
    if (stemLen >= 4) {
      const stem = kw.slice(0, stemLen);
      if (catWords.some((cw) => cw.startsWith(stem))) return true;
    }

    // 3. Un mot de la catégorie est inclus dans le keyword (ex: kw="plombier chauffagiste")
    //    → catégorie "Chauffagiste" passe car "chauffagiste" est dans le kw
    if (catWords.some((cw) => cw.length >= 4 && kw.includes(cw))) return true;
  }
  return false;
}

/**
 * Construit une searchQuery plus précise pour Apify en s'assurant que
 * la requête est orientée métier (pas de mots parasites).
 */
function buildPreciseQuery(rawQuery: string): string {
  // Si la requête contient déjà ville/département, on la garde telle quelle
  // mais on s'assure que le terme métier est en premier
  return rawQuery.trim();
}

function apifyMapsToLead(p: ApifyMapsPlace, query: string): Lead {
  const name    = p.title ?? p.name ?? "Inconnu";
  const phone   = p.phone ?? p.phoneUnformatted;
  const website = p.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const hours   = (p.openingHours ?? []).map((h) => `${h.day}: ${h.hours}`);

  return {
    id:            `apify-maps-${p.placeId ?? encodeURIComponent(name)}`,
    name,
    category:      p.categoryName ?? query,
    address:       p.address      ?? "",
    city:          p.city         ?? "",
    phone:         phone          ?? "",
    website:       website        ?? undefined,
    rating:        p.totalScore   ?? 0,
    reviewCount:   p.reviewsCount ?? 0,
    googleMapsUrl: p.googleMapsUrl ?? p.url,
    lat:           p.location?.lat  ?? undefined,
    lng:           p.location?.lng  ?? undefined,
    hours:         hours.length > 0 ? hours : undefined,
    priceLevel:    priceLevelFromRange(p.priceRange),
    source:     "apify-maps" as const,
    // Champs requis par Lead
    status:     "new" as const,
    notes:      "",
    detectedAt: new Date().toISOString(),
    callCount:  0,
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_TOKEN non configuré" }, { status: 503 });
  }

  const { searchQuery, maxResults = 20 } = await req.json() as {
    searchQuery: string;
    maxResults?: number;
  };

  if (!searchQuery) {
    return NextResponse.json({ error: "searchQuery requis" }, { status: 400 });
  }

  const preciseQuery   = buildPreciseQuery(searchQuery);
  const searchKeywords = extractKeywords(searchQuery);

  try {
    // On demande plus de résultats qu'il n'en faut pour absorber le filtrage
    const fetchCount = Math.min(maxResults * 3, 100);

    const results = await runApifyActor<ApifyMapsPlace>(
      ACTOR_ID,
      {
        searchStringsArray:            [preciseQuery],
        maxCrawledPlacesPerSearch:     fetchCount,
        language:                      "fr",
        countryCode:                   "fr",
        includeHistogram:              false,
        includeOpeningHours:           true,
        includePeopleAlsoSearch:       false,
        additionalInfo:                false,
        exportPlaceUrls:               false,
        scrapeDirectories:             false,
        deeperCityScrape:              false,
      },
      Math.ceil(fetchCount / 20) * 20 + 20,
    );

    const leads = results
      // 1. Éliminer les établissements fermés
      .filter((p) => !p.permanentlyClosed && !p.temporarilyClosed)
      // 2. Éliminer les résultats sans téléphone (peu exploitables)
      .filter((p) => !!(p.phone ?? p.phoneUnformatted))
      // 3. Filtrage catégorie strict : garder uniquement les vrais match métier
      //    (on ne filtre pas si la catégorie est absente)
      .filter((p) => categoryMatchesQuery(p.categoryName, searchKeywords))
      // 4. Convertir en lead
      .map((p) => apifyMapsToLead(p, searchQuery))
      // 5. Limiter au nombre demandé
      .slice(0, maxResults);

    return NextResponse.json({
      leads,
      total:    leads.length,
      source:   "apify",
      filtered: results.length - leads.length,  // debug : combien ont été filtrés
    });
  } catch (err) {
    if (err instanceof ApifyError) {
      return NextResponse.json({ error: err.message, leads: [] }, { status: 502 });
    }
    console.error("[apify/maps]", err);
    return NextResponse.json({ error: String(err), leads: [] }, { status: 500 });
  }
}
