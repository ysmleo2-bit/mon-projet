"""
leads_slack_sync.py — Automatisation Google Sheet LEADS → Slack

Fonctionnement :
  1. Lit l'onglet LEADS du Google Sheet (polling toutes les N secondes)
  2. Détecte les nouvelles lignes (colonne "Notifié Slack" vide)
  3. Envoie une carte Slack pour chaque nouveau lead
  4. Marque la ligne comme notifiée dans le Sheet (colonne G)

Colonnes attendues dans l'onglet LEADS :
  A Date | B Nom | C Lien profil | D Groupe | E Commentaire | F Statut | G Notifié Slack

Lancement :
  python leads_slack_sync.py              # Boucle infinie (polling 5 min)
  python leads_slack_sync.py --once       # Une seule passe
  python leads_slack_sync.py --interval 60  # Polling toutes les 60 secondes

Prérequis :
  - SLACK_WEBHOOK_URL dans .env
  - token.json valide (généré par upload_drive.py ou run_agent.py)
"""

import argparse
import json
import os
import time
import urllib.request
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

load_dotenv()

from config import SPREADSHEET_ID, SHEET_TAB_LEADS, SLACK_WEBHOOK_URL, SLACK_CHANNEL
from upload_drive import get_credentials

# ── Constantes ────────────────────────────────────────────────────────────────

COL_DATE       = 0   # A
COL_NOM        = 1   # B
COL_PROFIL     = 2   # C
COL_GROUPE     = 3   # D
COL_COMMENT    = 4   # E
COL_STATUT     = 5   # F
COL_NOTIF      = 6   # G  ← "Notifié Slack" (oui / vide)

HEADER_ROW     = ["Date", "Nom", "Lien profil", "Groupe", "Commentaire", "Statut", "Notifié Slack"]
DEFAULT_POLL   = 300   # secondes entre deux scans (5 min)
LOG_FILE       = Path("data/leads_slack_sync.log")


# ── Logging simple ────────────────────────────────────────────────────────────

def _log(msg: str):
    ts  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── Google Sheets helpers ─────────────────────────────────────────────────────

def _sheets_service():
    return build("sheets", "v4", credentials=get_credentials())


def _ensure_header(service) -> None:
    """Crée l'onglet LEADS avec en-têtes si nécessaire (colonne G incluse)."""
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_TAB_LEADS}!A1:G1",
        ).execute()
        existing = result.get("values", [[]])[0] if result.get("values") else []

        # Ajouter la colonne G si elle manque
        if len(existing) < 7:
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_TAB_LEADS}!A1:G1",
                valueInputOption="RAW",
                body={"values": [HEADER_ROW]},
            ).execute()
            _log("[Sheet] En-têtes mis à jour (colonne G ajoutée).")
    except HttpError as e:
        _log(f"[Sheet] Impossible de vérifier les en-têtes : {e}")


def _read_leads(service) -> list[tuple[int, list]]:
    """
    Retourne les lignes de LEADS dont la colonne G (Notifié Slack) est vide.
    Chaque item = (row_index_1based, [A, B, C, D, E, F, G])
    """
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_TAB_LEADS}!A2:G",
        ).execute()
    except HttpError as e:
        _log(f"[Sheet] Erreur lecture : {e}")
        return []

    rows = result.get("values", [])
    pending = []
    for i, row in enumerate(rows, start=2):   # start=2 car ligne 1 = en-tête
        # Compléter les colonnes manquantes jusqu'à G
        padded = row + [""] * (7 - len(row))
        notif  = padded[COL_NOTIF].strip().lower()
        nom    = padded[COL_NOM].strip()
        if nom and notif not in ("oui", "yes", "notifié", "notifie"):
            pending.append((i, padded))
    return pending


def _mark_notified(service, row_index: int) -> None:
    """Écrit 'oui' en colonne G de la ligne row_index (1-based)."""
    try:
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_TAB_LEADS}!G{row_index}",
            valueInputOption="RAW",
            body={"values": [["oui"]]},
        ).execute()
    except HttpError as e:
        _log(f"[Sheet] Impossible de marquer la ligne {row_index} : {e}")


# ── Slack helper ──────────────────────────────────────────────────────────────

def _send_slack(lead_row: list) -> bool:
    """Envoie une carte Slack Block Kit pour un lead. Retourne True si succès."""
    webhook = SLACK_WEBHOOK_URL
    if not webhook:
        _log("[Slack] SLACK_WEBHOOK_URL non configurée.")
        return False

    date     = lead_row[COL_DATE]    or datetime.now().strftime("%Y-%m-%d")
    nom      = lead_row[COL_NOM]     or "Inconnu"
    profil   = lead_row[COL_PROFIL]  or ""
    groupe   = lead_row[COL_GROUPE]  or "—"
    comment  = (lead_row[COL_COMMENT] or "")[:150]
    statut   = lead_row[COL_STATUT]  or "nouveau"

    profile_link = f"<{profil}|{nom}>" if profil else nom

    payload = {
        "text": f"🎯 Nouveau lead : {nom} ({groupe})",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🎯 Nouveau lead qualifié !"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Profil :*\n{profile_link}"},
                    {"type": "mrkdwn", "text": f"*Groupe :*\n{groupe}"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Commentaire :*\n_{comment}_" if comment else "*Commentaire :*\n—",
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Détecté le {date} · Statut : {statut}",
                    }
                ],
            },
            {"type": "divider"},
        ],
    }

    if SLACK_CHANNEL:
        payload["channel"] = SLACK_CHANNEL

    try:
        data    = json.dumps(payload).encode("utf-8")
        req     = urllib.request.Request(
            webhook, data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        _log(f"[Slack] Erreur envoi : {e}")
        return False


# ── Boucle principale ─────────────────────────────────────────────────────────

def run_once() -> int:
    """
    Effectue une passe : lit les leads non notifiés, envoie Slack, marque.
    Retourne le nombre de leads notifiés.
    """
    _log("── Scan LEADS → Slack ──")
    try:
        service = _sheets_service()
    except Exception as e:
        _log(f"[Auth] Impossible de se connecter aux Sheets : {e}")
        return 0

    _ensure_header(service)
    pending = _read_leads(service)

    if not pending:
        _log(f"Aucun nouveau lead à notifier.")
        return 0

    _log(f"{len(pending)} lead(s) à notifier…")
    notified = 0

    for row_idx, row in pending:
        nom = row[COL_NOM]
        ok  = _send_slack(row)
        if ok:
            _mark_notified(service, row_idx)
            _log(f"  ✓ Notifié : {nom} (ligne {row_idx})")
            notified += 1
        else:
            _log(f"  ✗ Échec Slack pour : {nom} (ligne {row_idx})")
        time.sleep(0.3)   # éviter le rate-limit Slack

    _log(f"── {notified}/{len(pending)} leads notifiés sur Slack ──")
    return notified


def run_loop(interval: int = DEFAULT_POLL):
    """Boucle de polling infinie."""
    _log(f"Démarrage de la boucle (intervalle : {interval}s)")
    while True:
        try:
            run_once()
        except Exception as e:
            _log(f"[ERREUR] {e}")
        _log(f"Prochain scan dans {interval}s…")
        time.sleep(interval)


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Automatisation Google Sheet LEADS → Slack"
    )
    parser.add_argument("--once",     action="store_true",
                        help="Une seule passe puis quitter")
    parser.add_argument("--interval", type=int, default=DEFAULT_POLL,
                        help=f"Secondes entre deux scans (défaut : {DEFAULT_POLL})")
    args = parser.parse_args()

    if args.once:
        run_once()
    else:
        run_loop(interval=args.interval)


if __name__ == "__main__":
    main()
