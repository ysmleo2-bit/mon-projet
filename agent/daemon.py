"""
Daemon 24/7 — cœur de l'automatisation Setting / Léo Ollivier

Planning des tâches quotidiennes :
  06:30  — Découverte de nouveaux groupes (lundi uniquement)
  07:00  — Scraping quotidien des groupes actifs
  08:00  — Analyse + mise à jour des profils (si nouveaux scrapes)
  09:00  — Génération des posts du jour (1 par groupe)
  10:00  — Vague de publication MATIN (groupes emploi/reconversion)
  14:00  — Scan leads matin
  19:00  — Vague de publication SOIR (groupes étudiants/mamans)
  21:00  — Scan leads soir + rapport hebdomadaire (vendredi uniquement)
  23:30  — Nettoyage et préparation du lendemain

Le daemon tourne en boucle infinie et gère :
  - La reprise automatique après erreur
  - Le statut en temps réel dans data/daemon_status.json
  - Les logs complets dans data/daemon.log
  - Les alertes sur objectif leads (30/semaine)

Lancement :
  python daemon.py            # Mode production (tourne indéfiniment)
  python daemon.py --test     # Mode test (lance toutes les tâches une fois)
  python daemon.py --task scrape   # Lance une tâche précise
"""

import asyncio
import json
import logging
import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────────

Path("data").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("data/daemon.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("daemon")

STATUS_FILE = Path("data/daemon_status.json")
GROUPS_CONFIG = "groups_config.json"


# ── Status ────────────────────────────────────────────────────────────────────

def _write_status(task: str, state: str, details: str = ""):
    STATUS_FILE.write_text(
        json.dumps({
            "task":       task,
            "state":      state,
            "details":    details,
            "updated_at": datetime.now().isoformat(),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_groups() -> list[dict]:
    if os.path.exists(GROUPS_CONFIG):
        with open(GROUPS_CONFIG, encoding="utf-8") as f:
            return json.load(f)
    from config import FB_GROUPS_PRIORITY
    return FB_GROUPS_PRIORITY


def _load_dea() -> str:
    try:
        with open("data/dea.txt", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "Setter — 2-3h/jour — 1500-3000€/mois, sans expérience"


# ── Tâches individuelles ──────────────────────────────────────────────────────

async def task_discovery():
    """Découverte hebdomadaire de nouveaux groupes (lundi)."""
    log.info("=== TÂCHE : Découverte de nouveaux groupes ===")
    _write_status("discovery", "running")
    try:
        from agent.discovery_agent import DiscoveryAgent
        agent  = DiscoveryAgent(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        added  = await agent.run_discovery_session()
        stats  = agent.discovery_stats()
        log.info(f"Découverte terminée : +{added} groupes (total={stats['total_groups']})")
        _write_status("discovery", "done", f"+{added} groupes")
    except Exception as e:
        log.error(f"Erreur discovery : {e}", exc_info=True)
        _write_status("discovery", "error", str(e))


async def task_scrape():
    """Scraping quotidien des groupes pour data fraîche."""
    log.info("=== TÂCHE : Scraping des groupes ===")
    _write_status("scrape", "running")
    try:
        from agent.scraper_agent import ScraperAgent
        groups  = _load_groups()
        # Scraper un sous-ensemble chaque jour (rotation)
        day_offset = datetime.now().timetuple().tm_yday
        chunk_size = min(8, len(groups))
        start      = (day_offset * chunk_size) % max(len(groups), 1)
        chunk      = (groups[start:] + groups[:start])[:chunk_size]

        agent   = ScraperAgent(max_posts_per_group=20)
        await agent.connect()
        results = await agent.scrape_groups(chunk)
        log.info(f"Scraping terminé : {len(results)} groupes scrapés")
        _write_status("scrape", "done", f"{len(results)} groupes")
    except Exception as e:
        log.error(f"Erreur scraping : {e}", exc_info=True)
        _write_status("scrape", "error", str(e))


def task_analyze():
    """Analyse des données scrapées — mise à jour des profils."""
    log.info("=== TÂCHE : Analyse + mise à jour profils ===")
    _write_status("analyze", "running")
    try:
        from agent.scraper_agent  import ScraperAgent
        from agent.analyzer_agent import AnalyzerAgent
        scraped  = ScraperAgent.all_cached()
        if not scraped:
            log.info("Aucune donnée scrapée à analyser.")
            _write_status("analyze", "skipped", "no data")
            return
        dea      = _load_dea()
        analyzer = AnalyzerAgent(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        profiles = analyzer.analyze_all(scraped, dea)
        log.info(f"Analyse terminée : {len(profiles)} profils mis à jour")
        _write_status("analyze", "done", f"{len(profiles)} profils")
    except Exception as e:
        log.error(f"Erreur analyse : {e}", exc_info=True)
        _write_status("analyze", "error", str(e))


def task_generate():
    """Génération des posts du jour pour tous les groupes."""
    log.info("=== TÂCHE : Génération des posts ===")
    _write_status("generate", "running")
    try:
        from agent.analyzer_agent import AnalyzerAgent
        from agent.content_agent  import ContentAgent
        from agent.visual_agent   import VisualAgent

        dea      = _load_dea()
        profiles = AnalyzerAgent.all_profiles()
        if not profiles:
            log.warning("Aucun profil de groupe — génération avec profils minimaux")
            groups = _load_groups()
            from agent.analyzer_agent import GroupProfile
            profiles = [
                GroupProfile(
                    group_id=g["id"], group_name=g.get("name", g["id"]),
                    category=g.get("category", "general"),
                    summary=g.get("description", ""),
                    pain_points=[], engagement_patterns=[],
                    typical_vocabulary=[], typical_objections=[],
                    maturity_level="froid", hook_angles=[],
                    tone_recommendation="Ton direct et accessible.",
                    best_post_format="Texte court + CTA",
                ) for g in groups
            ]

        content = ContentAgent(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        visual  = VisualAgent()
        posts   = []

        for profile in profiles:
            post = content.generate_post(profile, dea)
            visual.generate(post)
            posts.append(post)

        log.info(f"Génération terminée : {len(posts)} posts + visuels")
        _write_status("generate", "done", f"{len(posts)} posts")
    except Exception as e:
        log.error(f"Erreur génération : {e}", exc_info=True)
        _write_status("generate", "error", str(e))


async def task_publish(wave: str = "morning"):
    """Vague de publication."""
    log.info(f"=== TÂCHE : Publication {wave.upper()} ===")
    _write_status(f"publish_{wave}", "running")
    try:
        from agent.publisher_agent import PublisherAgent
        dea       = _load_dea()
        publisher = PublisherAgent(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            max_per_wave=15,
        )
        count = await publisher.run_wave(wave=wave, dea=dea)
        log.info(f"Publication {wave} terminée : {count} posts publiés")
        _write_status(f"publish_{wave}", "done", f"{count} publiés")
    except Exception as e:
        log.error(f"Erreur publication {wave} : {e}", exc_info=True)
        _write_status(f"publish_{wave}", "error", str(e))


async def task_scan_leads():
    """Scan des commentaires pour trouver les leads."""
    log.info("=== TÂCHE : Scan leads ===")
    _write_status("leads", "running")
    try:
        from agent.lead_tracker import LeadTracker
        tracker   = LeadTracker()
        new_leads = await tracker.scan_all_groups(hours_back=24)
        report    = tracker.weekly_report()
        log.info(f"Scan leads terminé : +{new_leads} nouveaux leads\n{report}")
        _write_status("leads", "done", f"+{new_leads}")
    except Exception as e:
        log.error(f"Erreur scan leads : {e}", exc_info=True)
        _write_status("leads", "error", str(e))


# ── Scheduler ─────────────────────────────────────────────────────────────────

class TaskSchedule:
    """Tâche planifiée avec heure de déclenchement et fréquence."""
    def __init__(self, name: str, hour: int, minute: int, days: str = "daily"):
        self.name       = name        # nom de la tâche
        self.hour       = hour
        self.minute     = minute
        self.days       = days        # "daily" / "monday" / "friday"
        self.last_run: datetime | None = None

    def should_run(self, now: datetime) -> bool:
        # Vérifier le jour
        if self.days == "monday" and now.weekday() != 0:
            return False
        if self.days == "friday" and now.weekday() != 4:
            return False

        # Vérifier l'heure (fenêtre de 2 minutes)
        target = now.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)
        diff   = abs((now - target).total_seconds())
        if diff > 120:
            return False

        # Ne pas relancer si déjà exécutée dans la dernière heure
        if self.last_run and (now - self.last_run).total_seconds() < 3600:
            return False

        return True

    def mark_run(self, now: datetime):
        self.last_run = now


SCHEDULE = [
    # Lundi uniquement
    TaskSchedule("discovery",      hour=6,  minute=30, days="monday"),
    # Tous les jours
    TaskSchedule("scrape",         hour=7,  minute=0,  days="daily"),
    TaskSchedule("analyze",        hour=8,  minute=0,  days="daily"),
    TaskSchedule("generate",       hour=9,  minute=0,  days="daily"),
    TaskSchedule("publish_morning",hour=10, minute=0,  days="daily"),
    TaskSchedule("leads_morning",  hour=14, minute=0,  days="daily"),
    TaskSchedule("publish_evening",hour=19, minute=0,  days="daily"),
    TaskSchedule("leads_evening",  hour=21, minute=0,  days="daily"),
    # Vendredi uniquement
    TaskSchedule("weekly_report",  hour=21, minute=30, days="friday"),
]

TASK_MAP = {
    "discovery":       task_discovery,
    "scrape":          task_scrape,
    "analyze":         task_analyze,
    "generate":        task_generate,
    "publish_morning": lambda: task_publish("morning"),
    "publish_evening": lambda: task_publish("evening"),
    "leads_morning":   task_scan_leads,
    "leads_evening":   task_scan_leads,
    "weekly_report":   _weekly_report_task,
}


def _weekly_report_task():
    """Affiche et log le rapport hebdomadaire des leads."""
    log.info("=== RAPPORT HEBDOMADAIRE ===")
    try:
        from agent.lead_tracker import LeadTracker
        tracker = LeadTracker()
        report  = tracker.weekly_report()
        log.info(report)
        # Sauvegarde dans data/weekly_reports/
        Path("data/weekly_reports").mkdir(exist_ok=True)
        filename = f"data/weekly_reports/rapport_{datetime.now().strftime('%Y-W%V')}.txt"
        Path(filename).write_text(report, encoding="utf-8")
    except Exception as e:
        log.error(f"Erreur rapport hebdo : {e}", exc_info=True)


async def _run_task(name: str):
    """Lance une tâche par son nom, sync ou async."""
    func = TASK_MAP.get(name)
    if func is None:
        log.warning(f"Tâche inconnue : {name}")
        return
    log.info(f"▶ Lancement : {name}")
    try:
        result = func()
        if asyncio.iscoroutine(result):
            await result
    except Exception as e:
        log.error(f"Tâche {name} échouée : {e}", exc_info=True)


# ── Boucle principale 24/7 ────────────────────────────────────────────────────

async def run_daemon():
    log.info("="*60)
    log.info("DAEMON SETTING — Démarrage")
    log.info(f"PID : {os.getpid()}")
    log.info("="*60)
    _write_status("daemon", "running", "Démarré")

    while True:
        now = datetime.now()

        for sched in SCHEDULE:
            if sched.should_run(now):
                log.info(f"⏰ Déclenchement : {sched.name} à {now.strftime('%H:%M')}")
                sched.mark_run(now)
                await _run_task(sched.name)

        # Mise à jour du statut "alive"
        _write_status("daemon", "running", f"Actif — {now.strftime('%H:%M:%S')}")

        # Attente 60 secondes avant la prochaine vérification
        await asyncio.sleep(60)


# ── Mode test (une passe de toutes les tâches) ────────────────────────────────

async def run_test():
    log.info("=== MODE TEST : lancement de toutes les tâches une fois ===")
    for name in ["scrape", "analyze", "generate", "publish_morning", "leads_morning"]:
        log.info(f"\n--- Tâche : {name} ---")
        await _run_task(name)
        await asyncio.sleep(2)
    log.info("=== Mode test terminé ===")


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Daemon 24/7 Setting — Léo Ollivier")
    parser.add_argument("--test",   action="store_true", help="Mode test (une passe)")
    parser.add_argument("--task",   type=str, default=None,
                        help=f"Lancer une tâche précise ({', '.join(TASK_MAP.keys())})")
    args = parser.parse_args()

    if args.task:
        asyncio.run(_run_task(args.task))
    elif args.test:
        asyncio.run(run_test())
    else:
        asyncio.run(run_daemon())


if __name__ == "__main__":
    main()
