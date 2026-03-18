"""
Daemon 24/7 — cœur de l'automatisation Setting / Léo Ollivier

Planning des tâches quotidiennes :
  06:30  — Découverte de nouveaux groupes (lundi uniquement)
  07:00  — Scraping quotidien des groupes actifs
  08:00  — Analyse + mise à jour des profils
  09:00  — Génération des posts du jour (1 par groupe)
  10:00  — Rapport matin Telegram + vague publication MATIN
  14:00  — Scan leads matin
  19:00  — Vague de publication SOIR
  21:00  — Scan leads soir + rapport soir Telegram
  21:30  — Rapport hebdomadaire Telegram (vendredi uniquement)

Lancement :
  python daemon.py            # Production (tourne indéfiniment)
  python daemon.py --test     # Mode test (une passe complète)
  python daemon.py --task scrape
  python daemon.py --task telegram_test
"""
from __future__ import annotations


import asyncio
import json
import logging
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

Path("data").mkdir(exist_ok=True)
Path("data/weekly_reports").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("data/daemon.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("daemon")

STATUS_FILE   = Path("data/daemon_status.json")
GROUPS_CONFIG = "groups_config.json"


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def _tg():
    """Retourne une instance TelegramReporter prête à l'emploi."""
    from agent.telegram_reporter import TelegramReporter
    return TelegramReporter(
        token=os.environ.get("TELEGRAM_BOT_TOKEN",
                             "8755703485:AAGNAU0FunCNgI5ECR2thta0qMZGJfOKf-I"),
        chat_id=os.environ.get("TELEGRAM_CHAT_ID", "2108862908"),
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


# ── Tâches ────────────────────────────────────────────────────────────────────

async def task_discovery():
    log.info("=== TÂCHE : Découverte de nouveaux groupes ===")
    _write_status("discovery", "running")
    added = 0
    try:
        from agent.discovery_agent import DiscoveryAgent
        agent  = DiscoveryAgent(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        added  = await agent.run_discovery_session()
        stats  = agent.discovery_stats()
        log.info(f"Découverte terminée : +{added} groupes (total={stats['total_groups']})")
        _write_status("discovery", "done", f"+{added} groupes")

        # Telegram — notifier chaque nouveau groupe
        if added > 0:
            tg = _tg()
            # Récupérer les noms des groupes ajoutés aujourd'hui
            try:
                from agent.discovery_agent import _load_log
                disc_log = _load_log()
                today_str = datetime.now().strftime("%Y-%m-%d")
                new_groups = [
                    g for g in disc_log.get("discovered", [])
                    if g.get("added_at") == today_str
                ][-added:]
                for g in new_groups:
                    tg.alerte_nouveau_groupe(g["name"], g.get("category", ""))
            except Exception:
                pass

    except Exception as e:
        log.error(f"Erreur discovery : {e}", exc_info=True)
        _write_status("discovery", "error", str(e))
        _tg().alerte_erreur("discovery", str(e))


async def task_scrape():
    log.info("=== TÂCHE : Scraping des groupes ===")
    _write_status("scrape", "running")
    try:
        from agent.scraper_agent import ScraperAgent
        groups     = _load_groups()
        day_offset = datetime.now().timetuple().tm_yday
        chunk_size = min(8, len(groups))
        start      = (day_offset * chunk_size) % max(len(groups), 1)
        chunk      = (groups[start:] + groups[:start])[:chunk_size]
        agent      = ScraperAgent(max_posts_per_group=20)
        await agent.connect()
        results = await agent.scrape_groups(chunk)
        log.info(f"Scraping terminé : {len(results)} groupes")
        _write_status("scrape", "done", f"{len(results)} groupes")
    except Exception as e:
        log.error(f"Erreur scraping : {e}", exc_info=True)
        _write_status("scrape", "error", str(e))
        _tg().alerte_erreur("scrape", str(e))


def task_analyze():
    log.info("=== TÂCHE : Analyse + mise à jour profils ===")
    _write_status("analyze", "running")
    try:
        from agent.scraper_agent  import ScraperAgent
        from agent.analyzer_agent import AnalyzerAgent
        scraped = ScraperAgent.all_cached()
        if not scraped:
            log.info("Aucune donnée scrapée à analyser.")
            _write_status("analyze", "skipped", "no data")
            return
        dea      = _load_dea()
        analyzer = AnalyzerAgent(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        profiles = analyzer.analyze_all(scraped, dea)
        log.info(f"Analyse terminée : {len(profiles)} profils")
        _write_status("analyze", "done", f"{len(profiles)} profils")
    except Exception as e:
        log.error(f"Erreur analyse : {e}", exc_info=True)
        _write_status("analyze", "error", str(e))
        _tg().alerte_erreur("analyze", str(e))


def task_generate():
    log.info("=== TÂCHE : Génération des posts ===")
    _write_status("generate", "running")
    try:
        from agent.analyzer_agent import AnalyzerAgent, GroupProfile
        from agent.content_agent  import ContentAgent
        from agent.visual_agent   import VisualAgent
        dea      = _load_dea()
        profiles = AnalyzerAgent.all_profiles()
        if not profiles:
            groups   = _load_groups()
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
        _tg().alerte_erreur("generate", str(e))


async def task_publish(wave: str = "morning"):
    log.info(f"=== TÂCHE : Publication {wave.upper()} ===")
    _write_status(f"publish_{wave}", "running")
    try:
        # Vérifier si Chrome CDP est disponible avant de lancer
        import urllib.request
        try:
            urllib.request.urlopen("http://localhost:9222/json", timeout=3)
            log.info("[Publisher] Chrome CDP détecté sur port 9222 ✓")
        except Exception:
            msg = (
                "⚠️ <b>Chrome non détecté</b> — publication impossible\n\n"
                "Pour activer la publication Facebook :\n"
                "1. Lance Chrome avec :\n"
                "<code>open -a 'Google Chrome' --args --remote-debugging-port=9222</code>\n"
                "2. Connecte-toi à Facebook dans ce Chrome\n"
                "3. La prochaine vague publiera automatiquement"
            )
            log.warning("[Publisher] Chrome CDP non disponible → publication annulée")
            _tg().send(msg)
            _write_status(f"publish_{wave}", "skipped", "Chrome CDP non disponible")
            return

        from agent.publisher_agent import PublisherAgent
        publisher = PublisherAgent(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            max_per_wave=15,
        )
        count = await publisher.run_wave(wave=wave, dea=_load_dea())
        log.info(f"Publication {wave} terminée : {count} posts publiés")
        _write_status(f"publish_{wave}", "done", f"{count} publiés")
    except Exception as e:
        log.error(f"Erreur publication {wave} : {e}", exc_info=True)
        _write_status(f"publish_{wave}", "error", str(e))
        _tg().alerte_erreur(f"publish_{wave}", str(e))


async def task_scan_leads():
    log.info("=== TÂCHE : Scan leads ===")
    _write_status("leads", "running")
    new_leads = 0
    try:
        from agent.lead_tracker import LeadTracker, weekly_count, WEEKLY_GOAL
        tracker   = LeadTracker()
        new_leads = await tracker.scan_all_groups(hours_back=24)
        log.info(f"Scan leads terminé : +{new_leads}")
        _write_status("leads", "done", f"+{new_leads}")

        # Alerte objectif atteint
        wc = weekly_count()
        if wc >= WEEKLY_GOAL:
            _tg().alerte_objectif_atteint(wc)

        # Export automatique vers Google Sheet LEADS
        try:
            from upload_drive import sync_leads_to_sheet
            added_to_sheet = sync_leads_to_sheet()
            if added_to_sheet > 0:
                log.info(f"[Leads] {added_to_sheet} profils ajoutés dans le Google Sheet.")
        except Exception as sheet_err:
            log.warning(f"[Leads] Export Sheet échoué (non bloquant) : {sheet_err}")

    except Exception as e:
        log.error(f"Erreur scan leads : {e}", exc_info=True)
        _write_status("leads", "error", str(e))
        _tg().alerte_erreur("scan_leads", str(e))
    return new_leads


def task_rapport_matin():
    """Rapport Telegram du matin (10h) + confirmation démarrage."""
    log.info("=== RAPPORT MATIN → Telegram ===")
    try:
        _tg().rapport_matin()
    except Exception as e:
        log.error(f"Erreur rapport matin : {e}", exc_info=True)


async def task_rapport_soir():
    """Rapport Telegram du soir (21h) — bilan complet + visuels."""
    log.info("=== RAPPORT SOIR → Telegram ===")
    try:
        # D'abord scanner les leads de la journée
        await task_scan_leads()
        # Puis envoyer le rapport complet avec visuels
        _tg().rapport_soir()
    except Exception as e:
        log.error(f"Erreur rapport soir : {e}", exc_info=True)


def task_rapport_hebdo():
    """Rapport hebdomadaire Telegram (vendredi 21h30)."""
    log.info("=== RAPPORT HEBDO → Telegram ===")
    try:
        from agent.lead_tracker import LeadTracker
        tracker = LeadTracker()
        report  = tracker.weekly_report()
        log.info(report)
        Path("data/weekly_reports").mkdir(exist_ok=True)
        fname = f"data/weekly_reports/rapport_{datetime.now().strftime('%Y-W%V')}.txt"
        Path(fname).write_text(report, encoding="utf-8")
        _tg().rapport_hebdomadaire()
    except Exception as e:
        log.error(f"Erreur rapport hebdo : {e}", exc_info=True)


def task_telegram_test():
    """Teste la connexion Telegram et envoie un message de vérification."""
    _tg().test()


# ── Scheduler ─────────────────────────────────────────────────────────────────

TASKS_TODAY_FILE = Path("data/tasks_today.json")


def _load_tasks_today() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    if TASKS_TODAY_FILE.exists():
        data = json.loads(TASKS_TODAY_FILE.read_text(encoding="utf-8"))
        if data.get("date") == today:
            return data
    return {"date": today, "done": []}


def _mark_task_done_today(name: str):
    data = _load_tasks_today()
    if name not in data["done"]:
        data["done"].append(name)
    TASKS_TODAY_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _task_done_today(name: str) -> bool:
    return name in _load_tasks_today()["done"]


class TaskSchedule:
    def __init__(self, name: str, hour: int, minute: int, days: str = "daily"):
        self.name     = name
        self.hour     = hour
        self.minute   = minute
        self.days     = days
        self.last_run: datetime | None = None

    def should_run(self, now: datetime) -> bool:
        if self.days == "monday" and now.weekday() != 0:
            return False
        if self.days == "friday" and now.weekday() != 4:
            return False
        target = now.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)
        if abs((now - target).total_seconds()) > 120:
            return False
        if self.last_run and (now - self.last_run).total_seconds() < 3600:
            return False
        return True

    def was_missed_today(self, now: datetime) -> bool:
        """Retourne True si la tâche aurait dû tourner aujourd'hui mais a été ratée."""
        if self.days == "monday" and now.weekday() != 0:
            return False
        if self.days == "friday" and now.weekday() != 4:
            return False
        target = now.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)
        # La tâche est dans le passé et n'a pas encore tourné aujourd'hui
        return now > target and not _task_done_today(self.name)

    def mark_run(self, now: datetime):
        self.last_run = now
        _mark_task_done_today(self.name)


SCHEDULE = [
    TaskSchedule("discovery",        hour=6,  minute=30, days="monday"),
    TaskSchedule("scrape",           hour=7,  minute=0,  days="daily"),
    TaskSchedule("analyze",          hour=8,  minute=0,  days="daily"),
    TaskSchedule("generate",         hour=9,  minute=0,  days="daily"),
    TaskSchedule("rapport_matin",    hour=10, minute=0,  days="daily"),
    TaskSchedule("publish_morning",  hour=10, minute=5,  days="daily"),
    TaskSchedule("leads_morning",    hour=14, minute=0,  days="daily"),
    TaskSchedule("publish_evening",  hour=19, minute=0,  days="daily"),
    TaskSchedule("rapport_soir",     hour=21, minute=0,  days="daily"),
    TaskSchedule("rapport_hebdo",    hour=21, minute=30, days="friday"),
]

TASK_MAP = {
    "discovery":       task_discovery,
    "scrape":          task_scrape,
    "analyze":         task_analyze,
    "generate":        task_generate,
    "publish_morning": lambda: task_publish("morning"),
    "publish_evening": lambda: task_publish("evening"),
    "leads_morning":   task_scan_leads,
    "rapport_matin":   task_rapport_matin,
    "rapport_soir":    task_rapport_soir,
    "rapport_hebdo":   task_rapport_hebdo,
    "telegram_test":   task_telegram_test,
}


async def _run_task(name: str):
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
        try:
            _tg().alerte_erreur(name, str(e))
        except Exception:
            pass


# ── Boucle principale ─────────────────────────────────────────────────────────

async def run_daemon():
    log.info("=" * 60)
    log.info("DAEMON SETTING — Démarrage")
    log.info(f"PID : {os.getpid()}")
    log.info("=" * 60)
    _write_status("daemon", "running", "Démarré")

    # Message de démarrage Telegram
    try:
        groups = _load_groups()
        now_str = datetime.now().strftime('%d/%m/%Y %H:%M')
        _tg().send(
            f"🤖 <b>Daemon Setting démarré</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⏰ {now_str}\n"
            f"👥 {len(groups)} groupes actifs\n\n"
            f"Planning du jour :\n"
            f"  10h00 · Publication matin\n"
            f"  19h00 · Publication soir\n"
            f"  21h00 · Rapport + leads\n"
        )
    except Exception:
        pass

    # ── Rattrapage : exécuter les tâches manquées depuis minuit ──────────────
    now = datetime.now()
    missed = [s for s in SCHEDULE if s.was_missed_today(now)]
    if missed:
        log.info(f"⚡ Rattrapage de {len(missed)} tâche(s) manquée(s) :")
        for sched in missed:
            log.info(f"   → {sched.name} (prévu {sched.hour:02d}:{sched.minute:02d})")
        try:
            _tg().send(
                f"⚡ <b>Rattrapage des tâches manquées</b>\n"
                + "\n".join(f"  • {s.name} ({s.hour:02d}h{s.minute:02d})" for s in missed)
            )
        except Exception:
            pass
        for sched in missed:
            sched.mark_run(now)
            await _run_task(sched.name)

    while True:
        now = datetime.now()
        for sched in SCHEDULE:
            if sched.should_run(now):
                log.info(f"⏰ Déclenchement : {sched.name} à {now.strftime('%H:%M')}")
                sched.mark_run(now)
                await _run_task(sched.name)
        _write_status("daemon", "running", f"Actif — {now.strftime('%H:%M:%S')}")
        await asyncio.sleep(60)


async def run_test():
    log.info("=== MODE TEST ===")
    await _run_task("telegram_test")
    for name in ["generate", "rapport_matin", "rapport_soir"]:
        log.info(f"--- {name} ---")
        await _run_task(name)
        await asyncio.sleep(2)
    log.info("=== Test terminé ===")


def main():
    parser = argparse.ArgumentParser(description="Daemon 24/7 Setting — Léo Ollivier")
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--task", type=str, default=None,
                        help=f"Tâches : {', '.join(TASK_MAP.keys())}")
    args = parser.parse_args()

    if args.task:
        asyncio.run(_run_task(args.task))
    elif args.test:
        asyncio.run(run_test())
    else:
        asyncio.run(run_daemon())


if __name__ == "__main__":
    main()
