#!/usr/bin/env python3
"""
run_agent.py — Point d'entrée unique de l'agent Setting / Léo Ollivier

Utilisation rapide :
  python run_agent.py --mode daily          # Post du jour pour tous les groupes
  python run_agent.py --mode full           # Pipeline complet (scrape + analyse + post + visuel)
  python run_agent.py --mode analyze        # Ré-analyse depuis cache (pas de scraping)
  python run_agent.py --mode generate --days 7  # Génère 7 jours de contenu en avance
  python run_agent.py --mode publish        # Publie les posts générés aujourd'hui

Variables d'environnement requises (dans .env) :
  ANTHROPIC_API_KEY=sk-ant-...
  FB_EMAIL=...
  FB_PASSWORD=...
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from agent.orchestrator import main

if __name__ == "__main__":
    main()
