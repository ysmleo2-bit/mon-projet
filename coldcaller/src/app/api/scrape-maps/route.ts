/**
 * /api/scrape-maps  — Google Maps scraper
 *
 * Mode 1 (recommandé) : si GOOGLE_MAPS_API_KEY est défini →
 *   utilise Places Text Search + Place Details (API officielle Google)
 *
 * Mode 2 (bot headless) : si pas de clé API →
 *   utilise Playwright + Chromium pour scraper Google Maps directement
 *
 * Déploiement :
 *   - Vercel Pro (60 s) avec @sparticuz/chromium-min pour le mode bot
 *   - OU définir GOOGLE_MAPS_API_KEY dans les env vars Vercel (gratuit
 *     jusqu'à 200 $/mois de crédit ≈ 5 000 recherches/mois)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Lead } from "@/lib/types";

export const dynamic   = "force-dynamic";
export const maxDuration = 55;

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanPhone(raw: string): string {
  return raw
    .replace(/^\+33\s?/, "0")
    .replace(/^0033\s?/, "0")
    .replace(/[\s.\-]/g, " ")
    .trim();
}

function frPhoneFromText(text: string): string | null {
  const m = text.match(/(?:\+33\s?|0033\s?|(?<!\d)0)[1-9](?:[\s.\-]?\d{2}){4}(?!\d)/);
  return m ? cleanPhone(m[0]) : null;
}

// ── Mode 1 : Google Places API (officielle) ───────────────────────────────────
async function scrapeViaPlacesApi(
  niche: string, city: string, radiusM: number, maxResults: number,
): Promise<Lead[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const now = new Date().toISOString();

  // 1. Text Search
  const searchUrl =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(`${niche} ${city}`)}` +
    `&language=fr&region=fr&key=${key}`;

  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000) });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json() as {
    results: Array<{
      place_id: string; name: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number; user_ratings_total?: number;
      website?: string;
    }>;
  };

  const places = (searchData.results ?? []).slice(0, maxResults);

  // 2. Place Details pour chaque résultat (phone + website)
  const detailFetches = places.map(async (p) => {
    try {
      const detailUrl =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${p.place_id}` +
        `&fields=name,formatted_phone_number,formatted_address,rating,user_ratings_total,website,address_component` +
        `&language=fr&key=${key}`;
      const dr = await fetch(detailUrl, { signal: AbortSignal.timeout(8_000) });
      if (!dr.ok) return null;
      const dd = await dr.json() as {
        result?: {
          name: string;
          formatted_phone_number?: string;
          formatted_address?: string;
          rating?: number;
          user_ratings_total?: number;
          website?: string;
          address_component?: Array<{ long_name: string; types: string[] }>;
        };
      };
      const r = dd.result;
      if (!r) return null;

      const cityComp = r.address_component?.find((c) => c.types.includes("locality"));
      const phoneRaw = r.formatted_phone_number ?? "";

      return {
        id:          `gmaps-${p.place_id}`,
        name:        r.name,
        category:    niche,
        phone:       phoneRaw ? cleanPhone(phoneRaw) : "",
        address:     r.formatted_address ?? p.formatted_address,
        city:        cityComp?.long_name ?? city,
        rating:      r.rating ?? 0,
        reviewCount: r.user_ratings_total ?? 0,
        website:     r.website?.replace(/^https?:\/\//, ""),
        status:      "new" as const,
        notes:       "",
        source:      "google_maps" as const,
        detectedAt:  now,
        callCount:   0,
      } satisfies Lead;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(detailFetches);
  return results.filter(Boolean) as Lead[];
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
async function extractFromBrowser(
  browser: { newPage: () => Promise<BrowserPage> },
  niche: string, city: string, maxResults: number,
  mode: "playwright" | "puppeteer",
): Promise<Lead[]> {
  const page = await browser.newPage();
  const now = new Date().toISOString();

  // Set lang + UA
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

  // Accepter les cookies si dialog présent
  try {
    const cookieBtn = await page.waitForSelector(
      'button[jsname="higCR"], button[aria-label*="Tout accepter"], button[aria-label*="Accept all"]',
      { timeout: 3000 }
    );
    if (cookieBtn) await cookieBtn.click();
    await page.waitForTimeout(1000);
  } catch { /* pas de dialog */ }

  // Attendre le panneau de résultats
  await page.waitForSelector('[role="feed"], .Nv2PK, a.hfpxzc', { timeout: 15_000 });
  await page.waitForTimeout(2000);

  // Récupérer tous les liens de résultats
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
        // Nom
        const name = (
          document.querySelector("h1.DUwDvf")
          ?? document.querySelector('[data-attrid="title"] span')
          ?? document.querySelector("h1")
        )?.textContent?.trim() ?? "";

        // Téléphone — méthodes multiples
        let phone = "";
        const telEl = document.querySelector('a[href^="tel:"]');
        if (telEl) {
          phone = (telEl as HTMLAnchorElement).href.replace("tel:", "");
        } else {
          // Chercher aria-label contenant un numéro
          const btns = Array.from(document.querySelectorAll("button, [aria-label]"));
          for (const btn of btns) {
            const lbl = (btn as HTMLElement).getAttribute("aria-label") ?? "";
            if (/Appeler|phone|téléphone/i.test(lbl)) {
              const m = lbl.match(/(?:\+33|0)[0-9\s.\-]{9,15}/);
              if (m) { phone = m[0]; break; }
            }
          }
          // Dernier recours : data-value sur boutons
          if (!phone) {
            const dataVals = Array.from(document.querySelectorAll("[data-value]"));
            for (const el of dataVals) {
              const v = (el as HTMLElement).getAttribute("data-value") ?? "";
              if (/^(\+33|0)[0-9]{9}/.test(v.replace(/\s/g,""))) { phone = v; break; }
            }
          }
        }

        // Adresse
        const addrEl = document.querySelector('[data-item-id*="address"], button[aria-label*="Adresse"]');
        const address = addrEl?.getAttribute("aria-label")?.replace(/^Adresse\s*:\s*/i, "").trim()
          ?? addrEl?.textContent?.trim() ?? "";

        // Note
        const ratingEl = document.querySelector(".ceNzKf, [aria-label*='étoile']");
        const ratingText = ratingEl?.getAttribute("aria-label") ?? "";
        const ratingM = ratingText.match(/([0-9][,.]?[0-9]?)/);
        const rating = ratingM ? parseFloat(ratingM[1].replace(",", ".")) : 0;

        // Avis
        const reviewsEl = document.querySelector(".RDApEe, [aria-label*='avis']");
        const reviewsText = reviewsEl?.textContent ?? reviewsEl?.getAttribute("aria-label") ?? "";
        const reviewsM = reviewsText.match(/(\d[\d\s]*)/);
        const reviewCount = reviewsM ? parseInt(reviewsM[1].replace(/\s/g, "")) : 0;

        // Site web
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

// Type minimal partagé
interface BrowserPage {
  goto: (url: string, opts?: any) => Promise<any>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  waitForSelector: (sel: string, opts?: any) => Promise<any>;
  waitForTimeout: (ms: number) => Promise<void>;
  click?: (sel: string) => Promise<void>;
  setExtraHTTPHeaders?: (h: Record<string, string>) => Promise<void>;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    niche    = "Plombier",
    city     = "Lyon",
    radius   = 20,
    maxResults = 20,
  } = body as { niche: string; city: string; radius: number; maxResults: number };

  const radiusM = radius * 1_000;

  try {
    let leads: Lead[];

    if (process.env.GOOGLE_MAPS_API_KEY) {
      // Mode 1 : API officielle
      leads = await scrapeViaPlacesApi(niche, city, radiusM, maxResults);
    } else {
      // Mode 2 : bot Playwright
      leads = await scrapeViaPlaywright(niche, city, maxResults);
    }

    return NextResponse.json({ leads, total: leads.length, source: process.env.GOOGLE_MAPS_API_KEY ? "api" : "bot" });
  } catch (err) {
    console.error("[scrape-maps]", err);
    return NextResponse.json(
      { leads: [], total: 0, error: String(err) },
      { status: 500 }
    );
  }
}
