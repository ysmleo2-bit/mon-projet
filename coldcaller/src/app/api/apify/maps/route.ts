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

  try {
    const results = await runApifyActor<ApifyMapsPlace>(
      ACTOR_ID,
      {
        searchStringsArray:            [searchQuery],
        maxCrawledPlacesPerSearch:     Math.min(maxResults, 50),
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
      50,
    );

    const leads = results
      .filter((p) => !p.permanentlyClosed && !p.temporarilyClosed)
      .map((p) => apifyMapsToLead(p, searchQuery));

    return NextResponse.json({ leads, total: leads.length, source: "apify" });
  } catch (err) {
    if (err instanceof ApifyError) {
      return NextResponse.json({ error: err.message, leads: [] }, { status: 502 });
    }
    console.error("[apify/maps]", err);
    return NextResponse.json({ error: String(err), leads: [] }, { status: 500 });
  }
}
