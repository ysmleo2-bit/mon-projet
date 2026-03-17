"""
Client de données iClosed.
Source primaire : Google Sheets (alimenté par Zapier depuis iClosed).
Source secondaire (optionnelle) : API REST iClosed si ICLOSED_API_KEY est fourni.
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional
import requests

logger = logging.getLogger(__name__)


class IClosedClient:
    def __init__(self, api_key: str = None, base_url: str = "https://api.iclosed.io/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/") if base_url else "https://api.iclosed.io/v1"
        self._sheets_client = None

        if api_key:
            self.session = requests.Session()
            self.session.headers.update({
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            })
        else:
            self.session = None

        # Google Sheets est disponible si les variables sont configurées
        sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
        creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
        if sheets_id and os.path.exists(creds_path):
            try:
                from sheets import SheetsClient
                self._sheets_client = SheetsClient()
                logger.info("Source de données : Google Sheets (Zapier)")
            except ImportError:
                logger.warning("gspread non disponible — pip install gspread")
        elif not api_key:
            logger.warning(
                "Aucune source de données configurée. "
                "Fournir GOOGLE_SHEETS_ID + credentials.json OU ICLOSED_API_KEY dans .env"
            )

    def _get(self, endpoint: str, params: dict = None) -> dict:
        if not self.session:
            raise RuntimeError("API REST iClosed non configurée (ICLOSED_API_KEY manquant)")
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
        Priorité : Google Sheets → API REST iClosed
        """
        # Priorité 1 : Google Sheets (source Zapier)
        if self._sheets_client:
            try:
                stats = self._sheets_client.get_stats_for_date(date)
                logger.info(f"Stats récupérées depuis Google Sheets pour {date}")
                return stats
            except Exception as e:
                logger.warning(f"Erreur Google Sheets, tentative API REST: {e}")

        # Priorité 2 : API REST iClosed (si clé disponible)
        if self.api_key:
            try:
                raw = self._get("stats", params={"date": date})
                return self._normalize_stats(raw, date)
            except Exception:
                logger.warning("Fallback sur les endpoints individuels")
                return self._build_stats_manually(date)

        # Aucune source disponible
        raise RuntimeError(
            "Aucune source de données disponible. "
            "Vérifier GOOGLE_SHEETS_ID + credentials.json dans .env"
        )

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

        # Si Google Sheets disponible, le breakdown est déjà dans get_stats_for_date
        if self._sheets_client:
            try:
                stats = self._sheets_client.get_stats_for_date(date)
                return stats.get("team", [])
            except Exception as e:
                logger.warning(f"Stats équipe Google Sheets indisponibles: {e}")
                return []

        # Fallback API REST
        try:
            data = self._get("team/stats", params={"date": date})
            return data.get("data", data.get("team", []))
        except Exception as e:
            logger.warning(f"Stats équipe indisponibles: {e}")
            return []
