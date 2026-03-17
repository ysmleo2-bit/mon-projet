#!/usr/bin/env python3
"""
daemon.py — Point d'entrée du daemon 24/7 Setting / Léo Ollivier

Lancement :
  python daemon.py                    # Production — tourne indéfiniment
  python daemon.py --test             # Mode test (1 passe complète)
  python daemon.py --task scrape      # Tâche unique
  python daemon.py --task generate
  python daemon.py --task publish_morning
  python daemon.py --task publish_evening
  python daemon.py --task leads_morning
  python daemon.py --task discovery

Tâches disponibles :
  discovery       — Trouve de nouveaux groupes FB (lundi)
  scrape          — Scrape les posts des groupes actifs
  analyze         — Analyse douleurs + patterns avec Claude
  generate        — Génère les posts du jour (1/groupe)
  publish_morning — Vague de publication 10h (emploi/reconversion)
  publish_evening — Vague de publication 19h (étudiants/mamans)
  leads_morning   — Scan des commentaires → leads (14h)
  leads_evening   — Scan des commentaires → leads (21h)
  weekly_report   — Rapport hebdo leads (vendredi)

Prérequis :
  - ANTHROPIC_API_KEY dans .env
  - Chrome ouvert sur Facebook (CDP port 9222)
  - pip install -r requirements.txt
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from agent.daemon import main

if __name__ == "__main__":
    main()
