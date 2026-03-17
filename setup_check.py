#!/usr/bin/env python3
"""
Script de vérification de la configuration.
Lance : python setup_check.py
"""
import os
import sys

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

def ok(msg): print(f"  {GREEN}✓{RESET} {msg}")
def err(msg): print(f"  {RED}✗{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}!{RESET} {msg}")
def section(title): print(f"\n{BOLD}{title}{RESET}")


def check_env():
    section("1. Fichier .env")
    if not os.path.exists(".env"):
        err(".env manquant — copie .env.example vers .env et remplis les valeurs")
        return False
    ok(".env présent")
    return True


def check_telegram():
    from dotenv import load_dotenv
    load_dotenv()
    section("2. Variables Telegram")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    ok_count = 0
    if token and len(token) > 10:
        ok(f"TELEGRAM_BOT_TOKEN configuré ({token[:8]}...)")
        ok_count += 1
    else:
        err("TELEGRAM_BOT_TOKEN manquant ou vide")
    if chat_id:
        ok(f"TELEGRAM_CHAT_ID configuré ({chat_id})")
        ok_count += 1
    else:
        err("TELEGRAM_CHAT_ID manquant")
    return ok_count == 2


def check_google_sheets():
    from dotenv import load_dotenv
    load_dotenv()
    section("3. Google Sheets")
    sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
    creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
    ok_count = 0
    if sheets_id:
        ok(f"GOOGLE_SHEETS_ID configuré ({sheets_id[:12]}...)")
        ok_count += 1
    else:
        err("GOOGLE_SHEETS_ID manquant")
    if os.path.exists(creds_path):
        ok(f"credentials.json présent ({creds_path})")
        ok_count += 1
    else:
        err(f"credentials.json introuvable à '{creds_path}'")
    return ok_count == 2


def test_telegram_connection():
    from dotenv import load_dotenv
    load_dotenv()
    section("4. Test connexion Telegram")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        warn("Skippé — token manquant")
        return False
    try:
        import requests
        r = requests.get(
            f"https://api.telegram.org/bot{token}/getMe",
            timeout=8
        )
        data = r.json()
        if data.get("ok"):
            name = data["result"].get("first_name", "Bot")
            username = data["result"].get("username", "")
            ok(f"Bot Telegram connecté : {name} (@{username})")
            return True
        else:
            err(f"Token invalide : {data.get('description', 'erreur inconnue')}")
            return False
    except Exception as e:
        err(f"Connexion échouée : {e}")
        return False


def test_sheets_connection():
    from dotenv import load_dotenv
    load_dotenv()
    section("5. Test connexion Google Sheets")
    sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
    creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
    if not sheets_id or not os.path.exists(creds_path):
        warn("Skippé — configuration manquante")
        return False
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from sheets import SheetsClient
        client = SheetsClient()
        connected = client.test_connection()
        if connected:
            ok("Connexion Google Sheets OK")
            # Affiche les colonnes disponibles
            rows = client.get_all_rows()
            if rows:
                cols = list(rows[0].keys())
                ok(f"Colonnes détectées : {', '.join(cols[:8])}{'...' if len(cols) > 8 else ''}")
                ok(f"Nombre de lignes : {len(rows)}")
            return True
        else:
            err("Connexion Google Sheets échouée (voir les logs)")
            return False
    except Exception as e:
        err(f"Erreur Google Sheets : {e}")
        return False


def main():
    print(f"\n{BOLD}=== Vérification configuration Agent iClosed ↔ Telegram ==={RESET}")

    env_ok = check_env()
    if not env_ok:
        print(f"\n{YELLOW}ACTION REQUISE :{RESET}")
        print("  cp .env.example .env")
        print("  nano .env  (ou ouvre avec ton éditeur)\n")
        sys.exit(1)

    tg_ok = check_telegram()
    gs_ok = check_google_sheets()

    if tg_ok:
        tg_conn = test_telegram_connection()
    else:
        tg_conn = False

    if gs_ok:
        gs_conn = test_sheets_connection()
    else:
        gs_conn = False

    # Résumé
    print(f"\n{BOLD}=== Résumé ==={RESET}")
    if tg_conn and gs_conn:
        print(f"\n  {GREEN}{BOLD}Tout est configuré correctement.{RESET}")
        print(f"  Lance le bot : {BOLD}python agent.py{RESET}")
        print(f"  Test immédiat : {BOLD}python agent.py --test{RESET}\n")
    else:
        print(f"\n  {YELLOW}Configuration incomplète.{RESET} Éléments manquants :\n")
        if not tg_conn:
            print(f"  {RED}Telegram{RESET} — Renseigne TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans .env")
            print(f"    • Token : crée un bot via @BotFather sur Telegram")
            print(f"    • Chat ID : envoie /start à @userinfobot sur Telegram")
        if not gs_conn:
            print(f"\n  {RED}Google Sheets{RESET} — Renseigne GOOGLE_SHEETS_ID et credentials.json")
            print(f"    • GOOGLE_SHEETS_ID : l'ID dans l'URL de ton Sheet")
            print(f"      (https://docs.google.com/spreadsheets/d/[ID_ICI]/edit)")
            print(f"    • credentials.json : Service Account Google Cloud")
            print(f"      1. console.cloud.google.com → APIs → Google Sheets API → Activer")
            print(f"      2. IAM → Service Accounts → Créer → Générer une clé JSON")
            print(f"      3. Copier credentials.json à la racine du projet")
            print(f"      4. Partager ton Google Sheet avec l'email du Service Account")
        print()


if __name__ == "__main__":
    main()
