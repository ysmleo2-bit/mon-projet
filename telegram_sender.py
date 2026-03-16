"""
Module d'envoi de messages Telegram.
Utilise l'API Bot Telegram pour envoyer le récap quotidien.
"""
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


class TelegramSender:
    def __init__(self, token: str, chat_id: str):
        self.token = token
        self.chat_id = str(chat_id)

    def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Envoie un message Telegram. Retourne True si succès."""
        url = TELEGRAM_API.format(token=self.token, method="sendMessage")
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }
        try:
            resp = requests.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            logger.info("Message Telegram envoyé avec succès")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur envoi Telegram: {e}")
            return False

    def send_daily_recap(self, stats: dict) -> bool:
        """Formate et envoie le récap quotidien des stats iClosed."""
        message = self._format_recap(stats)
        return self.send_message(message)

    def send_alert(self, message: str) -> bool:
        """Envoie une alerte / notification ponctuelle."""
        return self.send_message(f"🚨 <b>Alerte</b>\n\n{message}")

    def send_zapier_event(self, event_type: str, data: dict) -> bool:
        """Notifie en temps réel d'un événement reçu via Zapier."""
        emoji_map = {
            "optin": "🟢",
            "booked": "📅",
            "show": "✅",
            "no_show": "❌",
            "disqualified": "🚫",
            "closed": "💰",
        }
        emoji = emoji_map.get(event_type, "📌")
        name = data.get("name", data.get("first_name", "Inconnu"))
        detail = data.get("email", data.get("phone", ""))

        lines = [f"{emoji} <b>{self._event_label(event_type)}</b>"]
        if name and name != "Inconnu":
            lines.append(f"👤 {name}")
        if detail:
            lines.append(f"📧 {detail}")
        if "closer" in data:
            lines.append(f"🎯 Closer: {data['closer']}")
        if "setter" in data:
            lines.append(f"🔗 Setter: {data['setter']}")

        return self.send_message("\n".join(lines))

    def _event_label(self, event_type: str) -> str:
        labels = {
            "optin": "Nouveau prospect opt-in",
            "booked": "Call booké",
            "show": "Show confirmé",
            "no_show": "No-Show",
            "disqualified": "Disqualifié",
            "closed": "CLOSE 💸",
        }
        return labels.get(event_type, event_type.replace("_", " ").title())

    def _format_recap(self, stats: dict) -> str:
        """Formate le récap en message HTML Telegram."""
        date_str = stats.get("date", "")
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            date_label = d.strftime("%A %d %B %Y").capitalize()
        except Exception:
            date_label = date_str

        prospects = stats.get("prospects_optin", 0)
        bookes = stats.get("calls_bookes", 0)
        shows = stats.get("shows", 0)
        no_shows = stats.get("no_shows", 0)
        disqual = stats.get("disqualifies", 0)
        closes = stats.get("closes", 0)

        # Taux de show
        show_rate = f"{round(shows / bookes * 100)}%" if bookes > 0 else "N/A"
        # Taux de close
        close_rate = f"{round(closes / shows * 100)}%" if shows > 0 else "N/A"

        lines = [
            f"☀️ <b>Récap du {date_label}</b>",
            "",
            "━━━━━━━━━━━━━━━━━━━━",
            "📊 <b>PIPELINE DE VENTE</b>",
            "━━━━━━━━━━━━━━━━━━━━",
            "",
            f"🟢 <b>Prospects opt-in :</b> {prospects}",
            f"📅 <b>Calls bookés :</b> {bookes}",
            "",
            "━━━━━━━━━━━━━━━━━━━━",
            "📞 <b>APPELS</b>",
            "━━━━━━━━━━━━━━━━━━━━",
            "",
            f"✅ <b>Shows :</b> {shows}  ({show_rate} de show rate)",
            f"❌ <b>No-Shows :</b> {no_shows}",
            f"🚫 <b>Disqualifiés :</b> {disqual}",
            f"💰 <b>Closes :</b> {closes}  ({close_rate} de close rate)",
            "",
        ]

        # Stats équipe si disponibles
        team = stats.get("team", [])
        if team:
            lines += [
                "━━━━━━━━━━━━━━━━━━━━",
                "👥 <b>PAR CLOSER</b>",
                "━━━━━━━━━━━━━━━━━━━━",
                "",
            ]
            for member in team:
                name = member.get("name", "?")
                m_shows = member.get("shows", 0)
                m_closes = member.get("closes", 0)
                m_no_shows = member.get("no_shows", 0)
                lines.append(
                    f"• <b>{name}</b> — Shows: {m_shows} | Closes: {m_closes} | NS: {m_no_shows}"
                )
            lines.append("")

        lines += [
            "━━━━━━━━━━━━━━━━━━━━",
            "🤖 <i>Agent iClosed · Rapport automatique 9h</i>",
        ]

        return "\n".join(lines)
