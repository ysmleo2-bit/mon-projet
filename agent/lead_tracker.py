"""
Agent Lead Tracker — surveille les commentaires sur les posts publiés
et identifie / log les leads qualifiés.

Un lead est qualifié quand une personne :
  - Commente un mot déclencheur (INFO, OUI, INTÉRESSÉ, DETAILS, etc.)
  - Répond à la question CTA du post
  - Envoie un DM suite au post

Fonctionnement :
  1. Scanne les groupes où des posts ont été publiés (via post_log.json)
  2. Trouve les commentaires récents sur nos posts
  3. Filtre ceux qui contiennent les mots déclencheurs
  4. Log le profil de la personne (nom, URL, groupe, date)
  5. Affiche le compteur hebdomadaire (objectif : 30/semaine)
  6. Alerte quand objectif atteint ou près d'être atteint

Données sauvegardées dans : data/leads.json
"""

import asyncio
import json
import os
import random
import re
from datetime import datetime, timedelta
from pathlib import Path
from playwright.async_api import async_playwright, Page

LEADS_FILE      = Path("data/leads.json")
POST_LOG_FILE   = "post_log.json"
WEEKLY_GOAL     = 30

# Mots déclencheurs — quand un commentaire contient l'un d'eux, c'est un lead
TRIGGER_WORDS   = [
    "info", "infos", "information", "informations",
    "oui", "intéressé", "intéressée", "intéresse",
    "détails", "details", "dis moi", "dis-moi",
    "comment", "comment faire", "je veux",
    "c'est quoi", "c'est quoi", "ça m'intéresse",
    "en savoir plus", "contact", "mp", "message",
    "je suis partant", "partante", "yes", "ok",
    "comment ça marche", "comment ca marche",
    "plus d'info", "plus d'informations",
]


def _load_leads() -> dict:
    if LEADS_FILE.exists():
        return json.loads(LEADS_FILE.read_text(encoding="utf-8"))
    return {
        "leads":        [],
        "weekly_count": {},   # {"2024-W01": 5, …}
        "total":        0,
    }


def _save_leads(data: dict) -> None:
    LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
    LEADS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _week_key(dt: datetime = None) -> str:
    d = dt or datetime.now()
    return d.strftime("%Y-W%V")


def _is_trigger(text: str) -> bool:
    text_lower = text.lower().strip()
    return any(tw in text_lower for tw in TRIGGER_WORDS)


def weekly_count() -> int:
    data = _load_leads()
    key  = _week_key()
    return data["weekly_count"].get(key, 0)


def total_leads() -> int:
    return _load_leads().get("total", 0)


def progress_report() -> str:
    wc     = weekly_count()
    total  = total_leads()
    pct    = min(100, int(wc / WEEKLY_GOAL * 100))
    bar    = "█" * (pct // 5) + "░" * (20 - pct // 5)
    return (
        f"📊 LEADS CETTE SEMAINE : {wc}/{WEEKLY_GOAL}\n"
        f"   [{bar}] {pct}%\n"
        f"   Total cumulé : {total} leads"
    )


class LeadTracker:
    """
    Scanne les groupes pour trouver les commentaires qualifiés (leads)
    sur nos posts récents.
    """

    def __init__(self):
        self.page: Page | None = None

    async def _connect(self):
        p = await async_playwright().start()
        try:
            browser   = await p.chromium.connect_over_cdp("http://localhost:9222")
            context   = browser.contexts[0]
            self.page = context.pages[0] if context.pages else await context.new_page()
        except Exception:
            browser   = await p.chromium.launch(headless=False, slow_mo=20)
            context   = await browser.new_context()
            self.page = await context.new_page()

    def _load_recent_post_urls(self, hours_back: int = 48) -> list[dict]:
        """Charge les posts publiés dans les dernières N heures depuis post_log.json."""
        if not os.path.exists(POST_LOG_FILE):
            return []
        import time
        cutoff = time.time() - (hours_back * 3600)
        with open(POST_LOG_FILE, encoding="utf-8") as f:
            log = json.load(f)

        recent = []
        for group_id, timestamps in log.items():
            if not isinstance(timestamps, list):
                continue
            fresh = [ts for ts in timestamps if ts > cutoff]
            if fresh:
                recent.append({
                    "group_id":  group_id,
                    "post_count": len(fresh),
                })
        return recent

    async def _scan_group_for_leads(
        self, group_id: str
    ) -> list[dict]:
        """
        Visite la page du groupe, trouve nos posts récents et scanne les commentaires.
        Retourne les leads trouvés.
        """
        leads_found = []
        url = f"https://www.facebook.com/groups/{group_id}"

        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=25_000)
            await asyncio.sleep(random.uniform(2, 3))

            # Scroll pour charger les posts
            for _ in range(4):
                await self.page.mouse.wheel(0, random.randint(500, 900))
                await asyncio.sleep(random.uniform(1, 2))

            # Trouver les commentaires visibles
            comment_selectors = [
                'div[aria-label*="Commentaire"] span[dir="auto"]',
                'ul[role="presentation"] li span[dir="auto"]',
                'div.x1n2onr6 span[dir="auto"]',
                '[data-testid="UFI2Comment/body"] span',
            ]

            for sel in comment_selectors:
                elements = await self.page.query_selector_all(sel)
                if not elements:
                    continue

                for el in elements:
                    try:
                        text = (await el.inner_text()).strip()
                        if not text or len(text) < 2:
                            continue

                        if not _is_trigger(text):
                            continue

                        # Remonter pour trouver le nom/profil du commentateur
                        commenter_name = ""
                        commenter_url  = ""
                        try:
                            parent = await el.evaluate_handle(
                                "el => el.closest('li') || el.closest('[data-testid]') || el.parentElement"
                            )
                            links = await parent.query_selector_all('a[href*="/user/"], a[href*="profile.php"]')
                            if links:
                                commenter_url  = await links[0].get_attribute("href")
                                commenter_name = (await links[0].inner_text()).strip()
                        except Exception:
                            pass

                        lead = {
                            "group_id":       group_id,
                            "commenter_name": commenter_name or "Inconnu",
                            "commenter_url":  commenter_url,
                            "comment_text":   text[:200],
                            "detected_at":    datetime.now().isoformat(),
                            "week":           _week_key(),
                            "status":         "nouveau",
                        }
                        leads_found.append(lead)

                    except Exception:
                        continue
                break  # On a trouvé des éléments avec ce sélecteur

        except Exception as e:
            print(f"  [LeadTracker] Erreur scan groupe {group_id} : {e}")

        return leads_found

    async def scan_all_groups(self, hours_back: int = 48) -> int:
        """
        Scanne tous les groupes actifs, log les nouveaux leads.
        Retourne le nombre de nouveaux leads trouvés.
        """
        print(f"\n[LeadTracker] Scan — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        await self._connect()

        recent_groups = self._load_recent_post_urls(hours_back)
        if not recent_groups:
            # Scanner tous les groupes de la config si pas de log
            try:
                with open("groups_config.json", encoding="utf-8") as f:
                    all_groups = json.load(f)
                recent_groups = [{"group_id": g["id"]} for g in all_groups[:10]]
            except Exception:
                print("  [LeadTracker] Aucun groupe à scanner.")
                return 0

        data         = _load_leads()
        existing_ids = {
            (l["group_id"], l["commenter_url"]) for l in data["leads"]
        }
        new_count = 0

        for entry in recent_groups:
            gid = entry["group_id"]
            print(f"  → Scan groupe {gid}…")
            leads = await self._scan_group_for_leads(gid)

            for lead in leads:
                key = (lead["group_id"], lead["commenter_url"])
                if key in existing_ids:
                    continue  # Déjà logué
                data["leads"].append(lead)
                existing_ids.add(key)
                week = lead["week"]
                data["weekly_count"][week] = data["weekly_count"].get(week, 0) + 1
                data["total"] = data.get("total", 0) + 1
                new_count += 1
                print(f"    ✓ Nouveau lead : {lead['commenter_name']} — '{lead['comment_text'][:50]}'")

            await asyncio.sleep(random.uniform(10, 20))

        _save_leads(data)

        print(f"\n[LeadTracker] +{new_count} nouveaux leads")
        print(progress_report())

        # Alerte si objectif atteint ou proche
        wc = weekly_count()
        if wc >= WEEKLY_GOAL:
            print(f"\n🎯 OBJECTIF ATTEINT ! {wc} leads cette semaine 🎉")
        elif wc >= WEEKLY_GOAL * 0.7:
            remaining = WEEKLY_GOAL - wc
            print(f"\n⚡ Proche de l'objectif ! Plus que {remaining} leads à trouver.")

        return new_count

    def export_new_leads(self, since_hours: int = 24) -> list[dict]:
        """Retourne les leads détectés dans les dernières N heures."""
        data   = _load_leads()
        cutoff = datetime.now() - timedelta(hours=since_hours)
        return [
            l for l in data["leads"]
            if datetime.fromisoformat(l["detected_at"]) > cutoff
        ]

    def weekly_report(self) -> str:
        data     = _load_leads()
        wc       = weekly_count()
        total    = data.get("total", 0)
        new_24h  = len(self.export_new_leads(24))

        # Détail par groupe
        week_leads = [l for l in data["leads"] if l.get("week") == _week_key()]
        by_group   = {}
        for l in week_leads:
            gid = l["group_id"]
            by_group[gid] = by_group.get(gid, 0) + 1

        top_groups = sorted(by_group.items(), key=lambda x: -x[1])[:5]
        top_str = "\n".join(f"    {gid}: {n} leads" for gid, n in top_groups)

        return (
            f"{'='*50}\n"
            f"RAPPORT LEADS — Semaine {_week_key()}\n"
            f"{'='*50}\n"
            f"Cette semaine : {wc}/{WEEKLY_GOAL}\n"
            f"Dernières 24h : +{new_24h}\n"
            f"Total cumulé  : {total}\n"
            f"\nTop groupes cette semaine :\n{top_str}\n"
            f"{'='*50}"
        )
