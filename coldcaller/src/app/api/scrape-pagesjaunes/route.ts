/**
 * /api/scrape-pagesjaunes
 *
 * Scrape Pages Jaunes via navigateur stealth (contourne Cloudflare).
 * Retourne une liste de { name, phone, address, city } avec les vrais numéros.
 *
 * Sur Vercel Pro (60 s) → fonctionne pleinement
 * Sur Vercel Hobby (10 s) → timeout, retourne [] gracieusement
 * En développement local → utilise le Chromium Playwright installé
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 55;

export interface PJBusiness {
  name:    string;
  phone:   string;
  address: string;
  city:    string;
}

function cleanPhone(raw: string): string {
  return raw
    .replace(/^\+33\s?/, "0")
    .replace(/^0033\s?/, "0")
    .replace(/[\s.\-]/g, " ")
    .trim();
}

// ── Extraction depuis le HTML Pages Jaunes ────────────────────────────────────
async function extractFromPJ(
  browser: { newPage: () => Promise<any> },
  niche: string, city: string,
): Promise<PJBusiness[]> {
  const page = await browser.newPage();

  try {
    // Headers réalistes
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "fr-FR,fr;q=0.9",
      "Sec-CH-UA": '"Chromium";v="131","Not_A-Brand";v="99","Google Chrome";v="131"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
    });

    const url = `https://www.pagesjaunes.fr/annuaire/chercherlespros` +
      `?quoiqui=${encodeURIComponent(niche)}&ou=${encodeURIComponent(city)}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(3000);

    const html = await page.content();

    // Si Cloudflare challenge → pages.jaunes bloque
    if (html.includes("_cf_chl_opt") || html.includes("cf-ray") || html.length < 5000) {
      return [];
    }

    // Accepter les cookies si présent
    try {
      const btn = await page.waitForSelector(
        'button[id*="accept"], button[class*="accept"], #didomi-notice-agree-button',
        { timeout: 2000 }
      );
      if (btn) { await btn.click(); await page.waitForTimeout(1000); }
    } catch { /* pas de dialog */ }

    // Extraire les fiches métier
    const results: PJBusiness[] = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        ".bi-bloc-contain, [class*=\"bloc-identite\"], .result-item"
      );

      const out: { name: string; phone: string; address: string; city: string }[] = [];

      cards.forEach((card) => {
        // Nom
        const nameEl = card.querySelector(
          ".bi-denomination a, .denomination-links a, [class*=\"denomination\"] a, h2 a, h3 a"
        );
        const name = nameEl?.textContent?.trim() ?? "";
        if (!name) return;

        // Téléphone — plusieurs sélecteurs PJ
        let phone = "";
        const telLink = card.querySelector<HTMLAnchorElement>("a[href^=\"tel:\"]");
        if (telLink) {
          phone = telLink.href.replace("tel:", "").trim();
        } else {
          // Chercher dans data-number ou aria-label
          const telEl = card.querySelector(
            "[data-phone], [data-number], [class*=\"numero\"], [class*=\"phone\"]"
          );
          if (telEl) {
            phone = (telEl as HTMLElement).getAttribute("data-phone")
              || (telEl as HTMLElement).getAttribute("data-number")
              || telEl.textContent?.trim()
              || "";
          }
        }

        // Adresse
        const addrEl = card.querySelector(
          ".bi-address, [class*=\"address\"], address"
        );
        const fullAddr = addrEl?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const cityMatch = fullAddr.match(/\d{5}\s+(.+)$/);
        const addrCity = cityMatch ? cityMatch[1] : "";
        const address  = fullAddr.replace(/\d{5}\s*.+$/, "").trim();

        out.push({ name, phone, address, city: addrCity });
      });

      return out;
    });

    return results
      .filter((r) => !!r.name)
      .map((r) => ({ ...r, phone: r.phone ? cleanPhone(r.phone) : "" }));

  } finally {
    await page.close();
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { niche = "Plombier", city = "Lyon" } = await req.json() as {
    niche: string; city: string;
  };

  try {
    // Essayer d'abord puppeteer-extra avec le plugin stealth (contourne Cloudflare)
    try {
      const puppeteerExtra = (await import("puppeteer-extra")).default;
      const StealthPlugin   = (await import("puppeteer-extra-plugin-stealth")).default;
      puppeteerExtra.use(StealthPlugin());

      let executablePath: string;
      let args: string[];

      try {
        const chromium = (await import("@sparticuz/chromium-min")).default;
        executablePath = await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
        );
        args = chromium.args;
      } catch {
        // Dev local
        executablePath = process.env.CHROMIUM_PATH
          || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
        args = ["--no-sandbox", "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", "--disable-gpu"];
      }

      const browser = await puppeteerExtra.launch({
        executablePath,
        args,
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
      } as any);

      try {
        const results = await extractFromPJ(browser as any, niche, city);
        return NextResponse.json({ results, source: "pagesjaunes" });
      } finally {
        await browser.close();
      }

    } catch {
      // Fallback playwright-core (dev sans sparticuz)
      const { chromium } = await import("playwright-core");
      const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH
          || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox",
               "--disable-dev-shm-usage", "--disable-gpu"],
      });
      try {
        const results = await extractFromPJ(browser as any, niche, city);
        return NextResponse.json({ results, source: "pagesjaunes-pw" });
      } finally {
        await browser.close();
      }
    }
  } catch (err) {
    console.error("[scrape-pagesjaunes]", err);
    return NextResponse.json({ results: [], error: String(err) });
  }
}
