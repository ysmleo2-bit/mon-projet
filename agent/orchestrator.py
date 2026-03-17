"""
Agent 5 — Orchestrateur principal
Coordonne tous les agents dans le bon ordre :
  1. ScraperAgent    → collecte le contenu des groupes
  2. AnalyzerAgent   → analyse les douleurs et patterns
  3. ContentAgent    → génère les posts personnalisés
  4. VisualAgent     → crée les visuels 1080x1080
  5. (optionnel) post_facebook.py → publie dans les groupes

Modes :
  --mode full        : Pipeline complet (scrape → analyze → generate → visual)
  --mode analyze     : Réanalyse depuis données scrapées en cache
  --mode generate    : Génère les posts depuis profils en cache
  --mode daily       : Génère le post du jour + visuel pour chaque groupe
  --mode publish     : Publie les posts générés aujourd'hui
"""
from __future__ import annotations


import asyncio
import json
import os
import argparse
from datetime import datetime
from pathlib import Path

from agent.scraper_agent  import ScraperAgent
from agent.analyzer_agent import AnalyzerAgent
from agent.content_agent  import ContentAgent
from agent.visual_agent   import VisualAgent


DEA_PATH = "data/dea.txt"


def load_dea() -> str:
    with open(DEA_PATH, encoding="utf-8") as f:
        return f.read()


def load_groups() -> list[dict]:
    """Charge les groupes depuis groups_manifest.json ou config.py."""
    if os.path.exists("groups_config.json"):
        with open("groups_config.json", encoding="utf-8") as f:
            return json.load(f)
    from config import FB_GROUPS_PRIORITY
    print("[WARN] groups_manifest.json absent — utilisation des groupes de config.py")
    return FB_GROUPS_PRIORITY


# ── Pipelines ─────────────────────────────────────────────────────────────────

async def pipeline_full(groups: list[dict], api_key: str, max_groups: int = None):
    """
    Pipeline complet :
    1. Scrape chaque groupe
    2. Analyse les données scrapées
    3. Génère le post du jour
    4. Crée le visuel
    """
    if max_groups:
        groups = groups[:max_groups]

    dea      = load_dea()
    analyzer = AnalyzerAgent(api_key=api_key)
    content  = ContentAgent(api_key=api_key)
    visual   = VisualAgent()

    print(f"\n{'='*60}")
    print(f"PIPELINE COMPLET — {len(groups)} groupes")
    print(f"{'='*60}")

    # 1. Scraping
    print("\n[1/4] SCRAPING des groupes Facebook…")
    scraper = ScraperAgent(max_posts_per_group=25)
    await scraper.connect()
    scraped_list = await scraper.scrape_groups(groups)

    # 2. Analyse
    print("\n[2/4] ANALYSE des douleurs et patterns (Claude Opus 4.6)…")
    profiles = analyzer.analyze_all(scraped_list, dea)

    # 3. Génération des posts
    print("\n[3/4] GÉNÉRATION des posts personnalisés…")
    today_posts = []
    for profile in profiles:
        post = content.generate_post(profile, dea)
        today_posts.append(post)

    # 4. Visuels
    print("\n[4/4] CRÉATION des visuels 1080x1080…")
    visual_paths = visual.generate_batch(today_posts)

    _print_summary(profiles, today_posts, visual_paths)
    return today_posts


def pipeline_analyze_only(groups: list[dict], api_key: str):
    """Réanalyse depuis le cache (sans re-scraper)."""
    dea      = load_dea()
    analyzer = AnalyzerAgent(api_key=api_key)
    scraped  = ScraperAgent.all_cached()

    if not scraped:
        print("[ERREUR] Aucune donnée scrapée. Lancez d'abord --mode full.")
        return []

    print(f"\n[Analyze] Analyse de {len(scraped)} groupes scrapés…")
    profiles = analyzer.analyze_all(scraped, dea)
    for p in profiles:
        analyzer.print_summary(p)
    return profiles


def pipeline_generate_only(api_key: str, days: int = 1):
    """Génère les posts depuis les profils en cache (sans re-scraper ni ré-analyser)."""
    dea      = load_dea()
    content  = ContentAgent(api_key=api_key)
    visual   = VisualAgent()
    profiles = AnalyzerAgent.all_profiles()

    if not profiles:
        print("[ERREUR] Aucun profil de groupe. Lancez d'abord --mode analyze.")
        return []

    print(f"\n[Generate] Génération pour {len(profiles)} groupes ({days} jour(s))…")
    all_posts = []
    for profile in profiles:
        for day in range(days):
            post = content.generate_post(profile, dea, day_offset=day)
            all_posts.append(post)
            visual.generate(post)

    return all_posts


def pipeline_daily(api_key: str, groups: list[dict] | None = None):
    """
    Mode quotidien rapide :
    - Utilise les profils existants (ou les crée si absents)
    - Génère 1 post + 1 visuel par groupe pour aujourd'hui
    """
    dea      = load_dea()
    content  = ContentAgent(api_key=api_key)
    visual   = VisualAgent()
    analyzer = AnalyzerAgent(api_key=api_key)

    profiles = AnalyzerAgent.all_profiles()

    # Si aucun profil, tenter de créer depuis le cache scraping
    if not profiles:
        scraped = ScraperAgent.all_cached()
        if scraped:
            print("[Daily] Profils absents — analyse depuis cache scraping…")
            profiles = analyzer.analyze_all(scraped, dea)
        else:
            print("[ERREUR] Aucun profil ni donnée scrapée. Lancez --mode full d'abord.")
            return []

    # Si `groups` fourni, filtrer les profils
    if groups:
        group_ids = {g["id"] for g in groups}
        profiles  = [p for p in profiles if p.group_id in group_ids] or profiles

    print(f"\n[Daily] Génération de {len(profiles)} posts pour le {datetime.now().strftime('%d/%m/%Y')}…")
    posts = []
    for profile in profiles:
        post = content.generate_post(profile, dea)
        visual.generate(post)
        posts.append(post)

    print(f"\n✓ {len(posts)} posts + visuels générés.")
    return posts


async def pipeline_publish(posts=None):
    """Publie les posts générés aujourd'hui via post_facebook.py."""
    from post_facebook import run_posting_session

    if posts is None:
        from agent.content_agent import ContentAgent
        posts = ContentAgent.today_posts()

    if not posts:
        print("[Publish] Aucun post à publier aujourd'hui.")
        return

    print(f"\n[Publish] {len(posts)} posts à publier…")
    # Injecter les posts dans le manifest pour post_facebook.py
    import json
    manifest = [{"name": p.group_name, "id": p.group_id} for p in posts]
    with open("groups_today.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    await run_posting_session()


# ── Affichage récapitulatif ───────────────────────────────────────────────────

def _print_summary(profiles, posts, visual_paths):
    print(f"\n{'='*60}")
    print("RÉCAPITULATIF DE LA SESSION")
    print(f"{'='*60}")
    print(f"Groupes analysés : {len(profiles)}")
    print(f"Posts générés    : {len(posts)}")
    print(f"Visuels créés    : {len([p for p in visual_paths if p])}")
    print()
    for post in posts:
        print(f"  ▸ [{post.group_name}]")
        print(f"    Hook  : {post.hook[:70]}…")
        print(f"    CTA   : {post.cta}")
        print(f"    Angle : {post.angle}")
        print()


# ── Point d'entrée CLI ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Orchestrateur d'agents — Léo Ollivier / Setting"
    )
    parser.add_argument(
        "--mode",
        choices=["full", "analyze", "generate", "daily", "publish"],
        default="daily",
        help="Mode d'exécution (défaut: daily)",
    )
    parser.add_argument("--max-groups", type=int, default=None,
                        help="Limiter à N groupes")
    parser.add_argument("--days", type=int, default=1,
                        help="Nombre de jours à générer (mode generate)")
    parser.add_argument("--api-key", type=str, default=None,
                        help="Clé API Anthropic (ou ANTHROPIC_API_KEY dans .env)")
    args = parser.parse_args()

    # Charger .env
    from dotenv import load_dotenv
    load_dotenv()

    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and args.mode != "publish":
        print("[ERREUR] ANTHROPIC_API_KEY manquante. Ajoutez-la dans .env ou via --api-key")
        return

    groups = load_groups()
    if args.max_groups:
        groups = groups[:args.max_groups]

    if args.mode == "full":
        asyncio.run(pipeline_full(groups, api_key, args.max_groups))
    elif args.mode == "analyze":
        pipeline_analyze_only(groups, api_key)
    elif args.mode == "generate":
        pipeline_generate_only(api_key, days=args.days)
    elif args.mode == "daily":
        pipeline_daily(api_key, groups)
    elif args.mode == "publish":
        asyncio.run(pipeline_publish())


if __name__ == "__main__":
    main()
