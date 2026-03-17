#!/usr/bin/env python3
"""
Agent principal : connexion iClosed ↔ Telegram via Zapier.

Fonctionnalités :
- Récap quotidien automatique à 9h sur Telegram
- Réception des événements Zapier en temps réel
- Commandes Telegram : /recap, /recap_hier, /status, /test

Démarrage :
    cp .env.example .env
    # Remplis les variables dans .env
    pip install -r requirements.txt
    python agent.py

Options :
    python agent.py --test     # Envoie un récap de test immédiatement
    python agent.py --no-web   # Démarre sans le serveur webhook Zapier
"""
import argparse
import logging
import os
import sys
import threading
import time
from datetime import datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("agent.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def load_config() -> dict:
    # Variables Telegram — obligatoires
    required_telegram = {
        "TELEGRAM_BOT_TOKEN": "Token du bot Telegram (obtenu via @BotFather)",
        "TELEGRAM_CHAT_ID": "Ton Chat ID Telegram (envoie /start à @userinfobot)",
    }
    config = {}
    missing = []

    for key, description in required_telegram.items():
        val = os.getenv(key)
        if not val:
            missing.append(f"  {key}  →  {description}")
        config[key] = val

    if missing:
        logger.error("Variables d'environnement manquantes dans .env :")
        for m in missing:
            logger.error(m)
        logger.error("Copie .env.example vers .env et remplis les valeurs.")
        sys.exit(1)

    # Source de données — au moins une doit être configurée
    sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
    creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
    iclosed_key = os.getenv("ICLOSED_API_KEY", "")

    has_sheets = bool(sheets_id and os.path.exists(creds_path))
    has_api = bool(iclosed_key)

    if not has_sheets and not has_api:
        logger.warning(
            "ATTENTION : Aucune source de données configurée !\n"
            "  Option A (recommandée) : Configurer GOOGLE_SHEETS_ID + credentials.json\n"
            "  Option B : Configurer ICLOSED_API_KEY\n"
            "Le bot démarrera mais les récaps seront vides."
        )
    elif has_sheets:
        logger.info(f"Source de données : Google Sheets (ID: {sheets_id[:8]}...)")
    else:
        logger.info("Source de données : API REST iClosed")

    config.update({
        "ICLOSED_API_KEY": iclosed_key or None,
        "ICLOSED_BASE_URL": os.getenv("ICLOSED_BASE_URL", "https://api.iclosed.io/v1"),
        "RECAP_HOUR": int(os.getenv("RECAP_HOUR", "9")),
        "RECAP_MINUTE": int(os.getenv("RECAP_MINUTE", "0")),
        "TIMEZONE": os.getenv("TIMEZONE", "Europe/Paris"),
        "WEBHOOK_PORT": int(os.getenv("WEBHOOK_PORT", "5002")),
        "WEBHOOK_SECRET": os.getenv("WEBHOOK_SECRET", ""),
    })
    return config


def start_webhook_server(telegram_sender, config: dict):
    """Lance le serveur Flask dans un thread séparé."""
    from webhook_server import app, init_webhook
    init_webhook(telegram_sender, config["WEBHOOK_SECRET"])

    port = config["WEBHOOK_PORT"]
    logger.info(f"Serveur webhook Zapier démarré sur le port {port}")
    logger.info(f"Endpoints disponibles :")
    logger.info(f"  GET  http://localhost:{port}/health")
    logger.info(f"  POST http://localhost:{port}/zapier/event")
    logger.info(f"  POST http://localhost:{port}/zapier/optin")
    logger.info(f"  POST http://localhost:{port}/zapier/booked")
    logger.info(f"  POST http://localhost:{port}/zapier/show")
    logger.info(f"  POST http://localhost:{port}/zapier/no-show")
    logger.info(f"  POST http://localhost:{port}/zapier/disqualified")
    logger.info(f"  POST http://localhost:{port}/zapier/closed")

    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)


def start_telegram_command_bot(telegram_sender, iclosed_client, scheduler):
    """
    Écoute les commandes Telegram via long-polling.
    Commandes disponibles :
      /recap       → récap d'hier
      /recap_hier  → récap d'hier (alias)
      /aujourd_hui → récap du jour (si données disponibles)
      /status      → statut de l'agent
      /test        → envoie un message de test
    """
    import requests as req

    token = telegram_sender.token
    offset = 0

    def get_updates(offset):
        try:
            r = req.get(
                f"https://api.telegram.org/bot{token}/getUpdates",
                params={"timeout": 30, "offset": offset},
                timeout=35,
            )
            return r.json().get("result", [])
        except Exception as e:
            logger.warning(f"Erreur long-polling Telegram: {e}")
            time.sleep(5)
            return []

    logger.info("Bot Telegram en écoute des commandes...")
    while True:
        updates = get_updates(offset)
        for update in updates:
            offset = update["update_id"] + 1
            message = update.get("message", {})
            text = message.get("text", "").strip()
            chat_id = str(message.get("chat", {}).get("id", ""))

            # Sécurité : ignore les messages d'autres chats
            if chat_id != telegram_sender.chat_id:
                continue

            if text.startswith("/recap") or text.startswith("/recap_hier"):
                telegram_sender.send_message("⏳ Récupération des stats...")
                scheduler.run_now()

            elif text.startswith("/aujourd"):
                today = datetime.now().strftime("%Y-%m-%d")
                try:
                    stats = iclosed_client.get_stats_for_date(today)
                    stats["team"] = iclosed_client.get_team_breakdown(today)
                    telegram_sender.send_daily_recap(stats)
                except Exception as e:
                    telegram_sender.send_alert(f"Erreur: {e}")

            elif text.startswith("/status"):
                job = scheduler.scheduler.get_job("daily_recap")
                next_run = job.next_run_time if job else "N/A"
                telegram_sender.send_message(
                    f"✅ <b>Agent actif</b>\n\n"
                    f"⏰ Prochain récap : {next_run}\n"
                    f"🕒 Heure configurée : {scheduler.hour:02d}:{scheduler.minute:02d} ({scheduler.timezone})"
                )

            elif text.startswith("/test"):
                telegram_sender.send_message(
                    "✅ <b>Test réussi !</b>\n\nL'agent iClosed est bien connecté à Telegram.\n"
                    f"🕒 {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
                )

            elif text.startswith("/help") or text.startswith("/start"):
                telegram_sender.send_message(
                    "🤖 <b>Agent iClosed — Commandes disponibles</b>\n\n"
                    "/recap — Récap d'hier\n"
                    "/aujourd_hui — Récap du jour en cours\n"
                    "/status — Statut de l'agent\n"
                    "/test — Test de connexion\n"
                    "/help — Aide"
                )


def main():
    parser = argparse.ArgumentParser(description="Agent iClosed ↔ Telegram")
    parser.add_argument("--test", action="store_true", help="Envoie un récap de test et quitte")
    parser.add_argument("--no-web", action="store_true", help="Démarre sans le serveur webhook")
    args = parser.parse_args()

    config = load_config()

    # Import ici pour éviter les imports circulaires
    from iclosed_client import IClosedClient
    from telegram_sender import TelegramSender
    from scheduler import DailyRecapScheduler

    iclosed = IClosedClient(
        api_key=config["ICLOSED_API_KEY"],
        base_url=config["ICLOSED_BASE_URL"],
    )
    telegram = TelegramSender(
        token=config["TELEGRAM_BOT_TOKEN"],
        chat_id=config["TELEGRAM_CHAT_ID"],
    )
    scheduler = DailyRecapScheduler(
        iclosed_client=iclosed,
        telegram_sender=telegram,
        hour=config["RECAP_HOUR"],
        minute=config["RECAP_MINUTE"],
        timezone=config["TIMEZONE"],
    )

    # --- Mode test ---
    if args.test:
        logger.info("Mode test : envoi d'un récap immédiat...")
        telegram.send_message("🔧 <b>Test de l'agent iClosed</b>\n\nConnexion Telegram ✅")
        scheduler.run_now()
        logger.info("Test terminé.")
        return

    # --- Démarrage normal ---
    logger.info("=== Démarrage de l'agent iClosed ↔ Telegram ===")
    telegram.send_message(
        f"🚀 <b>Agent iClosed démarré</b>\n\n"
        f"⏰ Récap quotidien à {config['RECAP_HOUR']:02d}h{config['RECAP_MINUTE']:02d} ({config['TIMEZONE']})\n"
        f"📡 Webhooks Zapier : {'actifs' if not args.no_web else 'désactivés'}"
    )

    # Scheduler
    scheduler.start()

    # Serveur webhook Zapier
    if not args.no_web:
        webhook_thread = threading.Thread(
            target=start_webhook_server,
            args=(telegram, config),
            daemon=True,
        )
        webhook_thread.start()

    # Bot Telegram (long-polling pour les commandes)
    command_thread = threading.Thread(
        target=start_telegram_command_bot,
        args=(telegram, iclosed, scheduler),
        daemon=True,
    )
    command_thread.start()

    logger.info("Agent démarré. Ctrl+C pour arrêter.")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info("Arrêt de l'agent...")
        scheduler.stop()
        telegram.send_message("⛔ <b>Agent iClosed arrêté.</b>")
        logger.info("Agent arrêté.")


if __name__ == "__main__":
    main()
