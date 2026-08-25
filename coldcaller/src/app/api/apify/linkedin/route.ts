/**
 * POST /api/apify/linkedin
 *
 * Recherche de profils LinkedIn via Apify (actor bebity/linkedin-profile-scraper)
 * Authentification : cookie li_at du compte dédié (LINKEDIN_COOKIE)
 *
 * Body : { name: string; company?: string; location?: string }
 * Retour : { profile: { url, firstName, lastName, headline, location } | null; searchUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { runApifyActor, ApifyError } from "@/lib/apify";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// Actor Apify pour la recherche de personnes LinkedIn
// https://apify.com/curious_coder/linkedin-people-search
const ACTOR_ID = "curious_coder/linkedin-people-search";

interface ApifyLinkedInPerson {
  profileUrl?:      string;
  linkedInUrl?:     string;
  url?:             string;
  firstName?:       string;
  first_name?:      string;
  lastName?:        string;
  last_name?:       string;
  headline?:        string;
  title?:           string;
  location?:        string;
  publicIdentifier?: string;
}

export async function POST(req: NextRequest) {
  const liAt = process.env.LINKEDIN_COOKIE;
  if (!liAt) {
    return NextResponse.json(
      { error: "LINKEDIN_COOKIE non configuré" },
      { status: 503 },
    );
  }

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN non configuré" },
      { status: 503 },
    );
  }

  const { name, company, location } = await req.json() as {
    name:      string;
    company?:  string;
    location?: string;
  };

  if (!name) {
    return NextResponse.json({ error: "name requis" }, { status: 400 });
  }

  // Tronquer le nom légal à 2 mots max (prénom + nom)
  const nameShort = name.trim().split(/\s+/).slice(0, 2).join(" ");
  const keywords  = [nameShort, company].filter(Boolean).join(" ");

  // URL de recherche fallback (à ouvrir avec le compte dédié)
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

  try {
    const results = await runApifyActor<ApifyLinkedInPerson>(
      ACTOR_ID,
      {
        // Recherche par mots-clés
        searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=SWITCH_SEARCH_VERTICAL`,
        // Cookie d'authentification du compte dédié
        cookie: [{ name: "li_at", value: liAt }],
        maxResults: 3,
      },
      45,
    );

    if (results.length === 0) {
      return NextResponse.json({ profile: null, searchUrl, source: "apify" });
    }

    const p = results[0];
    const profileUrl =
      p.profileUrl ?? p.linkedInUrl ?? p.url ??
      (p.publicIdentifier ? `https://www.linkedin.com/in/${p.publicIdentifier}` : null);

    if (!profileUrl) {
      return NextResponse.json({ profile: null, searchUrl, source: "apify" });
    }

    return NextResponse.json({
      profile: {
        url:       profileUrl,
        firstName: p.firstName ?? p.first_name ?? "",
        lastName:  p.lastName  ?? p.last_name  ?? "",
        headline:  p.headline  ?? p.title       ?? "",
        location:  p.location  ?? "",
      },
      searchUrl,
      source: "apify",
    });
  } catch (err) {
    if (err instanceof ApifyError) {
      console.warn("[apify/linkedin]", err.message);
      // Fallback gracieux : retourner le lien de recherche
      return NextResponse.json({
        profile:  null,
        searchUrl,
        warning:  `Apify indisponible — ${err.message}`,
        source:   "fallback",
      });
    }
    console.error("[apify/linkedin]", err);
    return NextResponse.json({ profile: null, searchUrl, error: String(err) });
  }
}
