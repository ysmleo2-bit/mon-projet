"""
Charge la liste complète des groupes depuis l'onglet GROUPES du Google Sheet
et la sauvegarde dans groups_manifest.json pour le script post_facebook.py.
"""

import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import os

from config import SPREADSHEET_ID, SHEET_TAB_GROUPES

SCOPES     = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
TOKEN_PATH = "token.json"
CREDS_PATH = "credentials.json"
OUTPUT     = "groups_manifest.json"


def get_credentials():
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


def fetch_groups() -> list[dict]:
    creds   = get_credentials()
    service = build("sheets", "v4", credentials=creds)
    result  = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_TAB_GROUPES}!A:E",
    ).execute()
    rows   = result.get("values", [])
    groups = []
    for i, row in enumerate(rows):
        if i == 0:
            continue  # en-tête
        if len(row) < 2:
            continue
        name     = row[0] if len(row) > 0 else ""
        group_id = str(row[1]) if len(row) > 1 else ""
        url      = row[2] if len(row) > 2 else ""
        category = row[3] if len(row) > 3 else ""
        status   = row[4] if len(row) > 4 else "actif"
        if group_id and status != "exclu":
            groups.append({
                "name":     name,
                "id":       group_id,
                "url":      url,
                "category": category,
            })
    return groups


def main():
    groups = fetch_groups()
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=2)
    print(f"[fetch_groups] {len(groups)} groupes sauvegardés dans {OUTPUT}")


if __name__ == "__main__":
    main()
