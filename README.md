# Agent iClosed ↔ Telegram

Agent Python qui connecte **iClosed** (CRM de vente) et **Telegram** via **Zapier**.

## Ce qu'il fait

- **Récap quotidien à 9h** sur Telegram : prospects opt-in, calls bookés, shows, no-shows, disqualifiés, closes
- **Notifications temps réel** via webhooks Zapier dès qu'un événement se produit
- **Commandes Telegram** : `/recap`, `/status`, `/test`, etc.

## Installation

```bash
# 1. Clone le repo et installe les dépendances
pip install -r requirements.txt

# 2. Configure les variables d'environnement
cp .env.example .env
# Édite .env avec tes vraies valeurs
```

## Configuration (.env)

```env
TELEGRAM_BOT_TOKEN=<token obtenu via @BotFather>
TELEGRAM_CHAT_ID=<ton chat ID>
ICLOSED_API_KEY=<ta clé API iClosed>
ICLOSED_BASE_URL=https://api.iclosed.io/v1
RECAP_HOUR=9
RECAP_MINUTE=0
TIMEZONE=Europe/Paris
WEBHOOK_PORT=5000
WEBHOOK_SECRET=<un token secret pour sécuriser les webhooks Zapier>
```

**Comment trouver ton Chat ID Telegram :** envoie `/start` à [@userinfobot](https://t.me/userinfobot).

## Démarrage

```bash
# Démarrage normal
python agent.py

# Test immédiat (envoie un récap de test)
python agent.py --test

# Sans serveur webhook
python agent.py --no-web
```

## Configuration Zapier

Dans chaque Zap, ajoute une action **Webhook by Zapier → POST** vers :

| Événement | URL |
|-----------|-----|
| Nouveau prospect opt-in | `http://TON_IP:5000/zapier/optin` |
| Call booké | `http://TON_IP:5000/zapier/booked` |
| Show confirmé | `http://TON_IP:5000/zapier/show` |
| No-Show | `http://TON_IP:5000/zapier/no-show` |
| Disqualifié | `http://TON_IP:5000/zapier/disqualified` |
| Close réalisé | `http://TON_IP:5000/zapier/closed` |

Ajoute le header `X-Webhook-Secret: <ton WEBHOOK_SECRET>` pour sécuriser.

Ou utilise l'endpoint universel `POST /zapier/event` avec un champ `event_type`.

## Commandes Telegram disponibles

| Commande | Action |
|----------|--------|
| `/recap` | Récap d'hier |
| `/aujourd_hui` | Récap du jour |
| `/status` | Statut de l'agent |
| `/test` | Test de connexion |
| `/help` | Aide |

## Architecture

```
agent.py              ← Point d'entrée principal
iclosed_client.py     ← Client API iClosed
telegram_sender.py    ← Envoi des messages Telegram
scheduler.py          ← Cron job 9h
webhook_server.py     ← Serveur Flask pour Zapier
requirements.txt
.env.example
```
