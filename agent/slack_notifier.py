"""
Agent Slack Notifier — envoie les alertes leads en temps réel sur Slack.

Supporte deux modes (priorité au Bot Token) :
  1. Bot Token  → SLACK_BOT_TOKEN=xoxb-...  + SLACK_CHANNEL=#leads
                  Appelle chat.postMessage (méthode recommandée avec une app Slack)
  2. Webhook    → SLACK_WEBHOOK_URL=https://hooks.slack.com/...
                  Fallback si pas de token

Variables d'environnement (.env) :
  SLACK_BOT_TOKEN   — Token du bot Slack (xoxb-...)       ← prioritaire
  SLACK_CHANNEL     — Canal cible, ex. #leads ou C0123ABC  ← requis avec le token
  SLACK_WEBHOOK_URL — Webhook entrant (fallback)

Permissions OAuth requises pour le Bot Token :
  chat:write
"""

import json
import os
import urllib.request
from datetime import datetime

SLACK_API_POST = "https://slack.com/api/chat.postMessage"


class SlackNotifier:

    def __init__(
        self,
        bot_token:   str | None = None,
        webhook_url: str | None = None,
        channel:     str | None = None,
    ):
        self.bot_token   = bot_token   or os.environ.get("SLACK_BOT_TOKEN",   "")
        self.webhook_url = webhook_url or os.environ.get("SLACK_WEBHOOK_URL", "")
        self.channel     = channel     or os.environ.get("SLACK_CHANNEL",     "")

    # ── Primitives ────────────────────────────────────────────────────────────

    def _post_with_token(self, payload: dict) -> bool:
        """Utilise l'API Slack officielle avec le Bot Token (chat.postMessage)."""
        if not self.channel:
            print("[Slack] SLACK_CHANNEL requis avec le Bot Token.")
            return False
        payload["channel"] = self.channel
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            SLACK_API_POST, data=data,
            headers={
                "Content-Type":  "application/json; charset=utf-8",
                "Authorization": f"Bearer {self.bot_token}",
            },
        )
        try:
            res    = urllib.request.urlopen(req, timeout=10)
            result = json.loads(res.read())
            if not result.get("ok"):
                print(f"[Slack] Erreur API : {result.get('error', '?')}")
                return False
            return True
        except Exception as e:
            print(f"[Slack] Erreur requête : {e}")
            return False

    def _post_with_webhook(self, payload: dict) -> bool:
        """Fallback : Incoming Webhook."""
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            self.webhook_url, data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(req, timeout=10)
            return True
        except Exception as e:
            print(f"[Slack] Erreur webhook : {e}")
            return False

    def send(self, text: str, blocks: list | None = None) -> bool:
        """Envoie un message — préfère le Bot Token, sinon le Webhook."""
        payload: dict = {"text": text}
        if blocks:
            payload["blocks"] = blocks

        if self.bot_token:
            return self._post_with_token(payload)
        if self.webhook_url:
            if self.channel:
                payload["channel"] = self.channel
            return self._post_with_webhook(payload)

        print("[Slack] Aucune credential configurée (SLACK_BOT_TOKEN ou SLACK_WEBHOOK_URL).")
        return False

    # ── Notifications leads ───────────────────────────────────────────────────

    def nouveau_lead(self, lead: dict) -> bool:
        """Envoie une carte Slack pour chaque nouveau lead détecté."""
        name    = lead.get("commenter_name", "Inconnu")
        url     = lead.get("commenter_url", "")
        group   = lead.get("group_id", "")
        comment = lead.get("comment_text", "")[:120]
        date    = lead.get("detected_at", datetime.now().isoformat())[:16].replace("T", " à ")

        profile_link = f"<{url}|{name}>" if url else name

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🎯 Nouveau lead qualifié !"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Profil :*\n{profile_link}"},
                    {"type": "mrkdwn", "text": f"*Groupe :*\n{group}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Commentaire :*\n_{comment}_"},
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Détecté le {date}"}],
            },
            {"type": "divider"},
        ]
        return self.send(text=f"Nouveau lead : {name} ({group})", blocks=blocks)

    def rapport_leads(self, new_count: int, weekly_count: int, weekly_goal: int) -> bool:
        """Résumé Slack après chaque scan leads (14h / 21h)."""
        pct = min(100, int(weekly_count / weekly_goal * 100))
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)

        if weekly_count >= weekly_goal:
            status = f"🏆 *Objectif atteint !* {weekly_count}/{weekly_goal}"
        elif weekly_count >= weekly_goal * 0.7:
            status = f"⚡ Plus que *{weekly_goal - weekly_count}* leads pour l'objectif !"
        else:
            status = f"💪 Continue ! Objectif : *{weekly_goal} leads/semaine*"

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*📊 Rapport Leads — {datetime.now().strftime('%d/%m %H:%M')}*\n"
                        f"Nouveaux ce scan : *+{new_count}*\n"
                        f"Cette semaine : *{weekly_count}/{weekly_goal}*\n"
                        f"`{bar}` {pct}%\n\n{status}"
                    ),
                },
            }
        ]
        return self.send(
            text=f"Rapport leads : +{new_count} (semaine {weekly_count}/{weekly_goal})",
            blocks=blocks,
        )

    def alerte_objectif_atteint(self, count: int) -> bool:
        return self.send(
            text=f"🏆 Objectif atteint ! {count} leads cette semaine.",
            blocks=[
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": "🏆 Objectif leads atteint !"},
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"*{count} leads qualifiés* collectés cette semaine 🎉\n"
                            "Chaque lead a commenté sur un de tes posts → relance-les en DM !"
                        ),
                    },
                },
            ],
        )

    def test(self) -> bool:
        mode = "Bot Token" if self.bot_token else "Webhook"
        ok = self.send(
            text="✅ Slack Notifier connecté — Setting Agent",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"*✅ Setting Agent — Slack connecté !* _({mode})_\n\n"
                            "Tu recevras ici :\n"
                            "• 🎯 Chaque nouveau lead (temps réel)\n"
                            "• 📊 Rapport après chaque scan (14h / 21h)\n"
                            "• 🏆 Alerte quand l'objectif hebdo est atteint"
                        ),
                    },
                }
            ],
        )
        if ok:
            print(f"[Slack] ✓ Connexion OK ({mode})")
        return ok
