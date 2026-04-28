"""
Agent autonome — surveillance Google Doc
=========================================
Tourne en background. Toutes les 30 minutes :
  1. Récupère les images du Google Doc public
  2. Extrait les conversations via Claude Vision
  3. Analyse chaque conv (niche, techniques, objections, RDV)
  4. Sauvegarde dans conversations_reelles.json
Le simulateur lit ce fichier pour enrichir les prompts en temps réel.
"""

import os
import json
import time
import hashlib
import logging
import threading
import re
import base64

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = "/data" if os.path.isdir("/data") else BASE_DIR

GDOC_URL        = "https://docs.google.com/document/d/e/2PACX-1vQmNWhIEyz2s0m892p1EJ3vyO7xwJl6rMEacNuoFdLbkdc3G4NYKN_RxuYFzL6B4V6HvKnXcHMpmcTK/pub"
CHECK_INTERVAL  = 1800   # 30 minutes
PROCESSED_FILE  = os.path.join(DATA_DIR, "gdoc_processed.json")
CONV_FILE       = os.path.join(DATA_DIR, "conversations_reelles.json")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("gdoc_agent")


# ── Persistance ───────────────────────────────────────────────────────────────

def load_processed() -> set:
    if not os.path.exists(PROCESSED_FILE):
        return set()
    with open(PROCESSED_FILE, encoding="utf-8") as f:
        return set(json.load(f))

def save_processed(processed: set):
    with open(PROCESSED_FILE, "w", encoding="utf-8") as f:
        json.dump(list(processed), f)

def load_conversations() -> list:
    if not os.path.exists(CONV_FILE):
        return []
    with open(CONV_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_conversations(convs: list):
    with open(CONV_FILE, "w", encoding="utf-8") as f:
        json.dump(convs, f, ensure_ascii=False, indent=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def url_id(url: str) -> str:
    """ID stable basé sur le contenu de l'URL (sans paramètre de taille)."""
    base = url.split("=s")[0]
    return hashlib.md5(base.encode()).hexdigest()

def fetch_image_urls(doc_url: str) -> list:
    try:
        resp = requests.get(doc_url, timeout=30)
        resp.raise_for_status()
        urls = re.findall(r'<img[^>]+src="([^"]+docs\.google\.com[^"]+)"', resp.text)
        return [u.replace("&amp;", "&") for u in urls]
    except Exception as e:
        log.error(f"fetch_image_urls: {e}")
        return []


# ── Claude Vision ─────────────────────────────────────────────────────────────

def extract_conversation(client, image_bytes: bytes) -> str | None:
    img_b64 = base64.standard_b64encode(image_bytes).decode()
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": "image/jpeg", "data": img_b64
                    }},
                    {"type": "text", "text": (
                        "Cette image montre une conversation DM (Instagram/Facebook/WhatsApp).\n"
                        "Transcris toute la conversation mot pour mot.\n"
                        "Format strict :\nSETTER: <message>\nPROSPECT: <message>\n...\n"
                        "Si ce n'est pas une conversation de setting/vente, réponds uniquement : NON_PERTINENT"
                    )}
                ]
            }]
        )
        if not resp.content:
            return None
        result = resp.content[0].text.strip()
        return None if result == "NON_PERTINENT" else result
    except Exception as e:
        log.error(f"extract_conversation: {e}")
        return None


def analyze_conversation(client, conv_text: str) -> dict:
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=900,
            messages=[{
                "role": "user",
                "content": (
                    "Analyse cette vraie conversation de setting et retourne UNIQUEMENT un JSON valide.\n\n"
                    f"CONVERSATION:\n{conv_text}\n\n"
                    "JSON attendu (sans markdown) :\n"
                    '{"niche":"coaching_sportif|trading|coach_relationnel|sante|immobilier|ecommerce|saas|inconnu",'
                    '"rdv_pose":true/false,'
                    '"coordonnees_demandees":true/false,'
                    '"techniques_efficaces":["..."],'
                    '"objections_rencontrees":["..."],'
                    '"resume_prospect":"profil en 1-2 phrases",'
                    '"lecon_principale":"ce que cette conv apprend aux setters"}'
                )
            }]
        )
        if not resp.content:
            return {}
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.error(f"analyze_conversation: {e}")
        return {}


# ── Passage principal ─────────────────────────────────────────────────────────

def run_once():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY manquante — agent en pause")
        return

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    processed     = load_processed()
    conversations = load_conversations()
    new_count     = 0

    image_urls = fetch_image_urls(GDOC_URL)
    if not image_urls:
        log.info("Aucune image trouvée dans le doc")
        return

    for url in image_urls:
        uid = url_id(url)
        if uid in processed:
            continue

        log.info(f"Nouvelle image : {uid[:10]}…")

        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            image_bytes = r.content
        except Exception as e:
            log.error(f"Téléchargement image {uid[:10]}: {e}")
            processed.add(uid)
            continue

        conv_text = extract_conversation(client, image_bytes)
        if not conv_text:
            log.info(f"Image {uid[:10]} ignorée (non pertinente)")
            processed.add(uid)
            continue

        analysis = analyze_conversation(client, conv_text)

        conversations.append({
            "id":       uid,
            "texte":    conv_text,
            "analyse":  analysis,
        })
        processed.add(uid)
        new_count += 1

        niche = analysis.get("niche", "?")
        rdv   = analysis.get("rdv_pose", "?")
        log.info(f"Conv extraite — niche: {niche} | rdv: {rdv}")

    save_processed(processed)
    if new_count > 0:
        save_conversations(conversations)
        log.info(f"Agent: {new_count} nouvelles conversations sauvegardées")
    else:
        log.info("Agent: aucune nouvelle conversation")


# ── Boucle background ─────────────────────────────────────────────────────────

def run_loop():
    log.info(f"Agent GDoc démarré — ronde toutes les {CHECK_INTERVAL//60} min")
    run_once()  # premier passage immédiat au démarrage
    while True:
        time.sleep(CHECK_INTERVAL)
        try:
            run_once()
        except Exception as e:
            log.error(f"Agent loop error: {e}")


def start():
    t = threading.Thread(target=run_loop, daemon=True, name="gdoc-agent")
    t.start()
    log.info("Thread gdoc-agent lancé")
    return t
