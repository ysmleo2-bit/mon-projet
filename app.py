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
import json
import os
import uuid
from datetime import date, datetime

from dotenv import load_dotenv
from flask import (Flask, jsonify, redirect, render_template,
                   request, session, url_for)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "setting-training-secret-2026")

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
STUDENTS_FILE = os.path.join(BASE_DIR, "students_config.json")
SIM_FILE      = os.path.join(BASE_DIR, "sim_sessions.json")

# ── Import des données du simulateur ────────────────────────────────────────
from training_simulator import (
    NIVEAUX, NICHES, PERSONAS,
    build_prospect_system_prompt,
    get_prospect_reply,
    evaluate_session,
    sim_stats_eleve,
    load_sim_sessions,
    save_sim_session,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_students() -> list[dict]:
    if not os.path.exists(STUDENTS_FILE):
        return []
    with open(STUDENTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    import anthropic
    return anthropic.Anthropic(api_key=api_key)


# ── Routes publiques (élèves) ────────────────────────────────────────────────

@app.route("/")
def index():
    students = load_students()
    actifs = [e for e in students if e.get("statut") == "actif"]
    return render_template("index.html", students=actifs, niveaux=NIVEAUX, niches=NICHES)


@app.route("/start", methods=["POST"])
def start_session():
    eleve_id = request.form.get("eleve_id")
    niche    = request.form.get("niche")
    niveau   = int(request.form.get("niveau", 1))

    students = load_students()
    eleve = next((e for e in students if e["id"] == eleve_id), None)
    if not eleve:
        return redirect(url_for("index"))

    persona = PERSONAS.get(niche, PERSONAS["reconversion"]).get(niveau, PERSONAS["reconversion"][1])

    session["eleve"]       = eleve
    session["niche"]       = niche
    session["niveau"]      = niveau
    session["persona"]     = persona
    session["conversation"] = []
    session["api_messages"] = []
    session["start_time"]  = datetime.now().isoformat()
    session["session_id"]  = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{eleve_id}"

    return redirect(url_for("chat"))


@app.route("/chat")
def chat():
    if "eleve" not in session:
        return redirect(url_for("index"))
    eleve   = session["eleve"]
    niche   = session["niche"]
    niveau  = session["niveau"]
    persona = session["persona"]
    niv_info = NIVEAUX[niveau]
    conv    = session.get("conversation", [])
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

    niche   = session["niche"]
    niveau  = session["niveau"]
    persona = session["persona"]
    sys_prompt   = build_prospect_system_prompt(persona, niche, niveau)
    api_messages = session.get("api_messages", [])
    conversation = session.get("conversation", [])

    # Ajouter le message élève
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

    return jsonify({"reply": reply, "prenom": persona["prenom"]})


@app.route("/end", methods=["POST"])
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

    # Évaluation
    if client:
        try:
            scores = evaluate_session(client, conversation, eleve["nom"], niche, niveau, persona)
        except Exception:
            scores = _default_scores()
    else:
        scores = _default_scores()

    # Sauvegarder
    sim_session = {
        "id":              session_id,
        "eleve_id":        eleve["id"],
        "eleve_nom":       eleve["nom"],
        "date":            date.today().isoformat(),
        "heure":           start_time.strftime("%H:%M"),
        "niche":           niche,
        "niveau_difficulte": niveau,
        "niveau_label":    niv_info["label"],
        "duree_minutes":   duree,
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
    save_sim_session(sim_session)

    # Stocker les résultats pour la page de résultats
    session["last_result"] = sim_session
    session.modified = True

    return redirect(url_for("results"))


@app.route("/results")
def results():
    if "last_result" not in session:
        return redirect(url_for("index"))
    result   = session["last_result"]
    niv_info = NIVEAUX.get(result.get("niveau_difficulte", 1), NIVEAUX[1])
    return render_template("results.html", result=result, niv_info=niv_info)


# ── Routes coach ─────────────────────────────────────────────────────────────

@app.route("/coach")
def coach():
    students     = load_students()
    sim_sessions = load_sim_sessions()
    actifs       = [e for e in students if e.get("statut") == "actif"]

    stats_list = []
    for eleve in actifs:
        ss = sim_stats_eleve(sim_sessions, eleve["id"])
        # Sessions récentes de cet élève
        recent = sorted(
            [s for s in sim_sessions if s["eleve_id"] == eleve["id"]],
            key=lambda x: (x["date"], x["heure"]),
            reverse=True
        )[:3]
        stats_list.append({
            "eleve":  eleve,
            "stats":  ss,
            "recent": recent,
        })

    # Totaux globaux
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
def coach_eleve(eleve_id):
    students     = load_students()
    sim_sessions = load_sim_sessions()
    eleve = next((e for e in students if e["id"] == eleve_id), None)
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
def coach_session(session_id):
    sim_sessions = load_sim_sessions()
    s = next((x for x in sim_sessions if x["id"] == session_id), None)
    if not s:
        return redirect(url_for("coach"))
    niv_info = NIVEAUX.get(s.get("niveau_difficulte", 1), NIVEAUX[1])
    return render_template("coach_session.html", s=s, niv_info=niv_info)


# ── Utilitaires ───────────────────────────────────────────────────────────────

def _default_scores() -> dict:
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
        return "ELITE 🏆"
    elif score >= 70:
        return "EXCELLENT ⭐"
    elif score >= 55:
        return "BON ✅"
    elif score >= 40:
        return "EN PROGRESSION 📈"
    else:
        return "À TRAVAILLER 🔄"


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
    print(f"\n  🚀 Interface Setting Training démarrée")
    print(f"  ➜  http://localhost:{args.port}")
    print(f"  ➜  Coach : http://localhost:{args.port}/coach\n")
    app.run(host=args.host, port=args.port, debug=args.debug)
