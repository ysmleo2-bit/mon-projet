"""
Agent Telegram Reporter — envoie les rapports quotidiens à Léo sur Telegram.

Messages envoyés automatiquement :
  - Rapport matin (10h)    : confirmation démarrage vague publication
  - Rapport soir  (21h)    : bilan complet de la journée
  - Rapport hebdo (vendredi 21h30) : bilan semaine + leads
  - Alertes temps réel     : erreur daemon, objectif leads atteint
  - Aperçu visuels         : envoie les PNG générés du jour

Utilise uniquement urllib (pas de dépendance externe).
"""

import json
import os
import urllib.request
import urllib.parse
from datetime import datetime, date
from pathlib import Path


class TelegramReporter:

    def __init__(self, token: str | None = None, chat_id: str | None = None):
        self.token   = token   or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID", "")
        self.base    = f"https://api.telegram.org/bot{self.token}"

    # ── Primitives ────────────────────────────────────────────────────────────

    def _post(self, endpoint: str, payload: dict) -> bool:
        url  = f"{self.base}/{endpoint}"
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            res    = urllib.request.urlopen(req, timeout=10)
            result = json.loads(res.read())
            return result.get("ok", False)
        except Exception as e:
            print(f"[Telegram] Erreur : {e}")
            return False

    def send(self, text: str, parse_mode: str = "HTML") -> bool:
        return self._post("sendMessage", {
            "chat_id":    self.chat_id,
            "text":       text,
            "parse_mode": parse_mode,
        })

    def send_photo(self, image_path: str, caption: str = "") -> bool:
        """Envoie une image PNG directement dans le chat."""
        url = f"{self.base}/sendPhoto"
        try:
            with open(image_path, "rb") as f:
                img_data = f.read()

            boundary = "----TelegramBoundary"
            body  = f"--{boundary}\r\n"
            body += f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{self.chat_id}\r\n'
            body += f"--{boundary}\r\n"
            body += f'Content-Disposition: form-data; name="caption"\r\n\r\n{caption}\r\n'
            body += f"--{boundary}\r\n"
            body += f'Content-Disposition: form-data; name="photo"; filename="visuel.png"\r\n'
            body += "Content-Type: image/png\r\n\r\n"
            body_bytes = body.encode() + img_data + f"\r\n--{boundary}--\r\n".encode()

            req = urllib.request.Request(
                url, data=body_bytes,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
            )
            res = urllib.request.urlopen(req, timeout=30)
            return json.loads(res.read()).get("ok", False)
        except Exception as e:
            print(f"[Telegram] Erreur envoi photo : {e}")
            return False

    # ── Rapports ──────────────────────────────────────────────────────────────

    def rapport_matin(self):
        """Rapport envoyé à 10h avant la vague de publication."""
        from agent.lead_tracker import weekly_count, WEEKLY_GOAL
        from agent.discovery_agent import _load_config

        groups     = _load_config()
        leads_wk   = weekly_count()
        today_str  = datetime.now().strftime("%A %d %B").capitalize()

        msg = (
            f"☀️ <b>Bonjour Léo !</b>\n"
            f"📅 {today_str}\n\n"
            f"🚀 <b>Vague de publication en cours…</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"👥 Groupes actifs : <b>{len(groups)}</b>\n"
            f"🎯 Leads semaine  : <b>{leads_wk}/{WEEKLY_GOAL}</b>\n\n"
            f"Les posts du jour sont en cours d'envoi 📤"
        )
        self.send(msg)

    def rapport_soir(self):
        """Rapport complet envoyé à 21h."""
        today_str = date.today().isoformat()

        # Publications du jour
        posts_today = 0
        try:
            log = json.loads(Path("data/publish_log.json").read_text())
            posts_today = sum(
                1 for e in log.get("published", [])
                if e.get("date") == today_str
            )
        except Exception:
            pass

        # Leads du jour
        new_leads = 0
        total_leads_wk = 0
        try:
            from agent.lead_tracker import LeadTracker, weekly_count, WEEKLY_GOAL
            tracker    = LeadTracker()
            new_leads  = len(tracker.export_new_leads(24))
            total_leads_wk = weekly_count()
        except Exception:
            from agent.lead_tracker import weekly_count, WEEKLY_GOAL
            total_leads_wk = weekly_count()

        # Groupes
        try:
            from agent.discovery_agent import _load_config
            nb_groups = len(_load_config())
        except Exception:
            nb_groups = 0

        # Barre de progression leads
        pct = min(100, int(total_leads_wk / WEEKLY_GOAL * 100))
        bar = "🟩" * (pct // 10) + "⬜" * (10 - pct // 10)

        # Statut daemon
        daemon_ok = "✅ Actif"
        try:
            status = json.loads(Path("data/daemon_status.json").read_text())
            if status.get("state") != "running":
                daemon_ok = "⚠️ " + status.get("state", "?")
        except Exception:
            daemon_ok = "❓ Inconnu"

        msg = (
            f"🌙 <b>Rapport du soir — {datetime.now().strftime('%d/%m/%Y')}</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"📤 <b>Posts publiés aujourd'hui :</b> {posts_today}\n"
            f"👥 <b>Groupes actifs :</b> {nb_groups}\n\n"
            f"🎯 <b>Leads aujourd'hui :</b> +{new_leads}\n"
            f"📊 <b>Semaine en cours :</b> {total_leads_wk}/{WEEKLY_GOAL}\n"
            f"{bar} {pct}%\n\n"
            f"🤖 <b>Daemon :</b> {daemon_ok}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
        )

        # Emoji d'état selon la progression
        if total_leads_wk >= WEEKLY_GOAL:
            msg += "🏆 <b>OBJECTIF ATTEINT cette semaine !</b>"
        elif total_leads_wk >= WEEKLY_GOAL * 0.7:
            msg += f"⚡ Plus que <b>{WEEKLY_GOAL - total_leads_wk} leads</b> pour l'objectif !"
        else:
            msg += f"💪 Continue ! Objectif : <b>{WEEKLY_GOAL} leads/semaine</b>"

        self.send(msg)

        # Envoyer les visuels du jour (max 3)
        self._send_daily_visuals()

    def rapport_hebdomadaire(self):
        """Rapport complet de la semaine — envoyé le vendredi soir."""
        try:
            from agent.lead_tracker import LeadTracker, weekly_count, WEEKLY_GOAL
            tracker = LeadTracker()
            report  = tracker.weekly_report()
            wc      = weekly_count()

            # Détail par groupe (top 5)
            data       = json.loads(Path("data/leads.json").read_text())
            week_leads = [l for l in data.get("leads", [])
                          if l.get("week") == datetime.now().strftime("%Y-W%V")]
            by_group   = {}
            for l in week_leads:
                gid = l.get("group_id", "?")
                by_group[gid] = by_group.get(gid, 0) + 1
            top5 = sorted(by_group.items(), key=lambda x: -x[1])[:5]
            top5_str = "\n".join(f"  • {gid}: <b>{n}</b> leads" for gid, n in top5)
        except Exception:
            wc     = 0
            top5_str = "  — données indisponibles"

        msg = (
            f"📋 <b>RAPPORT HEBDOMADAIRE</b>\n"
            f"Semaine du {datetime.now().strftime('%d/%m/%Y')}\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"🎯 <b>Leads cette semaine : {wc}/{WEEKLY_GOAL}</b>\n\n"
            f"🏆 <b>Top groupes :</b>\n{top5_str}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"{'🏆 OBJECTIF ATTEINT !' if wc >= WEEKLY_GOAL else '📈 Continue sur ta lancée la semaine prochaine !'}"
        )
        self.send(msg)

    def alerte_erreur(self, tache: str, erreur: str):
        """Alerte immédiate en cas d'erreur du daemon."""
        msg = (
            f"🚨 <b>ERREUR DAEMON</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"Tâche : <code>{tache}</code>\n"
            f"Erreur : <code>{erreur[:300]}</code>\n\n"
            f"⏰ {datetime.now().strftime('%H:%M:%S')}"
        )
        self.send(msg)

    def alerte_objectif_atteint(self, count: int):
        """Notification quand les 30 leads/semaine sont atteints."""
        msg = (
            f"🏆 <b>OBJECTIF ATTEINT !</b>\n\n"
            f"Tu as collecté <b>{count} leads qualifiés</b> cette semaine 🎉\n\n"
            f"Chaque lead a commenté sur un de tes posts → relance-les en DM !"
        )
        self.send(msg)

    def alerte_nouveau_groupe(self, name: str, category: str):
        """Notification quand un nouveau groupe est découvert et ajouté."""
        msg = (
            f"🔍 <b>Nouveau groupe découvert !</b>\n"
            f"📌 {name}\n"
            f"🏷 Catégorie : {category}\n"
            f"✅ Ajouté à la liste de diffusion"
        )
        self.send(msg)

    # ── Envoi des visuels ─────────────────────────────────────────────────────

    def _send_daily_visuals(self, max_visuals: int = 3):
        """Envoie les derniers visuels générés dans le chat Telegram."""
        visuals_dir = Path("data/generated_content/visuals")
        if not visuals_dir.exists():
            return

        today = date.today().strftime("%Y%m%d")
        # Priorité aux visuels du jour, sinon les plus récents
        files = sorted(visuals_dir.glob("*.png"), reverse=True)
        today_files = [f for f in files if today in f.name]
        to_send = (today_files or files)[:max_visuals]

        if not to_send:
            return

        self.send(f"🖼 <b>Visuels générés aujourd'hui ({len(to_send)}) :</b>")
        for path in to_send:
            caption = path.stem.replace("_", " ").title()
            self.send_photo(str(path), caption=caption)

    def send_visual(self, image_path: str, group_name: str = ""):
        """Envoie un visuel unique — appelé par VisualAgent après génération."""
        caption = f"✅ Nouveau visuel généré\n📌 {group_name}" if group_name else "✅ Nouveau visuel généré"
        self.send_photo(image_path, caption=caption)

    # ── Test de connexion ─────────────────────────────────────────────────────

    def test(self) -> bool:
        ok = self.send(
            "✅ <b>Setting Agent connecté !</b>\n\n"
            "Tu recevras ici :\n"
            "☀️ Rapport matin (10h)\n"
            "🌙 Rapport soir (21h)\n"
            "📋 Bilan hebdo (vendredi)\n"
            "🚨 Alertes en temps réel\n"
            "🖼 Aperçu des visuels générés"
        )
        if ok:
            print("[Telegram] ✓ Connexion OK")
        return ok
