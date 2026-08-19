/**
 * Scraper Google Maps (Playwright).
 *
 * ATTENTION : cet outil automatise la lecture de pages publiques de Google
 * Maps. Cela viole les Conditions d'Utilisation de Google (pas d'usage
 * automatisé / scraping). Ce n'est pas illégal pénalement dans la plupart
 * des juridictions pour de la donnée publique non authentifiée, mais c'est
 * un manquement contractuel qui peut entraîner un blocage d'IP ou de
 * compte. Reste sur des volumes raisonnables. Pour du volume ou une
 * fiabilité garantie contractuellement, utilise l'API Google Places
 * officielle à la place.
 *
 * Nécessite la dépendance "playwright" (ajoutée au package.json) et un
 * Chromium local : `npx playwright install chromium`.
 */
import fs from 'fs';
import { chromium } from 'playwright-core';

const DEFAULT_TIMEOUT = 30000;

// Si un Chromium pré-téléchargé existe à cet emplacement (environnements
// sandboxés type CI/cloud), on l'utilise explicitement pour éviter les
// soucis de version. Sur une machine de dev classique ce chemin n'existe
// pas et Playwright résout son propre Chromium managé.
const LOCAL_CHROMIUM_PATH = '/opt/pw-browsers/chromium';
function resolveExecutablePath(): string | undefined {
  try {
    if (fs.existsSync(LOCAL_CHROMIUM_PATH)) return LOCAL_CHROMIUM_PATH;
  } catch {
    /* ignore */
  }
  return undefined;
}

export interface GoogleMapsRecord {
  source_url: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
}

function buildSearchUrl(query: string, location?: string) {
  const q = location ? `${query} ${location}` : query;
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=fr`;
}

async function dismissConsent(page: import('playwright-core').Page) {
  const candidates = [
    'button:has-text("Tout refuser")',
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter tout")',
    'button:has-text("Reject all")',
    'button:has-text("Accept all")',
    'form[action*="consent"] button',
  ];
  for (const sel of candidates) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(800);
        return;
      }
    } catch {
      /* not present, keep trying */
    }
  }
}

function normalizePlaceUrl(href: string) {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname.split('/').slice(0, 5).join('/')}`;
  } catch {
    return href;
  }
}

async function collectPlaceLinks(page: import('playwright-core').Page, limit: number) {
  const feed = page.locator('[role="feed"]').first();
  await feed.waitFor({ timeout: DEFAULT_TIMEOUT });

  const seen = new Map<string, string>();
  let idleRounds = 0;
  const maxIdleRounds = 4;

  while (seen.size < limit && idleRounds < maxIdleRounds) {
    const hrefs = await page.locator('a[href*="/maps/place/"]').evaluateAll((els: HTMLAnchorElement[]) =>
      els.map((e) => e.href)
    );
    const before = seen.size;
    for (const href of hrefs) {
      const key = normalizePlaceUrl(href);
      if (!seen.has(key)) seen.set(key, href);
      if (seen.size >= limit) break;
    }
    idleRounds = seen.size === before ? idleRounds + 1 : 0;
    if (seen.size >= limit) break;

    await feed.evaluate((node: Element) => (node as HTMLElement).scrollTo(0, node.scrollHeight));
    await page.waitForTimeout(1200);
  }

  return Array.from(seen.values()).slice(0, limit);
}

function parseAriaAfterColon(label: string | null) {
  if (!label) return null;
  const idx = label.indexOf(':');
  return idx >= 0 ? label.slice(idx + 1).trim() : label.trim();
}

async function extractPlaceDetails(page: import('playwright-core').Page, url: string): Promise<GoogleMapsRecord> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(600);

  const name = await page.locator('h1').first().innerText().catch(() => null);

  const phoneLabel = await page
    .locator('[data-item-id^="phone:"]')
    .first()
    .getAttribute('aria-label')
    .catch(() => null);
  const phone = parseAriaAfterColon(phoneLabel);

  const addressLabel = await page
    .locator('[data-item-id="address"]')
    .first()
    .getAttribute('aria-label')
    .catch(() => null);
  const address = parseAriaAfterColon(addressLabel);

  const website = await page
    .locator('a[data-item-id="authority"]')
    .first()
    .getAttribute('href')
    .catch(() => null);

  const category = await page
    .locator('button[jsaction*="category"]')
    .first()
    .innerText()
    .catch(() => null);

  let rating: number | null = null;
  let reviewCount: number | null = null;
  try {
    const ratingLabel = await page
      .locator('span[aria-label*="étoiles"], span[aria-label*="stars"]')
      .first()
      .getAttribute('aria-label');
    if (ratingLabel) {
      const ratingMatch = ratingLabel.match(/[\d.,]+/);
      if (ratingMatch) rating = parseFloat(ratingMatch[0].replace(',', '.'));
      const reviewMatch = ratingLabel.match(/([\d.,]+)\s*(avis|reviews)/i);
      if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/[.,]/g, ''), 10);
    }
  } catch {
    /* not found */
  }

  return {
    source_url: url,
    name: name ? name.trim() : null,
    phone,
    address,
    website: website || null,
    category: category ? category.trim() : null,
    rating,
    review_count: reviewCount,
  };
}

export interface ScrapeOptions {
  query: string;
  location?: string;
  limit?: number;
  onLog?: (message: string) => void;
}

/** Scrape Google Maps pour une requête + localisation donnée. */
export async function scrapeGoogleMaps({ query, location, limit = 20, onLog }: ScrapeOptions): Promise<GoogleMapsRecord[]> {
  if (!query?.trim()) throw new Error('query is required');
  const cappedLimit = Math.max(1, Math.min(limit, 200));
  const log = onLog ?? (() => {});

  const browser = await chromium.launch({ headless: true, executablePath: resolveExecutablePath() });
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const page = await context.newPage();

  const results: GoogleMapsRecord[] = [];
  try {
    const searchUrl = buildSearchUrl(query, location);
    log(`Ouverture de la recherche : ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
    await dismissConsent(page);
    await page.waitForTimeout(1000);

    log('Récupération de la liste des établissements…');
    const links = await collectPlaceLinks(page, cappedLimit);
    log(`${links.length} établissement(s) trouvé(s), extraction des détails…`);

    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      try {
        const details = await extractPlaceDetails(page, url);
        results.push(details);
        log(`(${i + 1}/${links.length}) ${details.name ?? url} — ${details.phone ?? 'pas de téléphone public'}`);
      } catch (err) {
        log(`Erreur sur ${url}: ${(err as Error).message}`);
      }
      await page.waitForTimeout(500 + Math.random() * 700);
    }
  } finally {
    await browser.close();
  }

  return results;
}
