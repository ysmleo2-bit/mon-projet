"""
Agent Slack Notifier — envoie les alertes leads en temps réel sur Slack.

Déclenché par le daemon à chaque nouveau lead détecté depuis Facebook.
La fonction Google Apps Script `notifySlackOnNewLead` couvre l'autre sens :
quand un lead est ajouté manuellement dans l'onglet LEADS du Sheet.

Variables d'environnement requises :
  SLACK_WEBHOOK_URL  — Webhook entrant Slack (ex. https://hooks.slack.com/…)
  SLACK_CHANNEL      — Canal cible, ex. #leads  (optionnel, défaut dans webhook)

Utilise uniquement urllib (pas de dépendance externe).
"""

import json
import os
import urllib.request
from datetime import datetime


class SlackNotifier:

    def __init__(self, webhook_url: str | None = None, channel: str | None = None):
        self.webhook_url = webhook_url or os.environ.get("SLACK_WEBHOOK_URL", "")
        self.channel     = channel     or os.environ.get("SLACK_CHANNEL", "")

    # ── Primitive ─────────────────────────────────────────────────────────────

    def _post(self, payload: dict) -> bool:
        if not self.webhook_url:
            print("[Slack] SLACK_WEBHOOK_URL non configurée — notification ignorée.")
            return False
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            self.webhook_url, data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(req, timeout=10)
            return True
        except Exception as e:
            print(f"[Slack] Erreur envoi : {e}")
            return False

    def send(self, text: str, blocks: list | None = None) -> bool:
        payload: dict = {"text": text}
        if self.channel:
            payload["channel"] = self.channel
        if blocks:
            payload["blocks"] = blocks
        return self._post(payload)

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
        return self.send(
            text=f"Nouveau lead : {name} ({group})",
            blocks=blocks,
        )

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
        ok = self.send(
            text="✅ Slack Notifier connecté — Setting Agent",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            "*✅ Setting Agent — Slack connecté !*\n\n"
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
            print("[Slack] ✓ Connexion OK")
        return ok
