"""
Upload les 25 PNG depuis VISUELS_DIR vers le dossier Google Drive,
puis met à jour l'onglet VISUELS du Sheet avec les URLs =IMAGE().
"""

import os
import json
import re
import time
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

from config import (
    SPREADSHEET_ID, DRIVE_FOLDER_ID, VISUELS_DIR,
    SHEET_TAB_VISUELS, SHEET_TAB_LEADS,
)

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]
TOKEN_PATH = "token.json"
CREDS_PATH = "credentials.json"


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_credentials() -> Credentials:
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
    return creds


# ── Drive ─────────────────────────────────────────────────────────────────────

def upload_images_to_drive(drive_service) -> list[dict]:
    """Upload tous les PNG du dossier VISUELS vers Drive. Retourne la liste des fichiers uploadés."""
    visuels_path = Path(VISUELS_DIR)
    if not visuels_path.exists():
        raise FileNotFoundError(f"Dossier introuvable : {VISUELS_DIR}")

    png_files = sorted(visuels_path.glob("*.png"))
    if not png_files:
        raise FileNotFoundError(f"Aucun PNG trouvé dans {VISUELS_DIR}")

    print(f"[Drive] {len(png_files)} images à uploader…")
    uploaded = []

    for idx, png in enumerate(png_files, 1):
        print(f"  [{idx}/{len(png_files)}] {png.name}…", end=" ", flush=True)
        file_metadata = {
            "name": png.name,
            "parents": [DRIVE_FOLDER_ID],
        }
        media = MediaFileUpload(str(png), mimetype="image/png", resumable=True)
        try:
            file = drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id,name,webContentLink,webViewLink",
            ).execute()
            # Rendre le fichier public (lecture)
            drive_service.permissions().create(
                fileId=file["id"],
                body={"type": "anyone", "role": "reader"},
            ).execute()
            public_url = f"https://drive.google.com/uc?id={file['id']}"
            uploaded.append({
                "name":    file["name"],
                "file_id": file["id"],
                "url":     public_url,
            })
            print("OK")
        except HttpError as e:
            print(f"ERREUR : {e}")
        time.sleep(0.5)  # gentle rate-limit

    print(f"[Drive] Upload terminé : {len(uploaded)}/{len(png_files)} fichiers.")
    return uploaded


# ── Sheet ─────────────────────────────────────────────────────────────────────

def update_sheet_with_images(sheets_service, uploaded: list[dict]) -> None:
    """Insère les =IMAGE() dans l'onglet VISUELS du Sheet."""
    if not uploaded:
        print("[Sheet] Rien à écrire.")
        return

    # En-têtes + données
    header = [["Fichier", "Drive ID", "=IMAGE()"]]
    rows = [
        [item["name"], item["file_id"], f'=IMAGE("{item["url"]}")']
        for item in uploaded
    ]
    values = header + rows

    body = {"values": values}
    range_name = f"{SHEET_TAB_VISUELS}!A1"
    try:
        sheets_service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption="USER_ENTERED",
            body=body,
        ).execute()
        print(f"[Sheet] {len(rows)} lignes écrites dans l'onglet '{SHEET_TAB_VISUELS}'.")
    except HttpError as e:
        print(f"[Sheet] ERREUR : {e}")


# ── Sauvegarde locale ─────────────────────────────────────────────────────────

def save_upload_manifest(uploaded: list[dict], path: str = "upload_manifest.json") -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(uploaded, f, ensure_ascii=False, indent=2)
    print(f"[Manifest] Sauvegardé dans {path}")


# ── Upload d'un fichier unique (utilisé par visual_agent) ────────────────────

def upload_single_file(local_path: str, filename: str | None = None) -> dict | None:
    """
    Upload un fichier PNG unique vers Drive et retourne son URL publique.
    Utilisé par visual_agent.py après chaque génération de visuel.
    """
    try:
        creds         = get_credentials()
        drive_service = build("drive", "v3", credentials=creds)

        name = filename or Path(local_path).name
        file_metadata = {"name": name, "parents": [DRIVE_FOLDER_ID]}
        media = MediaFileUpload(local_path, mimetype="image/png", resumable=True)

        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id,name,webContentLink,webViewLink",
        ).execute()

        # Rendre public
        drive_service.permissions().create(
            fileId=file["id"],
            body={"type": "anyone", "role": "reader"},
        ).execute()

        public_url = f"https://drive.google.com/uc?id={file['id']}"
        view_url   = f"https://drive.google.com/file/d/{file['id']}/view"
        print(f"  [Drive] ✓ {name} → {view_url}")
        return {"name": name, "file_id": file["id"], "url": public_url, "view_url": view_url}

    except Exception as e:
        print(f"  [Drive] ✗ Upload échoué pour {local_path} : {e}")
        return None


# ── Upload d'un dossier entier (visuels générés) ──────────────────────────────

def upload_folder_to_drive(folder_path: str) -> list[dict]:
    """
    Upload tous les PNG d'un dossier vers Drive.
    Retourne la liste des fichiers uploadés avec leurs URLs.
    """
    folder = Path(folder_path)
    png_files = sorted(folder.glob("*.png"))
    if not png_files:
        print(f"[Drive] Aucun PNG dans {folder_path}")
        return []

    print(f"[Drive] Upload de {len(png_files)} visuels…")
    results = []
    for png in png_files:
        result = upload_single_file(str(png))
        if result:
            results.append(result)
        time.sleep(0.5)
    return results


# ── Export Leads → Google Sheet ───────────────────────────────────────────────

def sync_leads_to_sheet() -> int:
    """
    Exporte tous les leads qualifiés depuis data/leads.json vers l'onglet LEADS
    du Google Sheet. Chaque ligne = un lead avec son lien de profil Facebook.
    Dédoublonne automatiquement (ne réécrit pas les leads déjà présents).
    Retourne le nombre de nouveaux leads ajoutés au Sheet.
    """
    import json
    from pathlib import Path

    leads_path = Path("data/leads.json")
    if not leads_path.exists():
        print("[Leads] Aucun fichier data/leads.json trouvé.")
        return 0

    all_leads = json.loads(leads_path.read_text(encoding="utf-8")).get("leads", [])
    if not all_leads:
        print("[Leads] Aucun lead à exporter.")
        return 0

    try:
        creds          = get_credentials()
        sheets_service = build("sheets", "v4", credentials=creds)

        # Lire les URLs déjà présentes dans le Sheet pour dédoublonner
        existing_urls: set[str] = set()
        try:
            result = sheets_service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_TAB_LEADS}!C2:C",  # colonne Lien profil
            ).execute()
            for row in result.get("values", []):
                if row:
                    existing_urls.add(row[0].strip())
        except HttpError:
            pass  # Onglet vide ou inexistant — on l'initialisera avec les en-têtes

        # Filtrer les nouveaux leads
        new_leads = [
            lead for lead in all_leads
            if lead.get("commenter_url", "").strip() not in existing_urls
            and lead.get("commenter_url", "").strip()
        ]

        if not new_leads:
            print("[Leads] Tous les leads sont déjà dans le Sheet.")
            return 0

        # Préparer les lignes à ajouter
        rows = []
        for lead in new_leads:
            rows.append([
                lead.get("detected_at", "")[:10],   # Date (YYYY-MM-DD)
                lead.get("commenter_name", ""),      # Nom
                lead.get("commenter_url", ""),       # Lien profil Facebook
                lead.get("group_id", ""),            # Groupe
                lead.get("comment_text", "")[:150],  # Commentaire (tronqué)
                lead.get("status", "nouveau"),       # Statut
            ])

        # Si le Sheet est vide, ajouter les en-têtes d'abord
        if not existing_urls:
            header = [["Date", "Nom", "Lien profil", "Groupe", "Commentaire", "Statut"]]
            sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_TAB_LEADS}!A1",
                valueInputOption="RAW",
                body={"values": header},
            ).execute()

        # Ajouter les nouvelles lignes à la suite
        sheets_service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_TAB_LEADS}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": rows},
        ).execute()

        print(f"[Leads] ✓ {len(new_leads)} leads ajoutés dans l'onglet '{SHEET_TAB_LEADS}'.")
        return len(new_leads)

    except HttpError as e:
        print(f"[Leads] ERREUR Google Sheets : {e}")
        return 0
    except Exception as e:
        print(f"[Leads] ERREUR : {e}")
        return 0


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main():
    creds         = get_credentials()
    drive_service = build("drive", "v3", credentials=creds)
    sheets_service = build("sheets", "v4", credentials=creds)

    uploaded = upload_images_to_drive(drive_service)
    save_upload_manifest(uploaded)
    update_sheet_with_images(sheets_service, uploaded)

    print("\n✓ Upload terminé. Relancez post_facebook.py pour commencer les posts.")


if __name__ == "__main__":
    main()
