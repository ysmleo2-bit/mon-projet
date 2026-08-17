/**
 * POST /api/prospection/enrich
 * Enrichit un prospect : site web (Google Places), emails (scraping), téléphone
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Scraping du site web pour trouver des emails ──────────────────────────────
async function scrapeWebsiteContacts(rawUrl: string): Promise<{
  emails:  string[];
  phones:  string[];
  scrapedOk: boolean;
}> {
  const cleanUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const PHONE_RE = /(?:(?:\+33|0033|0)[1-9])(?:[\s.\-]?\d{2}){4}/g;

  // Pages à essayer dans l'ordre
  const pages = [
    cleanUrl,
    `${cleanUrl}/contact`,
    `${cleanUrl}/nous-contacter`,
    `${cleanUrl}/contactez-nous`,
    `${cleanUrl}/contact.html`,
    `${cleanUrl}/a-propos`,
    `${cleanUrl}/about`,
  ];

  const emails = new Set<string>();
  const phones = new Set<string>();
  let scrapedOk = false;

  const IGNORE_DOMAINS = ["example.com", "domain.com", "email.com", "yoursite", "sentry", "google", "facebook", "twitter", "linkedin"];

  for (const url of pages) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/1.0)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      scrapedOk  = true;

      // Emails
      const found = html.match(EMAIL_RE) ?? [];
      for (const e of found) {
        const lower = e.toLowerCase();
        if (IGNORE_DOMAINS.some((d) => lower.includes(d))) continue;
        if (lower.includes(".png") || lower.includes(".jpg") || lower.includes(".gif")) continue;
        emails.add(lower);
      }

      // Téléphones
      const tel = html.match(PHONE_RE) ?? [];
      for (const p of tel) {
        const cleaned = p.replace(/[\s.\-]/g, " ").trim();
        phones.add(cleaned);
      }

      // Arrêter dès qu'on a trouvé un email
      if (emails.size > 0) break;
    } catch { continue; }
  }

  return { emails: Array.from(emails), phones: Array.from(phones), scrapedOk };
}

// ── Recherche de site web via Google Places ────────────────────────────────────
async function findWebsite(nom: string, ville?: string): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const query = `${nom}${ville ? " " + ville : ""}`;
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type":   "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.websiteUri,places.nationalPhoneNumber,places.displayName",
        },
        body: JSON.stringify({ textQuery: query, languageCode: "fr", pageSize: 1 }),
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { places?: Array<{ websiteUri?: string; nationalPhoneNumber?: string }> };
    const place = data.places?.[0];
    if (!place?.websiteUri) return null;
    return place.websiteUri.replace(/^https?:\/\//, "").replace(/\/$/, "");
  } catch { return null; }
}

// ── Génération de patterns d'email ────────────────────────────────────────────
function generateEmailPatterns(
  dirigeantPrincipal: string | undefined,
  domaine: string,
): string[] {
  if (!dirigeantPrincipal) {
    return [
      `contact@${domaine}`,
      `info@${domaine}`,
      `direction@${domaine}`,
    ];
  }

  const parts  = dirigeantPrincipal.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // retirer accents
    .split(/\s+/);
  const prenom = parts[0] ?? "";
  const nom    = parts[parts.length - 1] ?? "";
  const pInit  = prenom.charAt(0);

  return [
    `${prenom}.${nom}@${domaine}`,
    `${pInit}.${nom}@${domaine}`,
    `${nom}.${prenom}@${domaine}`,
    `${prenom}@${domaine}`,
    `${nom}@${domaine}`,
    `contact@${domaine}`,
    `info@${domaine}`,
    `direction@${domaine}`,
  ].filter((e) => e.length > 4 && !e.startsWith("@"));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    prospectId: string;
    siren:      string;
    nom:        string;
    ville?:     string;
    siteWeb?:   string;
    dirigeantPrincipal?: string;
  };

  const { prospectId, siren, nom, ville, dirigeantPrincipal } = body;
  let { siteWeb } = body;

  const now     = new Date().toISOString();
  const actions: ProspectAction[] = [];
  const sources: DataSource[]     = ["sirene"];
  const patch: Partial<Prospect>  = { updatedAt: now };

  try {
    // 1. Trouver le site web si pas déjà connu
    if (!siteWeb && process.env.GOOGLE_MAPS_API_KEY) {
      const found = await findWebsite(nom, ville);
      if (found) {
        siteWeb     = found;
        patch.siteWeb = found;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Site web trouvé via Google Places : ${found}` });
      }
    }

    // 2. Scraper le site web pour trouver des emails
    let emailTrouve: string | undefined;
    let emailSource: DataSource = "website_scraping";
    let emailPatterns: string[] = [];

    if (siteWeb) {
      const domaine = siteWeb.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
      const { emails, phones, scrapedOk } = await scrapeWebsiteContacts(siteWeb);

      if (scrapedOk) {
        sources.push("website_scraping");
        actions.push({ date: now, type: "enrichissement", detail: `Site web scrappé : ${emails.length} email(s) trouvé(s)` });
      }

      if (emails.length > 0) {
        // Préférer l'email du dirigeant si présent, sinon le premier
        emailTrouve = emails[0];
        emailSource = "website_scraping";
        actions.push({ date: now, type: "enrichissement", detail: `Email trouvé : ${emailTrouve}` });
      } else {
        // Générer des patterns si pas d'email trouvé
        emailPatterns = generateEmailPatterns(dirigeantPrincipal, domaine);
        emailSource   = "pattern_email";
        sources.push("pattern_email");
        actions.push({ date: now, type: "enrichissement", detail: `Pas d'email trouvé, ${emailPatterns.length} patterns générés` });
      }

      // Téléphone depuis le site si pas déjà connu
      if (phones.length > 0 && !patch.telephonePro) {
        patch.telephonePro = phones[0];
      }
    }

    // 3. Construire le patch final
    if (emailTrouve) {
      patch.emailDirigeant = emailTrouve;
      patch.emailSource    = emailSource;
      patch.emailVerifie   = false;
      patch.statut         = "email_trouve";
    } else if (emailPatterns.length > 0) {
      // On stocke le premier pattern (le plus probable: prenom.nom@)
      patch.emailDirigeant = emailPatterns[0];
      patch.emailSource    = "pattern_email";
      patch.emailVerifie   = false;
      patch.statut         = "enrichi";
    } else if (siteWeb) {
      patch.statut = "enrichi";
    }

    patch.sources     = sources;
    patch.enrichiAt   = now;
    patch.actions     = actions;

    // 4. Sauvegarder
    const { dbUpdateProspect } = await import("@/lib/db-prospection");
    const updated = await dbUpdateProspect(prospectId, patch);

    return NextResponse.json({
      ok:           true,
      prospect:     updated,
      emailFound:   !!emailTrouve,
      emailPatterns,
      siteFound:    !!siteWeb,
    });
  } catch (err) {
    console.error("[prospection/enrich]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
