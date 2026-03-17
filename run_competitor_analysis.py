"""
Orchestrateur — Analyse Concurrentielle Complète
Lance le scraping + analyse + rapport en une seule commande.

Usage:
    python run_competitor_analysis.py              # scraping + analyse + rapport
    python run_competitor_analysis.py --no-scrape  # analyse + rapport sans scraper
    python run_competitor_analysis.py --report-only # rapport uniquement
"""

import asyncio
import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path("data/competitors")
ANALYSIS_DIR = Path("data/competitor_analysis")
REPORTS_DIR = Path("data/reports")


def check_dependencies():
    """Vérifie que les dépendances sont installées."""
    missing = []
    try:
        import playwright
    except ImportError:
        missing.append("playwright")
    try:
        import anthropic
    except ImportError:
        missing.append("anthropic")
    try:
        from dotenv import load_dotenv
    except ImportError:
        missing.append("python-dotenv")

    if missing:
        print(f"[!] Dépendances manquantes: {', '.join(missing)}")
        print("[!] Lance: pip install -r requirements.txt && playwright install chromium")
        sys.exit(1)

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("[!] ANTHROPIC_API_KEY non définie dans .env")
        sys.exit(1)


def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║     ANALYSE CONCURRENTIELLE — B2C FR COACHING/FORMATION      ║
║              Meta Ad Library Intelligence                    ║
╚══════════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="Analyse concurrentielle Meta Ads FR")
    parser.add_argument("--no-scrape", action="store_true", help="Sauter le scraping")
    parser.add_argument("--report-only", action="store_true", help="Générer le rapport uniquement")
    parser.add_argument("--tier", type=int, default=1, help="Tier à analyser (1 ou 2)")
    args = parser.parse_args()

    print_banner()
    check_dependencies()

    start_time = datetime.now()

    # ── ÉTAPE 1 : Scraping ──────────────────────────────────────────────────
    if not args.no_scrape and not args.report_only:
        print("━" * 60)
        print("ÉTAPE 1/3 — SCRAPING META AD LIBRARY")
        print("━" * 60)

        try:
            from scrape_ad_library import scrape_all_competitors, load_config
            config = load_config()
            competitors = [c for c in config["competitors"] if c["tier"] <= args.tier]

            print(f"[*] {len(competitors)} concurrents à scraper (Tier ≤ {args.tier})")
            results = asyncio.run(scrape_all_competitors(competitors))

            total_ads = sum(v["total_ads"] for v in results.values())
            print(f"\n[✓] Scraping terminé: {total_ads} pubs collectées")

        except Exception as e:
            print(f"[!] Erreur scraping: {e}")
            print("[!] Passage à l'analyse sans données scrapées...")
    else:
        print("[*] Scraping ignoré (--no-scrape ou --report-only)")

    # ── ÉTAPE 2 : Analyse Funnel ────────────────────────────────────────────
    if not args.report_only:
        print("\n" + "━" * 60)
        print("ÉTAPE 2/3 — ANALYSE FUNNELS AVEC CLAUDE")
        print("━" * 60)

        try:
            from analyze_funnels import run_full_analysis
            analyses = run_full_analysis()
            print(f"\n[✓] Analyses terminées: {len(analyses)} concurrents")

        except Exception as e:
            print(f"[!] Erreur analyse: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    else:
        print("[*] Analyse ignorée (--report-only)")

    # ── ÉTAPE 3 : Rapport ───────────────────────────────────────────────────
    print("\n" + "━" * 60)
    print("ÉTAPE 3/3 — GÉNÉRATION DU RAPPORT")
    print("━" * 60)

    try:
        from generate_competitor_report import load_analyses, generate_report, add_header, save_report

        analyses = load_analyses()
        if not analyses:
            print("[!] Aucune analyse disponible pour le rapport")
            sys.exit(1)

        report_text = generate_report(analyses)
        full_report = add_header(report_text, analyses)
        report_path = save_report(full_report, analyses)

        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"\n{'═' * 60}")
        print("✓ ANALYSE COMPLÈTE TERMINÉE")
        print(f"{'═' * 60}")
        print(f"  Temps total     : {elapsed:.0f}s")
        print(f"  Rapport Markdown: {report_path}")
        print(f"  Rapport latest  : {REPORTS_DIR}/rapport_concurrentiel_LATEST.md")
        print(f"  Analyses JSON   : {ANALYSIS_DIR}/all_analyses.json")
        print(f"{'═' * 60}\n")

    except Exception as e:
        print(f"[!] Erreur rapport: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
