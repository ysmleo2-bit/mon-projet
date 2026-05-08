#!/usr/bin/env python3
"""
Script autonome — récupère les feedbacks depuis l'app Railway.
Usage : python3 fetch_feedbacks.py
"""

import json
import os
import sys
import requests

CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".prod_config.json")


def load_config():
    if not os.path.exists(CONFIG_FILE):
        print("CONFIG MANQUANTE — crée .prod_config.json avec {url, key}")
        sys.exit(1)
    with open(CONFIG_FILE) as f:
        return json.load(f)


def fetch_feedbacks(url: str, key: str) -> dict:
    resp = requests.get(
        f"{url.rstrip('/')}/api/internal/feedbacks",
        params={"key": key},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def mark_resolved(url: str, key: str, fb_id: str):
    resp = requests.post(
        f"{url.rstrip('/')}/api/internal/feedback/{fb_id}/resolve",
        params={"key": key},
        timeout=15,
    )
    resp.raise_for_status()


if __name__ == "__main__":
    cfg  = load_config()
    data = fetch_feedbacks(cfg["url"], cfg["key"])

    nouveaux = [f for f in data["items"] if f["statut"] == "nouveau"]
    en_cours = [f for f in data["items"] if f["statut"] == "en_cours"]

    print(f"\n=== FEEDBACKS RIVIA SETTING ===")
    print(f"Total : {data['total']} | Nouveaux : {data['nouveaux']} | En cours : {len(en_cours)}\n")

    if not nouveaux and not en_cours:
        print("Aucun feedback non résolu.")
    else:
        for fb in (nouveaux + en_cours):
            print(f"[{fb['statut'].upper()}] {fb['date']} {fb['heure']} — {fb['user_nom']}")
            print(f"  Type    : {fb['type']}")
            print(f"  Titre   : {fb['titre']}")
            print(f"  Desc    : {fb['description'][:200]}")
            print(f"  Page    : {fb['page']}")
            print(f"  ID      : {fb['id']}")
            print()
