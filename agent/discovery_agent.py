"""
Agent Discovery — trouve et valide de nouveaux groupes Facebook chaque jour.

Stratégie :
  1. Charge les mots-clés de recherche (emploi, étudiant, reconversion, argent…)
  2. Recherche sur Facebook via Playwright (barre de recherche → filtrer Groupes)
  3. Claude Opus 4.6 valide chaque groupe candidat : pertinent ? actif ? taille ?
  4. Ajoute les nouveaux groupes validés dans groups_config.json
  5. Log dans data/discovery_log.json (historique de toutes les découvertes)

Objectif : +3 à +10 nouveaux groupes ciblés par semaine.
"""
from __future__ import annotations


import asyncio
import json
import os
import random
import re
from datetime import datetime
from pathlib import Path

import anthropic
from playwright.async_api import async_playwright, Page

GROUPS_CONFIG   = "groups_config.json"
DISCOVERY_LOG   = "data/discovery_log.json"
MODEL           = "claude-opus-4-6"

# Mots-clés de recherche Facebook — rotation quotidienne
SEARCH_KEYWORDS = [
    # Emploi / chômage
    "cherche emploi France",
    "offres d'emploi Lyon Paris Marseille",
    "trouver un job rapidement",
    "demande d'emploi reconversion",
    "recherche travail sans diplôme",
    # Étudiants
    "job étudiant France",
    "étudiants travail argent de poche",
    "trouver stage alternance",
    "galère étudiant budget",
    # Reconversion
    "reconversion professionnelle",
    "changer de métier à 30 40 ans",
    "quitter son CDI reconversion",
    "nouvelle carrière 2024 2025",
    # Revenus / argent
    "revenus complémentaires France",
    "gagner argent maison travail maison",
    "liberté financière débutant",
    "side hustle business en ligne",
    "travailler depuis chez soi",
    # Mamans / parents
    "mamans entrepreneurs",
    "travailler à domicile maman",
    "concilier famille et travail",
    # Insatisfaction / salaire
    "augmentation salaire France",
    "CDI insatisfait que faire",
    "salaire insuffisant solution",
]

# Catégories mappées
CATEGORY_MAP = {
    "emploi":      ["emploi", "job", "travail", "chômage", "CDI", "offre"],
    "etudiant":    ["étudiant", "étude", "stage", "alternance", "bourse"],
    "reconversion":["reconversion", "changer", "nouvelle carrière", "se reconvertir"],
    "revenus":     ["revenu", "argent", "salaire", "gagner", "liberté financière"],
    "maman":       ["maman", "parent", "famille", "domicile", "concilier"],
    "freelance":   ["freelance", "indépendant", "entrepreneur", "micro-entrepreneur"],
}


def _load_config() -> list[dict]:
    if os.path.exists(GROUPS_CONFIG):
        with open(GROUPS_CONFIG, encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_config(groups: list[dict]) -> None:
    with open(GROUPS_CONFIG, "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=2)


def _load_log() -> dict:
    if os.path.exists(DISCOVERY_LOG):
        with open(DISCOVERY_LOG, encoding="utf-8") as f:
            return json.load(f)
    return {"discovered": [], "rejected": [], "total_added": 0}


def _save_log(log: dict) -> None:
    Path(DISCOVERY_LOG).parent.mkdir(parents=True, exist_ok=True)
    with open(DISCOVERY_LOG, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def _detect_category(name: str, description: str = "") -> str:
    text = (name + " " + description).lower()
    for cat, keywords in CATEGORY_MAP.items():
        if any(kw.lower() in text for kw in keywords):
            return cat
    return "general"


class DiscoveryAgent:
    """
    Découvre de nouveaux groupes Facebook pertinents et les valide avec Claude.
    Lance une session de découverte ~1x/jour, ajoute les meilleurs groupes.
    """

    def __init__(self, api_key: str | None = None, max_per_session: int = 8):
        self.client          = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )
        self.max_per_session = max_per_session
        self.page: Page | None = None

    # ── Playwright ────────────────────────────────────────────────────────────

    async def _connect(self):
        p = await async_playwright().start()
        try:
            browser    = await p.chromium.connect_over_cdp("http://localhost:9222")
            context    = browser.contexts[0]
            self.page  = context.pages[0] if context.pages else await context.new_page()
        except Exception:
            browser   = await p.chromium.launch(headless=False, slow_mo=30)
            context   = await browser.new_context()
            self.page = await context.new_page()

    async def _search_groups(self, keyword: str) -> list[dict]:
        """Cherche des groupes sur Facebook pour un mot-clé."""
        candidates = []
        search_url = f"https://www.facebook.com/search/groups?q={keyword.replace(' ', '%20')}"
        print(f"  [Discovery] Recherche : '{keyword}'")

        try:
            await self.page.goto(search_url, wait_until="domcontentloaded", timeout=25_000)
            await asyncio.sleep(random.uniform(2, 4))

            # Scroll pour charger plus de résultats
            for _ in range(3):
                await self.page.mouse.wheel(0, random.randint(600, 1000))
                await asyncio.sleep(random.uniform(1, 2))

            # Extraction des résultats
            # Facebook affiche les groupes dans des cartes avec nom + lien
            links = await self.page.query_selector_all('a[href*="/groups/"]')
            seen  = set()

            for link in links[:25]:
                try:
                    href = await link.get_attribute("href")
                    if not href or "/groups/feed" in href or "/groups/join" in href:
                        continue

                    # Extraire l'ID ou slug du groupe
                    match = re.search(r'/groups/([^/?]+)', href)
                    if not match:
                        continue
                    group_id = match.group(1)

                    if group_id in seen or group_id in ("", "discover"):
                        continue
                    seen.add(group_id)

                    # Tenter de récupérer le nom
                    name = ""
                    try:
                        parent = await link.evaluate_handle(
                            "el => el.closest('[role=\"article\"]') || el.parentElement"
                        )
                        name = (await parent.inner_text())[:120].strip()
                    except Exception:
                        name = group_id.replace("-", " ").replace("_", " ").title()

                    if len(name) < 5:
                        continue

                    candidates.append({
                        "id":       group_id,
                        "name":     name[:100],
                        "url":      f"https://www.facebook.com/groups/{group_id}",
                        "keyword":  keyword,
                    })

                except Exception:
                    continue

        except Exception as e:
            print(f"  [Discovery] Erreur recherche : {e}")

        return candidates

    # ── Validation Claude ─────────────────────────────────────────────────────

    def _validate_candidates(
        self, candidates: list[dict], existing_ids: set
    ) -> list[dict]:
        """
        Envoie les candidats à Claude pour validation.
        Retourne uniquement les groupes pertinents (cible Setting).
        """
        # Filtrer ceux déjà connus
        new_candidates = [c for c in candidates if c["id"] not in existing_ids]
        if not new_candidates:
            return []

        candidates_text = "\n".join(
            f"{i+1}. ID={c['id']} | Nom={c['name']}"
            for i, c in enumerate(new_candidates[:20])
        )

        prompt = f"""Tu es un expert en growth hacking et marketing Facebook.
Voici une liste de groupes Facebook candidats découverts pour promouvoir une offre de Setting
(métier digital, 2-3h/jour, 1500-3000€/mois, accessible sans diplôme).

CIBLES IDÉALES : chercheurs d'emploi, étudiants, personnes en reconversion,
indépendants avec revenus irréguliers, mamans voulant travailler chez elles,
personnes insatisfaites de leur salaire.

CANDIDATS :
{candidates_text}

Pour chaque groupe, indique s'il faut l'AJOUTER ou le REJETER.
Critères d'ajout :
  ✓ Le groupe correspond à une cible (emploi/étudiant/reconversion/revenus/maman)
  ✓ Le nom suggère de vraies personnes qui cherchent des solutions
  ✗ REJETER : groupes d'offres d'emploi d'entreprises, groupes de recruteurs,
    groupes hors-sujet, groupes de spam

Retourne UNIQUEMENT un JSON valide :
{{
  "validated": [
    {{"id": "...", "name": "...", "reason": "pourquoi pertinent", "category": "emploi|etudiant|reconversion|revenus|maman|freelance"}}
  ],
  "rejected_ids": ["id1", "id2"]
}}"""

        try:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = next(b.text for b in response.content if b.type == "text")
            match = re.search(r'\{[\s\S]+\}', text)
            if not match:
                return []
            data = json.loads(match.group())
            return data.get("validated", [])
        except Exception as e:
            print(f"  [Discovery] Erreur validation Claude : {e}")
            return []

    # ── Session de découverte ─────────────────────────────────────────────────

    async def run_discovery_session(self) -> int:
        """
        Lance une session complète de découverte.
        Retourne le nombre de nouveaux groupes ajoutés.
        """
        print(f"\n[Discovery] Début de session — {datetime.now().strftime('%d/%m/%Y %H:%M')}")

        existing   = _load_config()
        existing_ids = {g["id"] for g in existing}
        log        = _load_log()

        await self._connect()

        # Choisir 3 mots-clés aléatoires pour la session
        keywords = random.sample(SEARCH_KEYWORDS, min(3, len(SEARCH_KEYWORDS)))
        all_candidates = []

        for kw in keywords:
            candidates = await self._search_groups(kw)
            all_candidates.extend(candidates)
            await asyncio.sleep(random.uniform(8, 15))

        print(f"  {len(all_candidates)} candidats bruts trouvés")

        # Dédoublonnage
        seen = set()
        unique = []
        for c in all_candidates:
            if c["id"] not in seen:
                seen.add(c["id"])
                unique.append(c)

        # Validation Claude
        validated = self._validate_candidates(unique, existing_ids)
        print(f"  {len(validated)} groupes validés par Claude")

        # Ajout dans la config
        added = 0
        for v in validated[:self.max_per_session]:
            category = v.get("category", _detect_category(v["name"]))
            new_group = {
                "id":          v["id"],
                "name":        v["name"],
                "category":    category,
                "description": v.get("reason", ""),
                "added_at":    datetime.now().strftime("%Y-%m-%d"),
                "source":      "discovery_agent",
            }
            existing.append(new_group)
            log["discovered"].append(new_group)
            added += 1
            print(f"  ✓ Ajouté : [{category}] {v['name']}")

        if added > 0:
            _save_config(existing)
            log["total_added"] = log.get("total_added", 0) + added

        _save_log(log)
        print(f"\n[Discovery] Session terminée : +{added} groupes (total={len(existing)})")
        return added

    def discovery_stats(self) -> dict:
        log      = _load_log()
        config   = _load_config()
        by_cat   = {}
        for g in config:
            cat = g.get("category", "autre")
            by_cat[cat] = by_cat.get(cat, 0) + 1
        return {
            "total_groups":    len(config),
            "total_discovered": log.get("total_added", 0),
            "by_category":     by_cat,
        }
