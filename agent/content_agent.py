"""
Agent 3 — ContentAgent
Génère 1 publication Facebook par jour par groupe, personnalisée selon :
  - Le profil psychographique du groupe (pain points, patterns, vocabulaire)
  - La DEA (pitch du Setting)
  - Le tone of voice adapté à la communauté
  - Un angle d'accroche différent chaque jour

Utilise Claude Opus 4.6 avec streaming + adaptive thinking.
"""

import json
import os
from datetime import datetime, date
from pathlib import Path
from pydantic import BaseModel
from typing import List
import anthropic

from agent.analyzer_agent import GroupProfile

CONTENT_DIR = Path("data/generated_content/posts")
CONTENT_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "claude-opus-4-6"

# Rotation des angles pour éviter la répétition
DAILY_ANGLES = [
    "storytelling_transformation",   # Avant/après, histoire personnelle
    "chiffres_concrets",              # Stats, revenus, délais précis
    "question_douleur",               # Question qui touche le point de douleur
    "temoignage_fictif",              # Témoignage d'un profil similaire
    "mythe_vs_realite",               # Démontez une idée reçue
    "curiosite_metier",               # Révélez le métier mystère progressivement
    "urgence_marche",                 # Le marché explose maintenant
]


class GeneratedPost(BaseModel):
    group_id:    str
    group_name:  str
    date:        str          # YYYY-MM-DD
    angle:       str          # Angle utilisé
    hook:        str          # 1ère ligne accrocheuse
    body:        str          # Corps du post
    cta:         str          # Call-to-action
    full_text:   str          # Texte complet prêt à copier-coller
    hashtags:    List[str]
    visual_brief: str         # Brief pour l'agent visuel (ce qu'il faut illustrer)
    word_count:  int


class ContentAgent:
    """
    Génère des publications Facebook adaptées à chaque groupe.
    1 post / jour / groupe = différent de tous les autres groupes.
    """

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )

    def _get_daily_angle(self, group_id: str, day_offset: int = 0) -> str:
        """Rotation déterministe de l'angle selon le groupe et le jour."""
        day_number  = (date.today().toordinal() + day_offset) % len(DAILY_ANGLES)
        group_hash  = sum(ord(c) for c in group_id) % len(DAILY_ANGLES)
        angle_index = (day_number + group_hash) % len(DAILY_ANGLES)
        return DAILY_ANGLES[angle_index]

    def _build_content_prompt(
        self,
        profile: GroupProfile,
        dea: str,
        angle: str,
        day_offset: int = 0,
    ) -> str:
        pain_points_str = "\n".join(
            f"  - [{p.frequency}] {p.label}" + (
                f'\n    (extrait réel : "{p.raw_quotes[0]}")' if p.raw_quotes else ""
            )
            for p in profile.pain_points[:5]
        )
        patterns_str = "\n".join(
            f"  - {pt.pattern} → {pt.why_it_works}"
            for pt in profile.engagement_patterns[:3]
        )
        vocab_str = ", ".join(profile.typical_vocabulary[:15])
        objections_str = "\n".join(f"  - {o}" for o in profile.typical_objections[:4])

        angle_descriptions = {
            "storytelling_transformation":
                "Raconte une micro-histoire 'avant/après' d'une personne avec le même profil que le groupe. "
                "Commence par le problème vécu, puis révèle la transformation via le Setting.",
            "chiffres_concrets":
                "Utilise des chiffres précis, des délais réels, des revenus attestés. "
                "Les gens croient ce qu'ils peuvent mesurer. Sois ultra-spécifique.",
            "question_douleur":
                "Commence par UNE question qui touche exactement la douleur principale du groupe. "
                "La question doit faire dire 'c'est moi ça !'. Puis amène la solution.",
            "temoignage_fictif":
                "Rédige un témoignage d'une personne EXACTEMENT dans la situation de ce groupe "
                "(même âge approximatif, même problème). Synthèse credible, pas exagérée.",
            "mythe_vs_realite":
                "Démontez une idée reçue que ce groupe a probablement sur l'argent / le travail / "
                "les formations. 'Contrairement à ce qu'on croit…' ou 'Ce qu'on ne dit pas c'est que…'",
            "curiosite_metier":
                "Révèle progressivement l'existence du Setting sans le nommer tout de suite. "
                "Crée de la curiosité. 'Il existe un métier dont personne ne parle…'",
            "urgence_marche":
                "Parle de l'opportunité de marché actuelle. Le marché explose, la demande dépasse "
                "l'offre, les positions se remplissent. Crée un sentiment d'opportunité à saisir.",
        }

        return f"""Tu es un expert en copywriting et en growth hacking Facebook.
Tu dois créer UN post Facebook pour le groupe **"{profile.group_name}"**.

## PROFIL DU GROUPE
{profile.summary}
Maturité : **{profile.maturity_level}**
Ton recommandé : {profile.tone_recommendation}
Format qui fonctionne : {profile.best_post_format}

## DOULEURS PRINCIPALES
{pain_points_str}

## PATTERNS D'ENGAGEMENT (ce qui fonctionne dans ce groupe)
{patterns_str}

## VOCABULAIRE TYPIQUE DU GROUPE
{vocab_str}

## OBJECTIONS À ANTICIPER
{objections_str}

## DEA — L'OFFRE À PROMOUVOIR
{dea}

## ANGLE DU JOUR : {angle.replace("_", " ").upper()}
{angle_descriptions.get(angle, angle)}

## CONSIGNES DE RÉDACTION
1. **Hook** (1ère ligne) : DOIT arrêter le scroll. Maximum 15 mots. Percutant, spécifique au groupe.
2. **Corps** : 100-200 mots max. Parle EXACTEMENT comme les membres de ce groupe.
   Utilise leur vocabulaire. Touche leur douleur principale. Amène la solution naturellement.
3. **CTA** : Demande de commenter un mot-clé (ex: « INFO », « DETAILS », « OUI »).
   Simple, direct, sans friction.
4. **Hashtags** : 3-5 hashtags pertinents pour ce groupe.
5. **Brief visuel** : Décris en 1 phrase l'image qui devrait accompagner ce post.

⚠️ NE MENTIONNE PAS le mot "Setting" dans le post — génère la curiosité.
⚠️ Adapte TOTALEMENT le ton au groupe (étudiant ≠ maman ≠ en reconversion).
⚠️ Le post doit sembler écrit par un membre du groupe, pas une pub."""

    def generate_post(
        self,
        profile: GroupProfile,
        dea: str,
        day_offset: int = 0,
    ) -> GeneratedPost:
        """Génère 1 post pour 1 groupe pour 1 jour donné."""
        angle = self._get_daily_angle(profile.group_id, day_offset)
        print(f"\n[Content] Génération pour '{profile.group_name}' (angle: {angle})…")

        prompt = self._build_content_prompt(profile, dea, angle, day_offset)

        # Streaming pour éviter les timeouts sur les réponses longues
        full_response = ""
        with self.client.messages.stream(
            model=MODEL,
            max_tokens=4000,
            thinking={"type": "enabled", "budget_tokens": 2000},
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                full_response += text
                print(text, end="", flush=True)
            final_msg = stream.get_final_message()

        print()  # newline après le streaming

        # Structuration de la réponse avec un second appel léger
        structure_prompt = f"""Voici un post Facebook généré. Extrais et structure les éléments suivants en JSON.

Post :
{full_response}

Retourne UNIQUEMENT un JSON valide avec ces champs :
{{
  "hook": "première ligne accrocheuse du post",
  "body": "corps du post (sans le hook ni le CTA)",
  "cta": "call-to-action final",
  "full_text": "texte complet prêt à poster",
  "hashtags": ["hashtag1", "hashtag2"],
  "visual_brief": "description de l'image recommandée en 1 phrase"
}}"""

        struct_response = self.client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": structure_prompt}],
        )
        struct_text = next(
            b.text for b in struct_response.content if b.type == "text"
        )

        # Parser le JSON (robuste aux blocs markdown)
        import re
        json_match = re.search(r'\{[\s\S]+\}', struct_text)
        try:
            data = json.loads(json_match.group()) if json_match else {}
        except Exception:
            data = {}

        today_str   = (datetime.now()).strftime("%Y-%m-%d")
        full_text   = data.get("full_text", full_response)
        word_count  = len(full_text.split())

        post = GeneratedPost(
            group_id    = profile.group_id,
            group_name  = profile.group_name,
            date        = today_str,
            angle       = angle,
            hook        = data.get("hook", full_text[:100]),
            body        = data.get("body", full_text),
            cta         = data.get("cta", "Commente INFO pour en savoir plus"),
            full_text   = full_text,
            hashtags    = data.get("hashtags", []),
            visual_brief= data.get("visual_brief", "Visuel inspirant noir/vert avec texte accrocheur"),
            word_count  = word_count,
        )

        # Sauvegarde
        out_path = CONTENT_DIR / f"{profile.group_id}_{today_str}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(post.model_dump_json(indent=2))

        print(f"  ✓ Post généré : {word_count} mots, CTA: '{post.cta}'")
        return post

    def generate_week(
        self,
        profiles: list[GroupProfile],
        dea: str,
        days: int = 7,
    ) -> dict[str, list[GeneratedPost]]:
        """
        Génère `days` jours de contenu pour tous les groupes.
        Retourne un dict {group_id: [post_j1, post_j2, …]}
        """
        calendar: dict[str, list[GeneratedPost]] = {}
        for profile in profiles:
            calendar[profile.group_id] = []
            for day in range(days):
                post = self.generate_post(profile, dea, day_offset=day)
                calendar[profile.group_id].append(post)
        return calendar

    @staticmethod
    def load_post(group_id: str, date_str: str) -> GeneratedPost | None:
        path = CONTENT_DIR / f"{group_id}_{date_str}.json"
        if path.exists():
            return GeneratedPost.model_validate_json(path.read_text())
        return None

    @staticmethod
    def today_posts() -> list[GeneratedPost]:
        today = datetime.now().strftime("%Y-%m-%d")
        posts = []
        for path in CONTENT_DIR.glob(f"*_{today}.json"):
            posts.append(GeneratedPost.model_validate_json(path.read_text()))
        return posts
