"""
Lecture des données iClosed depuis Google Sheets (alimenté par Zapier).

Structure attendue du Google Sheet (flexible — colonnes configurables via .env) :
  - Chaque ligne = un événement (opt-in, call booké, show, no-show, etc.)
  - Colonnes minimales : Date, Status/Type
  - Colonnes optionnelles : Name, Email, Closer, Setter

Variables d'env :
  GOOGLE_CREDENTIALS_PATH  → chemin vers le fichier credentials.json (Service Account)
  GOOGLE_SHEETS_ID         → ID du Google Sheet (dans l'URL)
  SHEETS_TAB_NAME          → nom de l'onglet (défaut : "Feuille1" ou "Sheet1")
  SHEETS_DATE_COL          → nom de la colonne date (défaut : "Date")
  SHEETS_STATUS_COL        → nom de la colonne statut (défaut : "Status")
  SHEETS_NAME_COL          → nom de la colonne prénom/nom (défaut : "Name")
  SHEETS_CLOSER_COL        → nom de la colonne closer (défaut : "Closer")
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Mapping des statuts possibles → type normalisé
STATUS_MAP = {
    # Opt-in
    "optin": "optin", "opt-in": "optin", "opt_in": "optin",
    "lead": "optin", "prospect": "optin", "new lead": "optin",
    "nouveau prospect": "optin", "inscrit": "optin",
    # Booké
    "booked": "booked", "booking": "booked", "scheduled": "booked",
    "call booké": "booked", "rdv": "booked", "rendez-vous": "booked",
    # Show
    "show": "show", "showed": "show", "présent": "show",
    "attended": "show", "completed": "show",
    # No-show
    "no show": "no_show", "no-show": "no_show", "no_show": "no_show",
    "noshow": "no_show", "absent": "no_show", "missed": "no_show",
    "non présent": "no_show",
    # Disqualifié
    "disqualified": "disqualified", "dq": "disqualified",
    "disqualifié": "disqualified", "non qualifié": "disqualified",
    "not qualified": "disqualified", "unqualified": "disqualified",
    # Close
    "closed": "closed", "close": "closed", "won": "closed",
    "sale": "closed", "vente": "closed", "signé": "closed",
}


def _normalize_status(raw: str) -> str:
    """Normalise un statut brut vers un type standard."""
    clean = raw.strip().lower()
    return STATUS_MAP.get(clean, "unknown")


def _parse_date(raw: str) -> Optional[str]:
    """Tente de parser une date dans plusieurs formats → 'YYYY-MM-DD'."""
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
        "%d-%m-%Y", "%Y/%m/%d",
        "%d/%m/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
        "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M:%S",
    ]
    raw = raw.strip()
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


class SheetsClient:
    def __init__(self):
        self.credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
        self.sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
        self.tab_name = os.getenv("SHEETS_TAB_NAME", "")  # vide = auto-détection
        self.date_col = os.getenv("SHEETS_DATE_COL", "Date")
        self.status_col = os.getenv("SHEETS_STATUS_COL", "Status")
        self.name_col = os.getenv("SHEETS_NAME_COL", "Name")
        self.closer_col = os.getenv("SHEETS_CLOSER_COL", "Closer")
        self._client = None
        self._sheet = None

    def _connect(self):
        """Initialise la connexion Google Sheets (lazy)."""
        if self._client is not None:
            return
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ]
        creds = Credentials.from_service_account_file(self.credentials_path, scopes=scopes)
        self._client = gspread.authorize(creds)
        spreadsheet = self._client.open_by_key(self.sheets_id)

        # Auto-détection de l'onglet
        if self.tab_name:
            self._sheet = spreadsheet.worksheet(self.tab_name)
        else:
            self._sheet = spreadsheet.get_worksheet(0)
            logger.info(f"Onglet auto-détecté : '{self._sheet.title}'")

    def get_all_rows(self) -> list[dict]:
        """Retourne toutes les lignes du sheet sous forme de liste de dicts."""
        self._connect()
        return self._sheet.get_all_records(default_blank="", numericise_ignore=["all"])

    def get_rows_for_date(self, date: str) -> list[dict]:
        """
        Retourne les lignes correspondant à une date donnée (YYYY-MM-DD).
        Cherche la colonne date configurée dans SHEETS_DATE_COL.
        """
        all_rows = self.get_all_rows()
        result = []

        for row in all_rows:
            # Cherche la valeur de date dans la colonne configurée
            raw_date = ""
            for col_candidate in [self.date_col, "Date", "date", "DATE", "Date d'optin",
                                   "Date du call", "Created At", "Timestamp"]:
                if col_candidate in row and row[col_candidate]:
                    raw_date = str(row[col_candidate])
                    break

            if not raw_date:
                continue

            parsed = _parse_date(raw_date)
            if parsed == date:
                result.append(row)

        logger.info(f"Sheets: {len(result)} lignes trouvées pour {date}")
        return result

    def compute_stats(self, rows: list[dict]) -> dict:
        """
        Calcule les KPIs à partir des lignes filtrées.
        Détermine le statut via la colonne configurée dans SHEETS_STATUS_COL.
        """
        counts = {
            "optin": 0,
            "booked": 0,
            "show": 0,
            "no_show": 0,
            "disqualified": 0,
            "closed": 0,
        }
        team: dict[str, dict] = {}  # {closer_name: {shows, closes, no_shows}}

        for row in rows:
            # Détection du statut
            raw_status = ""
            for col_candidate in [self.status_col, "Status", "status", "TYPE", "Type",
                                   "Statut", "Outcome", "outcome", "Résultat"]:
                if col_candidate in row and row[col_candidate]:
                    raw_status = str(row[col_candidate])
                    break

            normalized = _normalize_status(raw_status) if raw_status else "unknown"

            if normalized in counts:
                counts[normalized] += 1

            # Breakdown par closer
            closer = ""
            for col_candidate in [self.closer_col, "Closer", "closer", "CLOSER",
                                   "Assigné à", "Owner", "Rep"]:
                if col_candidate in row and row[col_candidate]:
                    closer = str(row[col_candidate]).strip()
                    break

            if closer and normalized in ("show", "no_show", "disqualified", "closed"):
                if closer not in team:
                    team[closer] = {"name": closer, "shows": 0, "closes": 0, "no_shows": 0, "disqualified": 0}
                if normalized == "show":
                    team[closer]["shows"] += 1
                elif normalized == "closed":
                    team[closer]["closes"] += 1
                    team[closer]["shows"] += 1  # un close = forcément un show
                elif normalized == "no_show":
                    team[closer]["no_shows"] += 1
                elif normalized == "disqualified":
                    team[closer]["disqualified"] += 1

        return {
            "prospects_optin": counts["optin"],
            "calls_bookes": counts["booked"],
            "shows": counts["show"],
            "no_shows": counts["no_show"],
            "disqualifies": counts["disqualified"],
            "closes": counts["closed"],
            "team": list(team.values()),
        }

    def get_stats_for_date(self, date: str) -> dict:
        """Point d'entrée principal : stats pour une date donnée."""
        rows = self.get_rows_for_date(date)
        stats = self.compute_stats(rows)
        stats["date"] = date
        stats["total_rows"] = len(rows)
        return stats

    def test_connection(self) -> bool:
        """Vérifie que la connexion fonctionne. Retourne True si OK."""
        try:
            self._connect()
            # Tente de lire la première cellule
            self._sheet.cell(1, 1).value
            logger.info("Connexion Google Sheets : OK")
            return True
        except Exception as e:
            logger.error(f"Erreur connexion Google Sheets : {e}")
            return False
