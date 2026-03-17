"""
Stockage local des événements reçus via les webhooks Zapier.
Chaque événement est sauvegardé dans data/events_YYYY-MM-DD.json
Le scheduler lit ces fichiers pour construire le récap du matin.
"""
import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.path.join(os.path.dirname(__file__), "data"))


def _ensure_dir():
    DATA_DIR.mkdir(exist_ok=True)


def _file_for_date(date: str) -> Path:
    return DATA_DIR / f"events_{date}.json"


def save_event(event_type: str, data: dict):
    """Sauvegarde un événement entrant dans le fichier du jour."""
    _ensure_dir()
    today = datetime.now().strftime("%Y-%m-%d")
    path = _file_for_date(today)

    events = _load_file(path)
    events.append({
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        "data": data,
    })
    _save_file(path, events)
    logger.debug(f"Événement sauvegardé : {event_type} ({today})")


def get_stats_for_date(date: str) -> dict:
    """
    Calcule les KPIs depuis les événements stockés pour une date donnée.
    Retourne un dict compatible avec telegram_sender.send_daily_recap().
    """
    path = _file_for_date(date)
    events = _load_file(path)

    counts = {
        "optin": 0, "booked": 0, "show": 0,
        "no_show": 0, "disqualified": 0, "closed": 0,
    }
    team: dict[str, dict] = {}

    for ev in events:
        etype = ev.get("type", "").lower()
        d = ev.get("data", {})

        if etype in counts:
            counts[etype] += 1

        # Breakdown par closer
        closer = (
            d.get("closer") or d.get("Closer") or
            d.get("owner") or d.get("rep") or ""
        ).strip()

        if closer and etype in ("show", "no_show", "disqualified", "closed"):
            if closer not in team:
                team[closer] = {"name": closer, "shows": 0, "closes": 0, "no_shows": 0}
            if etype == "show":
                team[closer]["shows"] += 1
            elif etype == "closed":
                team[closer]["closes"] += 1
                team[closer]["shows"] += 1
            elif etype == "no_show":
                team[closer]["no_shows"] += 1

    return {
        "date": date,
        "prospects_optin": counts["optin"],
        "calls_bookes": counts["booked"],
        "shows": counts["show"],
        "no_shows": counts["no_show"],
        "disqualifies": counts["disqualified"],
        "closes": counts["closed"],
        "team": list(team.values()),
        "total_events": len(events),
    }


def has_data_for_date(date: str) -> bool:
    return _file_for_date(date).exists()


def _load_file(path: Path) -> list:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Erreur lecture {path}: {e}")
        return []


def _save_file(path: Path, events: list):
    try:
        path.write_text(json.dumps(events, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error(f"Erreur écriture {path}: {e}")
