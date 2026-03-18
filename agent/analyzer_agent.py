"""
Agent 2 — AnalyzerAgent
Analyse le contenu brut scrapé et en extrait :
  - Les douleurs communes (pain points)
  - Les patterns d'engagement (ce qui suscite des réactions)
  - Le profil psychographique du groupe
  - Les mots/expressions typiques de la communauté
  - Les objections récurrentes
  - Le niveau de maturité (prêt à dépenser / pas encore)

Utilise Claude Opus 4.6 avec adaptive thinking.
"""

import json
import os
from pathlib import Path
from pydantic import BaseModel
from typing import List
import anthropic

GROUP_PROFILES_DIR = Path("data/group_profiles")
GROUP_PROFILES_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "claude-opus-4-6"


# ── Schéma de sortie structurée ───────────────────────────────────────────────

class PainPoint(BaseModel):
    label:       str      # Ex: "Manque d'argent en fin de mois"
    frequency:   str      # "très fréquent" / "fréquent" / "occasionnel"
    raw_quotes:  List[str]  # Extraits directs des posts

class EngagementPattern(BaseModel):
    pattern:     str      # Ex: "Questions sur les horaires de travail"
    why_it_works: str     # Pourquoi ça crée de l'engagement
    example:     str      # Exemple de post qui a fonctionné

class GroupProfile(BaseModel):
    group_id:         str
    group_name:       str
    category:         str
    summary:          str       # Résumé du groupe en 2-3 phrases

    pain_points:      List[PainPoint]       # Douleurs classées par fréquence
    engagement_patterns: List[EngagementPattern]  # Ce qui génère de l'engagement

    typical_vocabulary: List[str]           # Mots/expressions du groupe
    typical_objections: List[str]           # Objections anticipées
    maturity_level:     str                 # "froid" / "tiède" / "chaud"

    hook_angles:        List[str]           # Angles d'accroche recommandés
    tone_recommendation: str                # Ton à adopter pour ce groupe
    best_post_format:   str                 # Format de post qui fonctionne


class AnalyzerAgent:
    """
    Analyse les données scrapées d'un groupe et construit son profil psychographique.
    Utilise Claude Opus 4.6 avec adaptive thinking pour une analyse approfondie.
    """

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )

    def _build_analysis_prompt(self, scraped_data: dict, dea: str) -> str:
        posts_text = "\n\n---\n\n".join(
            f"POST {i+1}:\n{p['text']}"
            for i, p in enumerate(scraped_data["posts"][:30])
        )
        return f"""Tu es un expert en psychologie du consommateur et en growth hacking digital.
Voici {len(scraped_data['posts'])} posts collectés dans le groupe Facebook **"{scraped_data['group_name']}"** (catégorie : {scraped_data.get('category', 'N/A')}).

Ta mission : analyser ce contenu pour comprendre en profondeur les douleurs, comportements et patterns d'engagement de cette communauté.

### Contexte de l'offre à promouvoir (DEA)
{dea}

### Posts scrapés du groupe
{posts_text}

### Consigne d'analyse
Produis une analyse TRÈS précise et actionnable. Identifie :

1. **Douleurs communes** : Quelles frustrations reviennent le plus ? Cite des extraits réels.
2. **Patterns d'engagement** : Quel type de contenu génère le plus de réactions/commentaires ?
3. **Vocabulaire typique** : Quels mots, expressions, émojis utilisent ces personnes ?
4. **Objections** : Quels freins/doutes auraient-ils face à une offre comme le Setting ?
5. **Niveau de maturité** : Sont-ils prêts à passer à l'action ou en phase de découverte ?
6. **Angles d'accroche** : Quels angles de communication seraient les plus percutants ?
7. **Ton recommandé** : Comment écrire pour parler EXACTEMENT comme eux ?
8. **Format de post** : Quel format visuel/textuel cartonne dans ce groupe ?

Sois ultra-précis. Utilise des exemples tirés des posts. C'est une analyse destinée à créer du contenu qui convertit."""

    def analyze_group(self, scraped_data: dict, dea: str) -> GroupProfile:
        """
        Analyse un groupe et retourne son profil complet.
        Utilise adaptive thinking + structured output.
        """
        group_id   = scraped_data["group_id"]
        group_name = scraped_data["group_name"]
        print(f"\n[Analyzer] Analyse de '{group_name}'…")

        if not scraped_data["posts"]:
            print(f"  ⚠ Aucun post pour {group_name} — profil minimal généré.")
            return GroupProfile(
                group_id=group_id, group_name=group_name,
                category=scraped_data.get("category", ""),
                summary="Aucun post scrapé.",
                pain_points=[], engagement_patterns=[],
                typical_vocabulary=[], typical_objections=[],
                maturity_level="froid", hook_angles=[],
                tone_recommendation="Ton bienveillant et accessible.",
                best_post_format="Texte court + question ouverte",
            )

        prompt = self._build_analysis_prompt(scraped_data, dea) + """

Retourne ton analyse UNIQUEMENT sous forme de JSON valide avec cette structure exacte :
{
  "summary": "résumé en 2-3 phrases",
  "pain_points": [
    {"label": "...", "frequency": "très fréquent|fréquent|occasionnel", "raw_quotes": ["extrait1"]}
  ],
  "engagement_patterns": [
    {"pattern": "...", "why_it_works": "...", "example": "..."}
  ],
  "typical_vocabulary": ["mot1", "mot2"],
  "typical_objections": ["objection1", "objection2"],
  "maturity_level": "froid|tiède|chaud",
  "hook_angles": ["angle1", "angle2"],
  "tone_recommendation": "description du ton",
  "best_post_format": "description du format"
}"""

        import re as _re

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=8000,
            thinking={"type": "enabled", "budget_tokens": 5000},
            messages=[{"role": "user", "content": prompt}],
        )

        text  = next((b.text for b in response.content if b.type == "text"), "")
        match = _re.search(r'\{[\s\S]+\}', text)
        try:
            data = json.loads(match.group()) if match else {}
        except Exception:
            data = {}

        pain_points = [
            PainPoint(**p) for p in data.get("pain_points", [])
            if isinstance(p, dict) and "label" in p
        ]
        engagement_patterns = [
            EngagementPattern(**e) for e in data.get("engagement_patterns", [])
            if isinstance(e, dict) and "pattern" in e
        ]

        profile = GroupProfile(
            group_id=group_id,
            group_name=group_name,
            category=scraped_data.get("category", ""),
            summary=data.get("summary", ""),
            pain_points=pain_points,
            engagement_patterns=engagement_patterns,
            typical_vocabulary=data.get("typical_vocabulary", []),
            typical_objections=data.get("typical_objections", []),
            maturity_level=data.get("maturity_level", "froid"),
            hook_angles=data.get("hook_angles", []),
            tone_recommendation=data.get("tone_recommendation", ""),
            best_post_format=data.get("best_post_format", ""),
        )

        # Sauvegarde
        out_path = GROUP_PROFILES_DIR / f"{group_id}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(profile.model_dump_json(indent=2))

        print(f"  ✓ Profil généré : {len(profile.pain_points)} douleurs, "
              f"{len(profile.engagement_patterns)} patterns, "
              f"maturité={profile.maturity_level}")
        return profile

    def analyze_all(self, scraped_list: list[dict], dea: str) -> list[GroupProfile]:
        profiles = []
        for data in scraped_list:
            profile = self.analyze_group(data, dea)
            profiles.append(profile)
        return profiles

    @staticmethod
    def load_profile(group_id: str) -> GroupProfile | None:
        path = GROUP_PROFILES_DIR / f"{group_id}.json"
        if path.exists():
            return GroupProfile.model_validate_json(path.read_text(encoding="utf-8"))
        return None

    @staticmethod
    def all_profiles() -> list[GroupProfile]:
        profiles = []
        for path in GROUP_PROFILES_DIR.glob("*.json"):
            profiles.append(GroupProfile.model_validate_json(path.read_text()))
        return profiles

    def print_summary(self, profile: GroupProfile) -> None:
        print(f"\n{'='*60}")
        print(f"GROUPE : {profile.group_name}")
        print(f"{'='*60}")
        print(f"Résumé    : {profile.summary}")
        print(f"Maturité  : {profile.maturity_level}")
        print(f"Ton       : {profile.tone_recommendation}")
        print(f"\nTop douleurs :")
        for p in profile.pain_points[:3]:
            print(f"  • [{p.frequency}] {p.label}")
        print(f"\nAngles d'accroche :")
        for a in profile.hook_angles[:3]:
            print(f"  → {a}")
