"""
Scheduler APScheduler pour le récap quotidien à 9h.
"""
import logging
from datetime import datetime, timedelta

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class DailyRecapScheduler:
    def __init__(self, iclosed_client, telegram_sender, hour: int = 9, minute: int = 0, timezone: str = "Europe/Paris"):
        self.iclosed = iclosed_client
        self.telegram = telegram_sender
        self.hour = hour
        self.minute = minute
        self.timezone = timezone
        self.scheduler = BackgroundScheduler(timezone=pytz.timezone(timezone))

    def start(self):
        """Démarre le scheduler avec le job quotidien."""
        self.scheduler.add_job(
            func=self._run_daily_recap,
            trigger=CronTrigger(hour=self.hour, minute=self.minute, timezone=self.timezone),
            id="daily_recap",
            name="Récap quotidien iClosed",
            replace_existing=True,
            misfire_grace_time=300,  # 5 min de tolérance si le job rate l'heure exacte
        )
        self.scheduler.start()
        logger.info(f"Scheduler démarré — récap quotidien à {self.hour:02d}:{self.minute:02d} ({self.timezone})")

        # Affiche la prochaine exécution
        job = self.scheduler.get_job("daily_recap")
        if job:
            next_run = job.next_run_time
            logger.info(f"Prochaine exécution : {next_run}")

    def stop(self):
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler arrêté")

    def run_now(self):
        """Lance immédiatement le récap (pour test ou déclenchement manuel)."""
        logger.info("Lancement manuel du récap...")
        self._run_daily_recap()

    def _run_daily_recap(self):
        """Tâche principale : récupère les stats d'hier et envoie le récap Telegram."""
        logger.info("=== Lancement du récap quotidien ===")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        stats = None

        # Source 1 : stockage local (événements reçus via webhooks Zapier)
        try:
            from data_store import get_stats_for_date, has_data_for_date
            if has_data_for_date(yesterday):
                stats = get_stats_for_date(yesterday)
                logger.info(f"Stats lues depuis stockage local ({stats.get('total_events', 0)} événements)")
            else:
                logger.info(f"Aucun événement local pour {yesterday} — tentative source externe")
        except Exception as e:
            logger.warning(f"Erreur stockage local: {e}")

        # Source 2 : Google Sheets / API iClosed (fallback)
        if stats is None:
            try:
                stats = self.iclosed.get_stats_for_date(yesterday)
                logger.info(f"Stats récupérées depuis source externe pour {yesterday}")
            except Exception as e:
                logger.warning(f"Source externe indisponible: {e}")

        # Aucune source disponible : envoie quand même un récap vide avec mention
        if stats is None:
            stats = {
                "date": yesterday,
                "prospects_optin": 0,
                "calls_bookes": 0,
                "shows": 0,
                "no_shows": 0,
                "disqualifies": 0,
                "closes": 0,
                "team": [],
                "_no_data": True,
            }
            logger.warning("Aucune donnée disponible — récap vide envoyé")

        # Envoie le récap
        success = self.telegram.send_daily_recap(stats)
        if success:
            logger.info("Récap envoyé avec succès sur Telegram")
        else:
            logger.error("Échec de l'envoi du récap Telegram")
