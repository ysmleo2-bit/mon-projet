"""
Serveur Flask pour recevoir les webhooks Zapier en temps réel.
Zapier envoie un POST quand un événement se produit dans iClosed.
"""
import hashlib
import hmac
import logging
from functools import wraps

from flask import Flask, request, jsonify

logger = logging.getLogger(__name__)

app = Flask(__name__)

# Sera injecté au démarrage
_telegram_sender = None
_webhook_secret = None


def init_webhook(telegram_sender, webhook_secret: str = None):
    global _telegram_sender, _webhook_secret
    _telegram_sender = telegram_sender
    _webhook_secret = webhook_secret


def _verify_secret(f):
    """Décorateur : vérifie le token secret si configuré."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if _webhook_secret:
            token = request.headers.get("X-Webhook-Secret") or request.args.get("secret")
            if token != _webhook_secret:
                logger.warning("Webhook reçu avec secret invalide")
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "iclosed-telegram-agent"})


@app.route("/zapier/event", methods=["POST"])
@_verify_secret
def zapier_event():
    """
    Endpoint principal pour les événements Zapier.

    Zapier doit envoyer un JSON avec au minimum :
    {
        "event_type": "optin" | "booked" | "show" | "no_show" | "disqualified" | "closed",
        "name": "Prénom Nom",
        "email": "email@exemple.com",
        ... autres champs optionnels
    }
    """
    # Accepte JSON, form-data ou raw body (compatibilité Zapier)
    data = request.get_json(silent=True)
    if data is None:
        data = request.form.to_dict() or {}
    logger.info(f"Webhook Zapier reçu: {data}")

    event_type = data.get("event_type", "").lower().strip()
    if not event_type:
        # Tentative de déduction depuis un champ "status" ou "outcome"
        status = str(data.get("status", data.get("outcome", ""))).lower()
        event_type = _guess_event_type(status)

    if not event_type:
        logger.warning(f"Type d'événement manquant dans: {data}")
        return jsonify({"error": "event_type required"}), 400

    # Sauvegarde locale pour le récap quotidien
    from data_store import save_event
    save_event(event_type, data)

    if _telegram_sender:
        _telegram_sender.send_zapier_event(event_type, data)

    return jsonify({"status": "received", "event_type": event_type})


def _handle_event(event_type: str):
    """Traitement commun : sauvegarde locale + notification Telegram."""
    from data_store import save_event
    data = request.get_json(silent=True) or request.form.to_dict() or {}
    save_event(event_type, data)
    if _telegram_sender:
        _telegram_sender.send_zapier_event(event_type, data)
    return jsonify({"status": "received", "event_type": event_type})


@app.route("/zapier/optin", methods=["POST"])
@_verify_secret
def zapier_optin():
    return _handle_event("optin")


@app.route("/zapier/booked", methods=["POST"])
@_verify_secret
def zapier_booked():
    return _handle_event("booked")


@app.route("/zapier/show", methods=["POST"])
@_verify_secret
def zapier_show():
    return _handle_event("show")


@app.route("/zapier/no-show", methods=["POST"])
@_verify_secret
def zapier_no_show():
    return _handle_event("no_show")


@app.route("/zapier/disqualified", methods=["POST"])
@_verify_secret
def zapier_disqualified():
    return _handle_event("disqualified")


@app.route("/zapier/closed", methods=["POST"])
@_verify_secret
def zapier_closed():
    return _handle_event("closed")


def _guess_event_type(status: str) -> str:
    mapping = {
        "optin": "optin", "opt_in": "optin", "opt-in": "optin",
        "booked": "booked", "scheduled": "booked", "booking": "booked",
        "show": "show", "showed": "show", "attended": "show",
        "no_show": "no_show", "no-show": "no_show", "noshow": "no_show", "missed": "no_show",
        "disqualified": "disqualified", "dq": "disqualified",
        "closed": "closed", "won": "closed", "sale": "closed",
    }
    return mapping.get(status, "")
