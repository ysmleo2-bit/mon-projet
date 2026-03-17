"""
Analyse de Funnel — Concurrents FR B2C Coaching/Formation
Utilise Claude pour analyser les pubs scrapées et reconstruire les funnels.
"""

import json
import os
from pathlib import Path
from typing import Optional
import anthropic
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path("data/competitors")
ANALYSIS_DIR = Path("data/competitor_analysis")
ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "claude-opus-4-6"

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Schémas de sortie ──────────────────────────────────────────────────────────

class AdAnalysis(BaseModel):
    format: str
    hook_type: str       # ex: "curiosité", "douleur", "autorité", "résultat"
    hook_text: str       # La phrase d'accroche principale
    promise: str         # La promesse principale
    funnel_stage: str    # "awareness" | "consideration" | "conversion"
    cta: str
    emotion_trigger: str # ex: "peur de rater", "désir de liberté", "envie de statut"
    copy_formula: str    # ex: "AIDA", "PAS", "Before/After/Bridge"


class CompetitorFunnelAnalysis(BaseModel):
    competitor_name: str
    niche: str
    estimated_tier: str  # "Gros spender (50k+/mois)", "Moyen spender (10-50k)", etc.

    # Structure du funnel
    funnel_structure: list[str]     # Étapes identifiées
    funnel_complexity: str          # "simple" | "intermédiaire" | "sophistiqué"

    # Offre
    main_offer: str
    price_point: str                # "non visible" | "freemium" | "<100€" | "100-500€" | "500-2000€" | "2000€+"
    offer_type: str                 # "formation", "coaching", "mastermind", "abonnement"

    # Copy & Angles
    dominant_angles: list[str]      # Les 3 angles les plus utilisés
    copy_style: str                 # "direct response", "storytelling", "éducatif", "autorité"
    emotional_triggers: list[str]   # Leviers émotionnels récurrents

    # Formats & Médias
    dominant_formats: list[str]     # "video VSL", "image témoignage", "carousel", etc.
    video_length_estimate: str      # si vidéo: "court <30s", "moyen 30s-3min", "long VSL 10min+"
    production_quality: str         # "DIY/authentique", "semi-pro", "pro haute production"

    # Spend & Volume
    ad_volume_estimate: str         # "faible <10 pubs actives", "moyen 10-50", "fort 50+ pubs actives"
    spend_estimate: str             # estimation mensuelle
    frequency_hypothesis: str       # "test A/B constant", "evergreen stable", "burst saisonnier"

    # Points forts et faiblesses
    strengths: list[str]
    weaknesses: list[str]

    # Opportunités pour Léo
    opportunities_for_leo: list[str]

    # Top 3 pubs à surveiller (descriptions)
    best_ads_summary: list[str]


def analyze_competitor_with_claude(competitor_data: dict) -> CompetitorFunnelAnalysis:
    """Analyse les pubs d'un concurrent avec Claude et reconstruit son funnel."""

    name = competitor_data["competitor_info"]["name"]
    niche = competitor_data["competitor_info"]["niche"]
    ads = competitor_data.get("ads", [])

    print(f"\n[→] Analyse Claude: {name} ({len(ads)} pubs)")

    # Préparer le contexte des pubs
    ads_context = ""
    if ads:
        for i, ad in enumerate(ads[:30], 1):
            ads_context += f"""
--- Pub #{i} ---
Format: {ad.get('ad_format', 'inconnu')}
Texte: {ad.get('ad_text', '')[:500]}
Titre: {ad.get('headline', '')}
CTA: {ad.get('cta', '')}
Date début: {ad.get('start_date', '')}
---
"""
    else:
        ads_context = "[Aucune pub scrapée directement — analyse basée sur la connaissance du marché FR]"

    prompt = f"""Tu es un expert en marketing direct et analyse concurrentielle sur le marché français du coaching/formation B2C.

Analyse en profondeur la stratégie publicitaire de **{name}** dans la niche : **{niche}**

## Pubs collectées depuis la Meta Ad Library FR :
{ads_context}

## Contexte marché :
- Marché : B2C français, coaching & formations en ligne
- Concurrent de référence : Théo Rossi (gros spender, funnel VSL + appel stratégique)
- Profils similaires analysés : Antoine BM, Yomi Denzel, Sébastien Night, Maxence Rigottier

## Ta mission :
Reconstruit le funnel complet de {name} en analysant :
1. **Structure du funnel** : étapes de awareness → conversion
2. **Offre principale** : produit, prix estimé, format
3. **Angles de copy** : les 3 angles dominants dans leurs pubs
4. **Formats publicitaires** : vidéo VSL, image, carousel — lequel domine ?
5. **Spend estimé** : volume de pubs actives × CPM moyen → estimation mensuelle
6. **Points forts** à surveiller / s'inspirer
7. **Faiblesses** exploitables
8. **Opportunités** pour Léo Ollivier (profil similaire, même marché FR)

Si tu n'as pas de données directes scrapées, utilise ta connaissance du marché FR pour inférer en précisant les hypothèses.

Réponds en JSON structuré selon ce schéma exact, tous les champs en français sauf les noms de clés :
{{
  "competitor_name": "{name}",
  "niche": "{niche}",
  "estimated_tier": "...",
  "funnel_structure": ["étape 1", "étape 2", ...],
  "funnel_complexity": "simple|intermédiaire|sophistiqué",
  "main_offer": "...",
  "price_point": "...",
  "offer_type": "...",
  "dominant_angles": ["angle 1", "angle 2", "angle 3"],
  "copy_style": "...",
  "emotional_triggers": ["trigger 1", "trigger 2", ...],
  "dominant_formats": ["format 1", ...],
  "video_length_estimate": "...",
  "production_quality": "...",
  "ad_volume_estimate": "...",
  "spend_estimate": "...",
  "frequency_hypothesis": "...",
  "strengths": ["point 1", ...],
  "weaknesses": ["faiblesse 1", ...],
  "opportunities_for_leo": ["opportunité 1", ...],
  "best_ads_summary": ["description pub 1", ...]
}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        thinking={
            "type": "enabled",
            "budget_tokens": 3000
        },
        messages=[{"role": "user", "content": prompt}]
    )

    # Extraire le JSON de la réponse
    response_text = ""
    for block in response.content:
        if block.type == "text":
            response_text = block.text
            break

    # Parser le JSON
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if json_match:
        data = json.loads(json_match.group())
        return CompetitorFunnelAnalysis(**data)
    else:
        raise ValueError(f"Impossible de parser le JSON pour {name}: {response_text[:200]}")


import re


def run_full_analysis() -> dict:
    """Lance l'analyse complète de tous les concurrents scrapés."""

    analyses = {}

    # Charger les données scrapées
    all_data_file = DATA_DIR / "all_competitors_ads.json"

    if all_data_file.exists():
        with open(all_data_file, encoding="utf-8") as f:
            all_data = json.load(f)
        competitors_data = list(all_data.values())
    else:
        # Charger les configs et analyser sans données scrapées
        with open("competitors_config.json", encoding="utf-8") as f:
            config = json.load(f)
        competitors_data = [
            {
                "competitor_info": c,
                "ads": [],
                "total_ads": 0
            }
            for c in config["competitors"] if c["tier"] == 1
        ]

    print(f"[*] Analyse de {len(competitors_data)} concurrents avec Claude {MODEL}")

    for comp_data in competitors_data:
        name = comp_data["competitor_info"]["name"]
        try:
            analysis = analyze_competitor_with_claude(comp_data)
            analyses[name] = analysis.model_dump()

            # Sauvegarder l'analyse individuelle
            out_file = ANALYSIS_DIR / f"{name.replace(' ', '_').lower()}_analysis.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(analyses[name], f, ensure_ascii=False, indent=2)

            print(f"   [✓] Analyse sauvée: {out_file}")

        except Exception as e:
            print(f"   [!] Erreur analyse {name}: {e}")
            analyses[name] = {"error": str(e), "competitor_name": name}

    # Sauvegarder toutes les analyses
    all_analyses_file = ANALYSIS_DIR / "all_analyses.json"
    with open(all_analyses_file, "w", encoding="utf-8") as f:
        json.dump(analyses, f, ensure_ascii=False, indent=2)

    print(f"\n[✓] Analyses complètes sauvées: {all_analyses_file}")
    return analyses


if __name__ == "__main__":
    analyses = run_full_analysis()
    print(f"\n[✓] {len(analyses)} concurrents analysés")
