/**
 * POST /api/prospection/enrich
 * Enrichit un prospect : site web, emails, téléphone via plusieurs sources :
 *  1. Google Places v1 (site + tél)
 *  2. Pages Jaunes HTTP (tél — meilleure source pour artisans FR)
 *  3. Société.com (tél via SIREN)
 *  4. SIRENE complémentaire (dirigeants, date, effectifs)
 *  5. Scraping site web (emails, tél)
 *  6. BAN — vérification adresse
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Normalisation numéro FR ───────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.–-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

// Teste si une chaîne ressemble à un numéro FR valide
function isValidFrPhone(p: string): boolean {
  const digits = p.replace(/\s/g, "");
  return /^0[1-9]\d{8}$/.test(digits);
}

// ── Scraping site web ─────────────────────────────────────────────────────────
async function scrapeWebsiteContacts(rawUrl: string): Promise<{
  emails:  string[];
  phones:  string[];
  scrapedOk: boolean;
}> {
  const cleanUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
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
        signal:   AbortSignal.timeout(4_000),
        headers:  { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/1.0; +https://coldcaller.app)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      scrapedOk  = true;

      // Emails (déobfusqués)
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

      // Téléphones
      const telMatches = html.match(PHONE_RE) ?? [];
      for (const t of telMatches) {
        const normalized = normalizePhone(t);
        if (isValidFrPhone(normalized)) phones.add(normalized);
      }

      // Aussi tel: links
      const telLinks = html.match(/href="tel:([^"]+)"/gi) ?? [];
      for (const link of telLinks) {
        const raw = link.replace(/href="tel:/i, "").replace(/"$/, "");
        const n = normalizePhone(raw);
        if (isValidFrPhone(n)) phones.add(n);
      }

      if (emails.size > 0) break;
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
          "X-Goog-FieldMask": "places.websiteUri,places.nationalPhoneNumber,places.displayName",
        },
        body:   JSON.stringify({ textQuery: query, languageCode: "fr", pageSize: 1 }),
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      places?: Array<{
        websiteUri?: string;
        nationalPhoneNumber?: string;
        displayName?: { text?: string };
      }>
    };
    const place = data.places?.[0];
    if (!place) return null;
    return {
      siteWeb: place.websiteUri?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      phone:   place.nationalPhoneNumber ? normalizePhone(place.nationalPhoneNumber) : undefined,
    };
  } catch { return null; }
}

// ── Pages Jaunes HTTP (sans navigateur) ──────────────────────────────────────
// Source principale pour les artisans/PME françaises
async function searchPagesJaunesPhone(nom: string, ville?: string): Promise<string | null> {
  try {
    const quoi = encodeURIComponent(nom.toLowerCase());
    const ou   = encodeURIComponent((ville ?? "").toLowerCase());
    const url  = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${quoi}&ou=${ou}`;

    const res = await fetch(url, {
      signal:  AbortSignal.timeout(4_000),
      headers: {
        "User-Agent":       "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":  "fr-FR,fr;q=0.9",
        "Cache-Control":    "no-cache",
        "Referer":          "https://www.pagesjaunes.fr/",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Cloudflare challenge → abandon
    if (html.includes("_cf_chl_opt") || html.length < 3000) return null;

    // Extraire les liens tel: (format PJ: href="tel:0x xx xx xx xx")
    const TEL_LINK_RE = /href="tel:([^"]+)"/gi;
    let m: RegExpExecArray | null;
    const candidates: string[] = [];
    const re = new RegExp(TEL_LINK_RE.source, TEL_LINK_RE.flags);
    while ((m = re.exec(html)) !== null) {
      const n = normalizePhone(m[1]);
      if (isValidFrPhone(n)) candidates.push(n);
    }

    // Préférer un 04/05 (Sud/Ouest) ou 01-09 mobile —  retourner le premier
    return candidates[0] ?? null;
  } catch { return null; }
}

// ── Société.com par SIREN ────────────────────────────────────────────────────
// Accès direct par SIREN → récupère le téléphone si disponible
async function searchSocieteComPhone(siren: string): Promise<string | null> {
  try {
    // Chercher via leur moteur de recherche par SIREN
    const res = await fetch(
      `https://www.societe.com/cgi-bin/search?champs=${siren}`,
      {
        signal:  AbortSignal.timeout(4_000),
        headers: {
          "User-Agent":      "Mozilla/5.0 (compatible; ColdCaller/1.0)",
          "Accept":          "text/html",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
        redirect: "follow",
      }
    );
    if (!res.ok) return null;
    const html = await res.text();

    // Extraire tel: ou patterns téléphone
    const TEL_LINK = /href="tel:([^"]+)"/i.exec(html);
    if (TEL_LINK) {
      const n = normalizePhone(TEL_LINK[1]);
      if (isValidFrPhone(n)) return n;
    }

    // Pattern texte "01 23 45 67 89" ou "01.23.45.67.89"
    const TEL_TEXT = /\b(0[1-9](?:[\s.]{1}\d{2}){4})\b/.exec(html);
    if (TEL_TEXT) {
      const n = normalizePhone(TEL_TEXT[1]);
      if (isValidFrPhone(n)) return n;
    }

    return null;
  } catch { return null; }
}

// ── Données SIRENE supplémentaires (dirigeants, date, effectifs) ──────────────
async function fetchSireneExtra(siren: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`,
      { signal: AbortSignal.timeout(4_000) }
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
      { signal: AbortSignal.timeout(3_000) }
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
    // ── 1. Lancer 4 sources en parallèle ─────────────────────────────────────
    const needPhone = !telephonePro;
    const needSite  = !siteWeb;

    const [placesResult, sireneExtra, pjPhone, societePhone] = await Promise.all([
      (needSite || needPhone) && process.env.GOOGLE_MAPS_API_KEY
        ? findViaGooglePlaces(nom, ville)
        : Promise.resolve(null),
      siren
        ? fetchSireneExtra(siren)
        : Promise.resolve(null),
      needPhone
        ? searchPagesJaunesPhone(nom, ville)
        : Promise.resolve(null),
      needPhone && siren
        ? searchSocieteComPhone(siren)
        : Promise.resolve(null),
    ]);

    // ── Appliquer résultats Google Places ─────────────────────────────────────
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
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé via Google : ${telephonePro}` });
      }
    }

    // ── Appliquer Pages Jaunes ────────────────────────────────────────────────
    if (pjPhone && !telephonePro) {
      telephonePro = pjPhone;
      patch.telephonePro = telephonePro;
      sources.push("pages_jaunes" as DataSource);
      actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé Pages Jaunes : ${telephonePro}` });
    }

    // ── Appliquer Société.com ─────────────────────────────────────────────────
    if (societePhone && !telephonePro) {
      telephonePro = societePhone;
      patch.telephonePro = telephonePro;
      actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé société.com : ${telephonePro}` });
    }

    // ── Appliquer données SIRENE complémentaires ──────────────────────────────
    if (sireneExtra) {
      const siege = sireneExtra.siege as Record<string, unknown> | undefined;
      if (!telephonePro && siege?.telephone) {
        const rawPhone = String(siege.telephone);
        telephonePro = normalizePhone(rawPhone.replace(/^\+33\s?/, "0"));
        if (isValidFrPhone(telephonePro)) {
          patch.telephonePro = telephonePro;
          actions.push({ date: now, type: "enrichissement", detail: `Tél trouvé SIRENE : ${telephonePro}` });
        } else {
          telephonePro = body.telephonePro; // reset
        }
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

    // ── 3. Vérification adresse BAN ──────────────────────────────────────────
    if (adresse && !patch.adresseVerifiee) {
      const verified = await verifyAddress(adresse, codePostal);
      if (verified) {
        patch.adresseVerifiee = verified;
        actions.push({ date: now, type: "enrichissement", detail: `Adresse vérifiée : ${verified}` });
      }
    }

    // ── 4. Patch final ────────────────────────────────────────────────────────
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
      phoneSource:  pjPhone && patch.telephonePro === pjPhone ? "pages_jaunes"
                  : placesResult?.phone && patch.telephonePro === placesResult.phone ? "google_places"
                  : societePhone && patch.telephonePro === societePhone ? "societe_com"
                  : "sirene",
    });
  } catch (err) {
    console.error("[prospection/enrich]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
