"""
Agent Publisher — pont intelligent entre ContentAgent/VisualAgent et post_facebook.py.

Rôle :
  1. Charge les posts générés du jour (data/generated_content/posts/)
  2. Associe chaque post à son visuel (data/generated_content/visuals/)
  3. Adapte le texte selon le nombre de posts déjà publiés aujourd'hui (anti-répétition)
  4. Injecte le tout dans post_facebook.run_posting_session()
  5. Gère le rate limiting entre groupes (max 8 posts/heure, délais humains)
  6. Log chaque publication dans data/publish_log.json

Stratégie de publication :
  - Vague matin : 09h-12h (groupes emploi/actifs)
  - Vague soir  : 19h-21h (groupes étudiants/mamans)
  - Max 2 posts par groupe par jour
"""
from __future__ import annotations


import asyncio
import json
import os
import random
import time
from datetime import datetime, date
from pathlib import Path

from playwright.async_api import async_playwright, Page

from agent.content_agent import GeneratedPost, ContentAgent
from agent.visual_agent   import VisualAgent, VISUALS_DIR

PUBLISH_LOG = Path("data/publish_log.json")
GROUPS_CONFIG = "groups_config.json"

# Horaires de publication (en heure locale)
MORNING_WAVE_START = 9     # 09:00
MORNING_WAVE_END   = 12    # 12:00
EVENING_WAVE_START = 19    # 19:00
EVENING_WAVE_END   = 21    # 21:00

# Catégories prioritaires par vague
MORNING_CATEGORIES = {"emploi", "reconversion", "freelance", "general"}
EVENING_CATEGORIES = {"etudiant", "maman", "revenus"}


def _load_publish_log() -> dict:
    if PUBLISH_LOG.exists():
        return json.loads(PUBLISH_LOG.read_text(encoding="utf-8"))
    return {"published": [], "daily_counts": {}}


def _save_publish_log(data: dict) -> None:
    PUBLISH_LOG.parent.mkdir(parents=True, exist_ok=True)
    PUBLISH_LOG.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _already_published_today(group_id: str) -> int:
    """Retourne le nombre de posts déjà publiés dans ce groupe aujourd'hui."""
    log       = _load_publish_log()
    today_str = date.today().isoformat()
    count     = 0
    for entry in log["published"]:
        if entry.get("group_id") == group_id and entry.get("date") == today_str:
            count += 1
    return count


def _find_visual_for_post(post: GeneratedPost) -> str | None:
    """Trouve le visuel le plus récent pour ce groupe."""
    pattern = f"{post.group_id}_*.png"
    matches = sorted(VISUALS_DIR.glob(pattern), reverse=True)
    return str(matches[0]) if matches else None


def _get_groups_for_wave(wave: str) -> list[dict]:
    """Retourne les groupes prioritaires pour la vague matin ou soir."""
    if not os.path.exists(GROUPS_CONFIG):
        from config import FB_GROUPS_PRIORITY
        return FB_GROUPS_PRIORITY

    with open(GROUPS_CONFIG, encoding="utf-8") as f:
        all_groups = json.load(f)

    categories = MORNING_CATEGORIES if wave == "morning" else EVENING_CATEGORIES

    # Priorité : groupes ciblés d'abord, puis les autres
    priority   = [g for g in all_groups if g.get("category", "") in categories]
    secondary  = [g for g in all_groups if g.get("category", "") not in categories]
    return priority + secondary


class PublisherAgent:
    """
    Orchestre la publication Facebook en intégrant génération de contenu et visuals.
    """

    def __init__(self, api_key: str | None = None, max_per_wave: int = 12):
        self.api_key     = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.max_per_wave = max_per_wave
        self.page: Page | None = None

    async def _connect(self):
        p = await async_playwright().start()
        try:
            browser   = await p.chromium.connect_over_cdp("http://localhost:9222")
            context   = browser.contexts[0]
            self.page = context.pages[0] if context.pages else await context.new_page()
        except Exception:
            browser   = await p.chromium.launch(headless=False, slow_mo=40)
            context   = await browser.new_context()
            self.page = await context.new_page()

    async def _post_to_group(
        self,
        group: dict,
        text: str,
        image_path: str | None = None,
    ) -> bool:
        """Publie dans un groupe (réutilise la logique de post_facebook.py)."""
        from post_facebook import post_to_group
        return await post_to_group(self.page, group, text, image_path)

    def _prepare_post_text(self, post: GeneratedPost) -> str:
        """Prépare le texte final avec hashtags."""
        hashtags = " ".join(f"#{h.lstrip('#')}" for h in post.hashtags[:5])
        return f"{post.full_text}\n\n{hashtags}".strip()

    async def run_wave(
        self,
        wave: str = "morning",
        dea: str | None = None,
        force_regenerate: bool = False,
    ) -> int:
        """
        Lance une vague de publications (morning ou evening).
        Retourne le nombre de posts réussis.
        """
        from dotenv import load_dotenv
        load_dotenv()
        if dea is None:
            try:
                with open("data/dea.txt", encoding="utf-8") as f:
                    dea = f.read()
            except FileNotFoundError:
                dea = "Setter — 2-3h/jour — 1500-3000€/mois"

        groups    = _get_groups_for_wave(wave)
        today_str = date.today().isoformat()

        print(f"\n[Publisher] Vague {wave.upper()} — {datetime.now().strftime('%H:%M')} — {len(groups)} groupes")
        await self._connect()

        content_agent = ContentAgent(api_key=self.api_key)
        visual_agent  = VisualAgent()

        published_count = 0
        posts_this_hour = 0
        hour_start      = time.time()

        for group in groups[:self.max_per_wave]:
            group_id = group["id"]

            # Limiter à 2 posts/jour/groupe
            already = _already_published_today(group_id)
            if already >= 2:
                continue

            # Rate limiting : max 8 posts/heure
            if posts_this_hour >= 8:
                elapsed = time.time() - hour_start
                if elapsed < 3600:
                    wait = 3600 - elapsed
                    print(f"  [Publisher] Rate limit atteint — attente {wait:.0f}s")
                    await asyncio.sleep(wait)
                posts_this_hour = 0
                hour_start      = time.time()

            # Charger ou générer le post du jour pour ce groupe
            post = ContentAgent.load_post(group_id, today_str)
            if post is None or force_regenerate:
                from agent.analyzer_agent import AnalyzerAgent
                profile = AnalyzerAgent.load_profile(group_id)
                if profile is None:
                    # Créer un profil minimal depuis la config
                    from agent.analyzer_agent import GroupProfile
                    profile = GroupProfile(
                        group_id=group_id,
                        group_name=group.get("name", group_id),
                        category=group.get("category", "general"),
                        summary=group.get("description", ""),
                        pain_points=[],
                        engagement_patterns=[],
                        typical_vocabulary=[],
                        typical_objections=[],
                        maturity_level="froid",
                        hook_angles=[],
                        tone_recommendation="Ton accessible et direct.",
                        best_post_format="Texte court + question + CTA",
                    )
                post = content_agent.generate_post(profile, dea)

            # Trouver ou générer le visuel
            image_path = _find_visual_for_post(post)
            if image_path is None:
                image_path = str(visual_agent.generate(post)) if post else None

            # Publier
            text    = self._prepare_post_text(post)
            success = await self._post_to_group(group, text, image_path)

            if success:
                published_count += 1
                posts_this_hour += 1

                # Log
                log = _load_publish_log()
                log["published"].append({
                    "group_id":   group_id,
                    "group_name": group.get("name", group_id),
                    "date":       today_str,
                    "time":       datetime.now().strftime("%H:%M"),
                    "wave":       wave,
                    "angle":      post.angle if post else "",
                    "image":      os.path.basename(image_path) if image_path else None,
                })
                _save_publish_log(log)

            # Délai humain entre groupes
            delay = random.uniform(60, 120)
            print(f"  ⏱  Prochain groupe dans {delay:.0f}s…")
            await asyncio.sleep(delay)

        print(f"\n[Publisher] Vague {wave} terminée : {published_count}/{min(len(groups), self.max_per_wave)} publiés")
        return published_count

    def daily_summary(self) -> str:
        log       = _load_publish_log()
        today_str = date.today().isoformat()
        today     = [e for e in log["published"] if e.get("date") == today_str]
        by_wave   = {}
        for e in today:
            w = e.get("wave", "?")
            by_wave[w] = by_wave.get(w, 0) + 1

        return (
            f"📤 Publications aujourd'hui : {len(today)}\n"
            + "\n".join(f"   {w}: {n}" for w, n in by_wave.items())
        )
