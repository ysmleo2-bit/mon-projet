/**
 * POST /api/prospection/enrich
 * Enrichit un prospect avec téléphone, site web et email.
 *
 * Architecture rapide (< 8s) pour rester sous la limite Vercel Hobby :
 *  1. Google Places (multiple requêtes intelligentes) → site + tél
 *  2. SIRENE extra (dirigeants, site, tél)
 *  Les deux en parallèle, max 5s chacun.
 *  3. Scraping site web → email (3s, 1 seule page)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

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
// L'API Places v1 ("New") nécessite une activation séparée.
// L'ancienne API Maps est universellement activée sur la même clé.
//
// Flux : Text Search (place_id + name) → validation similarité → Place Details (tél + site)
// Seuil de similarité : 0.25 (Dice sur bigrammes) — suffisant pour les abréviations courantes.
const PLACES_MIN_SIMILARITY = 0.20;

async function findViaGooglePlaces(nom: string, ville?: string): Promise<{
  siteWeb?: string;
  phone?:   string;
} | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const ville_ = ville ?? "";

  // Variantes de requête : du nom complet au nom court (4 mots puis 2 mots)
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
      // 1. Text Search → place_id + name (pour validation)
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?`
        + `query=${encodeURIComponent(query)}&language=fr&key=${key}`;

      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5_000) });
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json() as {
        status:   string;
        results?: Array<{ place_id?: string; name?: string }>;
      };

      if (searchData.status !== "OK" || !searchData.results?.length) continue;

      const hit = searchData.results[0];
      if (!hit.place_id) continue;

      // ── Validation : le nom retourné par Places doit ressembler au nom cherché ──
      // Évite les faux positifs (banque voisine, établissement homonyme…)
      const placeName = hit.name ?? "";
      const similarity = diceSimilarity(nom, placeName);
      if (similarity < PLACES_MIN_SIMILARITY) {
        console.info(
          `[places] skip "${placeName}" for "${nom}" — similarity ${similarity.toFixed(2)} < ${PLACES_MIN_SIMILARITY}`
        );
        continue;
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

      const phone   = detail.result?.formatted_phone_number
        ? normalizePhone(detail.result.formatted_phone_number)
        : undefined;

      // ── Validation site web : rejeter les domaines blacklistés ───────────────
      let siteWeb: string | undefined;
      if (detail.result?.website) {
        const raw = detail.result.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (!isWebsiteBlacklisted(raw)) {
          siteWeb = raw;
        } else {
          console.info(`[places] rejected website "${raw}" for "${nom}" (blacklisted domain)`);
        }
      }

      // Retourner dès qu'on trouve au moins un résultat utile
      if (phone || siteWeb) return { phone, siteWeb };

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

// ── Scraping site web (rapide, 1 page principale + contact) ──────────────────
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

  const emails = new Set<string>();
  const phones = new Set<string>();

  // Essayer seulement 2 pages pour rester rapide
  for (const url of [cleanUrl, `${cleanUrl}/contact`]) {
    try {
      const res = await fetch(url, {
        signal:   AbortSignal.timeout(3_000),
        headers:  { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/1.0)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Emails
      const deobfuscated = html.replace(/\[at\]|\(at\)/gi, "@").replace(/\[dot\]|\(dot\)/gi, ".");
      for (const e of (deobfuscated.match(EMAIL_RE) ?? [])) {
        const lower = e.toLowerCase();
        if (
          !IGNORE_DOMAINS.some((d) => lower.includes(d)) &&
          !isEmailBlacklisted(lower) &&
          lower.length <= 80
        )
          emails.add(lower);
      }

      // Téléphones (texte + liens tel:)
      for (const t of (html.match(PHONE_RE) ?? [])) {
        const n = normalizePhone(t);
        if (isValidFrPhone(n)) phones.add(n);
      }
      const telLinks = Array.from(html.matchAll(/href="tel:([^"]+)"/gi));
      for (const m of telLinks) {
        const n = normalizePhone(m[1]);
        if (isValidFrPhone(n)) phones.add(n);
      }

      if (emails.size > 0) break;
    } catch { continue; }
  }

  return { emails: Array.from(emails), phones: Array.from(phones) };
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
        ? findViaGooglePlaces(nom, ville)
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

    // ── Phase 2 : Scraping site → email + tél (seulement si site trouvé) ──────
    let emailTrouve: string | undefined;
    let emailPatterns: string[] = [];

    if (siteWeb) {
      // Nettoyer le domaine : retirer "www." pour éviter "contact@www.example.com"
      const domaine = siteWeb.split("/")[0].replace(/^www\./, "");
      const { emails, phones } = await scrapeWebsiteContacts(siteWeb);

      // Filtrer les emails blacklistés récupérés depuis le site
      const validEmails = emails.filter((e) => !isEmailBlacklisted(e));

      if (validEmails.length > 0) {
        sources.push("website_scraping");
        const dirLower = (dirigeantPrincipal ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const dirParts = dirLower.split(/\s+/).filter((p) => p.length > 2);
        emailTrouve = validEmails.find((e) => dirParts.some((p) => e.includes(p))) ?? validEmails[0];
        actions.push({ date: now, type: "enrichissement", detail: `Email : ${emailTrouve}` });
      } else if (!isWebsiteBlacklisted(domaine)) {
        // Ne générer des patterns que si le domaine est légitime
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
