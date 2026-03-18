"""
Agent 1 — ScraperAgent
Scrape les posts et commentaires des groupes Facebook ciblés.
Objectif : collecter le contenu brut qui révèle les douleurs, questions
et comportements récurrents de chaque communauté.

Stratégie de collecte :
  - Posts populaires (likes, commentaires, partages)
  - Questions fréquemment posées
  - Plaintes récurrentes
  - Témoignages / success stories
"""
from __future__ import annotations


import asyncio
import json
import os
import random
import re
import time
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext

SCRAPED_DIR = Path("data/scraped_posts")
SCRAPED_DIR.mkdir(parents=True, exist_ok=True)

# Sélecteurs Facebook (à ajuster si Facebook change son DOM)
POST_SELECTORS = [
    'div[data-ad-comet-preview="message"]',
    'div[data-ad-preview="message"]',
    'div.x1iorvi4 span',
    'div[role="article"] span[dir="auto"]',
]
COMMENT_SELECTORS = [
    'div[aria-label*="Commentaire"]',
    'ul[role="presentation"] > li',
    'div.x1n2onr6 span[dir="auto"]',
]


class ScraperAgent:
    """
    Scrape le contenu d'un groupe Facebook pour alimenter l'analyseur.
    Collecte : titres de posts, textes, commentaires, réactions.
    """

    def __init__(self, max_posts_per_group: int = 30, headless: bool = False):
        self.max_posts   = max_posts_per_group
        self.headless    = headless
        self.context: BrowserContext | None = None
        self.page: Page | None = None

    # ── Connexion au navigateur ───────────────────────────────────────────────

    async def connect(self):
        """Se connecte au Chrome existant (déjà connecté à Facebook) via CDP."""
        p = await async_playwright().start()
        try:
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
            self.context = browser.contexts[0]
            self.page    = self.context.pages[0] if self.context.pages else await self.context.new_page()
            print("[Scraper] Connecté au Chrome existant.")
        except Exception:
            print("[Scraper] Chrome CDP indisponible — lancement d'un nouveau navigateur.")
            browser      = await p.chromium.launch(
                headless=self.headless,
                slow_mo=30,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            self.context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            )
            self.page = await self.context.new_page()

        # Vérifier si connecté à Facebook, sinon auto-login
        await self._ensure_facebook_login()
        return self

    async def _ensure_facebook_login(self):
        """Vérifie la connexion Facebook et tente un login si nécessaire."""
        from dotenv import load_dotenv
        load_dotenv()
        fb_email    = os.environ.get("FB_EMAIL", "")
        fb_password = os.environ.get("FB_PASSWORD", "")

        try:
            await self.page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=20_000)
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[Scraper] Impossible d'accéder à Facebook : {e}")
            return

        # Détecte si on est déjà connecté (présence du menu principal)
        is_logged_in = await self.page.query_selector('[aria-label="Accueil"]') or \
                       await self.page.query_selector('[aria-label="Home"]') or \
                       await self.page.query_selector('div[role="navigation"]')

        if is_logged_in:
            print("[Scraper] ✓ Déjà connecté à Facebook.")
            return

        if not fb_email or not fb_password:
            print("[Scraper] ✗ FB_EMAIL ou FB_PASSWORD manquant dans .env — connexion impossible.")
            return

        print(f"[Scraper] Connexion à Facebook avec {fb_email}…")
        try:
            # Remplir le formulaire de connexion
            email_sel = 'input#email, input[name="email"]'
            pass_sel  = 'input#pass, input[name="pass"]'
            await self.page.wait_for_selector(email_sel, timeout=10_000)
            await self.page.fill(email_sel, fb_email)
            await asyncio.sleep(random.uniform(0.5, 1.2))
            await self.page.fill(pass_sel, fb_password)
            await asyncio.sleep(random.uniform(0.5, 1.0))
            await self.page.click('button[name="login"], [data-testid="royal_login_button"]')
            await asyncio.sleep(5)

            # Vérifier si 2FA nécessaire
            twofa = await self.page.query_selector('input[name="approvals_code"]') or \
                    await self.page.query_selector('#approvals_code')
            if twofa:
                print("[Scraper] ⚠ Facebook demande un code 2FA.")
                print("          Entrez le code dans le terminal (ou laissez vide pour ignorer) :")
                code = input("Code 2FA : ").strip()
                if code:
                    await twofa.fill(code)
                    await self.page.keyboard.press("Enter")
                    await asyncio.sleep(4)

            # Confirmer la connexion
            logged = await self.page.query_selector('[aria-label="Accueil"]') or \
                     await self.page.query_selector('[aria-label="Home"]')
            if logged:
                print("[Scraper] ✓ Connexion Facebook réussie.")
            else:
                print("[Scraper] ⚠ Connexion incertaine — vérifiez le compte.")
        except Exception as e:
            print(f"[Scraper] ✗ Erreur lors de la connexion : {e}")

    # ── Navigation humaine ────────────────────────────────────────────────────

    async def _human_scroll(self, times: int = 3):
        for _ in range(times):
            delta = random.randint(400, 900)
            await self.page.mouse.wheel(0, delta)
            await asyncio.sleep(random.uniform(1.0, 2.5))

    async def _wait(self, min_s=1.5, max_s=3.5):
        await asyncio.sleep(random.uniform(min_s, max_s))

    # ── Extraction du texte d'un post ─────────────────────────────────────────

    async def _extract_post_texts(self) -> list[str]:
        texts = []
        for sel in POST_SELECTORS:
            try:
                elements = await self.page.query_selector_all(sel)
                for el in elements:
                    text = (await el.inner_text()).strip()
                    if len(text) > 30 and text not in texts:
                        texts.append(text)
                if texts:
                    break
            except Exception:
                continue
        return texts

    async def _extract_comments(self) -> list[str]:
        comments = []
        # Clic sur "Voir les commentaires"
        try:
            see_comments = await self.page.query_selector('[aria-label*="commentaire"]')
            if see_comments:
                await see_comments.click()
                await self._wait(1, 2)
        except Exception:
            pass
        for sel in COMMENT_SELECTORS:
            try:
                elements = await self.page.query_selector_all(sel)
                for el in elements:
                    text = (await el.inner_text()).strip()
                    if len(text) > 15:
                        comments.append(text[:500])
                if comments:
                    break
            except Exception:
                continue
        return comments[:20]

    # ── Scraping d'un groupe ──────────────────────────────────────────────────

    async def scrape_group(self, group: dict) -> dict:
        """
        Scrape un groupe Facebook et retourne un dict structuré.
        group = {"name": str, "id": str, "url": str, "category": str}
        """
        group_id  = group["id"]
        group_url = f"https://www.facebook.com/groups/{group_id}"
        print(f"\n[Scraper] → {group['name']} ({group_url})")

        result = {
            "group_id":   group_id,
            "group_name": group["name"],
            "category":   group.get("category", ""),
            "scraped_at": datetime.utcnow().isoformat(),
            "posts":      [],
        }

        try:
            await self.page.goto(group_url, wait_until="domcontentloaded", timeout=30_000)
            await self._wait(2, 4)
            await self._human_scroll(2)

            posts_collected = 0
            scroll_attempts = 0

            while posts_collected < self.max_posts and scroll_attempts < 12:
                texts = await self._extract_post_texts()
                for text in texts:
                    if posts_collected >= self.max_posts:
                        break
                    # Filtrer les textes trop courts ou publicitaires
                    if len(text) < 40:
                        continue
                    already = any(p["text"][:80] == text[:80] for p in result["posts"])
                    if already:
                        continue

                    result["posts"].append({
                        "text":     text[:1500],
                        "comments": [],  # rempli en mode deep si activé
                    })
                    posts_collected += 1

                await self._human_scroll(random.randint(2, 4))
                scroll_attempts += 1

            print(f"  ✓ {posts_collected} posts collectés dans {group['name']}")

        except Exception as e:
            print(f"  ✗ Erreur scraping {group['name']} : {e}")

        # Sauvegarde locale
        out_path = SCRAPED_DIR / f"{group_id}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return result

    # ── Scraping de plusieurs groupes ─────────────────────────────────────────

    async def scrape_groups(self, groups: list[dict]) -> list[dict]:
        results = []
        for i, group in enumerate(groups):
            data = await self.scrape_group(group)
            results.append(data)
            if i < len(groups) - 1:
                delay = random.uniform(45, 90)
                print(f"  ⏱  Attente {delay:.0f}s avant le prochain groupe…")
                await asyncio.sleep(delay)
        return results

    # ── Chargement d'un résultat déjà scrapé ──────────────────────────────────

    @staticmethod
    def load_cached(group_id: str) -> dict | None:
        path = SCRAPED_DIR / f"{group_id}.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return None

    @staticmethod
    def all_cached() -> list[dict]:
        results = []
        for path in SCRAPED_DIR.glob("*.json"):
            with open(path, encoding="utf-8") as f:
                results.append(json.load(f))
        return results


# ── Point d'entrée standalone ────────────────────────────────────────────────

async def main(group_ids: list[str] | None = None):
    from config import FB_GROUPS_PRIORITY
    groups = FB_GROUPS_PRIORITY if not group_ids else [
        {"id": gid, "name": gid, "category": ""} for gid in group_ids
    ]
    agent = ScraperAgent(max_posts_per_group=25)
    await agent.connect()
    results = await agent.scrape_groups(groups)
    print(f"\n[Scraper] Terminé : {len(results)} groupes scrapés.")


if __name__ == "__main__":
    asyncio.run(main())
