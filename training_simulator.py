"""
Simulateur d'entraînement Setting — Interface interactive
=========================================================
Les élèves s'entraînent à converser avec un prospect simulé par IA (Claude).
Chaque session est évaluée automatiquement et sauvegardée pour le suivi coach.

Usage :
  python training_simulator.py                    # Démarrer une session
  python training_simulator.py --eleve eleve_001  # Pré-sélectionner un élève
  python training_simulator.py --resume           # Résumé coach de toutes les sessions
  python training_simulator.py --resume --eleve eleve_001  # Résumé d'un élève
"""

import argparse
import json
import os
import sys
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv()

BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
STUDENTS_FILE  = os.path.join(BASE_DIR, "students_config.json")
SIM_FILE       = os.path.join(BASE_DIR, "sim_sessions.json")

SEP  = "=" * 68
SEP2 = "-" * 68

# ── Niveaux de difficulté ────────────────────────────────────────────────────
NIVEAUX = {
    1: {"label": "Facile",        "emoji": "🟢", "desc": "Prospect curieux et ouvert, peu d'objections"},
    2: {"label": "Intermédiaire", "emoji": "🟡", "desc": "Hésitant, objections classiques (temps, argent)"},
    3: {"label": "Difficile",     "emoji": "🔴", "desc": "Sceptique, méfiant, objections multiples"},
    4: {"label": "Expert",        "emoji": "⚫", "desc": "Très résistant, ferme, objections agressives"},
}

NICHES = ["reconversion", "emploi", "freelance", "etudiant", "revenus", "teletravail", "maman"]

# ── Personas par niche × niveau ──────────────────────────────────────────────
PERSONAS: dict[str, dict[int, dict]] = {
    "reconversion": {
        1: {"prenom": "Sophie", "age": 35, "situation": "employée grande distribution depuis 10 ans",
            "contexte": "Fatiguée de son travail, elle cherche activement une reconversion. Ouverte, curieuse, répond facilement.",
            "objections": []},
        2: {"prenom": "Marc", "age": 42, "situation": "technicien d'usine",
            "contexte": "Pense à changer mais a peur de perdre sa stabilité. Objections : 'j'ai pas le temps', 'j'sais pas si c'est pour moi'.",
            "objections": ["j'ai pas le temps", "je sais pas si c'est pour moi", "ça coûte combien ?"]},
        3: {"prenom": "Isabelle", "age": 38, "situation": "comptable salariée",
            "contexte": "Contactée des dizaines de fois par des 'formateurs'. Très méfiante, pose beaucoup de questions, dit 'encore une arnaque' au début.",
            "objections": ["encore une arnaque", "j'ai déjà essayé des formations", "prouve-moi que ça marche", "c'est quoi votre taux de réussite ?"]},
        4: {"prenom": "Patrick", "age": 50, "situation": "cadre licencié en reconversion forcée",
            "contexte": "En colère, méfiant au maximum. Voit chaque message comme une tentative de vente. Agressif, a perdu de l'argent dans des formations bidons.",
            "objections": ["laisse-moi tranquille", "j'ai déjà perdu de l'argent avec vos méthodes", "c'est du MLM ça", "non merci au revoir"]},
    },
    "emploi": {
        1: {"prenom": "Lucas", "age": 24, "situation": "fraîchement diplômé cherchant son premier emploi",
            "contexte": "Enthousiaste et ouvert. Répond vite, peu d'objections, juste des questions basiques.",
            "objections": []},
        2: {"prenom": "Fatima", "age": 29, "situation": "en recherche d'emploi depuis 3 mois",
            "contexte": "Motivée mais commence à douter. Demande des garanties de crédibilité avant de s'engager.",
            "objections": ["comment je sais que c'est sérieux ?", "j'ai pas trop le temps en ce moment", "c'est quoi comme domaine ?"]},
        3: {"prenom": "Julien", "age": 33, "situation": "en reconversion après plusieurs échecs",
            "contexte": "Sceptique, demande des preuves, des témoignages. Veut comprendre exactement avant de s'engager.",
            "objections": ["j'ai déjà essayé des trucs qui marchaient pas", "montre-moi des résultats concrets", "c'est quoi ton taux de placement ?", "je fais confiance à personne sur les réseaux"]},
        4: {"prenom": "Sandrine", "age": 45, "situation": "chômeuse depuis 1 an",
            "contexte": "Épuisée des promesses. Directe, presque agressive. Se méfie de tout ce qui ressemble à du recrutement ou coaching.",
            "objections": ["encore une arnaque", "j'ai plus envie d'essayer", "vous prenez l'argent des gens qui galèrent c'est honteux", "non"]},
    },
    "freelance": {
        1: {"prenom": "Antoine", "age": 27, "situation": "freelance débutant cherchant à développer son activité",
            "contexte": "Curieux, manque d'expérience, écoute bien. Peu d'objections.",
            "objections": []},
        2: {"prenom": "Claire", "age": 32, "situation": "graphiste freelance qui veut scaler",
            "contexte": "Gagne bien sa vie mais veut croître. Peur de perdre du temps avec des méthodes inefficaces.",
            "objections": ["j'ai pas le temps de me former", "c'est quoi le ROI concrètement ?", "j'ai déjà essayé des trucs et c'était décevant"]},
        3: {"prenom": "Romain", "age": 38, "situation": "développeur freelance très sollicité",
            "contexte": "Reçoit des dizaines de messages par semaine. Direct, peu patient, coupe vite si ça n'accroche pas.",
            "objections": ["encore un coach...", "je gère très bien tout seul", "j'ai pas besoin de ça", "c'est du bullshit les formations en ligne"]},
        4: {"prenom": "Nathalie", "age": 44, "situation": "consultante freelance aguerrie",
            "contexte": "Tout vu, tout essayé. Critique, déconstruit chaque argument, demande des chiffres précis. N'est impressionnée par rien.",
            "objections": ["donne-moi des données vérifiables", "j'ai essayé 5 programmes similaires", "prouve-moi que c'est différent", "c'est du marketing tout ça"]},
    },
    "etudiant": {
        1: {"prenom": "Léa", "age": 20, "situation": "étudiante BTS cherchant un job étudiant",
            "contexte": "Enthousiaste, naïve dans le bon sens. Répond vite, peu de questions.",
            "objections": []},
        2: {"prenom": "Hugo", "age": 22, "situation": "étudiant master cherchant un revenu complémentaire",
            "contexte": "Méfiant des arnaques MLM. Pose des questions directes sur légalité et rémunération.",
            "objections": ["c'est pas du MLM ça ?", "c'est légal ?", "combien on peut gagner vraiment ?", "j'ai pas beaucoup de temps avec mes cours"]},
        3: {"prenom": "Emma", "age": 23, "situation": "étudiante en droit, très analytique",
            "contexte": "Questionne tout, veut comprendre le modèle économique exact avant de s'intéresser.",
            "objections": ["c'est quoi votre modèle économique ?", "qui finance ça ?", "quelles sont vos obligations légales vis-à-vis des stagiaires ?", "j'ai besoin de voir les contrats"]},
        4: {"prenom": "Théo", "age": 25, "situation": "doctorant aux positions arrêtées",
            "contexte": "Intellectuellement très exigeant. Contre le marketing de réseau, prêt à débattre de l'éthique de la démarche.",
            "objections": ["c'est de l'exploitation", "vous capitalisez sur la précarité des étudiants", "non merci", "je trouve ça problématique éthiquement"]},
    },
    "revenus": {
        1: {"prenom": "Julie", "age": 31, "situation": "salariée cherchant un complément de revenus",
            "contexte": "Ouverte à toute idée sérieuse. Répond facilement, peu d'objections.",
            "objections": []},
        2: {"prenom": "David", "age": 36, "situation": "père de famille cherchant à arrondir les fins de mois",
            "contexte": "Motivé mais manque de temps. Méfiant des arnaques, veut du concret.",
            "objections": ["j'ai pas beaucoup de temps libre", "c'est pas une arnaque ?", "combien il faut investir ?"]},
        3: {"prenom": "Karine", "age": 40, "situation": "divorcée cherchant autonomie financière",
            "contexte": "A essayé plusieurs side hustles qui ont échoué. Méfiante, demande des preuves.",
            "objections": ["j'ai déjà essayé et perdu de l'argent", "comment je sais que c'est pas pareil ?", "t'as des témoignages vérifiables ?"]},
        4: {"prenom": "Bruno", "age": 48, "situation": "cadre supérieur cynique",
            "contexte": "Connaît très bien les techniques de vente. Déconstruit tout, ne croit en rien.",
            "objections": ["je connais vos techniques", "c'est du storytelling tout ça", "non merci", "j'ai pas besoin de ça"]},
    },
    "teletravail": {
        1: {"prenom": "Amandine", "age": 28, "situation": "salariée qui veut télétravailler à 100%",
            "contexte": "Très motivée à l'idée de travailler depuis chez elle. Ouverte et enthousiaste.",
            "objections": []},
        2: {"prenom": "Nicolas", "age": 34, "situation": "salarié en télétravail partiel",
            "contexte": "Veut aller vers 100% remote mais ne sait pas comment. Quelques doutes sur la faisabilité.",
            "objections": ["mon employeur acceptera jamais", "j'ai peur de perdre mon poste", "c'est possible dans mon secteur ?"]},
        3: {"prenom": "Pauline", "age": 39, "situation": "RH ayant refusé des demandes de remote",
            "contexte": "Connaît bien les arguments côté employeur. Sceptique sur les solutions proposées.",
            "objections": ["c'est pas si simple", "j'ai déjà essayé de négocier", "les entreprises acceptent pas facilement"]},
        4: {"prenom": "Gérard", "age": 52, "situation": "manager 'old school'",
            "contexte": "Ne croit pas au télétravail, préfère le présentiel. Résiste fortement.",
            "objections": ["le télétravail ça marche pas", "j'ai besoin de voir mes équipes", "c'est une mode ça va passer", "non"]},
    },
    "maman": {
        1: {"prenom": "Céline", "age": 33, "situation": "maman au foyer qui veut reprendre une activité",
            "contexte": "Motivée, cherche quelque chose de flexible. Très ouverte aux propositions.",
            "objections": []},
        2: {"prenom": "Stéphanie", "age": 37, "situation": "maman salariée à mi-temps",
            "contexte": "Veut plus d'indépendance mais a peur de l'instabilité financière.",
            "objections": ["j'ai les enfants à gérer", "c'est compatible avec les horaires scolaires ?", "j'ai peur de pas y arriver"]},
        3: {"prenom": "Valérie", "age": 42, "situation": "maman ayant essayé plusieurs formations en ligne",
            "contexte": "A déjà investi dans des formations sans résultats. Méfiante et déçue.",
            "objections": ["j'ai déjà payé pour des formations qui m'ont rien apporté", "prouve-moi que c'est différent", "c'est encore des promesses ?"]},
        4: {"prenom": "Michèle", "age": 46, "situation": "maman très sceptique des offres en ligne",
            "contexte": "Son mari lui a interdit d'acheter d'autres formations. Fermée, méfiante, dit non rapidement.",
            "objections": ["non merci", "j'ai plus le droit d'acheter des formations", "c'est encore une arnaque", "laissez-moi tranquille"]},
    },
}


# ── Chargement / Sauvegarde ──────────────────────────────────────────────────

def load_students() -> list[dict]:
    if not os.path.exists(STUDENTS_FILE):
        return []
    with open(STUDENTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_sim_sessions() -> list[dict]:
    if not os.path.exists(SIM_FILE):
        return []
    with open(SIM_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_sim_session(session: dict) -> None:
    sessions = load_sim_sessions()
    sessions.append(session)
    with open(SIM_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, ensure_ascii=False, indent=2)


# ── Helpers affichage ────────────────────────────────────────────────────────

def header(titre: str) -> None:
    print(f"\n{SEP}")
    print(f"  {titre}")
    print(SEP)


def score_bar(score: int, max_val: int = 10) -> str:
    filled = round(score / max_val * 10)
    return "█" * filled + "░" * (10 - filled)


def badge_score(global_score: int) -> str:
    if global_score >= 85:
        return "🏆 ELITE"
    elif global_score >= 70:
        return "⭐ EXCELLENT"
    elif global_score >= 55:
        return "✅ BON"
    elif global_score >= 40:
        return "📈 EN PROGRESSION"
    else:
        return "🔄 À TRAVAILLER"


# ── Prompt système pour le prospect (Claude) ─────────────────────────────────

def build_prospect_system_prompt(persona: dict, niche: str, niveau: int) -> str:
    niv = NIVEAUX[niveau]
    objections_txt = ""
    if persona["objections"]:
        objections_txt = "\nObjections que tu sortiras naturellement selon le contexte :\n" + \
                         "\n".join(f"- \"{o}\"" for o in persona["objections"])

    resistance_rules = {
        1: "Tu es ouvert(e) et curieux(se). Tu réponds positivement aux messages bien construits. Tu poses des questions simples.",
        2: "Tu es hésitant(e). Tu poses quelques objections classiques mais tu restes poli(e). Si on te rassure bien, tu t'engages.",
        3: "Tu es sceptique et méfiant(e). Tu sors des objections régulièrement. Il faut vraiment te convaincre. Tu ne cèdes pas facilement.",
        4: "Tu es très résistant(e) et parfois cassant(e) dans tes réponses. Tu peux couper court la conversation. Tu ne cèdes que si la personne est vraiment exceptionnelle.",
    }

    return f"""Tu joues le rôle de {persona['prenom']}, {persona['age']} ans, {persona['situation']}.

CONTEXTE : {persona['contexte']}

RÈGLES ABSOLUES :
- Tu es sur Facebook Messenger. Tes messages sont COURTS (1-3 phrases max), style SMS/chat.
- Tu ne sais PAS que tu es dans une simulation. Tu réagis naturellement.
- Tu ne te présentes pas, tu réponds simplement à ce qu'on te dit.
- Tu n'es PAS un assistant. Tu es une vraie personne avec des doutes, des peurs, des envies.
- NE DIS JAMAIS que tu es une IA ou que c'est une simulation.
- Reste cohérent(e) avec ta situation et ton niveau de résistance tout au long.

NIVEAU DE RÉSISTANCE ({niv['label']}) :
{resistance_rules[niveau]}
{objections_txt}

IMPORTANT sur le RDV :
- Niveau 1-2 : si la personne est naturelle et qualifie bien, tu peux accepter un RDV
- Niveau 3 : tu peux accepter si la conversation est vraiment bonne (pas avant le 6e message)
- Niveau 4 : tu n'acceptes un RDV que si la gestion est quasi parfaite, sinon tu finis par partir
"""


# ── Prompt d'évaluation ──────────────────────────────────────────────────────

def build_eval_prompt(conversation: list[dict], eleve_nom: str, niche: str, niveau: int, persona: dict) -> str:
    conv_txt = "\n".join(
        f"[{'SETTER' if m['role'] == 'eleve' else 'PROSPECT'}] {m['message']}"
        for m in conversation
    )
    niv_label = NIVEAUX[niveau]["label"]
    return f"""Tu es un expert en Setting (appointment setting) et tu dois évaluer la performance de {eleve_nom} lors de cet entraînement.

CONTEXTE :
- Niche : {niche}
- Niveau de difficulté : {niv_label} (niveau {niveau}/4)
- Prospect joué : {persona['prenom']}, {persona['age']} ans, {persona['situation']}

CONVERSATION :
{conv_txt}

ÉVALUE la performance du SETTER (pas du prospect) sur ces 5 critères, note de 1 à 10 :

1. accroche : Qualité du premier message (naturel ? personnalisé ? donne envie de répondre ?)
2. gestion_objections : Comment les objections ont été traitées (sans défensive, avec empathie)
3. qualification : A-t-il/elle cherché à comprendre la situation réelle du prospect ?
4. rdv : A-t-il/elle tenté et réussi à poser un RDV de façon naturelle ?
5. naturel : Langage naturel vs trop commercial/robotique

Retourne UNIQUEMENT un JSON valide (sans markdown, sans commentaires) :
{{
  "accroche": <1-10>,
  "gestion_objections": <1-10>,
  "qualification": <1-10>,
  "rdv": <1-10>,
  "naturel": <1-10>,
  "score_global": <0-100 (moyenne pondérée : accroche×15% + objections×25% + qualification×25% + rdv×20% + naturel×15%)>,
  "rdv_pose": <true|false>,
  "points_forts": ["...", "..."],
  "points_ameliorer": ["...", "..."],
  "conseil_principal": "..."
}}"""


# ── Appels Claude ────────────────────────────────────────────────────────────

def get_prospect_reply(client, messages: list[dict], system_prompt: str) -> str:
    import anthropic
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text.strip()


def evaluate_session(client, conversation: list[dict], eleve_nom: str,
                     niche: str, niveau: int, persona: dict) -> dict:
    import anthropic
    prompt = build_eval_prompt(conversation, eleve_nom, niche, niveau, persona)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    # Nettoyer si besoin (markdown code block)
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ── Session de chat interactive ──────────────────────────────────────────────

def run_chat_session(client, eleve: dict, niche: str, niveau: int) -> None:
    persona   = PERSONAS.get(niche, PERSONAS["reconversion"]).get(niveau, PERSONAS["reconversion"][1])
    niv_info  = NIVEAUX[niveau]
    sys_prompt = build_prospect_system_prompt(persona, niche, niveau)

    header(f"SESSION D'ENTRAÎNEMENT — {eleve['nom'].upper()}")
    print(f"\n  Niche       : {niche}")
    print(f"  Difficulté  : {niv_info['emoji']} {niv_info['label']}  — {niv_info['desc']}")
    print(f"\n  PROSPECT : {persona['prenom']}, {persona['age']} ans")
    print(f"  Situation  : {persona['situation']}")
    print(f"\n  {SEP2}")
    print("  RÈGLES :")
    print("  • Tape ton message et appuie sur ENTRÉE pour l'envoyer")
    print("  • /fin   → terminer la session et obtenir ton évaluation")
    print("  • /aide  → afficher des conseils rapides")
    print(f"  {SEP2}\n")

    api_messages: list[dict] = []
    conversation: list[dict] = []
    start_time = datetime.now()

    while True:
        try:
            user_input = input("🎯 [TOI] ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n  Session interrompue.")
            break

        if not user_input:
            continue

        if user_input.lower() == "/aide":
            print("\n  ── CONSEILS RAPIDES ──────────────────────────────────────")
            print("  1. Commence par une accroche personnalisée (pas générique)")
            print("  2. Pose des questions sur SA situation avant de parler de toi")
            print("  3. Utilise l'écoute active : reformule ce qu'il/elle dit")
            print("  4. Face aux objections : empathie d'abord, réponse ensuite")
            print("  5. Propose le RDV naturellement quand le moment est venu")
            print("  ──────────────────────────────────────────────────────────\n")
            continue

        if user_input.lower() == "/fin":
            break

        # Envoyer au prospect
        api_messages.append({"role": "user", "content": user_input})
        conversation.append({
            "role": "eleve",
            "message": user_input,
            "heure": datetime.now().strftime("%H:%M:%S"),
        })

        try:
            reply = get_prospect_reply(client, api_messages, sys_prompt)
        except Exception as e:
            print(f"\n  [ERREUR API] {e}\n")
            break

        api_messages.append({"role": "assistant", "content": reply})
        conversation.append({
            "role": "prospect",
            "message": reply,
            "heure": datetime.now().strftime("%H:%M:%S"),
        })
        print(f"\n👤 [{persona['prenom'].upper()}] {reply}\n")

    if len(conversation) < 2:
        print("  Session trop courte, non sauvegardée.")
        return

    # ── Évaluation ────────────────────────────────────────────────────────────
    duree = int((datetime.now() - start_time).total_seconds() / 60)
    nb_messages_eleve = sum(1 for m in conversation if m["role"] == "eleve")

    print(f"\n{SEP}")
    print("  ÉVALUATION DE LA SESSION EN COURS…")
    print(SEP)

    try:
        scores = evaluate_session(client, conversation, eleve["nom"], niche, niveau, persona)
    except Exception as e:
        print(f"  [ERREUR évaluation] {e}")
        scores = {
            "accroche": 5, "gestion_objections": 5, "qualification": 5,
            "rdv": 5, "naturel": 5, "score_global": 50,
            "rdv_pose": False, "points_forts": [], "points_ameliorer": [],
            "conseil_principal": "Évaluation indisponible.",
        }

    # ── Affichage résultats ───────────────────────────────────────────────────
    rdv_icon = "✅ RDV POSÉ !" if scores.get("rdv_pose") else "❌ Pas de RDV"
    global_s  = scores.get("score_global", 0)

    print(f"\n  {SEP2}")
    print(f"  RÉSULTATS  —  {badge_score(global_s)}  |  {rdv_icon}")
    print(f"  {SEP2}")
    print(f"  Score global        : {global_s}/100  [{score_bar(global_s, 100)}]")
    print(f"  {SEP2}")
    for key, label in [
        ("accroche",            "Accroche         "),
        ("gestion_objections",  "Gestion objections"),
        ("qualification",       "Qualification     "),
        ("rdv",                 "Prise de RDV      "),
        ("naturel",             "Naturel / Flow    "),
    ]:
        v = scores.get(key, 0)
        print(f"  {label} : {v:2}/10  [{score_bar(v)}]")

    if scores.get("points_forts"):
        print(f"\n  ✅ POINTS FORTS :")
        for p in scores["points_forts"]:
            print(f"     • {p}")

    if scores.get("points_ameliorer"):
        print(f"\n  📈 À AMÉLIORER :")
        for p in scores["points_ameliorer"]:
            print(f"     • {p}")

    if scores.get("conseil_principal"):
        print(f"\n  💡 CONSEIL PRINCIPAL :")
        print(f"     {scores['conseil_principal']}")

    print(f"\n  Durée : {duree} min  |  Tes messages : {nb_messages_eleve}\n")

    # ── Sauvegarde ────────────────────────────────────────────────────────────
    session_id = f"sim_{start_time.strftime('%Y%m%d_%H%M%S')}_{eleve['id']}"
    session = {
        "id":              session_id,
        "eleve_id":        eleve["id"],
        "eleve_nom":       eleve["nom"],
        "date":            date.today().isoformat(),
        "heure":           start_time.strftime("%H:%M"),
        "niche":           niche,
        "niveau_difficulte": niveau,
        "niveau_label":    niv_info["label"],
        "duree_minutes":   duree,
        "nb_messages_eleve": nb_messages_eleve,
        "scores": {
            "accroche":           scores.get("accroche", 0),
            "gestion_objections": scores.get("gestion_objections", 0),
            "qualification":      scores.get("qualification", 0),
            "rdv":                scores.get("rdv", 0),
            "naturel":            scores.get("naturel", 0),
            "global":             global_s,
        },
        "rdv_pose":           scores.get("rdv_pose", False),
        "points_forts":       scores.get("points_forts", []),
        "points_ameliorer":   scores.get("points_ameliorer", []),
        "conseil_principal":  scores.get("conseil_principal", ""),
        "conversation":       conversation,
    }
    save_sim_session(session)
    print(f"  ✓ Session sauvegardée (ID : {session_id})")


# ── Vue résumé coach ─────────────────────────────────────────────────────────

def resume_coach(students: list[dict], sessions: list[dict], eleve_id: str = None) -> None:
    if eleve_id:
        sessions = [s for s in sessions if s["eleve_id"] == eleve_id]
        titre = f"RÉSUMÉ SIMULATIONS — {eleve_id.upper()}"
    else:
        titre = "RÉSUMÉ SIMULATIONS — TOUS LES ÉLÈVES"

    header(titre)

    if not sessions:
        print("  Aucune session de simulation enregistrée.\n")
        return

    # Regrouper par élève
    by_eleve: dict[str, list] = {}
    for s in sessions:
        by_eleve.setdefault(s["eleve_id"], []).append(s)

    print(f"  {'ÉLÈVE':<22} {'SESSIONS':<10} {'SCORE MOY':<12} {'MEILLEUR':<10} {'PROGRESSION':<14} {'RDV%'}")
    print(SEP2)

    for eid, esessions in by_eleve.items():
        eleve = next((e for e in students if e["id"] == eid), None)
        nom   = eleve["nom"] if eleve else eid
        scores_globaux = [s["scores"]["global"] for s in esessions]
        moy    = round(sum(scores_globaux) / len(scores_globaux))
        best   = max(scores_globaux)
        prog   = scores_globaux[-1] - scores_globaux[0] if len(scores_globaux) > 1 else 0
        prog_s = f"+{prog}" if prog > 0 else str(prog)
        rdv_ok = sum(1 for s in esessions if s.get("rdv_pose"))
        rdv_pct = round(rdv_ok / len(esessions) * 100)
        print(
            f"  {nom:<22} {len(esessions):<10} {moy}/100{'':<5} {best}/100{'':<3} "
            f"{prog_s:>+5} pts{'':<5} {rdv_pct}%"
        )

    # ── Détail par élève si filtré ─────────────────────────────────────────
    if eleve_id and sessions:
        print(f"\n  {SEP2}")
        print("  DÉTAIL DES SESSIONS")
        print(f"  {SEP2}")
        print(f"  {'DATE':<12} {'NICHE':<14} {'NIV':<14} {'SCORE':<8} {'RDV':<6} CONSEIL")
        for s in sorted(sessions, key=lambda x: x["date"]):
            rdv_ic = "✅" if s.get("rdv_pose") else "❌"
            conseil = s.get("conseil_principal", "")[:40] + ("…" if len(s.get("conseil_principal","")) > 40 else "")
            niv_emoji = NIVEAUX.get(s.get("niveau_difficulte", 1), NIVEAUX[1])["emoji"]
            print(
                f"  {s['date']:<12} {s['niche']:<14} "
                f"{niv_emoji} {s.get('niveau_label',''):<12} "
                f"{s['scores']['global']}/100  {rdv_ic}     {conseil}"
            )
    print()


# ── Sélecteurs interactifs ────────────────────────────────────────────────────

def choisir_eleve(students: list[dict]) -> dict | None:
    actifs = [e for e in students if e.get("statut") == "actif"]
    if not actifs:
        print("  Aucun élève actif dans students_config.json")
        return None
    print("\n  Élèves disponibles :")
    for i, e in enumerate(actifs, 1):
        print(f"    {i}. {e['nom']}  ({e['niveau']} — {e['niche']})")
    try:
        idx = int(input("\n  Ton numéro : ")) - 1
        if 0 <= idx < len(actifs):
            return actifs[idx]
    except (ValueError, KeyboardInterrupt):
        pass
    print("  Choix invalide.")
    return None


def choisir_niche(defaut: str = None) -> str:
    print(f"\n  Niches disponibles :")
    for i, n in enumerate(NICHES, 1):
        print(f"    {i}. {n}")
    if defaut:
        print(f"  (Défaut : {defaut} — appuie sur ENTRÉE)")
    try:
        val = input("  Choix (numéro ou nom) : ").strip()
        if not val and defaut:
            return defaut
        if val.isdigit() and 1 <= int(val) <= len(NICHES):
            return NICHES[int(val) - 1]
        if val.lower() in NICHES:
            return val.lower()
    except (ValueError, KeyboardInterrupt):
        pass
    return defaut or NICHES[0]


def choisir_niveau() -> int:
    print("\n  Niveaux de difficulté :")
    for n, info in NIVEAUX.items():
        print(f"    {n}. {info['emoji']} {info['label']}  — {info['desc']}")
    try:
        val = int(input("  Choix (1-4) : "))
        if 1 <= val <= 4:
            return val
    except (ValueError, KeyboardInterrupt):
        pass
    return 1


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Simulateur d'entraînement Setting — Élèves"
    )
    parser.add_argument("--eleve",  metavar="ID", help="ID de l'élève (ex: eleve_001)")
    parser.add_argument("--resume", action="store_true", help="Afficher le résumé coach")
    args = parser.parse_args()

    students = load_students()
    sessions = load_sim_sessions()

    # ── Mode résumé coach ─────────────────────────────────────────────────────
    if args.resume:
        resume_coach(students, sessions, eleve_id=args.eleve)
        return

    # ── Mode entraînement ─────────────────────────────────────────────────────
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n  [ERREUR] ANTHROPIC_API_KEY introuvable.")
        print("  Ajoute-la dans un fichier .env : ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
    except ImportError:
        print("  [ERREUR] Le package 'anthropic' n'est pas installé.")
        print("  Lance : pip install anthropic")
        sys.exit(1)

    header("SIMULATEUR D'ENTRAÎNEMENT SETTING")
    print("  Bienvenue ! Tu vas t'entraîner à prospecter un contact simulé par IA.")
    print("  La conversation est évaluée automatiquement à la fin.\n")

    # Choisir l'élève
    if args.eleve:
        eleve = next((e for e in students if e["id"] == args.eleve), None)
        if not eleve:
            print(f"  Élève '{args.eleve}' introuvable.")
            sys.exit(1)
    else:
        eleve = choisir_eleve(students)
        if not eleve:
            sys.exit(1)

    print(f"\n  Bonjour {eleve['nom']} ! 👋")

    # Choisir niche et niveau
    niche  = choisir_niche(defaut=eleve.get("niche"))
    niveau = choisir_niveau()

    # Lancer la session
    run_chat_session(client, eleve, niche, niveau)


if __name__ == "__main__":
    main()
