"""
Configuration centrale pour l'automatisation Facebook / Google de Léo Ollivier.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Google ──────────────────────────────────────────────────────────────────
SPREADSHEET_ID     = "1py_R-MHNPe31nwn5kDYqNyg1dhbr36C59Li4s10D-7s"
DRIVE_FOLDER_ID    = "1OJvZm6DQ3shilxpWCXoA0TmPIfVIBCco"
SHEET_TAB_GROUPES  = "GROUPES"
SHEET_TAB_POSTS    = "POSTS"
SHEET_TAB_VISUELS  = "VISUELS"
SHEET_TAB_LEADS    = "LEADS"

# ── Facebook ─────────────────────────────────────────────────────────────────
FB_PAGE_ID        = "61582709835864"
FB_EMAIL          = os.getenv("FB_EMAIL", "leo.riviasetting@gmail.com")
FB_PASSWORD       = os.getenv("FB_PASSWORD", "")

# Groupes prioritaires (ID ou slug)
FB_GROUPS_PRIORITY = [
    {"name": "Reconversion Professionnelle",  "id": "476524732394498"},
    {"name": "Emploi Job Paris 224K",          "id": "1214796296071016"},
    {"name": "Entrepreneurs Freelances FR",    "id": "entrepreneursfreelancesfr"},
]

# ── Chemins locaux ────────────────────────────────────────────────────────────
VISUELS_DIR      = "/mnt/user-data/outputs/VISUELS"
DESCRIPTIONS_DIR = "/mnt/user-data/outputs/DESCRIPTIONS"
SCRIPTS_CTA_DIR  = "/mnt/user-data/outputs/SCRIPTS_CTA"

# ── Comportement humain ───────────────────────────────────────────────────────
DELAY_BETWEEN_GROUPS_MIN  = 60    # secondes
DELAY_BETWEEN_GROUPS_MAX  = 120
DELAY_BETWEEN_POSTS_MIN   = 45
DELAY_BETWEEN_POSTS_MAX   = 180
MAX_POSTS_PER_HOUR        = 8
POSTS_PER_DAY_PER_GROUP   = 6
SCROLL_BEFORE_POST_MIN    = 2
SCROLL_BEFORE_POST_MAX    = 3
TYPING_DELAY_MIN_MS       = 30    # ms entre chaque caractère
TYPING_DELAY_MAX_MS       = 120
CLICK_WAIT_MIN            = 3     # secondes après clic
CLICK_WAIT_MAX            = 5
