"""
Client pour l'API iClosed.
Récupère les métriques de vente : prospects, calls bookés, shows, no-shows, disqualifiés.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
import requests

logger = logging.getLogger(__name__)


class IClosedClient:
    def __init__(self, api_key: str, base_url: str = "https://api.iclosed.io/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _get(self, endpoint: str, params: dict = None) -> dict:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        try:
            resp = self.session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"iClosed API HTTP error {e.response.status_code}: {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"iClosed API request error: {e}")
            raise

    def get_stats_today(self) -> dict:
        """Récupère les statistiques du jour."""
        today = datetime.now().strftime("%Y-%m-%d")
        return self.get_stats_for_date(today)

    def get_stats_yesterday(self) -> dict:
        """Récupère les statistiques d'hier."""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        return self.get_stats_for_date(yesterday)

    def get_stats_for_date(self, date: str) -> dict:
        """
        Récupère toutes les métriques pour une date donnée (format YYYY-MM-DD).
        Retourne un dict normalisé avec les métriques clés.
        """
        try:
            # Endpoint principal des statistiques
            raw = self._get("stats", params={"date": date})
            return self._normalize_stats(raw, date)
        except Exception:
            # Fallback : construction manuelle depuis les endpoints individuels
            logger.warning("Fallback sur les endpoints individuels")
            return self._build_stats_manually(date)

    def _normalize_stats(self, raw: dict, date: str) -> dict:
        """Normalise la réponse de l'API en format standard."""
        # Adapte selon la structure réelle de l'API iClosed
        # Les clés peuvent varier selon la version de l'API
        data = raw.get("data", raw)
        return {
            "date": date,
            "prospects_optin": self._extract(data, ["optin", "opt_in", "leads", "prospects", "new_leads"], 0),
            "calls_bookes": self._extract(data, ["booked", "calls_booked", "appointments", "scheduled"], 0),
            "shows": self._extract(data, ["shows", "showed", "attended", "completed"], 0),
            "no_shows": self._extract(data, ["no_shows", "no_show", "missed", "absent"], 0),
            "disqualifies": self._extract(data, ["disqualified", "disqualifies", "dq", "not_qualified"], 0),
            "closes": self._extract(data, ["closed", "closes", "won", "sales"], 0),
            "raw": data,
        }

    def _extract(self, data: dict, keys: list, default):
        """Cherche la première clé trouvée dans le dict."""
        for key in keys:
            if key in data:
                val = data[key]
                # Supporte les objets {"count": N} ou directement un nombre
                if isinstance(val, dict):
                    return val.get("count", val.get("total", default))
                return val
        return default

    def _build_stats_manually(self, date: str) -> dict:
        """Construit les stats en appelant plusieurs endpoints si /stats n'existe pas."""
        stats = {
            "date": date,
            "prospects_optin": 0,
            "calls_bookes": 0,
            "shows": 0,
            "no_shows": 0,
            "disqualifies": 0,
            "closes": 0,
            "raw": {},
        }
        params = {"date": date, "start_date": date, "end_date": date}

        # Prospects / leads
        try:
            data = self._get("leads", params=params)
            items = data.get("data", data.get("leads", data.get("items", [])))
            stats["prospects_optin"] = len(items) if isinstance(items, list) else data.get("total", 0)
        except Exception as e:
            logger.warning(f"Impossible de récupérer les leads: {e}")

        # Appointments / calls
        try:
            data = self._get("appointments", params=params)
            items = data.get("data", data.get("appointments", data.get("items", [])))
            if isinstance(items, list):
                stats["calls_bookes"] = len(items)
                stats["shows"] = sum(1 for i in items if self._is_show(i))
                stats["no_shows"] = sum(1 for i in items if self._is_no_show(i))
                stats["disqualifies"] = sum(1 for i in items if self._is_disqualified(i))
                stats["closes"] = sum(1 for i in items if self._is_closed(i))
        except Exception as e:
            logger.warning(f"Impossible de récupérer les appointments: {e}")

        return stats

    def _is_show(self, item: dict) -> bool:
        status = str(item.get("status", item.get("outcome", ""))).lower()
        return status in ("show", "showed", "attended", "completed", "closed", "won", "disqualified", "dq")

    def _is_no_show(self, item: dict) -> bool:
        status = str(item.get("status", item.get("outcome", ""))).lower()
        return status in ("no_show", "no-show", "noshow", "missed", "absent")

    def _is_disqualified(self, item: dict) -> bool:
        status = str(item.get("status", item.get("outcome", ""))).lower()
        return status in ("disqualified", "dq", "not_qualified", "unqualified")

    def _is_closed(self, item: dict) -> bool:
        status = str(item.get("status", item.get("outcome", ""))).lower()
        return status in ("closed", "won", "sale", "close")

    def get_team_breakdown(self, date: str = None) -> list[dict]:
        """Récupère les stats par membre de l'équipe (closers/setters)."""
        if date is None:
            date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        try:
            data = self._get("team/stats", params={"date": date})
            return data.get("data", data.get("team", []))
        except Exception as e:
            logger.warning(f"Stats équipe indisponibles: {e}")
            return []
