"""
Lance l'authentification Google OAuth et sauvegarde le token.
À exécuter UNE SEULE FOIS sur ta machine locale.
"""
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
import os

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]
TOKEN_PATH = "token.json"
CREDS_PATH = "credentials.json"

def main():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if creds and creds.valid:
        print("✓ Token Google déjà valide !")
        return

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
        print("✓ Token rafraîchi.")
        return

    flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)

    # Sur Mac/Linux avec navigateur : ouvre automatiquement le browser
    creds = flow.run_local_server(port=8080)

    with open(TOKEN_PATH, "w") as f:
        f.write(creds.to_json())

    print("\n✓ token.json créé — Google Drive et Sheets sont prêts !")

if __name__ == "__main__":
    main()
