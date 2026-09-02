/**
 * POST /api/prospection/enrich
 * Enrichit un prospect avec téléphone, site web et email.
 *
 * Architecture (< 25s) :
 *  1. Google Places API + SIRENE extra → site + tél (parallèle, max 5s)
 *  2. Apify Maps scraper (fallback si pas de tél) + scraping site → email (parallèle, max 20s)
 *
 * Apify crawler-google-places est utilisé en fallback quand Google Places API
 * ne trouve pas de téléphone — couverture ~85 % vs ~40 % pour l'API seule.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// ── Normalisation numéro FR ───────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.–\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

function isValidFrPhone(p: string): boolean {
  const digits = p.replace(/\s/g, "");
  return /^0[1-9]\d{8}$/.test(digits);
}

// ── Google Places (ancienne API Maps — Text Search + Details) ────────────────
// Flux : Text Search (place_id + name + adresse) → validation nom + ville → Place Details
//
// Seuil de similarité relevé à 0.38 (était 0.20) pour éviter les faux positifs.
// Validation géographique ajoutée : si on a une ville, l'adresse Google doit la contenir.
const PLACES_MIN_SIMILARITY = 0.38;

/** Normalise une chaîne pour comparaison ville / adresse */
function normCity(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[-_]/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Vérifie qu'une adresse contient la ville attendue (comparaison souple) */
function cityMatchesAddress(ville: string, address: string, codePostal?: string): boolean {
  const addrN  = normCity(address);
  const villeN = normCity(ville);

  // Ville directement dans l'adresse
  if (addrN.includes(villeN)) return true;

  // Code postal départemental (ex: "69" pour Lyon)
  if (codePostal && addrN.includes(codePostal.slice(0, 2))) return true;

  // Premiers mots de la ville (utile pour "Saint-Étienne" vs "saint etienne")
  const villeWords = villeN.split(" ").filter((w) => w.length > 3);
  if (villeWords.length > 0 && villeWords.every((w) => addrN.includes(w))) return true;

  return false;
}

async function findViaGooglePlaces(nom: string, ville?: string, codePostal?: string): Promise<{
  siteWeb?: string;
  phone?:   string;
} | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const ville_ = ville ?? "";

  // Variantes de requête : du plus précis au plus court
  const nomCourt = nom.split(/\s+/).slice(0, 4).join(" ");
  const nomTres  = nom.split(/\s+/).slice(0, 2).join(" ");
  const queriesRaw = [
    `${nom} ${ville_} France`,
    `${nomCourt} ${ville_} France`,
    `${nomTres} ${ville_} France`,
  ];
  const queries = queriesRaw.filter((q, i) => queriesRaw.indexOf(q) === i);

  for (const query of queries) {
    try {
      // 1. Text Search → place_id + name + formatted_address
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?`
        + `query=${encodeURIComponent(query)}&language=fr&key=${key}`;

      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5_000) });
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json() as {
        status:   string;
        results?: Array<{ place_id?: string; name?: string; formatted_address?: string }>;
      };

      if (searchData.status !== "OK" || !searchData.results?.length) continue;

      // Essayer les 3 premiers résultats au lieu du seul premier
      for (const hit of searchData.results.slice(0, 3)) {
        if (!hit.place_id) continue;

        // ── Validation 1 : similarité du nom ─────────────────────────────────
        const placeName  = hit.name ?? "";
        const similarity = diceSimilarity(nom, placeName);
        if (similarity < PLACES_MIN_SIMILARITY) {
          console.info(`[places] skip "${placeName}" for "${nom}" — sim ${similarity.toFixed(2)}`);
          continue;
        }

        // ── Validation 2 : cohérence géographique ─────────────────────────────
        // Si on a une ville, l'adresse doit la contenir — évite les faux positifs inter-villes
        if (ville_ && hit.formatted_address) {
          if (!cityMatchesAddress(ville_, hit.formatted_address, codePostal)) {
            console.info(`[places] city mismatch for "${nom}" — wanted "${ville_}", got "${hit.formatted_address}"`);
            continue;
          }
        }

        // 2. Place Details → téléphone + site
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?`
          + `place_id=${hit.place_id}&fields=formatted_phone_number,website&language=fr&key=${key}`;

        const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(4_000) });
        if (!detailRes.ok) continue;

        const detail = await detailRes.json() as {
          status: string;
          result?: { formatted_phone_number?: string; website?: string };
        };

        if (detail.status !== "OK") continue;

        const phone = detail.result?.formatted_phone_number
          ? normalizePhone(detail.result.formatted_phone_number)
          : undefined;

        let siteWeb: string | undefined;
        if (detail.result?.website) {
          const raw = detail.result.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
          if (!isWebsiteBlacklisted(raw)) siteWeb = raw;
        }

        if (phone || siteWeb) return { phone, siteWeb };
      }
    } catch { continue; }
  }

  return null;
}

// ── Données SIRENE supplémentaires ────────────────────────────────────────────
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

// ── Domaines à ignorer pour sites web ────────────────────────────────────────
// Sites qui ne sont clairement pas le site de l'entreprise cherchée
const WEBSITE_BLACKLIST_DOMAINS = [
  // Banques & finance
  "credit-agricole","creditagricole","lcl.fr","bnpparibas","societegenerale",
  "caisse-epargne","caisseepargne","banquepostale","labanquepostale",
  "cic.fr","hsbc.fr","boursorama","fortuneo","ing.fr","axabanque",
  // Portails / annuaires
  "pagesjaunes","pagesblanches","societe.com","infogreffe","pappers",
  "verif.com","manageo","kompass","europages","corporama","nomination.fr",
  "societeinfo","annuaire-mairie","annuaire.free","11870.com","118000",
  // Réseaux sociaux & plateformes
  "facebook","instagram","linkedin","twitter","tiktok","youtube",
  "google","apple","microsoft","amazon","ebay","leboncoin","seloger",
  // CMS / hébergeurs (pas le site réel)
  "wixpress","wix.com","squarespace","shopify","wordpress.com","blogger",
  "jimdo","webflow","strikingly","webnode",
  // Divers
  "example.com","domain.com","sentry","localhost",
  "mail.fr","laposte.net","orange.fr","free.fr","sfr.fr","bbox.fr",
];

function isWebsiteBlacklisted(site: string): boolean {
  const lower = site.toLowerCase();
  return WEBSITE_BLACKLIST_DOMAINS.some((blocked) => lower.includes(blocked));
}

// ── Emails à ignorer ──────────────────────────────────────────────────────────
const EMAIL_BLACKLIST_PATTERNS = [
  /^adresse@/i,
  /^email@/i,
  /^exemple@/i,
  /^example@/i,
  /^test@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^notifications@/i,
  /^newsletter@/i,
  /^mailer@/i,
  /^bounce@/i,
  /^postmaster@/i,
  /^webmaster@/i,
  /^admin@(?:mail|email|domain|example)/i,
  // Domaines génériques non professionnels
  /@mail\.fr$/i,
  /@adresse\.fr$/i,
  /@example\.com$/i,
  /@domain\.com$/i,
];

function isEmailBlacklisted(email: string): boolean {
  return EMAIL_BLACKLIST_PATTERNS.some((re) => re.test(email));
}

// ── Similarité de nom d'entreprise (Dice coefficient sur bigrammes) ───────────
function diceSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, " ").trim();
  const bigrams = (s: string): string[] => {
    const words = normalize(s).split(/\s+/).join("");
    const arr: string[] = [];
    for (let i = 0; i < words.length - 1; i++) arr.push(words.slice(i, i + 2));
    return arr;
  };
  const sa = bigrams(a), sb = bigrams(b);
  const sbSet = new Set<string>(sb);
  const intersection = sa.filter((g) => sbSet.has(g)).length;
  return (2 * intersection) / (sa.length + sb.length) || 0;
}

// ── Apify Google Maps (fallback quand Google Places API ne trouve pas de tél) ──
// Utilise compass/crawler-google-places — 85 % de couverture téléphonique
// Timeout court (20s) car on cherche 1 seul résultat
interface ApifyPlace {
  title?: string; name?: string;
  phone?: string; phoneUnformatted?: string;
  website?: string;
  totalScore?: number; reviewsCount?: number;
  openingHours?: Array<{ day: string; hours: string }>;
  placeId?: string; googleMapsUrl?: string; url?: string;
  permanentlyClosed?: boolean;
}

async function findViaApifyMaps(nom: string, ville?: string, codePostal?: string): Promise<{
  phone?:    string;
  siteWeb?:  string;
  placeId?:  string;
  mapsUrl?:  string;
  rating?:   number;
} | null> {
  if (!process.env.APIFY_TOKEN) return null;

  const location = codePostal ?? ville ?? "France";
  const query    = `${nom} ${location}`;

  try {
    const { runApifyActor } = await import("@/lib/apify");
    const results = await runApifyActor<ApifyPlace>(
      "compass/crawler-google-places",
      {
        searchStringsArray:        [query],
        maxCrawledPlacesPerSearch: 3,          // 1 seul résultat suffit
        language:                  "fr",
        countryCode:               "fr",
        includeOpeningHours:       false,
        includeHistogram:          false,
        includePeopleAlsoSearch:   false,
        additionalInfo:            false,
        exportPlaceUrls:           false,
        scrapeDirectories:         false,
        deeperCityScrape:          false,
      },
      20,   // wait 20s max
    );

    // Filtrer les fermés définitifs, prendre le 1er avec le plus de similarité
    const active = results.filter((r) => !r.permanentlyClosed);
    if (!active.length) return null;

    // Garder celui dont le nom est le plus proche du prospect
    const best = active
      .map((r) => ({ r, score: diceSimilarity(nom, r.title ?? r.name ?? "") }))
      .filter(({ score }) => score >= 0.32)  // was 0.15 — évite les faux positifs
      .sort((a, b) => b.score - a.score)[0]?.r;

    if (!best) return null;

    const rawPhone = best.phone ?? best.phoneUnformatted;
    const phone    = rawPhone ? normalizePhone(rawPhone) : undefined;
    const validPhone = phone && isValidFrPhone(phone) ? phone : undefined;

    let siteWeb: string | undefined;
    if (best.website) {
      const raw = best.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!isWebsiteBlacklisted(raw)) siteWeb = raw;
    }

    if (!validPhone && !siteWeb) return null;

    return {
      phone:   validPhone,
      siteWeb,
      placeId: best.placeId,
      mapsUrl: best.googleMapsUrl ?? best.url,
      rating:  best.totalScore,
    };
  } catch (err) {
    // Silencieux — Apify est un fallback, pas bloquant
    console.warn("[enrich/apify-maps] fallback failed:", err);
    return null;
  }
}

// ── Scraping site web (rapide, 1 page principale + contact) ──────────────────
// Priorité : liens tel: (fiables) > regex texte. Si > 4 numéros distincts trouvés
// → probable site agrégateur ou annuaire → on ignore les résultats (trop de bruit).
async function scrapeWebsiteContacts(rawUrl: string): Promise<{
  emails: string[];
  phones: string[];
}> {
  const cleanUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const PHONE_RE = /(?:(?:\+33|0033|0)[1-9])(?:[\s.\-]?\d{2}){4}/g;

  const IGNORE_DOMAINS = [
    "example.com","domain.com","sentry","google","facebook","twitter",
    "linkedin","instagram","youtube","wixpress","shopify","wordpress","squarespace",
  ];

  const emails   = new Set<string>();
  // Deux pools séparés : tel: links (fiables) et regex texte (bruit potentiel)
  const telLinks = new Set<string>();
  const textPhones = new Set<string>();

  for (const url of [cleanUrl, `${cleanUrl}/contact`, `${cleanUrl}/nous-contacter`]) {
    try {
      const res = await fetch(url, {
        signal:   AbortSignal.timeout(3_500),
        headers:  { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/2.0; +https://coldcaller.io)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();

      // ── Emails ──────────────────────────────────────────────────────────────
      const deobf = html.replace(/\[at\]|\(at\)/gi, "@").replace(/\[dot\]|\(dot\)/gi, ".");
      for (const e of (deobf.match(EMAIL_RE) ?? [])) {
        const lower = e.toLowerCase();
        if (!IGNORE_DOMAINS.some((d) => lower.includes(d)) && !isEmailBlacklisted(lower) && lower.length <= 80)
          emails.add(lower);
      }

      // ── Téléphones : liens tel: (PRIORITÉ — très fiables) ──────────────────
      for (const m of Array.from(html.matchAll(/href="tel:([^"]+)"/gi))) {
        const n = normalizePhone(m[1].replace(/\s/g, ""));
        if (isValidFrPhone(n)) telLinks.add(n);
      }

      // ── Téléphones : regex texte (plus de bruit) ────────────────────────────
      for (const t of (html.match(PHONE_RE) ?? [])) {
        const n = normalizePhone(t);
        if (isValidFrPhone(n)) textPhones.add(n);
      }

      if (emails.size > 0) break;
    } catch { continue; }
  }

  // ── Sélection finale des numéros ────────────────────────────────────────────
  // Priorité aux liens tel:. Si > 4 numéros regex distincts sans aucun tel:
  // → probablement un site agrégateur → ignorer les regex, ne garder que les tel:
  let phones: string[];
  if (telLinks.size > 0) {
    // On prend d'abord les tel: links, puis les regex en complément (si distincts)
    const combined = new Set<string>([...telLinks]);
    for (const p of textPhones) {
      if (!Array.from(telLinks).some((t) => t.replace(/\s/g,"") === p.replace(/\s/g,"")))
        combined.add(p);
    }
    phones = Array.from(combined).slice(0, 3);
  } else if (textPhones.size <= 4) {
    // Peu de numéros : probablement le site de l'entreprise
    phones = Array.from(textPhones).slice(0, 2);
  } else {
    // Trop de numéros sans aucun tel: link → agrégateur/annuaire → ignorer
    console.info(`[scrape] trop de numéros (${textPhones.size}) sans tel: — probablement un agrégateur, ignoré`);
    phones = [];
  }

  return { emails: Array.from(emails), phones };
}

// ── Génération patterns d'email ───────────────────────────────────────────────
function generateEmailPatterns(dirigeant: string | undefined, domaine: string): string[] {
  if (!dirigeant) return [`contact@${domaine}`, `info@${domaine}`];
  const parts  = dirigeant.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/);
  const prenom = parts[0] ?? "";
  const nom    = parts[parts.length - 1] ?? "";
  return [
    `${prenom}.${nom}@${domaine}`,
    `${prenom.charAt(0)}.${nom}@${domaine}`,
    `contact@${domaine}`,
    `info@${domaine}`,
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
    libelleNaf?:         string;
  };

  const { prospectId, siren, nom, ville, adresse, codePostal, dirigeantPrincipal, libelleNaf } = body;
  let { siteWeb, telephonePro } = body;

  const now     = new Date().toISOString();
  const actions: ProspectAction[] = [];
  const sources: DataSource[]     = ["sirene"];
  const patch: Partial<Prospect>  = { updatedAt: now };

  try {
    // ── Phase 1 : Google Places + SIRENE extra en parallèle (max 5s) ──────────
    const [placesResult, sireneExtra] = await Promise.all([
      (!siteWeb || !telephonePro)
        ? findViaGooglePlaces(nom, ville, codePostal)  // passe codePostal pour validation géo
        : Promise.resolve(null),
      siren
        ? fetchSireneExtra(siren)
        : Promise.resolve(null),
    ]);

    // Résultats Google Places
    if (placesResult) {
      if (placesResult.siteWeb && !siteWeb) {
        siteWeb = placesResult.siteWeb;
        patch.siteWeb = siteWeb;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Site : ${siteWeb}` });
      }
      if (placesResult.phone && !telephonePro) {
        telephonePro = placesResult.phone;
        patch.telephonePro = telephonePro;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Tél Google Maps : ${telephonePro}` });
      }
    }

    // Résultats SIRENE complémentaires
    if (sireneExtra) {
      const siege = sireneExtra.siege as Record<string, unknown> | undefined;

      if (!telephonePro && siege?.telephone) {
        const n = normalizePhone(String(siege.telephone).replace(/^\+33\s?/, "0"));
        if (isValidFrPhone(n)) {
          telephonePro = n;
          patch.telephonePro = n;
          actions.push({ date: now, type: "enrichissement", detail: `Tél SIRENE : ${n}` });
        }
      }
      if (!siteWeb && siege?.site_internet) {
        const rawSite = String(siege.site_internet).replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (!isWebsiteBlacklisted(rawSite)) {
          siteWeb = rawSite;
          patch.siteWeb = siteWeb;
          actions.push({ date: now, type: "enrichissement", detail: `Site SIRENE : ${siteWeb}` });
        }
      }

      // Dirigeants
      const dirigeants = sireneExtra.dirigeants as Array<{ nom?: string; prenoms?: string; qualite?: string }> | undefined;
      if (dirigeants?.length) {
        const physiques = dirigeants.filter((d) => d.nom);
        if (physiques.length > 0) {
          const p0      = physiques[0];
          const fullName = [p0.prenoms, p0.nom].filter(Boolean).join(" ");
          if (fullName) {
            patch.dirigeantPrincipal = fullName;
            patch.fonctionDirigeant  = p0.qualite;
            patch.dirigeants = physiques.map((d) => ({
              nom: d.nom ?? "", prenoms: d.prenoms, qualite: d.qualite,
            }));
          }
        }
      }
    }

    // ── LinkedIn dirigeant (URL de recherche publique) ────────────────────────
    const dirName = patch.dirigeantPrincipal ?? dirigeantPrincipal;
    if (dirName) {
      const linkedinQuery = encodeURIComponent(`${dirName} ${nom}`);
      patch.linkedinDirigeant = `https://www.linkedin.com/search/results/people/?keywords=${linkedinQuery}`;
      actions.push({ date: now, type: "enrichissement", detail: `LinkedIn: ${dirName}` });
    }

    // ── Phase 2 : Scraping site web + Apify Maps fallback (en parallèle) ───────
    let emailTrouve: string | undefined;
    let emailPatterns: string[] = [];

    // Apify Maps : lancé uniquement si on n'a pas encore de téléphone
    const needsApify = !telephonePro && !patch.telephonePro;

    const [scrapeResult, apifyResult] = await Promise.all([
      siteWeb ? scrapeWebsiteContacts(siteWeb) : Promise.resolve({ emails: [], phones: [] }),
      needsApify
        ? findViaApifyMaps(nom, ville, codePostal)
        : Promise.resolve(null),
    ]);

    // Résultats scraping site
    if (siteWeb) {
      const { emails, phones } = scrapeResult;
      const domaine = siteWeb.split("/")[0].replace(/^www\./, "");
      const validEmails = emails.filter((e) => !isEmailBlacklisted(e));

      if (validEmails.length > 0) {
        sources.push("website_scraping");
        const dirLower = (dirigeantPrincipal ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const dirParts = dirLower.split(/\s+/).filter((p) => p.length > 2);
        emailTrouve = validEmails.find((e) => dirParts.some((p) => e.includes(p))) ?? validEmails[0];
        actions.push({ date: now, type: "enrichissement", detail: `Email : ${emailTrouve}` });
      } else if (!isWebsiteBlacklisted(domaine)) {
        emailPatterns = generateEmailPatterns(dirigeantPrincipal, domaine).filter(
          (e) => !isEmailBlacklisted(e)
        );
        if (emailPatterns.length > 0) {
          sources.push("pattern_email");
          actions.push({ date: now, type: "enrichissement", detail: `${emailPatterns.length} patterns email` });
        }
      }

      if (phones.length > 0 && !patch.telephonePro) {
        patch.telephonePro = phones[0];
        actions.push({ date: now, type: "enrichissement", detail: `Tél site : ${phones[0]}` });
      }
    }

    // Résultats Apify Google Maps
    if (apifyResult) {
      if (apifyResult.phone && !patch.telephonePro) {
        patch.telephonePro = apifyResult.phone;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Tél Google Maps (Apify) : ${apifyResult.phone}` });
      }
      if (apifyResult.siteWeb && !siteWeb && !patch.siteWeb) {
        patch.siteWeb = apifyResult.siteWeb;
        siteWeb = apifyResult.siteWeb;
        sources.push("google_places");
        actions.push({ date: now, type: "enrichissement", detail: `Site Maps : ${apifyResult.siteWeb}` });
      }
      // Stocker les métadonnées Maps (note, placeId, lien Maps) sans changer l'interface
      if (apifyResult.placeId) patch.placeId = apifyResult.placeId;
      if (apifyResult.mapsUrl) patch.googleMapsUrl = apifyResult.mapsUrl;
      if (apifyResult.rating)  patch.rating = apifyResult.rating;
    }

    // ── Patch final ───────────────────────────────────────────────────────────
    if (emailTrouve && !isEmailBlacklisted(emailTrouve)) {
      patch.emailDirigeant = emailTrouve;
      patch.emailSource    = "website_scraping";
      patch.emailVerifie   = false;
      patch.statut         = "email_trouve";
    } else if (emailPatterns.length > 0) {
      // Pattern : afficher le premier candidat uniquement (pas stocké comme email vérifié)
      patch.emailDirigeant = emailPatterns[0];
      patch.emailSource    = "pattern_email";
      patch.emailVerifie   = false;
      patch.statut         = "enrichi";
    } else if (siteWeb || patch.telephonePro) {
      patch.statut = "enrichi";
    }

    patch.sources   = Array.from(new Set(sources)) as DataSource[];
    patch.enrichiAt = now;
    if (actions.length > 0) patch.actions = actions;

    // Build the full patch including raw identification fields for the upsert fallback
    const fullPatch = {
      ...patch,
      siren:      siren      || undefined,
      nom:        nom        || undefined,
      ville:      ville      || undefined,
      adresse:    adresse    || undefined,
      codePostal: codePostal || undefined,
    };

    // Try to persist — but even if the DB crashes, return the enrichment data
    // so the UI can display the phone/site immediately.
    let updated: import("@/lib/types-prospection").Prospect | null = null;
    let dbError: string | undefined;
    try {
      const { dbUpdateProspect } = await import("@/lib/db-prospection");
      updated = await dbUpdateProspect(prospectId, fullPatch);
    } catch (dbErr) {
      console.error("[prospection/enrich] DB error:", dbErr);
      dbError = dbErr instanceof Error
        ? `${dbErr.message}\n${dbErr.stack ?? ""}`
        : String(dbErr);
      // Build a synthetic in-memory prospect so the caller still gets data
      updated = {
        id:            prospectId,
        siren:         siren         ?? "",
        nom:           nom           ?? "",
        codeNaf:       "",
        libelleNaf:    libelleNaf    ?? "",
        secteur:       "",
        adresse:       adresse       ?? "",
        ville,
        codePostal,
        dirigeants:    [],
        statut:        (patch.statut ?? "enrichi") as import("@/lib/types-prospection").ProspectStatut,
        sources:       patch.sources ?? ["sirene"],
        actions:       patch.actions ?? [],
        createdAt:     now,
        updatedAt:     now,
        telephonePro,
        siteWeb,
        ...patch,
      } as import("@/lib/types-prospection").Prospect;
    }

    return NextResponse.json({
      ok:           true,
      prospect:     updated,
      emailFound:   !!emailTrouve,
      emailPatterns,
      siteFound:    !!siteWeb,
      phoneFound:   !!(telephonePro ?? patch.telephonePro),
      ...(dbError ? { dbError } : {}),
      debug: {
        placesFound:       !!placesResult,
        placesPhone:       placesResult?.phone,
        placesSite:        placesResult?.siteWeb,
        sirenePhone:       (sireneExtra?.siege as Record<string,unknown>)?.telephone,
        sireneSite:        (sireneExtra?.siege as Record<string,unknown>)?.site_internet,
        websiteBlacklist:  siteWeb ? isWebsiteBlacklisted(siteWeb) : false,
        apifyUsed:         needsApify,
        apifyFound:        !!apifyResult,
        apifyPhone:        apifyResult?.phone,
        apifySite:         apifyResult?.siteWeb,
        apifyRating:       apifyResult?.rating,
      },
    });
  } catch (err) {
    console.error("[prospection/enrich]", err);
    const msg = err instanceof Error
      ? `${err.message}\n${err.stack ?? ""}`
      : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
