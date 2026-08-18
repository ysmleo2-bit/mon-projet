/**
 * POST /api/prospection/enrich
 * Enrichit un prospect : site web (Google Places v1), emails (scraping), téléphone,
 * données SIRENE complémentaires, vérification adresse BAN
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Normalisation numéro FR ───────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/\s|\.|–|-/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw;
}

// ── Scraping site web ─────────────────────────────────────────────────────────
async function scrapeWebsiteContacts(rawUrl: string): Promise<{
  emails:  string[];
  phones:  string[];
  scrapedOk: boolean;
}> {
  const cleanUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  // Regex téléphone France plus complète : gère formats "Tél :", "☎", "Tel:", "+33", espaces points tirets
  const PHONE_RE = /(?:(?:\+33|0033|0)[1-9])(?:[\s.\-]?\d{2}){4}/g;

  const pages = [
    cleanUrl,
    `${cleanUrl}/contact`,
    `${cleanUrl}/nous-contacter`,
    `${cleanUrl}/contactez-nous`,
    `${cleanUrl}/contact.html`,
    `${cleanUrl}/contact/`,
    `${cleanUrl}/a-propos`,
    `${cleanUrl}/about`,
  ];

  const emails = new Set<string>();
  const phones = new Set<string>();
  let scrapedOk = false;

  const IGNORE_DOMAINS = [
    "example.com","domain.com","email.com","yoursite","sentry",
    "google","facebook","twitter","linkedin","instagram","youtube",
    "wixpress","shopify","wordpress","squarespace",
  ];
  const IGNORE_EXTS = [".png",".jpg",".gif",".svg",".webp",".ico",".pdf",".css",".js"];

  for (const url of pages) {
    try {
      const res = await fetch(url, {
        signal:   AbortSignal.timeout(5_000),
        headers:  { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/1.0; +https://coldcaller.app)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      scrapedOk  = true;

      // ── Emails ──
      // Aussi chercher les mailto: links obfusqués
      const deobfuscated = html
        .replace(/\[at\]|\(at\)/gi, "@")
        .replace(/\[dot\]|\(dot\)/gi, ".");
      const found = deobfuscated.match(EMAIL_RE) ?? [];
      for (const e of found) {
        const lower = e.toLowerCase();
        if (IGNORE_DOMAINS.some((d) => lower.includes(d))) continue;
        if (IGNORE_EXTS.some((x) => lower.endsWith(x))) continue;
        if (lower.length > 80) continue;
        emails.add(lower);
      }

      // ── Téléphones ──
      const telMatches = html.match(PHONE_RE) ?? [];
      for (const t of telMatches) {
        const normalized = normalizePhone(t);
        if (normalized) phones.add(normalized);
      }

      if (emails.size > 0) break; // stop dès qu'on a un email
    } catch { continue; }
  }

  return { emails: Array.from(emails), phones: Array.from(phones), scrapedOk };
}

// ── Google Places v1 (site + téléphone) ──────────────────────────────────────
async function findViaGooglePlaces(nom: string, ville?: string): Promise<{
  siteWeb?: string;
  phone?:   string;
} | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const query = `${nom}${ville ? " " + ville : ""} France`;
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method:  "POST",
        headers: {
          "Content-Type":     "application/json",
          "X-Goog-Api-Key":   key,
          "X-Goog-FieldMask": "places.websiteUri,places.nationalPhoneNumber",
        },
        body:   JSON.stringify({ textQuery: query, languageCode: "fr", pageSize: 1 }),
        signal: AbortSignal.timeout(6_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { places?: Array<{ websiteUri?: string; nationalPhoneNumber?: string }> };
    const place = data.places?.[0];
    if (!place) return null;
    return {
      siteWeb: place.websiteUri?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      phone:   place.nationalPhoneNumber ? normalizePhone(place.nationalPhoneNumber) : undefined,
    };
  } catch { return null; }
}

// ── Données SIRENE supplémentaires (dirigeants, date, effectifs) ──────────────
async function fetchSireneExtra(siren: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    return data.results?.[0] ?? null;
  } catch { return null; }
}

// ── Vérification adresse via BAN ──────────────────────────────────────────────
async function verifyAddress(adresse: string, codePostal?: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(adresse + (codePostal ? " " + codePostal : ""));
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${q}&limit=1`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { features?: Array<{ properties?: { label?: string } }> };
    return data.features?.[0]?.properties?.label ?? null;
  } catch { return null; }
}

// ── Génération patterns d'email ───────────────────────────────────────────────
function generateEmailPatterns(dirigeant: string | undefined, domaine: string): string[] {
  if (!dirigeant) {
    return [`contact@${domaine}`, `info@${domaine}`, `direction@${domaine}`];
  }
  const parts  = dirigeant.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
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
  ].filter((e) => e.length > 5 && !e.startsWith("@") && !e.startsWith("."));
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    prospectId:          string;
    siren:               string;
    nom:                 string;
    ville?:              string;
    adresse?:            string;
    codePostal?:         string;
    siteWeb?:            string;
    telephonePro?:       string;
    dirigeantPrincipal?: string;
  };

  const { prospectId, siren, nom, ville, adresse, codePostal, dirigeantPrincipal } = body;
  let { siteWeb, telephonePro } = body;

  const now     = new Date().toISOString();
  const actions: ProspectAction[] = [];
  const sources: DataSource[]     = ["sirene"];
  const patch: Partial<Prospect>  = { updatedAt: now };

  try {
    // ── 1. Lancer en parallèle : Google Places + SIRENE extra ─────────────────
    const [placesResult, sireneExtra] = await Promise.all([
      (!siteWeb || !telephonePro) && process.env.GOOGLE_MAPS_API_KEY
        ? findViaGooglePlaces(nom, ville)
        : Promise.resolve(null),
      siren ? fetchSireneExtra(siren) : Promise.resolve(null),
    ]);

    // Appliquer résultats Google Places
    if (placesResult) {
      if (placesResult.siteWeb && !siteWeb) {
        siteWeb = placesResult.siteWeb;
        patch.siteWeb = siteWeb;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Site web trouvé : ${siteWeb}` });
      }
      if (placesResult.phone && !telephonePro) {
        telephonePro = placesResult.phone;
        patch.telephonePro = telephonePro;
        actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé via Google : ${telephonePro}` });
      }
    }

    // Appliquer données SIRENE complémentaires
    if (sireneExtra) {
      const siege = sireneExtra.siege as Record<string, unknown> | undefined;
      if (!telephonePro && siege?.telephone) {
        const rawPhone = String(siege.telephone);
        telephonePro = normalizePhone(rawPhone.replace(/^\+33\s?/, "0"));
        patch.telephonePro = telephonePro;
        actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé SIRENE : ${telephonePro}` });
      }
      if (!siteWeb && siege?.site_internet) {
        const rawSite = String(siege.site_internet);
        siteWeb = rawSite.replace(/^https?:\/\//, "").replace(/\/$/, "");
        patch.siteWeb = siteWeb;
        actions.push({ date: now, type: "enrichissement", detail: `Site trouvé SIRENE : ${siteWeb}` });
      }
      // Mise à jour dirigeants si manquants
      const dirigeants = sireneExtra.dirigeants as Array<{ nom?: string; prenoms?: string; qualite?: string }> | undefined;
      if (dirigeants?.length) {
        const physiques = dirigeants.filter((d) => d.nom);
        if (physiques.length > 0) {
          const principal = physiques[0];
          const fullName  = [principal.prenoms, principal.nom].filter(Boolean).join(" ");
          if (fullName) {
            patch.dirigeantPrincipal = fullName;
            patch.fonctionDirigeant  = principal.qualite;
            patch.dirigeants = physiques.map((d) => ({
              nom:     d.nom ?? "",
              prenoms: d.prenoms,
              qualite: d.qualite,
            }));
          }
        }
      }
    }

    // ── 2. Scraper le site web pour emails + téléphone ────────────────────────
    let emailTrouve: string | undefined;
    let emailPatterns: string[] = [];
    let emailSource: DataSource = "website_scraping";

    if (siteWeb) {
      const domaine = siteWeb.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
      const { emails, phones, scrapedOk } = await scrapeWebsiteContacts(siteWeb);

      if (scrapedOk) {
        sources.push("website_scraping");
        actions.push({ date: now, type: "enrichissement", detail: `Site scrappé : ${emails.length} email(s), ${phones.length} tél.` });
      }

      if (emails.length > 0) {
        // Préférer email contenant le nom du dirigeant
        const dirLower = (dirigeantPrincipal ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const dirParts = dirLower.split(/\s+/).filter((p) => p.length > 2);
        emailTrouve = emails.find((e) => dirParts.some((p) => e.includes(p))) ?? emails[0];
        emailSource = "website_scraping";
        actions.push({ date: now, type: "enrichissement", detail: `Email trouvé : ${emailTrouve}` });
      } else {
        emailPatterns = generateEmailPatterns(dirigeantPrincipal, domaine);
        emailSource   = "pattern_email";
        sources.push("pattern_email");
        actions.push({ date: now, type: "enrichissement", detail: `${emailPatterns.length} patterns email générés` });
      }

      if (phones.length > 0 && !patch.telephonePro) {
        patch.telephonePro = phones[0];
        actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé site : ${phones[0]}` });
      }
    }

    // ── 3. Vérification adresse BAN (en parallèle si possible) ───────────────
    if (adresse && !patch.adresseVerifiee) {
      const verified = await verifyAddress(adresse, codePostal);
      if (verified) {
        (patch as any).adresseVerifiee = verified;
        actions.push({ date: now, type: "enrichissement", detail: `Adresse vérifiée : ${verified}` });
      }
    }

    // ── 4. Patch final ─────────────────────────────────────────────────────────
    if (emailTrouve) {
      patch.emailDirigeant = emailTrouve;
      patch.emailSource    = emailSource;
      patch.emailVerifie   = false;
      patch.statut         = "email_trouve";
    } else if (emailPatterns.length > 0) {
      patch.emailDirigeant = emailPatterns[0];
      patch.emailSource    = "pattern_email";
      patch.emailVerifie   = false;
      patch.statut         = "enrichi";
    } else if (siteWeb) {
      patch.statut = "enrichi";
    }

    patch.sources   = Array.from(new Set(sources)) as DataSource[];
    patch.enrichiAt = now;
    patch.actions   = actions;

    const { dbUpdateProspect } = await import("@/lib/db-prospection");
    const updated = await dbUpdateProspect(prospectId, patch);

    return NextResponse.json({
      ok:           true,
      prospect:     updated,
      emailFound:   !!emailTrouve,
      emailPatterns,
      siteFound:    !!siteWeb,
      phoneFound:   !!(patch.telephonePro),
    });
  } catch (err) {
    console.error("[prospection/enrich]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
