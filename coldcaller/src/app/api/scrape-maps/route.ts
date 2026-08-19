/**
 * /api/scrape-maps  — Google Maps scraper
 *
 * Mode 1 (recommandé) : si GOOGLE_MAPS_API_KEY est défini →
 *   utilise la nouvelle Places API v1 (places:searchText) qui retourne les
 *   numéros de téléphone en UNE SEULE requête (vs 20+ avant → plus de timeout)
 *
 * Mode 2 (bot headless) : si pas de clé API →
 *   utilise Playwright + Chromium pour scraper Google Maps directement
 *
 * Déploiement :
 *   - Ajouter GOOGLE_MAPS_API_KEY dans les env vars Vercel
 *   - L'API v1 répond en < 3s → compatible Vercel Hobby (10 s)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Lead } from "@/lib/types";

export const dynamic     = "force-dynamic";
export const maxDuration = 55;

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanPhone(raw: string): string {
  return raw
    .replace(/^\+33\s?/, "0")
    .replace(/^0033\s?/, "0")
    .replace(/[\s.\-]/g, " ")
    .trim();
}

// ── Mode 1 : Google Places API v1 (une seule requête, retourne les tél.) ─────
type PlaceV1 = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  addressComponents?: Array<{ longText: string; types: string[] }>;
};

async function fetchPlacesV1Page(
  key: string, textQuery: string,
  opts?: { pageToken?: string; lat?: number; lon?: number; radiusM?: number },
): Promise<{ places: PlaceV1[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery,
    languageCode: "fr",
    pageSize:     20,            // ← paramètre correct (maxResultCount est déprécié)
  };
  if (opts?.pageToken) body.pageToken = opts.pageToken;
  // Biaiser la recherche vers la zone géographique → plus de résultats locaux
  if (opts?.lat && opts?.lon) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lon },
        radius: Math.min(opts.radiusM ?? 20_000, 50_000),
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type":   "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.rating",
        "places.userRatingCount",
        "places.websiteUri",
        "places.addressComponents",
        "nextPageToken",
      ].join(","),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[scrape-maps] Places API v1 error:", res.status, errText.slice(0, 200));
    return { places: [] };
  }

  const data = await res.json() as { places?: PlaceV1[]; nextPageToken?: string };
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

// Alias de requête pour diversifier les résultats Maps
const NICHE_QUERY_ALIAS: Record<string, string> = {
  Plombier:           "plomberie sanitaire",
  Électricien:        "electricité installation électrique",
  Maçon:              "maçonnerie construction",
  Serrurier:          "serrurerie dépannage serrure",
  Peintre:            "peinture décoration intérieure",
  Couvreur:           "toiture couverture",
  Carreleur:          "carrelage revêtement sol",
  Menuisier:          "menuiserie ébénisterie",
  Chauffagiste:       "chauffage climatisation",
  Paysagiste:         "jardinage entretien espaces verts",
  Nettoyage:          "société nettoyage propreté",
  Restaurant:         "brasserie bistrot",
  Boulangerie:        "boulanger artisan pâtisserie",
  Coiffeur:           "salon coiffure barbier",
  Comptable:          "expert comptable cabinet comptabilité",
  "Agent immobilier": "agence immobilière transaction",
  Médecin:            "cabinet médecin généraliste docteur",
  Dentiste:           "cabinet dentaire chirurgien dentiste",
  Pharmacie:          "pharmacien officine",
  Avocat:             "cabinet avocat droit",
  Architecte:         "cabinet architecture urbanisme",
  Garage:             "carrosserie mécanique automobile",
  Auto:               "réparation auto garage mécanique",
  Opticien:           "optique lunettes vue",
  Kiné:               "kinésithérapeute rééducation",
  Vétérinaire:        "clinique vétérinaire animaux",
};

type OldSearchResult = {
  place_id: string; name: string; formatted_address: string;
  rating?: number; user_ratings_total?: number;
};

async function fetchOldTextSearch(key: string, query: string): Promise<OldSearchResult[]> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query)}&language=fr&region=fr&key=${key}`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { results: OldSearchResult[] };
    return data.results ?? [];
  } catch { return []; }
}

async function fetchPlaceDetails(
  key: string, p: OldSearchResult, niche: string, city: string, now: string,
): Promise<Lead | null> {
  try {
    const dr = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${p.place_id}` +
      `&fields=name,formatted_phone_number,formatted_address,rating,user_ratings_total,website,address_component` +
      `&language=fr&key=${key}`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!dr.ok) return null;
    const dd = await dr.json() as {
      result?: {
        name: string; formatted_phone_number?: string; formatted_address?: string;
        rating?: number; user_ratings_total?: number; website?: string;
        address_component?: Array<{ long_name: string; types: string[] }>;
      };
    };
    const r = dd.result;
    if (!r) return null;
    const cityComp = r.address_component?.find((c) => c.types.includes("locality"));
    return {
      id:          `gmaps-${p.place_id}`,
      name:        r.name,
      category:    niche,
      phone:       r.formatted_phone_number ? cleanPhone(r.formatted_phone_number) : "",
      address:     r.formatted_address ?? p.formatted_address,
      city:        cityComp?.long_name ?? city,
      rating:      r.rating ?? p.rating ?? 0,
      reviewCount: r.user_ratings_total ?? p.user_ratings_total ?? 0,
      website:     r.website?.replace(/^https?:\/\//, ""),
      status:      "new" as const,
      notes:       "",
      source:      "google_maps" as const,
      detectedAt:  now,
      callCount:   0,
    } satisfies Lead;
  } catch { return null; }
}

async function scrapeViaPlacesApiV1(
  niche: string, city: string, maxResults: number,
  lat?: number, lon?: number, radiusM?: number,
): Promise<Lead[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const now = new Date().toISOString();
  const textQuery  = `${niche} ${city}`;
  const aliasQuery = NICHE_QUERY_ALIAS[niche] ? `${NICHE_QUERY_ALIAS[niche]} ${city}` : null;
  const geoOpts    = { lat, lon, radiusM };

  // ── 3 requêtes en parallèle : v1 + Text Search principal + Text Search alias ─
  const [page1, oldResults1, oldResults2] = await Promise.all([
    fetchPlacesV1Page(key, textQuery, geoOpts),
    fetchOldTextSearch(key, textQuery),
    aliasQuery ? fetchOldTextSearch(key, aliasQuery) : Promise.resolve([] as OldSearchResult[]),
  ]);

  // Construire la map depuis v1
  const leadsMap = new Map<string, Lead>();
  for (const p of (page1.places ?? [])) {
    if (!p.displayName?.text) continue;
    const rawPhone = p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "";
    const cityComp = p.addressComponents?.find((c) => c.types.includes("locality"));
    leadsMap.set(p.id, {
      id:          `gmaps-${p.id}`,
      name:        p.displayName.text,
      category:    niche,
      phone:       rawPhone ? cleanPhone(rawPhone) : "",
      address:     p.formattedAddress ?? "",
      city:        cityComp?.longText ?? city,
      rating:      p.rating ?? 0,
      reviewCount: p.userRatingCount ?? 0,
      website:     p.websiteUri?.replace(/^https?:\/\//, ""),
      status:      "new",
      notes:       "",
      source:      "google_maps",
      detectedAt:  now,
      callCount:   0,
    });
  }

  // Collecter tous les IDs uniques des 2 Text Searches non couverts par v1
  const allOld = [...oldResults1, ...oldResults2];
  const seenOld = new Set<string>();
  const missingIds = allOld
    .filter((p) => {
      if (leadsMap.has(p.place_id) || seenOld.has(p.place_id)) return false;
      seenOld.add(p.place_id);
      return true;
    })
    .slice(0, 15); // max 15 Details en parallèle → ~3-4s

  if (missingIds.length > 0) {
    const extras = (
      await Promise.all(missingIds.map((p) => fetchPlaceDetails(key, p, niche, city, now)))
    ).filter(Boolean) as Lead[];
    for (const l of extras) leadsMap.set(l.id.replace("gmaps-", ""), l);
  }

  const all = Array.from(leadsMap.values());
  console.log(`[scrape-maps] v1=${page1.places?.length ?? 0} old=${allOld.length} details=${missingIds.length} → total=${all.length}`);

  if (all.length === 0) return scrapeViaPlacesApiLegacySimple(niche, city, maxResults);
  return all.slice(0, maxResults);
}

// ── Fallback ultime : ancienne API seule, 5 résultats ─────────────────────────
async function scrapeViaPlacesApiLegacySimple(
  niche: string, city: string, maxResults: number,
): Promise<Lead[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const now = new Date().toISOString();

  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(`${niche} ${city}`)}&language=fr&region=fr&key=${key}`,
    { signal: AbortSignal.timeout(6_000) }
  );
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json() as {
    results: Array<{ place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number }>;
  };
  const places = (searchData.results ?? []).slice(0, Math.min(maxResults, 5));
  const detailFetches = places.map(async (p) => {
    try {
      const dr = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}` +
        `&fields=name,formatted_phone_number,formatted_address,rating,user_ratings_total,website,address_component` +
        `&language=fr&key=${key}`,
        { signal: AbortSignal.timeout(4_000) }
      );
      if (!dr.ok) return null;
      const dd = await dr.json() as { result?: { name: string; formatted_phone_number?: string; formatted_address?: string; rating?: number; user_ratings_total?: number; website?: string; address_component?: Array<{ long_name: string; types: string[] }> } };
      const r = dd.result; if (!r) return null;
      const cityComp = r.address_component?.find((c) => c.types.includes("locality"));
      return { id: `gmaps-${p.place_id}`, name: r.name, category: niche, phone: r.formatted_phone_number ? cleanPhone(r.formatted_phone_number) : "", address: r.formatted_address ?? "", city: cityComp?.long_name ?? city, rating: r.rating ?? 0, reviewCount: r.user_ratings_total ?? 0, website: r.website?.replace(/^https?:\/\//, ""), status: "new" as const, notes: "", source: "google_maps" as const, detectedAt: now, callCount: 0 } satisfies Lead;
    } catch { return null; }
  });
  return (await Promise.all(detailFetches)).filter(Boolean) as Lead[];
}

// ── Mode 2 : Playwright headless bot ─────────────────────────────────────────
async function scrapeViaPlaywright(
  niche: string, city: string, maxResults: number,
): Promise<Lead[]> {
  let chromium: typeof import("@sparticuz/chromium-min").default;
  let puppeteer: typeof import("puppeteer-core").default;

  try {
    chromium  = (await import("@sparticuz/chromium-min")).default;
    puppeteer = (await import("puppeteer-core")).default;
  } catch {
    // Fallback local dev : utiliser le Chromium installé par Playwright
    const pw  = await import("playwright-core");
    return scrapeViaPlaywrightCore(pw.chromium, niche, city, maxResults);
  }

  // Production Vercel (sparticuz)
  const executablePath = await chromium.executablePath(
    "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
  );
  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless:        true,
  });

  try {
    return await extractFromBrowser(browser as any, niche, city, maxResults, "puppeteer");
  } finally {
    await browser.close();
  }
}

// Scraping via playwright-core (dev local)
async function scrapeViaPlaywrightCore(
  chromiumLauncher: import("playwright-core").BrowserType,
  niche: string, city: string, maxResults: number,
): Promise<Lead[]> {
  const localExe = process.env.CHROMIUM_PATH
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

  const browser = await chromiumLauncher.launch({
    executablePath: localExe,
    headless:       true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", "--disable-gpu",
    ],
  });

  try {
    return await extractFromBrowser(browser as any, niche, city, maxResults, "playwright");
  } finally {
    await browser.close();
  }
}

// ── Logique d'extraction partagée ────────────────────────────────────────────
interface BrowserPage {
  goto: (url: string, opts?: any) => Promise<any>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  waitForSelector: (sel: string, opts?: any) => Promise<any>;
  waitForTimeout: (ms: number) => Promise<void>;
  click?: (sel: string) => Promise<void>;
  setExtraHTTPHeaders?: (h: Record<string, string>) => Promise<void>;
}

async function extractFromBrowser(
  browser: { newPage: () => Promise<BrowserPage> },
  niche: string, city: string, maxResults: number,
  mode: "playwright" | "puppeteer",
): Promise<Lead[]> {
  const page = await browser.newPage();
  const now = new Date().toISOString();

  if (mode === "playwright") {
    const pwPage = page as any;
    await pwPage.setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9" });
  } else {
    await (page as any).setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await (page as any).setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9" });
  }

  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${niche} ${city}`)}`;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });

  try {
    const cookieBtn = await page.waitForSelector(
      'button[jsname="higCR"], button[aria-label*="Tout accepter"], button[aria-label*="Accept all"]',
      { timeout: 3000 }
    );
    if (cookieBtn) await cookieBtn.click();
    await page.waitForTimeout(1000);
  } catch { /* pas de dialog */ }

  await page.waitForSelector('[role="feed"], .Nv2PK, a.hfpxzc', { timeout: 15_000 });
  await page.waitForTimeout(2000);

  const placeLinks: string[] = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place"]'));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const a of anchors) {
      if (a.href && !seen.has(a.href)) {
        seen.add(a.href);
        result.push(a.href);
        if (result.length >= 40) break;
      }
    }
    return result;
  });

  const leads: Lead[] = [];
  const toProcess = placeLinks.slice(0, maxResults);

  for (const placeUrl of toProcess) {
    try {
      await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 12_000 });
      await page.waitForTimeout(1500);

      const data = await page.evaluate(() => {
        const name = (
          document.querySelector("h1.DUwDvf")
          ?? document.querySelector('[data-attrid="title"] span')
          ?? document.querySelector("h1")
        )?.textContent?.trim() ?? "";

        let phone = "";
        const telEl = document.querySelector('a[href^="tel:"]');
        if (telEl) {
          phone = (telEl as HTMLAnchorElement).href.replace("tel:", "");
        } else {
          const btns = Array.from(document.querySelectorAll("button, [aria-label]"));
          for (const btn of btns) {
            const lbl = (btn as HTMLElement).getAttribute("aria-label") ?? "";
            if (/Appeler|phone|téléphone/i.test(lbl)) {
              const m = lbl.match(/(?:\+33|0)[0-9\s.\-]{9,15}/);
              if (m) { phone = m[0]; break; }
            }
          }
          if (!phone) {
            const dataVals = Array.from(document.querySelectorAll("[data-value]"));
            for (const el of dataVals) {
              const v = (el as HTMLElement).getAttribute("data-value") ?? "";
              if (/^(\+33|0)[0-9]{9}/.test(v.replace(/\s/g, ""))) { phone = v; break; }
            }
          }
        }

        const addrEl = document.querySelector('[data-item-id*="address"], button[aria-label*="Adresse"]');
        const address = addrEl?.getAttribute("aria-label")?.replace(/^Adresse\s*:\s*/i, "").trim()
          ?? addrEl?.textContent?.trim() ?? "";

        const ratingEl = document.querySelector(".ceNzKf, [aria-label*='étoile']");
        const ratingText = ratingEl?.getAttribute("aria-label") ?? "";
        const ratingM = ratingText.match(/([0-9][,.]?[0-9]?)/);
        const rating = ratingM ? parseFloat(ratingM[1].replace(",", ".")) : 0;

        const reviewsEl = document.querySelector(".RDApEe, [aria-label*='avis']");
        const reviewsText = reviewsEl?.textContent ?? reviewsEl?.getAttribute("aria-label") ?? "";
        const reviewsM = reviewsText.match(/(\d[\d\s]*)/);
        const reviewCount = reviewsM ? parseInt(reviewsM[1].replace(/\s/g, "")) : 0;

        const siteEl = document.querySelector('a[data-item-id*="authority"], a[href*="website"]');
        const website = (siteEl as HTMLAnchorElement)?.href?.replace(/^https?:\/\//, "") ?? "";

        return { name, phone, address, rating, reviewCount, website };
      });

      if (!data.name) continue;

      leads.push({
        id:          `gmaps-${Math.random().toString(36).slice(2)}`,
        name:        data.name,
        category:    niche,
        phone:       data.phone ? cleanPhone(data.phone) : "",
        address:     data.address,
        city,
        rating:      data.rating,
        reviewCount: data.reviewCount,
        website:     data.website || undefined,
        status:      "new",
        notes:       "",
        source:      "google_maps",
        detectedAt:  now,
        callCount:   0,
      });
    } catch (e) {
      console.warn("Skipping place:", (e as Error).message.slice(0, 60));
    }
  }

  return leads;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    niche      = "Plombier",
    city       = "Lyon",
    radius     = 20,
    maxResults = 20,
    lat,
    lon,
  } = body as { niche: string; city: string; radius: number; maxResults: number; lat?: number; lon?: number };

  try {
    let leads: Lead[];
    let source: string;

    if (process.env.GOOGLE_MAPS_API_KEY) {
      // Mode 1 : API officielle v1 (une requête, retourne les tél. directement)
      leads  = await scrapeViaPlacesApiV1(niche, city, maxResults, lat, lon, radius * 1_000);
      source = "api-v1";
    } else {
      // Mode 2 : bot Playwright
      leads  = await scrapeViaPlaywright(niche, city, maxResults);
      source = "bot";
    }

    return NextResponse.json({ leads, total: leads.length, source });
  } catch (err) {
    console.error("[scrape-maps]", err);
    return NextResponse.json(
      { leads: [], total: 0, error: String(err) },
      { status: 500 }
    );
  }
}
