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
    if not request.is_json:
        return jsonify({"error": "JSON required"}), 400

    data = request.get_json()
    logger.info(f"Webhook Zapier reçu: {data}")

    event_type = data.get("event_type", "").lower().strip()
    if not event_type:
        # Tentative de déduction depuis un champ "status" ou "outcome"
        status = str(data.get("status", data.get("outcome", ""))).lower()
        event_type = _guess_event_type(status)

    if not event_type:
        logger.warning(f"Type d'événement manquant dans: {data}")
        return jsonify({"error": "event_type required"}), 400

    if _telegram_sender:
        _telegram_sender.send_zapier_event(event_type, data)

    return jsonify({"status": "received", "event_type": event_type})


@app.route("/zapier/optin", methods=["POST"])
@_verify_secret
def zapier_optin():
    """Endpoint dédié : nouveau prospect opt-in."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("optin", data)
    return jsonify({"status": "received"})


@app.route("/zapier/booked", methods=["POST"])
@_verify_secret
def zapier_booked():
    """Endpoint dédié : call booké."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("booked", data)
    return jsonify({"status": "received"})


@app.route("/zapier/show", methods=["POST"])
@_verify_secret
def zapier_show():
    """Endpoint dédié : show confirmé."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("show", data)
    return jsonify({"status": "received"})


@app.route("/zapier/no-show", methods=["POST"])
@_verify_secret
def zapier_no_show():
    """Endpoint dédié : no-show."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("no_show", data)
    return jsonify({"status": "received"})


@app.route("/zapier/disqualified", methods=["POST"])
@_verify_secret
def zapier_disqualified():
    """Endpoint dédié : prospect disqualifié."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("disqualified", data)
    return jsonify({"status": "received"})


@app.route("/zapier/closed", methods=["POST"])
@_verify_secret
def zapier_closed():
    """Endpoint dédié : close réalisé."""
    data = request.get_json(force=True) or {}
    if _telegram_sender:
        _telegram_sender.send_zapier_event("closed", data)
    return jsonify({"status": "received"})


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
