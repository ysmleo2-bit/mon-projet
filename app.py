"""
Interface Web — Simulateur d'entraînement Setting
==================================================
Accessible à tous les élèves via navigateur.

Usage :
  python app.py                   # Démarre sur http://localhost:5000
  python app.py --port 8080       # Port personnalisé
  python app.py --host 0.0.0.0    # Accessible sur le réseau local
"""

import argparse
import hashlib
import json
import os
import uuid
from datetime import date, datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import (Flask, jsonify, redirect, render_template,
                   request, session, url_for)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "setting-training-secret-2026")

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
DATA_DIR      = "/data" if os.path.isdir("/data") else BASE_DIR

STUDENTS_FILE = os.path.join(BASE_DIR, "students_config.json")
SIM_FILE      = os.path.join(DATA_DIR, "sim_sessions.json")
ACCOUNTS_FILE = os.path.join(DATA_DIR, "accounts.json")
ACTIVE_FILE    = os.path.join(DATA_DIR, "active_sessions.json")
FEEDBACK_FILE  = os.path.join(DATA_DIR, "feedback.json")

COACH_EMAIL    = os.environ.get("COACH_EMAIL", "leo")
COACH_PASSWORD = os.environ.get("COACH_PASSWORD", "coach2026")

# ── Import des données du simulateur ────────────────────────────────────────
from training_simulator import (
    NIVEAUX, NICHES, PERSONAS,
    build_prospect_system_prompt,
    get_prospect_reply,
    evaluate_session,
    sim_stats_eleve,
    load_sim_sessions,
    save_sim_session,
    pick_persona,
)


# ── Helpers fichiers ─────────────────────────────────────────────────────────

def load_students():
    if not os.path.exists(STUDENTS_FILE):
        return []
    with open(STUDENTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_accounts():
    if not os.path.exists(ACCOUNTS_FILE):
        return []
    with open(ACCOUNTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_accounts(accounts):
    with open(ACCOUNTS_FILE, "w", encoding="utf-8") as f:
        json.dump(accounts, f, ensure_ascii=False, indent=2)


def load_active():
    if not os.path.exists(ACTIVE_FILE):
        return {}
    try:
        with open(ACTIVE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_active(data):
    try:
        with open(ACTIVE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass


def clean_active(data):
    cutoff = (datetime.now() - timedelta(minutes=5)).isoformat()
    return {k: v for k, v in data.items() if v.get("last_ping", "") >= cutoff}


def load_feedback():
    if not os.path.exists(FEEDBACK_FILE):
        return []
    try:
        with open(FEEDBACK_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_feedback_item(item):
    items = load_feedback()
    items.append(item)
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def update_feedback_status(fb_id, statut):
    items = load_feedback()
    for item in items:
        if item["id"] == fb_id:
            item["statut"] = statut
            break
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    import anthropic
    return anthropic.Anthropic(api_key=api_key)


# ── Auth helpers ─────────────────────────────────────────────────────────────

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if session.get("coach_logged_in"):
                session["user_id"]    = "coach"
                session["user_nom"]   = "Coach"
                session["user_email"] = COACH_EMAIL
            else:
                return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def coach_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("coach_logged_in"):
            return redirect(url_for("coach_login"))
        return f(*args, **kwargs)
    return decorated


# ── Routes auth ──────────────────────────────────────────────────────────────

@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("index"))

    error = None
    if request.method == "POST":
        nom      = request.form.get("nom", "").strip()
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm  = request.form.get("confirm", "")

        if not nom or not email or not password:
            error = "Tous les champs sont obligatoires."
        elif password != confirm:
            error = "Les mots de passe ne correspondent pas."
        elif len(password) < 6:
            error = "Le mot de passe doit faire au moins 6 caractères."
        else:
            accounts = load_accounts()
            if any(a["email"] == email for a in accounts):
                error = "Cet email est déjà utilisé."
            else:
                account = {
                    "id":            str(uuid.uuid4())[:8],
                    "nom":           nom,
                    "email":         email,
                    "password_hash": hash_password(password),
                    "created_at":    datetime.now().isoformat(),
                    "statut":        "actif",
                }
                accounts.append(account)
                save_accounts(accounts)
                session["user_id"]    = account["id"]
                session["user_nom"]   = account["nom"]
                session["user_email"] = account["email"]
                return redirect(url_for("index"))

    return render_template("register.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("index"))

    error = None
    if request.method == "POST":
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        accounts = load_accounts()
        account  = next((a for a in accounts if a["email"] == email), None)

        if not account or account.get("password_hash") != hash_password(password):
            error = "Email ou mot de passe incorrect."
        else:
            session["user_id"]    = account["id"]
            session["user_nom"]   = account["nom"]
            session["user_email"] = account["email"]
            return redirect(url_for("index"))

    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Routes publiques (élèves) ────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    return render_template("index.html", niveaux=NIVEAUX, niches=NICHES)


@app.route("/start", methods=["POST"])
@login_required
def start_session():
    niche  = request.form.get("niche")
    niveau = int(request.form.get("niveau", 1))

    eleve = {
        "id":    session["user_id"],
        "nom":   session["user_nom"],
        "email": session.get("user_email", ""),
    }

    persona = pick_persona(niche, niveau)

    session["eleve"]        = eleve
    session["niche"]        = niche
    session["niveau"]       = niveau
    session["persona"]      = persona
    session["conversation"] = []
    session["api_messages"] = []
    session["start_time"]   = datetime.now().isoformat()
    session["session_id"]   = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{eleve['id']}"

    # Enregistrement session active (live tracking)
    active = clean_active(load_active())
    active[session["session_id"]] = {
        "eleve_nom":    eleve["nom"],
        "eleve_id":     eleve["id"],
        "niche":        niche,
        "niveau":       niveau,
        "niveau_label": NIVEAUX[niveau]["label"],
        "nb_messages":  0,
        "start_time":   session["start_time"],
        "last_ping":    datetime.now().isoformat(),
    }
    save_active(active)

    return redirect(url_for("chat"))


@app.route("/chat")
@login_required
def chat():
    if "eleve" not in session:
        return redirect(url_for("index"))
    eleve    = session["eleve"]
    niche    = session["niche"]
    niveau   = session["niveau"]
    persona  = session["persona"]
    niv_info = NIVEAUX[niveau]
    conv     = session.get("conversation", [])
    return render_template(
        "chat.html",
        eleve=eleve,
        niche=niche,
        niveau=niveau,
        niv_info=niv_info,
        persona=persona,
        conversation=conv,
    )


@app.route("/send", methods=["POST"])
def send_message():
    if "eleve" not in session:
        return jsonify({"error": "Session expirée"}), 401

    data    = request.get_json()
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Message vide"}), 400

    client = get_client()
    if not client:
        return jsonify({"error": "ANTHROPIC_API_KEY manquante — contacte ton coach"}), 503

    niche        = session["niche"]
    niveau       = session["niveau"]
    persona      = session["persona"]
    sys_prompt   = build_prospect_system_prompt(persona, niche, niveau)
    api_messages = session.get("api_messages", [])
    conversation = session.get("conversation", [])

    api_messages.append({"role": "user", "content": message})
    conversation.append({
        "role":    "eleve",
        "message": message,
        "heure":   datetime.now().strftime("%H:%M:%S"),
    })

    try:
        reply = get_prospect_reply(client, api_messages, sys_prompt)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    api_messages.append({"role": "assistant", "content": reply})
    conversation.append({
        "role":    "prospect",
        "message": reply,
        "heure":   datetime.now().strftime("%H:%M:%S"),
    })

    session["api_messages"] = api_messages
    session["conversation"]  = conversation
    session.modified = True

    # Ping session active
    sid = session.get("session_id")
    if sid:
        active = load_active()
        if sid in active:
            active[sid]["nb_messages"] = sum(1 for m in conversation if m["role"] == "eleve")
            active[sid]["last_ping"]   = datetime.now().isoformat()
            save_active(active)

    return jsonify({"reply": reply, "prenom": persona["prenom"]})


@app.route("/end", methods=["POST"])
@login_required
def end_session():
    if "eleve" not in session:
        return redirect(url_for("index"))

    client       = get_client()
    eleve        = session["eleve"]
    niche        = session["niche"]
    niveau       = session["niveau"]
    persona      = session["persona"]
    conversation = session.get("conversation", [])
    start_iso    = session.get("start_time", datetime.now().isoformat())
    session_id   = session.get("session_id", f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{eleve['id']}")

    if len(conversation) < 2:
        return redirect(url_for("index"))

    start_time = datetime.fromisoformat(start_iso)
    duree      = max(1, int((datetime.now() - start_time).total_seconds() / 60))
    nb_msgs    = sum(1 for m in conversation if m["role"] == "eleve")
    niv_info   = NIVEAUX[niveau]

    if client:
        try:
            scores = evaluate_session(client, conversation, eleve["nom"], niche, niveau, persona)
        except Exception:
            scores = _default_scores()
    else:
        scores = _default_scores()

    sim_session = {
        "id":                session_id,
        "eleve_id":          eleve["id"],
        "eleve_nom":         eleve["nom"],
        "date":              date.today().isoformat(),
        "heure":             start_time.strftime("%H:%M"),
        "niche":             niche,
        "niveau_difficulte": niveau,
        "niveau_label":      niv_info["label"],
        "duree_minutes":     duree,
        "nb_messages_eleve": nb_msgs,
        "scores": {
            "accroche":           scores.get("accroche", 5),
            "gestion_objections": scores.get("gestion_objections", 5),
            "qualification":      scores.get("qualification", 5),
            "rdv":                scores.get("rdv", 5),
            "naturel":            scores.get("naturel", 5),
            "global":             scores.get("score_global", 50),
        },
        "rdv_pose":          scores.get("rdv_pose", False),
        "points_forts":      scores.get("points_forts", []),
        "points_ameliorer":  scores.get("points_ameliorer", []),
        "conseil_principal": scores.get("conseil_principal", ""),
        "conversation":      conversation,
    }
    # Retrait de la session active
    active = load_active()
    active.pop(session_id, None)
    save_active(active)

    save_sim_session(sim_session)

    session["last_result"] = sim_session
    session.modified = True

    return redirect(url_for("results"))


@app.route("/results")
@login_required
def results():
    if "last_result" not in session:
        return redirect(url_for("index"))
    result   = session["last_result"]
    niv_info = NIVEAUX.get(result.get("niveau_difficulte", 1), NIVEAUX[1])
    return render_template("results.html", result=result, niv_info=niv_info)


# ── Routes coach ─────────────────────────────────────────────────────────────

@app.route("/coach/login", methods=["GET", "POST"])
def coach_login():
    if session.get("coach_logged_in"):
        return redirect(url_for("coach"))

    error = None
    if request.method == "POST":
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if (email == COACH_EMAIL.lower() and
                hash_password(password) == hash_password(COACH_PASSWORD)):
            session["coach_logged_in"] = True
            session["user_id"]         = "coach"
            session["user_nom"]        = "Coach"
            session["user_email"]      = COACH_EMAIL
            return redirect(url_for("coach"))
        else:
            error = "Identifiants incorrects."

    return render_template("coach_login.html", error=error)


@app.route("/coach/logout")
def coach_logout():
    for key in ("coach_logged_in", "user_id", "user_nom", "user_email"):
        session.pop(key, None)
    return redirect(url_for("coach_login"))


@app.context_processor
def inject_feedback_count():
    count = 0
    if session.get("coach_logged_in"):
        count = sum(1 for f in load_feedback() if f.get("statut") == "nouveau")
    return {"feedback_new_count": count}


@app.route("/coach")
@coach_required
def coach():
    accounts     = load_accounts()
    sim_sessions = load_sim_sessions()

    stats_list = []
    for eleve in accounts:
        ss = sim_stats_eleve(sim_sessions, eleve["id"])
        recent = sorted(
            [s for s in sim_sessions if s["eleve_id"] == eleve["id"]],
            key=lambda x: (x["date"], x["heure"]),
            reverse=True,
        )[:3]
        stats_list.append({
            "eleve":  eleve,
            "stats":  ss,
            "recent": recent,
        })

    total_sessions = sum(s["stats"]["nb"] for s in stats_list)
    total_rdv      = sum(
        s["stats"]["nb"] * s["stats"]["rdv_pct"] // 100
        for s in stats_list if s["stats"]["nb"] > 0
    )

    return render_template(
        "coach.html",
        stats_list=stats_list,
        niveaux=NIVEAUX,
        total_sessions=total_sessions,
        total_rdv=total_rdv,
    )


@app.route("/coach/eleve/<eleve_id>")
@coach_required
def coach_eleve(eleve_id):
    accounts     = load_accounts()
    sim_sessions = load_sim_sessions()

    eleve = next((a for a in accounts if a["id"] == eleve_id), None)
    if not eleve:
        return redirect(url_for("coach"))

    sessions_eleve = sorted(
        [s for s in sim_sessions if s["eleve_id"] == eleve_id],
        key=lambda x: (x["date"], x["heure"]),
        reverse=True,
    )
    stats = sim_stats_eleve(sim_sessions, eleve_id)
    return render_template(
        "coach_eleve.html",
        eleve=eleve,
        sessions=sessions_eleve,
        stats=stats,
        niveaux=NIVEAUX,
    )


@app.route("/coach/session/<session_id>")
@coach_required
def coach_session(session_id):
    sim_sessions = load_sim_sessions()
    s = next((x for x in sim_sessions if x["id"] == session_id), None)
    if not s:
        return redirect(url_for("coach"))
    niv_info = NIVEAUX.get(s.get("niveau_difficulte", 1), NIVEAUX[1])
    return render_template("coach_session.html", s=s, niv_info=niv_info)


@app.route("/feedback", methods=["GET", "POST"])
@login_required
def feedback():
    if request.method == "POST":
        if request.is_json:
            data    = request.get_json()
            fb_type = data.get("type", "autre")
            desc    = data.get("description", "").strip()
            page    = request.referrer or "non précisée"
        else:
            fb_type = request.form.get("type", "autre")
            desc    = request.form.get("description", "").strip()
            page    = request.form.get("page", "") or request.referrer or "non précisée"

        if desc:
            titre = (desc[:80] + "…") if len(desc) > 80 else desc
            item  = {
                "id":          f"fb_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}",
                "type":        fb_type,
                "titre":       titre,
                "description": desc,
                "page":        page,
                "user_id":     session.get("user_id", "?"),
                "user_nom":    session.get("user_nom", "Inconnu"),
                "date":        date.today().isoformat(),
                "heure":       datetime.now().strftime("%H:%M"),
                "statut":      "nouveau",
                "created_at":  datetime.now().isoformat(),
            }
            save_feedback_item(item)
            if request.is_json:
                return jsonify({"ok": True})
            return render_template("feedback.html", success=True)

        if request.is_json:
            return jsonify({"ok": False}), 400

    return render_template("feedback.html", success=False)


@app.route("/coach/feedbacks")
@coach_required
def coach_feedbacks():
    items = sorted(load_feedback(), key=lambda x: x.get("created_at", ""), reverse=True)
    return render_template("coach_feedbacks.html", items=items)


@app.route("/coach/feedback/<fb_id>/resolve", methods=["POST"])
@coach_required
def coach_feedback_resolve(fb_id):
    update_feedback_status(fb_id, "résolu")
    return redirect(url_for("coach_feedbacks"))


@app.route("/coach/feedback/<fb_id>/en-cours", methods=["POST"])
@coach_required
def coach_feedback_en_cours(fb_id):
    update_feedback_status(fb_id, "en_cours")
    return redirect(url_for("coach_feedbacks"))


@app.route("/api/dashboard")
@coach_required
def api_dashboard():
    accounts     = load_accounts()
    sim_sessions = load_sim_sessions()
    active       = clean_active(load_active())

    today       = date.today().isoformat()
    sess_today  = [s for s in sim_sessions if s.get("date") == today]
    rdv_today   = sum(1 for s in sess_today if s.get("rdv_pose"))
    avg_today   = (
        sum(s["scores"]["global"] for s in sess_today) // len(sess_today)
        if sess_today else 0
    )

    sorted_recent = sorted(
        sim_sessions,
        key=lambda x: (x.get("date", ""), x.get("heure", "")),
        reverse=True,
    )[:25]
    recent_light = [{
        "id":                s["id"],
        "eleve_id":          s.get("eleve_id", ""),
        "eleve_nom":         s.get("eleve_nom", ""),
        "date":              s.get("date", ""),
        "heure":             s.get("heure", ""),
        "niche":             s.get("niche", ""),
        "niveau_difficulte": s.get("niveau_difficulte", 1),
        "niveau_label":      s.get("niveau_label", ""),
        "score":             s.get("scores", {}).get("global", 0),
        "rdv_pose":          s.get("rdv_pose", False),
    } for s in sorted_recent]

    students       = []
    total_sessions = 0
    total_rdv      = 0
    for e in accounts:
        ss = sim_stats_eleve(sim_sessions, e["id"])
        students.append({"id": e["id"], "nom": e["nom"], "email": e["email"], "stats": ss})
        total_sessions += ss["nb"]
        total_rdv      += round(ss["nb"] * ss["rdv_pct"] / 100)

    return jsonify({
        "ts":             datetime.now().isoformat(),
        "active":         list(active.values()),
        "active_count":   len(active),
        "sessions_today": len(sess_today),
        "rdv_today":      rdv_today,
        "avg_today":      avg_today,
        "total_sessions": total_sessions,
        "total_rdv":      total_rdv,
        "recent":         recent_light,
        "students":       students,
    })


# ── Utilitaires ───────────────────────────────────────────────────────────────

def _default_scores():
    return {
        "accroche": 5, "gestion_objections": 5, "qualification": 5,
        "rdv": 5, "naturel": 5, "score_global": 50,
        "rdv_pose": False, "points_forts": [], "points_ameliorer": [],
        "conseil_principal": "Évaluation indisponible (clé API manquante).",
    }


# ── Filtres Jinja ─────────────────────────────────────────────────────────────

@app.template_filter("score_color")
def score_color(score):
    if score >= 75:
        return "#22c55e"
    elif score >= 55:
        return "#f59e0b"
    else:
        return "#ef4444"


@app.template_filter("score_label")
def score_label(score):
    if score >= 85:
        return "ELITE"
    elif score >= 70:
        return "EXCELLENT"
    elif score >= 55:
        return "BON"
    elif score >= 40:
        return "EN PROGRESSION"
    else:
        return "A TRAVAILLER"


@app.template_filter("prog_color")
def prog_color(prog):
    if prog > 0:
        return "#22c55e"
    elif prog < 0:
        return "#ef4444"
    return "#94a3b8"


# ── Lancement ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Interface web Setting Training")
    parser.add_argument("--host", default="0.0.0.0", help="Hôte (défaut: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=5000, help="Port (défaut: 5000)")
    parser.add_argument("--debug", action="store_true", help="Mode debug")
    args = parser.parse_args()
    print(f"\n  Simulateur Setting Training")
    print(f"  ->  http://localhost:{args.port}")
    print(f"  ->  Coach : http://localhost:{args.port}/coach\n")
    app.run(host=args.host, port=args.port, debug=args.debug)
