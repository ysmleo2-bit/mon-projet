"""
Facebook Authentication Helper — Léo Ollivier / Setting

Connexion Facebook avec Playwright et sauvegarde de la session (cookies).
Permet à tous les agents de réutiliser la session sans se reconnecter.

Usage :
  python -m agent.facebook_auth          # Login + sauvegarde session
  python -m agent.facebook_auth --check  # Vérifie si la session est valide
"""

import asyncio
import os
import re
import sys
import argparse
from pathlib import Path
from playwright.async_api import async_playwright

FB_SESSION_FILE = Path("data/fb_session.json")
CHROMIUM_PATH   = "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome"


def _proxy_settings() -> dict | None:
    """Extrait les paramètres proxy depuis les variables d'environnement."""
    raw = os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY") or \
          os.environ.get("http_proxy")  or os.environ.get("HTTP_PROXY")
    if not raw:
        return None
    # Format: http://user:pass@host:port
    m = re.match(r"https?://([^:]+):(.+)@([^:]+):(\d+)", raw)
    if m:
        return {
            "server":   f"http://{m.group(3)}:{m.group(4)}",
            "username": m.group(1),
            "password": m.group(2),
        }
    return {"server": raw}

# Sélecteurs pour le formulaire de connexion Facebook
LOGIN_SELECTORS = {
    "email":    ["#email", 'input[name="email"]'],
    "password": ["#pass",  'input[name="pass"]'],
    "submit":   ['[name="login"]', 'button[type="submit"]'],
}

COOKIE_BTNS = [
    '[data-cookiebanner="accept_button"]',
    'button[title="Tout accepter"]',
    'button[title="Allow all cookies"]',
    '[data-testid="cookie-policy-manage-dialog-accept-button"]',
    'div[aria-label="Tout accepter"]',
]


async def _accept_cookies(page) -> None:
    for sel in COOKIE_BTNS:
        try:
            await page.click(sel, timeout=3_000)
            return
        except Exception:
            continue


async def login_and_save_session(
    email: str,
    password: str,
    headless: bool = True,
) -> bool:
    """
    Connecte Playwright à Facebook avec les identifiants fournis.
    Sauvegarde les cookies dans FB_SESSION_FILE pour réutilisation.
    Retourne True si succès.
    """
    print(f"[FB Auth] Connexion à Facebook ({email})…")
    FB_SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        proxy = _proxy_settings()
        browser = await p.chromium.launch(
            headless=headless,
            slow_mo=80,
            executable_path=CHROMIUM_PATH,
            proxy=proxy,
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            ignore_https_errors=True,
        )
        page = await context.new_page()

        try:
            await page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(2)
            await _accept_cookies(page)
            await asyncio.sleep(1)

            # Remplir email
            for sel in LOGIN_SELECTORS["email"]:
                try:
                    await page.fill(sel, email, timeout=5_000)
                    break
                except Exception:
                    continue

            # Remplir mot de passe
            for sel in LOGIN_SELECTORS["password"]:
                try:
                    await page.fill(sel, password, timeout=5_000)
                    break
                except Exception:
                    continue

            # Soumettre
            for sel in LOGIN_SELECTORS["submit"]:
                try:
                    await page.click(sel, timeout=5_000)
                    break
                except Exception:
                    continue

            # Attendre la redirection post-login
            await asyncio.sleep(5)
            await page.wait_for_load_state("domcontentloaded", timeout=20_000)

            # Vérifier si connecté
            current_url = page.url
            if "login" in current_url or "checkpoint" in current_url:
                print(f"[FB Auth] ⚠ URL après login : {current_url}")
                # Tenter quand même de sauvegarder si on a des cookies utiles
                if "checkpoint" in current_url:
                    print("[FB Auth] ⚠ Vérification de sécurité Facebook détectée.")

            # Sauvegarder la session
            await context.storage_state(path=str(FB_SESSION_FILE))
            print(f"[FB Auth] ✅ Session sauvegardée → {FB_SESSION_FILE}")

            title = await page.title()
            print(f"[FB Auth] Page actuelle : {title}")

        except Exception as e:
            print(f"[FB Auth] ❌ Erreur : {e}")
            await browser.close()
            return False

        await browser.close()
        return True


async def check_session() -> bool:
    """
    Vérifie si la session sauvegardée est encore valide
    en chargeant Facebook et en vérifiant si on est connecté.
    """
    if not FB_SESSION_FILE.exists():
        print("[FB Auth] Aucune session sauvegardée.")
        return False

    async with async_playwright() as p:
        proxy = _proxy_settings()
        browser = await p.chromium.launch(headless=True, executable_path=CHROMIUM_PATH, proxy=proxy)
        context = await browser.new_context(storage_state=str(FB_SESSION_FILE), ignore_https_errors=True)
        page    = await context.new_page()

        await page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(3)

        url = page.url
        await browser.close()

        if "login" in url:
            print("[FB Auth] Session expirée.")
            return False
        else:
            print(f"[FB Auth] ✅ Session valide — URL: {url}")
            return True


def get_session_file() -> str | None:
    """Retourne le chemin vers la session FB si elle existe."""
    return str(FB_SESSION_FILE) if FB_SESSION_FILE.exists() else None


async def get_connected_context(playwright):
    """
    Helper universel : retourne un (browser, context, page) connecté à Facebook.
    Essaie dans l'ordre :
      1. Chrome CDP (port 9222)
      2. Session cookies sauvegardée
      3. Nouveau navigateur sans session (fallback)
    """
    # 1. Chrome CDP existant
    try:
        browser  = await playwright.chromium.connect_over_cdp("http://localhost:9222")
        context  = browser.contexts[0]
        page     = context.pages[0] if context.pages else await context.new_page()
        print("[FB Auth] Connecté au Chrome existant via CDP.")
        return browser, context, page
    except Exception:
        pass

    # 2. Session sauvegardée
    session = get_session_file()
    proxy = _proxy_settings()
    browser = await playwright.chromium.launch(
        headless=True,
        slow_mo=30,
        executable_path=CHROMIUM_PATH,
        proxy=proxy,
    )
    if session:
        context = await browser.new_context(
            storage_state=session,
            ignore_https_errors=True,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        print("[FB Auth] Session Facebook chargée depuis le cache.")
    else:
        context = await browser.new_context(ignore_https_errors=True)
        print("[FB Auth] ⚠ Aucune session — navigateur sans cookies.")

    page = await context.new_page()
    return browser, context, page


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Vérifier la session existante")
    parser.add_argument("--headless", action="store_true", default=True)
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    if args.check:
        valid = asyncio.run(check_session())
        sys.exit(0 if valid else 1)
    else:
        email    = os.environ.get("FB_EMAIL", "")
        password = os.environ.get("FB_PASSWORD", "")
        if not email or not password:
            print("[FB Auth] FB_EMAIL et FB_PASSWORD requis dans .env")
            sys.exit(1)
        ok = asyncio.run(login_and_save_session(email, password, headless=True))
        sys.exit(0 if ok else 1)
