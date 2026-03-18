"""
Automation Facebook — Léo Ollivier / Setting
Poste dans les groupes Facebook avec comportement humain simulé.

Prérequis :
  - Chrome ouvert et connecté au compte Facebook de Léo
  - Playwright installé : playwright install chromium
  - upload_manifest.json présent (généré par upload_drive.py)
"""

import asyncio
import json
import random
import time
import os
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright, Page

from config import (
    FB_GROUPS_PRIORITY,
    DELAY_BETWEEN_GROUPS_MIN, DELAY_BETWEEN_GROUPS_MAX,
    DELAY_BETWEEN_POSTS_MIN, DELAY_BETWEEN_POSTS_MAX,
    MAX_POSTS_PER_HOUR, POSTS_PER_DAY_PER_GROUP,
    SCROLL_BEFORE_POST_MIN, SCROLL_BEFORE_POST_MAX,
    TYPING_DELAY_MIN_MS, TYPING_DELAY_MAX_MS,
    CLICK_WAIT_MIN, CLICK_WAIT_MAX,
    DESCRIPTIONS_DIR,
)

MANIFEST_PATH  = "upload_manifest.json"
POST_LOG_PATH  = "post_log.json"


# ── Helpers ───────────────────────────────────────────────────────────────────

def rand_delay(min_s: float, max_s: float) -> float:
    return random.uniform(min_s, max_s)


def load_manifest() -> list[dict]:
    if not os.path.exists(MANIFEST_PATH):
        raise FileNotFoundError(
            f"{MANIFEST_PATH} introuvable. Lancez d'abord upload_drive.py."
        )
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_post_text(index: int) -> str:
    """Charge le texte de post v{index:02d} depuis DESCRIPTIONS_DIR."""
    path = Path(DESCRIPTIONS_DIR) / f"v{index:02d}.txt"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    # Fallback générique
    return (
        "Tu veux gagner entre 1500€ et 3000€/mois depuis chez toi sans expérience ?\n\n"
        "Le métier de Setter est en plein boom. Je t'explique tout.\n\n"
        "👇 Commente « INFO » pour recevoir les détails."
    )


def load_post_log() -> dict:
    if os.path.exists(POST_LOG_PATH):
        with open(POST_LOG_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_post_log(log: dict) -> None:
    with open(POST_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def count_posts_last_hour(log: dict) -> int:
    now = time.time()
    return sum(
        1 for entry in log.values()
        if isinstance(entry, list)
        for ts in entry
        if now - ts < 3600
    )


def group_url(group_id: str) -> str:
    """Construit l'URL du groupe Facebook."""
    if group_id.isdigit():
        return f"https://www.facebook.com/groups/{group_id}"
    return f"https://www.facebook.com/groups/{group_id}"


# ── Comportement humain ───────────────────────────────────────────────────────

async def human_scroll(page: Page, times: int = None) -> None:
    n = times or random.randint(SCROLL_BEFORE_POST_MIN, SCROLL_BEFORE_POST_MAX)
    for _ in range(n):
        delta = random.randint(300, 800)
        await page.mouse.wheel(0, delta)
        await asyncio.sleep(random.uniform(0.8, 2.0))


async def human_type(page: Page, selector: str, text: str) -> None:
    """Tape le texte caractère par caractère avec délai aléatoire."""
    await page.click(selector)
    await asyncio.sleep(random.uniform(0.3, 0.8))
    for char in text:
        await page.keyboard.type(char)
        await asyncio.sleep(random.uniform(
            TYPING_DELAY_MIN_MS / 1000,
            TYPING_DELAY_MAX_MS / 1000,
        ))


# ── Logique de post ───────────────────────────────────────────────────────────

async def post_to_group(
    page: Page,
    group: dict,
    text: str,
    image_path: str | None = None,
) -> bool:
    """
    Navigue vers le groupe et publie le post.
    Retourne True si succès, False sinon.
    """
    url = group_url(group["id"])
    print(f"  → Navigation vers {group['name']} ({url})")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(random.uniform(2, 4))
    except Exception as e:
        print(f"  ✗ Impossible d'accéder au groupe : {e}")
        return False

    # Scroll humain avant de cliquer
    await human_scroll(page)

    # Clic sur la zone de création de publication
    create_selectors = [
        '[aria-label*="Créer une publication"]',
        '[aria-label*="Écrire quelque chose"]',
        '[data-pagelet="GroupComposer"] [role="button"]',
        'div[role="button"][tabindex="0"]:has-text("Écrire")',
        'span:has-text("Écrire quelque chose")',
    ]
    clicked = False
    for sel in create_selectors:
        try:
            await page.click(sel, timeout=5_000)
            clicked = True
            break
        except Exception:
            continue

    if not clicked:
        print("  ✗ Zone de publication introuvable.")
        return False

    await asyncio.sleep(random.uniform(CLICK_WAIT_MIN, CLICK_WAIT_MAX))

    # Saisie du texte
    text_selectors = [
        '[contenteditable="true"][role="textbox"]',
        'div[aria-label*="Quoi de neuf"]',
        'div[aria-label*="Écrire quelque chose"]',
        'div.notranslate[contenteditable="true"]',
    ]
    typed = False
    for sel in text_selectors:
        try:
            await page.wait_for_selector(sel, timeout=5_000)
            await human_type(page, sel, text)
            typed = True
            break
        except Exception:
            continue

    if not typed:
        print("  ✗ Zone de texte introuvable.")
        return False

    # Upload image si fournie
    if image_path and os.path.exists(image_path):
        try:
            photo_btn_selectors = [
                'input[type="file"][accept*="image"]',
                '[aria-label*="Photo/vidéo"]',
                '[aria-label*="Ajouter une photo"]',
            ]
            for sel in photo_btn_selectors:
                try:
                    await page.set_input_files(sel, image_path, timeout=5_000)
                    print(f"  ✓ Image attachée : {os.path.basename(image_path)}")
                    await asyncio.sleep(random.uniform(2, 4))
                    break
                except Exception:
                    continue
        except Exception as e:
            print(f"  ⚠ Image non attachée : {e}")

    # Clic sur Publier
    publish_selectors = [
        '[aria-label="Publier"]',
        'div[aria-label="Publier"]',
        'button:has-text("Publier")',
        'span:has-text("Publier")',
    ]
    published = False
    for sel in publish_selectors:
        try:
            await page.click(sel, timeout=5_000)
            published = True
            break
        except Exception:
            continue

    if published:
        await asyncio.sleep(random.uniform(3, 6))
        print(f"  ✓ Post publié dans {group['name']} à {datetime.now().strftime('%H:%M:%S')}")
        return True
    else:
        print("  ✗ Bouton Publier introuvable.")
        return False


# ── Chargement des groupes depuis le Sheet ────────────────────────────────────

def load_groups_from_manifest_or_config() -> list[dict]:
    """
    Tente de charger la liste complète depuis groups_today.json (généré par pipeline_publish),
    puis groups_manifest.json, sinon utilise FB_GROUPS_PRIORITY depuis config.py.
    """
    for fname in ("groups_today.json", "groups_manifest.json"):
        if os.path.exists(fname):
            with open(fname, encoding="utf-8") as f:
                return json.load(f)
    print("[WARN] Aucun manifest de groupes trouvé, utilisation des groupes prioritaires de config.py")
    return FB_GROUPS_PRIORITY


# ── Orchestrateur principal ───────────────────────────────────────────────────

async def run_posting_session(max_groups: int = None):
    groups   = load_groups_from_manifest_or_config()
    manifest = load_manifest()
    post_log = load_post_log()

    if not manifest:
        print("[ERREUR] Aucune image dans upload_manifest.json.")
        return

    if max_groups:
        groups = groups[:max_groups]

    print(f"\n=== Session de posting : {len(groups)} groupes / {len(manifest)} visuels ===\n")

    async with async_playwright() as p:
        from agent.facebook_auth import get_connected_context
        browser, context, page = await get_connected_context(p)

        post_index   = 0
        posts_this_hour = count_posts_last_hour(post_log)

        for group_idx, group in enumerate(groups):
            group_id = group["id"]
            print(f"\n[{group_idx + 1}/{len(groups)}] Groupe : {group['name']}")

            # Rate limit global
            if posts_this_hour >= MAX_POSTS_PER_HOUR:
                wait_time = 3600 - (time.time() % 3600)
                print(f"  ⏳ Rate limit atteint ({MAX_POSTS_PER_HOUR}/h). Attente {wait_time:.0f}s…")
                await asyncio.sleep(wait_time)
                posts_this_hour = 0

            for post_num in range(POSTS_PER_DAY_PER_GROUP):
                if post_index >= len(manifest):
                    post_index = 0  # cycle sur les visuels

                item       = manifest[post_index]
                text       = load_post_text(post_index + 1)
                image_path = None  # On utilise l'URL Drive (pas d'upload local nécessaire)

                success = await post_to_group(page, group, text, image_path)

                # Enregistrement log
                if group_id not in post_log:
                    post_log[group_id] = []
                post_log[group_id].append(time.time())
                save_post_log(post_log)

                if success:
                    posts_this_hour += 1
                    post_index += 1

                # Délai entre posts dans le même groupe
                if post_num < POSTS_PER_DAY_PER_GROUP - 1:
                    delay = rand_delay(DELAY_BETWEEN_POSTS_MIN, DELAY_BETWEEN_POSTS_MAX)
                    print(f"  ⏱  Attente {delay:.0f}s avant le prochain post…")
                    await asyncio.sleep(delay)

            # Délai entre groupes
            if group_idx < len(groups) - 1:
                delay = rand_delay(DELAY_BETWEEN_GROUPS_MIN, DELAY_BETWEEN_GROUPS_MAX)
                print(f"\n⏱  Passage au groupe suivant dans {delay:.0f}s…")
                await asyncio.sleep(delay)

        await browser.close()

    print("\n=== Session terminée ===")
    save_post_log(post_log)


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Post Facebook automation pour Léo Ollivier")
    parser.add_argument("--max-groups", type=int, default=None,
                        help="Limiter à N groupes (test)")
    args = parser.parse_args()
    asyncio.run(run_posting_session(max_groups=args.max_groups))
