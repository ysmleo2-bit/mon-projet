"""
Orchestrateur principal — Léo Ollivier / Setting

Ordre d'exécution :
  1. fetch_groups.py   → charge les 40 groupes depuis le Sheet
  2. upload_drive.py   → upload les 25 PNG vers Drive + =IMAGE() dans Sheet
  3. post_facebook.py  → posting dans les groupes avec comportement humain

Usage :
  python main.py                    # Pipeline complet
  python main.py --step upload      # Upload uniquement
  python main.py --step post        # Posting uniquement
  python main.py --step groups      # Fetch groupes uniquement
  python main.py --step post --max-groups 3   # Test sur 3 groupes
"""

import argparse
import asyncio
import sys


def step_fetch_groups():
    print("\n" + "=" * 60)
    print("ÉTAPE 1 — Chargement des groupes depuis le Sheet")
    print("=" * 60)
    from fetch_groups import main as fetch_main
    fetch_main()


def step_upload():
    print("\n" + "=" * 60)
    print("ÉTAPE 2 — Upload images Drive + mise à jour Sheet")
    print("=" * 60)
    from upload_drive import main as upload_main
    upload_main()


def step_post(max_groups: int = None):
    print("\n" + "=" * 60)
    print("ÉTAPE 3 — Posting Facebook")
    print("=" * 60)
    from post_facebook import run_posting_session
    asyncio.run(run_posting_session(max_groups=max_groups))


def main():
    parser = argparse.ArgumentParser(
        description="Pipeline automatisation Facebook — Léo Ollivier / Setting"
    )
    parser.add_argument(
        "--step",
        choices=["groups", "upload", "post", "all"],
        default="all",
        help="Étape à exécuter (défaut : all)",
    )
    parser.add_argument(
        "--max-groups",
        type=int,
        default=None,
        help="Limiter le posting à N groupes (utile pour les tests)",
    )
    args = parser.parse_args()

    if args.step in ("all", "groups"):
        step_fetch_groups()
    if args.step in ("all", "upload"):
        step_upload()
    if args.step in ("all", "post"):
        step_post(max_groups=args.max_groups)

    print("\n✓ Pipeline terminé.")


if __name__ == "__main__":
    main()
