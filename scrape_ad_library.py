"""
Scraper Meta Ad Library — Analyse concurrents FR B2C Coaching/Formation
Utilise Playwright pour scraper https://www.facebook.com/ads/library/
"""

import asyncio
import json
import os
import re
import time
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

DATA_DIR = Path("data/competitors")
DATA_DIR.mkdir(parents=True, exist_ok=True)

AD_LIBRARY_BASE = "https://www.facebook.com/ads/library/"


async def scrape_competitor_ads(page, competitor: dict) -> list[dict]:
    """Scrape les pubs d'un concurrent depuis la Meta Ad Library."""
    ads = []
    name = competitor["name"]
    print(f"\n[→] Scraping: {name}")

    for search_term in competitor["search_terms"][:2]:  # max 2 termes par concurrent
        url = (
            f"{AD_LIBRARY_BASE}?active_status=all&ad_type=all"
            f"&country=FR&q={search_term.replace(' ', '+')}"
            f"&search_type=keyword_unordered&media_type=all"
        )
        try:
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)

            # Fermer cookie banner si présent
            try:
                await page.click('[data-testid="cookie-policy-manage-dialog-accept-button"]', timeout=3000)
            except Exception:
                pass
            try:
                await page.click('button:has-text("Allow all cookies")', timeout=2000)
            except Exception:
                pass
            try:
                await page.click('button:has-text("Accepter")', timeout=2000)
            except Exception:
                pass

            # Scroll pour charger plus de pubs
            for _ in range(5):
                await page.keyboard.press("End")
                await page.wait_for_timeout(1500)

            # Extraire les cartes de pubs
            ad_cards = await page.query_selector_all('[data-testid="ad-card"]')
            if not ad_cards:
                # Fallback: chercher d'autres sélecteurs
                ad_cards = await page.query_selector_all('._8i4u')
                if not ad_cards:
                    ad_cards = await page.query_selector_all('[class*="adCard"]')

            print(f"   [{search_term}] → {len(ad_cards)} cartes trouvées")

            for card in ad_cards[:20]:  # max 20 pubs par recherche
                try:
                    ad_data = await extract_ad_data(card, competitor)
                    if ad_data:
                        ads.append(ad_data)
                except Exception as e:
                    print(f"   [!] Erreur extraction carte: {e}")
                    continue

            await page.wait_for_timeout(2000)

        except PlaywrightTimeout:
            print(f"   [!] Timeout sur: {search_term}")
            continue
        except Exception as e:
            print(f"   [!] Erreur: {e}")
            continue

    # Dédup par texte
    seen = set()
    unique_ads = []
    for ad in ads:
        key = ad.get("ad_text", "")[:100]
        if key not in seen:
            seen.add(key)
            unique_ads.append(ad)

    print(f"   [✓] {len(unique_ads)} pubs uniques pour {name}")
    return unique_ads


async def extract_ad_data(card, competitor: dict) -> dict | None:
    """Extrait les données d'une carte publicitaire."""
    try:
        ad = {
            "competitor": competitor["name"],
            "niche": competitor["niche"],
            "scraped_at": datetime.now().isoformat(),
            "ad_text": "",
            "headline": "",
            "cta": "",
            "ad_format": "",
            "page_name": "",
            "start_date": "",
            "impressions": "",
            "platforms": [],
            "ad_url": "",
            "image_url": "",
        }

        # Texte principal de la pub
        text_selectors = [
            '[data-testid="ad-card-body"]',
            '._4bl9',
            '[class*="bodyText"]',
            'div[class*="text"]',
        ]
        for sel in text_selectors:
            try:
                el = await card.query_selector(sel)
                if el:
                    ad["ad_text"] = (await el.inner_text()).strip()[:2000]
                    break
            except Exception:
                pass

        # Headline / titre
        headline_selectors = ['[data-testid="ad-card-title"]', 'h2', 'h3', '._5pbx']
        for sel in headline_selectors:
            try:
                el = await card.query_selector(sel)
                if el:
                    ad["headline"] = (await el.inner_text()).strip()[:300]
                    break
            except Exception:
                pass

        # CTA
        cta_selectors = ['[data-testid="ad-card-cta"]', 'button', 'a[role="button"]']
        for sel in cta_selectors:
            try:
                el = await card.query_selector(sel)
                if el:
                    cta_text = (await el.inner_text()).strip()
                    if cta_text and len(cta_text) < 50:
                        ad["cta"] = cta_text
                        break
            except Exception:
                pass

        # Date de début
        try:
            date_el = await card.query_selector('[data-testid="start-date"]')
            if date_el:
                ad["start_date"] = (await date_el.inner_text()).strip()
        except Exception:
            pass

        # Format (vidéo ou image)
        try:
            video_el = await card.query_selector("video")
            carousel_el = await card.query_selector('[data-testid="carousel"]')
            if video_el:
                ad["ad_format"] = "video"
            elif carousel_el:
                ad["ad_format"] = "carousel"
            else:
                ad["ad_format"] = "image"
        except Exception:
            ad["ad_format"] = "unknown"

        # Image URL
        try:
            img_el = await card.query_selector("img")
            if img_el:
                ad["image_url"] = await img_el.get_attribute("src") or ""
        except Exception:
            pass

        # Vérification: on ne garde que si on a au moins du texte
        if not ad["ad_text"] and not ad["headline"]:
            # Essai global du texte de la carte
            try:
                full_text = (await card.inner_text()).strip()
                if full_text:
                    ad["ad_text"] = full_text[:2000]
            except Exception:
                pass

        if not ad["ad_text"] and not ad["headline"]:
            return None

        return ad

    except Exception:
        return None


async def scrape_all_competitors(competitors: list[dict]) -> dict:
    """Lance le scraping de tous les concurrents."""
    results = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="fr-FR",
            timezone_id="Europe/Paris",
        )

        page = await context.new_page()

        # Masquer WebDriver
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            window.chrome = {runtime: {}};
        """)

        for competitor in competitors:
            try:
                ads = await scrape_competitor_ads(page, competitor)
                results[competitor["name"]] = {
                    "competitor_info": competitor,
                    "ads": ads,
                    "total_ads": len(ads),
                }

                # Sauvegarder au fur et à mesure
                output_file = DATA_DIR / f"{competitor['name'].replace(' ', '_').lower()}_ads.json"
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(results[competitor["name"]], f, ensure_ascii=False, indent=2)

                # Pause anti-rate-limit
                await page.wait_for_timeout(3000)

            except Exception as e:
                print(f"[!] Erreur globale pour {competitor['name']}: {e}")
                results[competitor["name"]] = {
                    "competitor_info": competitor,
                    "ads": [],
                    "total_ads": 0,
                    "error": str(e)
                }

        await browser.close()

    return results


def load_config() -> dict:
    with open("competitors_config.json", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    config = load_config()
    # Tier 1 uniquement (gros spenders)
    tier1 = [c for c in config["competitors"] if c["tier"] == 1]

    print(f"[*] Scraping Meta Ad Library — {len(tier1)} concurrents Tier 1")
    print(f"[*] Marché: {config['market']}")
    print("=" * 60)

    results = asyncio.run(scrape_all_competitors(tier1))

    # Sauvegarde globale
    output_path = DATA_DIR / "all_competitors_ads.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n[✓] Scraping terminé.")
    total_ads = sum(v["total_ads"] for v in results.values())
    print(f"[✓] Total pubs collectées: {total_ads}")
    print(f"[✓] Données sauvées: {output_path}")
