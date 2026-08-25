/**
 * POST /api/apify/contact
 *
 * Enrichissement email & téléphone via Apify (actor apify/contact-info-scraper)
 * Scrape le site web de l'entreprise pour trouver email, téléphone, réseaux sociaux.
 *
 * Body : { siteWeb: string; name?: string }
 * Retour : { email?: string; phone?: string; socials?: Record<string, string> }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { runApifyActor, ApifyError } from "@/lib/apify";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// https://apify.com/apify/contact-info-scraper
const ACTOR_ID = "apify/contact-info-scraper";

interface ApifyContactResult {
  domain?:         string;
  emails?:         string[];
  phones?:         string[];
  linkedInProfiles?: string[];
  twitterProfiles?:  string[];
  facebookProfiles?: string[];
  instagramProfiles?: string[];
  url?:            string;
}

function normalizePhone(raw: string): string {
  // Normaliser le format téléphone français
  return raw
    .replace(/^\+33\s?/, "0")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !email.includes("example.") &&
    !email.includes("noreply") &&
    !email.includes("no-reply");
}

export async function POST(req: NextRequest) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_TOKEN non configuré" }, { status: 503 });
  }

  const { siteWeb, name } = await req.json() as {
    siteWeb: string;
    name?:   string;
  };

  if (!siteWeb) {
    return NextResponse.json({ error: "siteWeb requis" }, { status: 400 });
  }

  // Normaliser l'URL
  const url = siteWeb.startsWith("http") ? siteWeb : `https://${siteWeb}`;

  console.log(`[apify/contact] Scraping ${url}${name ? ` (${name})` : ""}`);

  try {
    const results = await runApifyActor<ApifyContactResult>(
      ACTOR_ID,
      {
        startUrls:          [{ url }],
        maxDepth:           1,         // Ne pas crawler trop profond
        maxPages:           5,         // Pages max à visiter
        includeUrlGlobs:    [],
        excludeUrlGlobs:    [],
        proxyConfiguration: { useApifyProxy: true },
      },
      45,
    );

    if (results.length === 0) {
      return NextResponse.json({ email: null, phone: null, source: "apify" });
    }

    // Agréger les résultats de toutes les pages scrapées
    const allEmails  = results.flatMap((r) => r.emails  ?? []).filter(isValidEmail);
    const allPhones  = results.flatMap((r) => r.phones  ?? []).map(normalizePhone);
    const linkedIns  = results.flatMap((r) => r.linkedInProfiles  ?? []);
    const instagrams = results.flatMap((r) => r.instagramProfiles ?? []);
    const facebooks  = results.flatMap((r) => r.facebookProfiles  ?? []);

    // Dédupliquer
    const emails = Array.from(new Set(allEmails));
    const phones = Array.from(new Set(allPhones));

    return NextResponse.json({
      email:   emails[0]  ?? null,
      emails,
      phone:   phones[0]  ?? null,
      phones,
      socials: {
        ...(linkedIns[0]  ? { linkedin:  linkedIns[0] }  : {}),
        ...(instagrams[0] ? { instagram: instagrams[0] } : {}),
        ...(facebooks[0]  ? { facebook:  facebooks[0] }  : {}),
      },
      source: "apify",
    });
  } catch (err) {
    if (err instanceof ApifyError) {
      return NextResponse.json({ error: err.message, email: null, phone: null }, { status: 502 });
    }
    console.error("[apify/contact]", err);
    return NextResponse.json({ error: String(err), email: null, phone: null }, { status: 500 });
  }
}
