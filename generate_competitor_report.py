"""
Générateur de Rapport Concurrentiel — FR B2C Coaching/Formation
Produit un rapport complet en Markdown + JSON depuis les analyses Claude.
"""

import json
import os
from pathlib import Path
from datetime import datetime
import anthropic
from dotenv import load_dotenv

load_dotenv()

ANALYSIS_DIR = Path("data/competitor_analysis")
REPORTS_DIR = Path("data/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "claude-opus-4-6"
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def generate_report(analyses: dict) -> str:
    """Génère le rapport complet avec Claude."""

    analyses_json = json.dumps(analyses, ensure_ascii=False, indent=2)

    prompt = f"""Tu es un consultant en marketing direct et stratégie digitale pour le marché français.

Tu as analysé les stratégies publicitaires des plus gros concurrents B2C dans le secteur coaching/formation en ligne en France.

## Données d'analyse :
{analyses_json}

## Ta mission :
Génère un **rapport stratégique complet** destiné à Léo Ollivier, qui opère sur le même marché (B2C FR, coaching/formation, Meta Ads).

Le rapport doit inclure :

---

# 1. EXECUTIVE SUMMARY
- Top insights en 5 bullet points
- Le concurrent le plus dangereux et pourquoi
- L'opportunité de marché la plus exploitable

---

# 2. ANALYSE PAR CONCURRENT
Pour chaque concurrent (Tier 1) :
- Résumé du funnel en 3 phrases
- Structure exacte du funnel (avec les étapes)
- Offre principale + prix estimé
- Top 3 angles publicitaires avec exemples de copy
- Formats dominants (vidéo/image/carousel)
- Estimation du spend mensuel
- Forces et faiblesses

---

# 3. ANALYSE COMPARATIVE DES FUNNELS
- Tableau comparatif : funnel complexity × spend × format dominant
- Patterns communs (ce que TOUS les gros spenders font)
- Ce qui différencie les leaders
- Formules de copy les plus utilisées (PAS, AIDA, etc.)

---

# 4. ANALYSE DES ANGLES & TRIGGERS ÉMOTIONNELS
- Top 10 angles d'accroche dominants sur le marché FR
- Top triggers émotionnels (classés par fréquence)
- Copy qui performe en FR (avec exemples réels ou simulés)
- Ce qui est saturé vs sous-exploité

---

# 5. ANALYSE DES FORMATS PUBLICITAIRES
- Répartition des formats (vidéo vs image vs carousel)
- La longueur de VSL qui performe le mieux
- Niveau de production vs authenticité : qui gagne ?
- Tendances 2025-2026

---

# 6. ARCHITECTURE DES FUNNELS GAGNANTS
- Le funnel "type" des gros spenders FR
- Les étapes incontournables
- Les micro-conversions (lead magnet, webinaire, quiz, etc.)
- Les pages de vente qui convertissent

---

# 7. OPPORTUNITÉS POUR LÉO OLLIVIER
- Les angles NON occupés par les concurrents
- Les niches de marché sous-exploitées
- Les formats à tester en priorité
- Les tactiques à copier immédiatement
- Les erreurs des concurrents à ne PAS reproduire

---

# 8. RECOMMANDATIONS STRATÉGIQUES
- Priorité #1 à mettre en place (quick win)
- Stratégie à 3 mois
- KPIs à surveiller
- Budget Meta Ads recommandé pour compétir

---

# 9. FICHES ACTION
Pour chaque recommandation clé :
- Action concrète
- Ressources nécessaires
- Délai estimé
- Impact attendu

---

Écris ce rapport en français, de manière précise, directe et actionnable.
Utilise des tableaux Markdown quand c'est pertinent.
Chaque section doit apporter de la valeur opérationnelle concrète.
Cite des exemples spécifiques de copy, d'angles, de structures de funnel.
"""

    print("[→] Génération du rapport avec Claude (thinking étendu)...")

    response = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        thinking={
            "type": "enabled",
            "budget_tokens": 5000
        },
        messages=[{"role": "user", "content": prompt}]
    )

    report_text = ""
    for block in response.content:
        if block.type == "text":
            report_text = block.text
            break

    return report_text


def add_header(report_text: str, analyses: dict) -> str:
    """Ajoute l'en-tête du rapport."""
    date = datetime.now().strftime("%d/%m/%Y")
    total_ads = sum(
        len(a.get("ads", [])) if "ads" in a else 0
        for a in analyses.values()
    )
    competitors_list = ", ".join(analyses.keys())

    header = f"""# RAPPORT CONCURRENTIEL — B2C COACHING/FORMATION FR
## Meta Ad Library Intelligence Report

**Préparé pour :** Léo Ollivier
**Date :** {date}
**Marché :** B2C France — Coaching & Formations en ligne
**Concurrents analysés :** {competitors_list}
**Total pubs analysées :** {total_ads}+
**Modèle d'analyse :** Claude Opus 4.6 (Extended Thinking)

---

> ⚠️ **Note méthodologique** : Ce rapport combine les données scrapées depuis la Meta Ad Library FR
> et l'analyse du marché par intelligence artificielle. Les estimations de spend sont basées sur
> le volume de pubs actives × CPM moyen observé sur le marché FR.

---

"""
    return header + report_text


def save_report(report: str, analyses: dict):
    """Sauvegarde le rapport en Markdown et en JSON."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    # Rapport Markdown
    md_path = REPORTS_DIR / f"rapport_concurrentiel_{timestamp}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"[✓] Rapport Markdown: {md_path}")

    # Rapport latest (sans timestamp pour accès facile)
    latest_path = REPORTS_DIR / "rapport_concurrentiel_LATEST.md"
    with open(latest_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"[✓] Rapport latest: {latest_path}")

    # Données brutes JSON
    json_path = REPORTS_DIR / f"donnees_brutes_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "analyses": analyses,
            "report_file": str(md_path)
        }, f, ensure_ascii=False, indent=2)
    print(f"[✓] Données JSON: {json_path}")

    return md_path


def load_analyses() -> dict:
    """Charge les analyses depuis le dossier analysis."""
    all_file = ANALYSIS_DIR / "all_analyses.json"
    if all_file.exists():
        with open(all_file, encoding="utf-8") as f:
            return json.load(f)

    # Charger fichiers individuels
    analyses = {}
    for f in ANALYSIS_DIR.glob("*_analysis.json"):
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
            name = data.get("competitor_name", f.stem)
            analyses[name] = data

    return analyses


if __name__ == "__main__":
    print("[*] Chargement des analyses...")
    analyses = load_analyses()

    if not analyses:
        print("[!] Aucune analyse trouvée. Lance d'abord analyze_funnels.py")
        exit(1)

    print(f"[*] {len(analyses)} analyses chargées")

    report_text = generate_report(analyses)
    full_report = add_header(report_text, analyses)
    report_path = save_report(full_report, analyses)

    print(f"\n[✓] Rapport généré avec succès!")
    print(f"[✓] Chemin: {report_path}")

    # Afficher un résumé
    lines = full_report.split('\n')
    print("\n" + "="*60)
    print("APERÇU DU RAPPORT (premières lignes):")
    print("="*60)
    for line in lines[:30]:
        print(line)
    print("...[rapport complet dans le fichier]...")
