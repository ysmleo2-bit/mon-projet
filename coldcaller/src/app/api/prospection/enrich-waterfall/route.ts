/**
 * POST /api/prospection/enrich-waterfall
 * Enrichissement en cascade (waterfall) — EMAIL + TÉLÉPHONE.
 *
 * Architecture :
 *  EMAIL waterfall (stop au premier résultat fiable, score ≥ 50) :
 *    1. Pappers /v2/entreprise — score 90 (SIREN FR uniquement)
 *    2. Scraping site web existant — score 70
 *    3. Pattern email (prénom.nom@domaine) — score 35  ← "suggestion"
 *
 *  TÉLÉPHONE waterfall :
 *    1. Pappers /v2/entreprise — score 90
 *    2. Google Places API — score 80
 *    3. SIRENE extra — score 75
 *    4. Scraping site web — score 65
 *
 * Règles :
 *  - Stop au premier résultat (score ≥ 50) — pas de gaspillage d'API
 *  - On ne remplace jamais une donnée existante par une donnée moins fiable
 *  - Chaque résultat stocke : valeur + source + date + score (0-100)
 *
 * Pas d'Apollo. Pas de FullEnrich.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect, DataSource, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 55;

// ── Seuil de fiabilité ────────────────────────────────────────────────────────
const RELIABLE_SCORE = 50;  // score ≥ 50 → donnée fiable, affichage OK

// ── Confidence scores par source ──────────────────────────────────────────────
const SCORE_BY_SOURCE: Record<string, number> = {
  pappers:         90,
  google_places:   80,
  sirene:          75,
  website_scraping: 70,
  pattern_email:   35,  // suggestion uniquement
};

// ── Types internes ────────────────────────────────────────────────────────────
interface EnrichedField {
  value:      string;
  source:     DataSource;
  score:      number;  // 0-100
  date:       string;
}

// ── Normalisation téléphone ───────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.–\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  // Belgique +32
  if (p.startsWith("+32")) return raw.trim();
  // Suisse +41
  if (p.startsWith("+41")) return raw.trim();
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

function isValidPhone(p: string): boolean {
  const digits = p.replace(/[\s.+\-]/g, "");
  // FR : 0XXXXXXXXX (10 chiffres commençant par 0)
  if (/^0[1-9]\d{8}$/.test(digits)) return true;
  // International : +XX... (7-15 chiffres)
  if (/^\+\d{7,15}$/.test(p.replace(/\s/g, ""))) return true;
  return false;
}

// ── Blacklists ────────────────────────────────────────────────────────────────
const WEBSITE_BLACKLIST = [
  "pagesjaunes","pagesblanches","societe.com","infogreffe","pappers","verif.com",
  "manageo","kompass","facebook","instagram","linkedin","twitter","youtube",
  "google","wixpress","squarespace","shopify","wordpress.com","credit-agricole",
  "bnpparibas","societegenerale","example.com","domain.com","mail.fr",
];
const EMAIL_BLACKLIST = [
  /^adresse@/i, /^email@/i, /^exemple@/i, /^example@/i, /^test@/i,
  /^noreply@/i, /^no-reply@/i, /^donotreply@/i, /^notifications@/i,
  /^newsletter@/i, /^mailer@/i, /^bounce@/i, /^postmaster@/i, /^webmaster@/i,
  /@mail\.fr$/i, /@example\.com$/i, /@domain\.com$/i,
];

function isBlacklistedSite(s: string): boolean {
  const l = s.toLowerCase();
  return WEBSITE_BLACKLIST.some((b) => l.includes(b));
}
function isBlacklistedEmail(e: string): boolean {
  return EMAIL_BLACKLIST.some((r) => r.test(e));
}

// ── Dice similarity (validation nom) ─────────────────────────────────────────
function diceSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const bigrams = (s: string): string[] => {
    const arr: string[] = [];
    for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
    return arr;
  };
  const sa = bigrams(norm(a)), sb = new Set(bigrams(norm(b)));
  const inter = sa.filter((g) => sb.has(g)).length;
  return (2 * inter) / (sa.length + sb.size) || 0;
}

// ── Pappers enrichissement ────────────────────────────────────────────────────
interface PappersDetail {
  telephone?:      string | null;
  email?:          string | null;
  sites_internet?: Array<{ url?: string }>;
  representants?:  Array<{ nom?: string; prenom?: string; qualite?: string; type?: string }>;
  finances?:       Array<{ annee?: number; chiffre_affaires?: number }>;
}

async function fetchPappersDetail(siren: string): Promise<PappersDetail | null> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return null;
  if (!/^\d{9}$/.test(siren)) return null;

  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/entreprise?api_token=${key}&siren=${siren}`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return null;
    return await res.json() as PappersDetail;
  } catch { return null; }
}

// ── Google Places API ─────────────────────────────────────────────────────────
async function fetchGooglePlaces(nom: string, ville?: string): Promise<{
  phone?: string; site?: string;
} | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const query = `${nom} ${ville ?? ""} France`;
  try {
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=fr&key=${key}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!searchRes.ok) return null;
    const sd = await searchRes.json() as { status: string; results?: Array<{ place_id?: string; name?: string }> };
    if (sd.status !== "OK" || !sd.results?.[0]?.place_id) return null;

    const hit = sd.results[0];
    if (diceSimilarity(nom, hit.name ?? "") < 0.20) return null;

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${hit.place_id}&fields=formatted_phone_number,website&language=fr&key=${key}`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!detailRes.ok) return null;
    const dd = await detailRes.json() as { status: string; result?: { formatted_phone_number?: string; website?: string } };
    if (dd.status !== "OK") return null;

    const phone = dd.result?.formatted_phone_number
      ? normalizePhone(dd.result.formatted_phone_number)
      : undefined;
    const rawSite = dd.result?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const site = rawSite && !isBlacklistedSite(rawSite) ? rawSite : undefined;

    return (phone || site) ? { phone, site } : null;
  } catch { return null; }
}

// ── SIRENE extra ──────────────────────────────────────────────────────────────
async function fetchSireneExtra(siren: string): Promise<{
  phone?: string; site?: string;
  dirigeant?: { nom: string; prenoms?: string; qualite?: string };
} | null> {
  if (!/^\d{9}$/.test(siren)) return null;
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    const r = data.results?.[0];
    if (!r) return null;

    const siege = r.siege as Record<string, unknown> | undefined;
    const rawPhone = siege?.telephone ? String(siege.telephone) : undefined;
    const phone = rawPhone ? normalizePhone(rawPhone.replace(/^\+33\s?/, "0")) : undefined;
    const rawSite = siege?.site_internet ? String(siege.site_internet) : undefined;
    const site = rawSite && !isBlacklistedSite(rawSite)
      ? rawSite.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : undefined;

    const dirs = r.dirigeants as Array<{ nom?: string; prenoms?: string; qualite?: string }> | undefined;
    const dir = dirs?.find((d) => d.nom);
    const dirigeant = dir ? { nom: dir.nom ?? "", prenoms: dir.prenoms, qualite: dir.qualite } : undefined;

    return { phone: phone && isValidPhone(phone) ? phone : undefined, site, dirigeant };
  } catch { return null; }
}

// ── Scraping site web ─────────────────────────────────────────────────────────
async function scrapeWebsite(rawUrl: string): Promise<{
  emails: string[]; phones: string[];
}> {
  const cleanUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const PHONE_RE = /(?:(?:\+33|0033|0)[1-9])(?:[\s.\-]?\d{2}){4}/g;

  const emails = new Set<string>();
  const phones = new Set<string>();

  for (const url of [cleanUrl, `${cleanUrl}/contact`, `${cleanUrl}/nous-contacter`]) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3_500),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ColdCaller/2.0)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();

      const deob = html.replace(/\[at\]|\(at\)/gi, "@").replace(/\[dot\]|\(dot\)/gi, ".");
      for (const e of (deob.match(EMAIL_RE) ?? [])) {
        const lower = e.toLowerCase();
        if (!isBlacklistedEmail(lower) && lower.length <= 80 && lower.includes("."))
          emails.add(lower);
      }
      for (const t of (html.match(PHONE_RE) ?? [])) {
        const n = normalizePhone(t);
        if (isValidPhone(n)) phones.add(n);
      }
      for (const m of Array.from(html.matchAll(/href="tel:([^"]+)"/gi))) {
        const n = normalizePhone(m[1]);
        if (isValidPhone(n)) phones.add(n);
      }
      if (emails.size > 0) break;
    } catch { continue; }
  }

  return { emails: Array.from(emails), phones: Array.from(phones) };
}

// ── Patterns email dirigeant ──────────────────────────────────────────────────
function generateEmailPatterns(dirigeant: string | undefined, domaine: string): string[] {
  if (!dirigeant || !domaine) return [`contact@${domaine}`, `info@${domaine}`];
  const parts  = dirigeant.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/);
  const prenom = parts[0] ?? "";
  const nom    = parts[parts.length - 1] ?? "";
  return [
    `${prenom}.${nom}@${domaine}`,
    `${prenom.charAt(0)}.${nom}@${domaine}`,
    `contact@${domaine}`,
    `info@${domaine}`,
  ].filter((e) => e.length > 5 && !e.startsWith(".") && !e.startsWith("@") && !isBlacklistedEmail(e));
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error: authError } = requireAuth(req);
  if (authError) return authError;

  const body = await req.json() as {
    prospectId:          string;
    siren:               string;
    nom:                 string;
    ville?:              string;
    codePostal?:         string;
    adresse?:            string;
    siteWeb?:            string;
    telephonePro?:       string;
    emailDirigeant?:     string;
    emailSource?:        string;
    dirigeantPrincipal?: string;
    libelleNaf?:         string;
  };

  const { prospectId, siren, nom, ville, codePostal, adresse, dirigeantPrincipal } = body;
  let { siteWeb, telephonePro, emailDirigeant, emailSource } = body;

  if (!prospectId || !nom) {
    return NextResponse.json({ error: "prospectId et nom requis" }, { status: 400 });
  }

  const now     = new Date().toISOString();
  const actions: ProspectAction[] = [];
  const sources: DataSource[]     = [];
  const patch:   Partial<Prospect> = { updatedAt: now };

  // Scores actuels des données existantes
  const currentEmailScore = emailDirigeant
    ? (SCORE_BY_SOURCE[emailSource ?? ""] ?? 40)
    : 0;
  const currentPhoneScore = telephonePro
    ? SCORE_BY_SOURCE.sirene  // on considère qu'une donnée déjà là vient de SIRENE
    : 0;

  // Résultats waterfall
  let emailResult:  EnrichedField | null = null;
  let phoneResult:  EnrichedField | null = null;
  let siteResult:   string | undefined;
  let dirResult:    { nom: string; prenoms?: string; qualite?: string } | null = null;

  // ── ÉTAPE 1 : Pappers (si SIREN FR numérique) ────────────────────────────
  const cleanSiren = siren?.replace(/^prospect-/, "") ?? "";
  const pappers = /^\d{9}$/.test(cleanSiren) ? await fetchPappersDetail(cleanSiren) : null;

  if (pappers) {
    if (pappers.email && !isBlacklistedEmail(pappers.email) && SCORE_BY_SOURCE.pappers > currentEmailScore) {
      emailResult = { value: pappers.email, source: "pappers", score: SCORE_BY_SOURCE.pappers, date: now };
      sources.push("pappers");
    }
    if (pappers.telephone && isValidPhone(normalizePhone(pappers.telephone))) {
      const ph = normalizePhone(pappers.telephone);
      if (SCORE_BY_SOURCE.pappers > currentPhoneScore) {
        phoneResult = { value: ph, source: "pappers", score: SCORE_BY_SOURCE.pappers, date: now };
        if (!sources.includes("pappers")) sources.push("pappers");
      }
    }
    const siteRaw = pappers.sites_internet?.[0]?.url;
    if (siteRaw) {
      const cleaned = siteRaw.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!isBlacklistedSite(cleaned)) {
        siteResult = cleaned;
        if (!siteWeb) siteWeb = siteResult;
      }
    }
    // Dirigeants
    const reps = (pappers.representants ?? []).filter((r) => r.type !== "morale" && r.nom);
    if (reps.length > 0 && !dirigeantPrincipal) {
      const priority = ["gérant", "président", "directeur général", "associé gérant", "pdg"];
      const main = reps.find((r) => priority.some((q) => r.qualite?.toLowerCase().includes(q))) ?? reps[0];
      dirResult = { nom: main.nom ?? "", prenoms: main.prenom, qualite: main.qualite };
    }
  }

  // ── ÉTAPE 2 : Google Places + SIRENE en parallèle ─────────────────────────
  // Uniquement si on n'a pas encore de téléphone fiable
  const needPhone = !phoneResult || phoneResult.score < RELIABLE_SCORE;
  const needSite  = !siteWeb;

  const [placesRes, sireneRes] = await Promise.all([
    (needPhone || needSite) ? fetchGooglePlaces(nom, ville) : Promise.resolve(null),
    (needPhone || needSite || !dirResult) ? fetchSireneExtra(cleanSiren) : Promise.resolve(null),
  ]);

  if (placesRes) {
    if (placesRes.phone && (!phoneResult || SCORE_BY_SOURCE.google_places > phoneResult.score)) {
      phoneResult = { value: placesRes.phone, source: "google_places", score: SCORE_BY_SOURCE.google_places, date: now };
      if (!sources.includes("google_places")) sources.push("google_places");
    }
    if (placesRes.site && !siteWeb) {
      siteWeb = placesRes.site;
      siteResult = siteWeb;
    }
  }
  if (sireneRes) {
    if (sireneRes.phone && (!phoneResult || SCORE_BY_SOURCE.sirene > phoneResult.score)) {
      phoneResult = { value: sireneRes.phone, source: "sirene", score: SCORE_BY_SOURCE.sirene, date: now };
      if (!sources.includes("sirene")) sources.push("sirene");
    }
    if (sireneRes.site && !siteWeb) {
      siteWeb = sireneRes.site;
      siteResult = siteWeb;
    }
    if (sireneRes.dirigeant && !dirResult && !dirigeantPrincipal) {
      dirResult = sireneRes.dirigeant;
    }
  }

  // ── ÉTAPE 3 : Scraping site web ───────────────────────────────────────────
  const needEmail = !emailResult || emailResult.score < RELIABLE_SCORE;
  const needPhoneStill = !phoneResult || phoneResult.score < RELIABLE_SCORE;

  if (siteWeb && (needEmail || needPhoneStill)) {
    const { emails, phones } = await scrapeWebsite(siteWeb);
    const domaine = siteWeb.split("/")[0].replace(/^www\./, "");

    if (emails.length > 0 && (!emailResult || SCORE_BY_SOURCE.website_scraping > emailResult.score)) {
      // Privilégier l'email qui contient le nom du dirigeant
      const dirLower = (dirigeantPrincipal ?? dirResult?.nom ?? "")
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const dirParts = dirLower.split(/\s+/).filter((p) => p.length > 2);
      const best = emails.find((e) => dirParts.some((p) => e.includes(p))) ?? emails[0];
      emailResult = { value: best, source: "website_scraping", score: SCORE_BY_SOURCE.website_scraping, date: now };
      if (!sources.includes("website_scraping")) sources.push("website_scraping");
    } else if (!emailResult && domaine && !isBlacklistedSite(domaine)) {
      // Générer des patterns si aucun email trouvé (score 35 — suggestion seulement)
      const dirName = dirigeantPrincipal ?? (dirResult ? [dirResult.prenoms, dirResult.nom].filter(Boolean).join(" ") : undefined);
      const patterns = generateEmailPatterns(dirName, domaine).filter((e) => !isBlacklistedEmail(e));
      if (patterns.length > 0) {
        emailResult = { value: patterns[0], source: "pattern_email", score: SCORE_BY_SOURCE.pattern_email, date: now };
        if (!sources.includes("pattern_email")) sources.push("pattern_email");
      }
    }

    if (phones.length > 0 && (!phoneResult || SCORE_BY_SOURCE.website_scraping > phoneResult.score)) {
      phoneResult = { value: phones[0], source: "website_scraping", score: SCORE_BY_SOURCE.website_scraping, date: now };
      if (!sources.includes("website_scraping")) sources.push("website_scraping");
    }
  }

  // ── Patch final — ne jamais dégrader une donnée existante ─────────────────
  // EMAIL
  if (emailResult && emailResult.score > currentEmailScore) {
    const reliable = emailResult.score >= RELIABLE_SCORE;
    patch.emailDirigeant  = emailResult.value;
    patch.emailSource     = emailResult.source;
    patch.emailVerifie    = reliable;
    if (reliable) {
      patch.statut = "email_trouve";
      actions.push({ date: now, type: "enrichissement", detail: `Email (${emailResult.source}, confiance ${emailResult.score}) : ${emailResult.value}` });
    } else {
      // Pattern uniquement — suggestion
      actions.push({ date: now, type: "enrichissement", detail: `Email suggéré (${emailResult.source}) : ${emailResult.value}` });
    }
    emailDirigeant = emailResult.value;
  }

  // PHONE
  if (phoneResult && phoneResult.score > currentPhoneScore) {
    patch.telephonePro  = phoneResult.value;
    actions.push({ date: now, type: "enrichissement", detail: `Tél (${phoneResult.source}, confiance ${phoneResult.score}) : ${phoneResult.value}` });
    telephonePro = phoneResult.value;
  }

  // SITE
  if (siteResult && !body.siteWeb) {
    patch.siteWeb = siteResult;
    actions.push({ date: now, type: "enrichissement", detail: `Site web : ${siteResult}` });
  }

  // DIRIGEANT
  if (dirResult && !dirigeantPrincipal) {
    const fullName = [dirResult.prenoms, dirResult.nom].filter(Boolean).join(" ").trim();
    if (fullName) {
      patch.dirigeantPrincipal = fullName;
      patch.fonctionDirigeant  = dirResult.qualite;
      patch.dirigeants = [{ nom: dirResult.nom, prenoms: dirResult.prenoms, qualite: dirResult.qualite }];
      actions.push({ date: now, type: "enrichissement", detail: `Dirigeant : ${fullName}` });

      // LinkedIn search URL
      const linkedinQuery = encodeURIComponent(`${fullName} ${nom}`);
      patch.linkedinDirigeant = `https://www.linkedin.com/search/results/people/?keywords=${linkedinQuery}`;
    }
  }

  // Statut global
  if (!patch.statut) {
    if (telephonePro ?? patch.telephonePro) patch.statut = "enrichi";
    else if (siteWeb ?? patch.siteWeb)     patch.statut = "enrichi";
  }

  patch.enrichiAt = now;
  if (actions.length > 0) patch.actions = actions;
  patch.sources = Array.from(new Set(sources)) as DataSource[];

  // ── Persistance DB ────────────────────────────────────────────────────────
  let updated: Prospect | null = null;
  try {
    const fullPatch = {
      ...patch,
      siren:      siren      || undefined,
      nom:        nom        || undefined,
      ville:      ville      || undefined,
      adresse:    adresse    || undefined,
      codePostal: codePostal || undefined,
    };
    const { dbUpdateProspect } = await import("@/lib/db-prospection");
    updated = await dbUpdateProspect(prospectId, fullPatch);
  } catch (dbErr) {
    console.warn("[enrich-waterfall] DB save skipped:", dbErr);
    // Retourner quand même les données pour l'UI
    updated = {
      id:         prospectId,
      siren:      siren ?? "",
      nom,
      codeNaf:    "",
      libelleNaf: body.libelleNaf ?? "",
      secteur:    "",
      dirigeants: [],
      statut:     (patch.statut ?? "enrichi") as Prospect["statut"],
      sources:    patch.sources ?? [],
      actions:    patch.actions ?? [],
      createdAt:  now,
      updatedAt:  now,
      telephonePro,
      siteWeb:    siteWeb ?? undefined,
      emailDirigeant,
      ...patch,
    } as Prospect;
  }

  return NextResponse.json({
    ok:           true,
    prospect:     updated,
    // Résumé waterfall
    waterfall: {
      email: emailResult
        ? { value: emailResult.value, source: emailResult.source, score: emailResult.score, reliable: emailResult.score >= RELIABLE_SCORE }
        : null,
      phone: phoneResult
        ? { value: phoneResult.value, source: phoneResult.source, score: phoneResult.score, reliable: phoneResult.score >= RELIABLE_SCORE }
        : null,
      site:      siteResult ?? null,
      dirigeant: dirResult ? [dirResult.prenoms, dirResult.nom].filter(Boolean).join(" ") : null,
    },
    pappersUsed:    !!pappers,
    googleUsed:     !!placesRes,
    sireneUsed:     !!sireneRes,
    scrapingUsed:   !!(siteWeb && (needEmail || needPhoneStill)),
    sourcesUsed:    sources,
  });
}
