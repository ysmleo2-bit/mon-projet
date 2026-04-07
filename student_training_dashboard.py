"""
Tableau de bord d'entraînement Setting — Élèves
================================================
Suivi des performances, objectifs et progression de chaque élève en setting.

Usage :
  python student_training_dashboard.py                  # Vue globale
  python student_training_dashboard.py --eleve eleve_001  # Vue détaillée élève
  python student_training_dashboard.py --ajouter-session  # Saisir une session
  python student_training_dashboard.py --ajouter-eleve    # Ajouter un élève
"""

import argparse
import json
import os
from datetime import datetime, date, timedelta
from typing import Optional

# ── Chemins des fichiers ─────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
STUDENTS_FILE   = os.path.join(BASE_DIR, "students_config.json")
SESSIONS_FILE   = os.path.join(BASE_DIR, "training_sessions.json")
SIM_FILE        = os.path.join(BASE_DIR, "sim_sessions.json")

# ── Niveaux et seuils ────────────────────────────────────────────────────────
NIVEAUX = {
    "debutant":      {"label": "Débutant",      "emoji": "🌱", "min_rdv": 0,  "max_rdv": 3},
    "intermediaire": {"label": "Intermédiaire", "emoji": "🔥", "min_rdv": 4,  "max_rdv": 6},
    "avance":        {"label": "Avancé",        "emoji": "⚡", "min_rdv": 7,  "max_rdv": 99},
}

NICHES = ["reconversion", "emploi", "freelance", "etudiant", "revenus", "teletravail", "maman"]

SCRIPTS_DISPONIBLES = {
    "reconversion": ["script_reconversion_v1", "script_reconversion_v2", "script_reconversion_v3"],
    "emploi":       ["script_emploi_v1", "script_emploi_v2", "script_emploi_v3"],
    "freelance":    ["script_freelance_v1", "script_freelance_v2", "script_freelance_v3"],
    "etudiant":     ["script_etudiant_v1", "script_etudiant_v2"],
    "revenus":      ["script_revenus_v1", "script_revenus_v2"],
    "teletravail":  ["script_teletravail_v1"],
    "maman":        ["script_maman_v1", "script_maman_v2"],
}


# ── Chargement / sauvegarde ──────────────────────────────────────────────────

def load_students() -> list[dict]:
    if not os.path.exists(STUDENTS_FILE):
        return []
    with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_students(students: list[dict]) -> None:
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(students, f, ensure_ascii=False, indent=2)


def load_sim_sessions() -> list[dict]:
    if not os.path.exists(SIM_FILE):
        return []
    with open(SIM_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_sessions() -> list[dict]:
    if not os.path.exists(SESSIONS_FILE):
        return []
    with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_sessions(sessions: list[dict]) -> None:
    with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, ensure_ascii=False, indent=2)


# ── Calculs / métriques ──────────────────────────────────────────────────────

def sessions_eleve(sessions: list[dict], eleve_id: str) -> list[dict]:
    return [s for s in sessions if s["eleve_id"] == eleve_id]


def stats_periode(sessions: list[dict], eleve_id: str, jours: int = 7) -> dict:
    cutoff = (date.today() - timedelta(days=jours)).isoformat()
    recent = [
        s for s in sessions
        if s["eleve_id"] == eleve_id and s["date"] >= cutoff
    ]
    if not recent:
        return {
            "jours_actifs": 0, "messages": 0, "reponses": 0,
            "rdv_poses": 0, "rdv_honores": 0,
            "taux_reponse": 0.0, "taux_conversion": 0.0, "taux_honore": 0.0,
        }
    messages   = sum(s["messages_envoyes"]    for s in recent)
    reponses   = sum(s["reponses_obtenues"]   for s in recent)
    rdv_poses  = sum(s["rdv_poses"]           for s in recent)
    rdv_honores= sum(s["rdv_honores"]         for s in recent)
    return {
        "jours_actifs":     len(recent),
        "messages":         messages,
        "reponses":         reponses,
        "rdv_poses":        rdv_poses,
        "rdv_honores":      rdv_honores,
        "taux_reponse":     round(reponses    / messages  * 100, 1) if messages  else 0.0,
        "taux_conversion":  round(rdv_poses   / reponses  * 100, 1) if reponses  else 0.0,
        "taux_honore":      round(rdv_honores / rdv_poses * 100, 1) if rdv_poses else 0.0,
    }


def progression_niveau(eleve: dict, stats: dict) -> str:
    """Retourne une barre de progression vers le niveau suivant."""
    niveau = eleve.get("niveau", "debutant")
    objectif = eleve.get("objectif_rdv_jour", 3)
    rdv_moy = stats["rdv_poses"] / max(stats["jours_actifs"], 1)
    pct = min(int(rdv_moy / objectif * 100), 100) if objectif else 0
    blocs = pct // 10
    barre = "█" * blocs + "░" * (10 - blocs)
    return f"[{barre}] {pct}%"


def sim_stats_eleve(sim_sessions: list[dict], eleve_id: str) -> dict:
    ss = [s for s in sim_sessions if s["eleve_id"] == eleve_id]
    if not ss:
        return {"nb": 0, "score_moy": 0, "meilleur": 0, "progression": 0,
                "rdv_pct": 0, "niv_moy": 0}
    scores = [s["scores"]["global"] for s in ss]
    rdv_ok = sum(1 for s in ss if s.get("rdv_pose"))
    niveaux = [s.get("niveau_difficulte", 1) for s in ss]
    prog    = scores[-1] - scores[0] if len(scores) > 1 else 0
    return {
        "nb":          len(ss),
        "score_moy":   round(sum(scores) / len(scores)),
        "meilleur":    max(scores),
        "progression": prog,
        "rdv_pct":     round(rdv_ok / len(ss) * 100),
        "niv_moy":     round(sum(niveaux) / len(niveaux), 1),
    }


def badge_performance(taux_reponse: float) -> str:
    if taux_reponse >= 40:
        return "🏆 ELITE"
    elif taux_reponse >= 30:
        return "⭐ EXCELLENT"
    elif taux_reponse >= 20:
        return "✅ BON"
    elif taux_reponse >= 10:
        return "📈 EN PROGRESSION"
    else:
        return "🔄 À TRAVAILLER"


# ── Affichage ────────────────────────────────────────────────────────────────

SEP  = "=" * 70
SEP2 = "-" * 70


def header(titre: str) -> None:
    print(f"\n{SEP}")
    print(f"  {titre}")
    print(SEP)


def vue_globale(students: list[dict], sessions: list[dict]) -> None:
    sim_sessions = load_sim_sessions()
    header("TABLEAU DE BORD SETTING — VUE GLOBALE")
    print(f"  Date : {date.today().strftime('%d/%m/%Y')}  |  Élèves actifs : {len([e for e in students if e['statut']=='actif'])}")
    print(SEP2)

    print(f"\n{'NOM':<22} {'NIVEAU':<14} {'NICHE':<14} {'RDV/J (7j)':<12} {'TAUX REP':<10} {'BADGE'}")
    print(SEP2)

    for eleve in students:
        if eleve["statut"] != "actif":
            continue
        stats   = stats_periode(sessions, eleve["id"], jours=7)
        niveau  = NIVEAUX.get(eleve["niveau"], NIVEAUX["debutant"])
        rdv_moy = round(stats["rdv_poses"] / max(stats["jours_actifs"], 1), 1)
        badge   = badge_performance(stats["taux_reponse"])
        print(
            f"  {eleve['nom']:<20} "
            f"{niveau['emoji']} {niveau['label']:<12} "
            f"{eleve['niche']:<14} "
            f"{rdv_moy:<12} "
            f"{stats['taux_reponse']}%{'':<6} "
            f"{badge}"
        )

    # ── Totaux ────────────────────────────────────────────────────────────────
    total_rdv = sum(
        stats_periode(sessions, e["id"], 7)["rdv_poses"]
        for e in students if e["statut"] == "actif"
    )
    total_msg = sum(
        stats_periode(sessions, e["id"], 7)["messages"]
        for e in students if e["statut"] == "actif"
    )
    print(SEP2)
    print(f"\n  TOTAUX 7 DERNIERS JOURS")
    print(f"  Messages envoyés  : {total_msg}")
    print(f"  RDV posés         : {total_rdv}")

    # ── Simulations ───────────────────────────────────────────────────────────
    total_sim = sum(
        sim_stats_eleve(sim_sessions, e["id"])["nb"]
        for e in students if e["statut"] == "actif"
    )
    if total_sim > 0:
        print(f"\n  {SEP2}")
        print("  SIMULATIONS D'ENTRAÎNEMENT")
        print(f"  {SEP2}")
        print(f"  {'ÉLÈVE':<22} {'SESSIONS':<10} {'SCORE MOY':<12} {'MEILLEUR':<10} {'PROG':<8} {'RDV%'}")
        print(f"  {'-'*60}")
        for eleve in students:
            if eleve["statut"] != "actif":
                continue
            ss = sim_stats_eleve(sim_sessions, eleve["id"])
            if ss["nb"] == 0:
                print(f"  {eleve['nom']:<22} {'—':<10} {'—':<12} {'—':<10} {'—':<8} —")
                continue
            prog_s = f"+{ss['progression']}" if ss["progression"] > 0 else str(ss["progression"])
            print(
                f"  {eleve['nom']:<22} {ss['nb']:<10} "
                f"{ss['score_moy']}/100{'':<5} {ss['meilleur']}/100{'':<3} "
                f"{prog_s:>6}   {ss['rdv_pct']}%"
            )
    print()


def vue_eleve(eleve: dict, sessions: list[dict]) -> None:
    sim_sessions = load_sim_sessions()
    niveau = NIVEAUX.get(eleve["niveau"], NIVEAUX["debutant"])
    header(f"FICHE ÉLÈVE — {eleve['nom'].upper()} {niveau['emoji']}")

    print(f"  ID         : {eleve['id']}")
    print(f"  Email      : {eleve['email']}")
    print(f"  Niveau     : {niveau['label']}")
    print(f"  Niche      : {eleve['niche']}")
    print(f"  Script     : {eleve['script_actif']}")
    print(f"  Objectif   : {eleve['objectif_rdv_jour']} RDV/jour  |  {eleve['objectif_messages_jour']} messages/jour")
    print(f"  Inscrit le : {eleve['date_debut']}")

    for periode, jours in [("7 DERNIERS JOURS", 7), ("30 DERNIERS JOURS", 30)]:
        stats = stats_periode(sessions, eleve["id"], jours)
        print(f"\n  {SEP2[:66]}")
        print(f"  STATS — {periode}")
        print(f"  {SEP2[:66]}")
        if stats["jours_actifs"] == 0:
            print("  Aucune session sur cette période.")
            continue
        rdv_moy = round(stats["rdv_poses"] / stats["jours_actifs"], 1)
        print(f"  Jours actifs        : {stats['jours_actifs']}")
        print(f"  Messages envoyés    : {stats['messages']}")
        print(f"  Réponses obtenues   : {stats['reponses']}  ({stats['taux_reponse']}%)")
        print(f"  RDV posés           : {stats['rdv_poses']}  (conv. {stats['taux_conversion']}%)")
        print(f"  RDV honorés         : {stats['rdv_honores']}  (show-up {stats['taux_honore']}%)")
        print(f"  Moyenne RDV/jour    : {rdv_moy}")
        print(f"  Objectif ({eleve['objectif_rdv_jour']}/j)     : {progression_niveau(eleve, stats)}")
        print(f"  Performance         : {badge_performance(stats['taux_reponse'])}")

    # ── 5 dernières sessions ──────────────────────────────────────────────────
    historique = sorted(
        sessions_eleve(sessions, eleve["id"]),
        key=lambda s: s["date"],
        reverse=True
    )[:5]

    if historique:
        print(f"\n  {SEP2[:66]}")
        print("  5 DERNIÈRES SESSIONS")
        print(f"  {SEP2[:66]}")
        print(f"  {'DATE':<12} {'MSG':<6} {'REP':<6} {'RDV':<6} {'HON':<6} NOTES")
        for s in historique:
            print(
                f"  {s['date']:<12} "
                f"{s['messages_envoyes']:<6} "
                f"{s['reponses_obtenues']:<6} "
                f"{s['rdv_poses']:<6} "
                f"{s['rdv_honores']:<6} "
                f"{s.get('notes','')}"
            )

    # ── Simulations ───────────────────────────────────────────────────────────
    ss = sim_stats_eleve(sim_sessions, eleve["id"])
    if ss["nb"] > 0:
        prog_s = f"+{ss['progression']}" if ss["progression"] > 0 else str(ss["progression"])
        print(f"\n  {SEP2[:66]}")
        print("  SIMULATIONS D'ENTRAÎNEMENT IA")
        print(f"  {SEP2[:66]}")
        print(f"  Sessions effectuées   : {ss['nb']}")
        print(f"  Score moyen           : {ss['score_moy']}/100")
        print(f"  Meilleur score        : {ss['meilleur']}/100")
        print(f"  Progression           : {prog_s} pts (1ère → dernière session)")
        print(f"  Taux RDV posés        : {ss['rdv_pct']}%")
        print(f"  Niveau moyen pratiqué : {ss['niv_moy']}/4")

        # 3 dernières sessions sim
        recent_sim = sorted(
            [s for s in sim_sessions if s["eleve_id"] == eleve["id"]],
            key=lambda x: (x["date"], x["heure"]),
            reverse=True
        )[:3]
        if recent_sim:
            print(f"\n  3 DERNIÈRES SIMULATIONS")
            print(f"  {'DATE':<12} {'NICHE':<14} {'NIV':<5} {'SCORE':<8} {'RDV':<5} CONSEIL")
            for s in recent_sim:
                rdv_ic  = "✅" if s.get("rdv_pose") else "❌"
                conseil = s.get("conseil_principal", "")[:35]
                if len(s.get("conseil_principal", "")) > 35:
                    conseil += "…"
                print(
                    f"  {s['date']:<12} {s['niche']:<14} "
                    f"{s.get('niveau_difficulte',1)}/4  "
                    f"{s['scores']['global']}/100  {rdv_ic}    {conseil}"
                )
    else:
        print(f"\n  💡 Aucune simulation IA effectuée — lance : python training_simulator.py")
    print()


# ── Interactions ─────────────────────────────────────────────────────────────

def saisir_session(students: list[dict], sessions: list[dict]) -> None:
    header("SAISIE D'UNE NOUVELLE SESSION")
    actifs = [e for e in students if e["statut"] == "actif"]
    if not actifs:
        print("  Aucun élève actif.")
        return

    print("  Élèves disponibles :")
    for i, e in enumerate(actifs, 1):
        print(f"    {i}. {e['nom']} ({e['id']})")

    try:
        choix = int(input("\n  Numéro de l'élève : ")) - 1
        if choix < 0 or choix >= len(actifs):
            print("  Numéro invalide.")
            return
        eleve = actifs[choix]
    except (ValueError, KeyboardInterrupt):
        print("\n  Annulé.")
        return

    today = date.today().isoformat()
    date_session = input(f"  Date (défaut: {today}) : ").strip() or today

    try:
        messages  = int(input("  Messages envoyés    : "))
        reponses  = int(input("  Réponses obtenues   : "))
        rdv_poses = int(input("  RDV posés           : "))
        rdv_honores = int(input("  RDV honorés         : "))
    except (ValueError, KeyboardInterrupt):
        print("\n  Saisie invalide, annulée.")
        return

    notes = input("  Notes / commentaires : ").strip()

    session = {
        "eleve_id":          eleve["id"],
        "date":              date_session,
        "messages_envoyes":  messages,
        "reponses_obtenues": reponses,
        "rdv_poses":         rdv_poses,
        "rdv_honores":       rdv_honores,
        "niche":             eleve["niche"],
        "notes":             notes,
    }
    sessions.append(session)
    save_sessions(sessions)
    print(f"\n  ✓ Session enregistrée pour {eleve['nom']}.")

    # Vérifier si montée de niveau
    stats_7j = stats_periode(sessions, eleve["id"], 7)
    rdv_moy  = stats_7j["rdv_poses"] / max(stats_7j["jours_actifs"], 1)
    niveau_actuel = eleve["niveau"]
    if niveau_actuel == "debutant" and rdv_moy >= 4:
        print(f"  🎉 MONTÉE DE NIVEAU → Intermédiaire suggérée !")
        if input("  Confirmer la montée de niveau ? (o/N) : ").lower() == "o":
            eleve["niveau"] = "intermediaire"
            save_students(students)
            print("  ✓ Niveau mis à jour.")
    elif niveau_actuel == "intermediaire" and rdv_moy >= 7:
        print(f"  🎉 MONTÉE DE NIVEAU → Avancé suggérée !")
        if input("  Confirmer la montée de niveau ? (o/N) : ").lower() == "o":
            eleve["niveau"] = "avance"
            save_students(students)
            print("  ✓ Niveau mis à jour.")


def ajouter_eleve(students: list[dict]) -> None:
    header("AJOUTER UN ÉLÈVE")
    try:
        nom    = input("  Nom complet         : ").strip()
        email  = input("  Email               : ").strip()
        print(f"  Niches disponibles  : {', '.join(NICHES)}")
        niche  = input("  Niche               : ").strip().lower()
        if niche not in NICHES:
            print(f"  Niche inconnue. Choisir parmi : {', '.join(NICHES)}")
            return
        obj_rdv = int(input("  Objectif RDV/jour   : ") or "3")
        obj_msg = int(input("  Objectif messages/j : ") or "30")
    except (ValueError, KeyboardInterrupt):
        print("\n  Annulé.")
        return

    scripts = SCRIPTS_DISPONIBLES.get(niche, [f"script_{niche}_v1"])
    script_defaut = scripts[0]

    new_id = f"eleve_{len(students)+1:03d}"
    eleve = {
        "id":                   new_id,
        "nom":                  nom,
        "email":                email,
        "date_debut":           date.today().isoformat(),
        "niveau":               "debutant",
        "niche":                niche,
        "objectif_rdv_jour":    obj_rdv,
        "objectif_messages_jour": obj_msg,
        "script_actif":         script_defaut,
        "statut":               "actif",
    }
    students.append(eleve)
    save_students(students)
    print(f"\n  ✓ Élève ajouté : {nom} (ID: {new_id})")
    print(f"  Script par défaut    : {script_defaut}")
    print(f"  Scripts disponibles  : {', '.join(scripts)}")


def modifier_settings_eleve(students: list[dict]) -> None:
    header("MODIFIER LES SETTINGS D'UN ÉLÈVE")
    actifs = [e for e in students if e["statut"] == "actif"]
    for i, e in enumerate(actifs, 1):
        print(f"    {i}. {e['nom']}")

    try:
        choix = int(input("\n  Numéro de l'élève : ")) - 1
        eleve = actifs[choix]
    except (ValueError, KeyboardInterrupt, IndexError):
        print("\n  Annulé.")
        return

    print(f"\n  Élève : {eleve['nom']}")
    print(f"  1. Script actif       : {eleve['script_actif']}")
    print(f"  2. Objectif RDV/jour  : {eleve['objectif_rdv_jour']}")
    print(f"  3. Objectif MSG/jour  : {eleve['objectif_messages_jour']}")
    print(f"  4. Niche              : {eleve['niche']}")
    print(f"  5. Niveau             : {eleve['niveau']}")
    print(f"  6. Statut             : {eleve['statut']}")

    try:
        champ = int(input("\n  Que modifier ? (1-6) : "))
    except (ValueError, KeyboardInterrupt):
        print("\n  Annulé.")
        return

    if champ == 1:
        niche = eleve["niche"]
        scripts = SCRIPTS_DISPONIBLES.get(niche, [])
        print(f"  Scripts pour {niche} : {', '.join(scripts)}")
        eleve["script_actif"] = input("  Nouveau script : ").strip()
    elif champ == 2:
        eleve["objectif_rdv_jour"] = int(input("  Nouvel objectif RDV/jour : "))
    elif champ == 3:
        eleve["objectif_messages_jour"] = int(input("  Nouvel objectif MSG/jour : "))
    elif champ == 4:
        print(f"  Niches : {', '.join(NICHES)}")
        eleve["niche"] = input("  Nouvelle niche : ").strip().lower()
    elif champ == 5:
        print("  Niveaux : debutant / intermediaire / avance")
        eleve["niveau"] = input("  Nouveau niveau : ").strip().lower()
    elif champ == 6:
        print("  Statuts : actif / inactif")
        eleve["statut"] = input("  Nouveau statut : ").strip().lower()
    else:
        print("  Choix invalide.")
        return

    save_students(students)
    print(f"\n  ✓ Settings de {eleve['nom']} mis à jour.")


def rapport_quotidien(students: list[dict], sessions: list[dict]) -> None:
    header(f"RAPPORT DU JOUR — {date.today().strftime('%d/%m/%Y')}")
    today = date.today().isoformat()
    sessions_today = [s for s in sessions if s["date"] == today]

    if not sessions_today:
        print("  Aucune session enregistrée aujourd'hui.\n")
        return

    print(f"  {'ÉLÈVE':<22} {'MSG':<6} {'REP':<6} {'RDV':<6} {'HON':<6} {'OBJECTIF':<10} STATUT")
    print(SEP2)

    for eleve in students:
        if eleve["statut"] != "actif":
            continue
        s_today = [s for s in sessions_today if s["eleve_id"] == eleve["id"]]
        if not s_today:
            print(f"  {eleve['nom']:<22} {'—':<6} {'—':<6} {'—':<6} {'—':<6} {eleve['objectif_rdv_jour']}/j{'':<4} ⏳ En attente")
            continue
        s = s_today[-1]
        rdv  = s["rdv_poses"]
        obj  = eleve["objectif_rdv_jour"]
        icon = "✅" if rdv >= obj else ("🔶" if rdv >= obj * 0.7 else "❌")
        print(
            f"  {eleve['nom']:<22} "
            f"{s['messages_envoyes']:<6} "
            f"{s['reponses_obtenues']:<6} "
            f"{s['rdv_poses']:<6} "
            f"{s['rdv_honores']:<6} "
            f"{obj}/j{'':<6} "
            f"{icon} {'Objectif atteint' if rdv >= obj else f'{rdv}/{obj} RDV'}"
        )
    print()


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Tableau de bord entraînement Setting — Élèves"
    )
    parser.add_argument("--eleve",            metavar="ID",    help="Afficher la fiche d'un élève")
    parser.add_argument("--ajouter-session",  action="store_true", help="Saisir une nouvelle session")
    parser.add_argument("--ajouter-eleve",    action="store_true", help="Ajouter un élève")
    parser.add_argument("--modifier-settings",action="store_true", help="Modifier les settings d'un élève")
    parser.add_argument("--rapport",          action="store_true", help="Rapport du jour")
    args = parser.parse_args()

    students = load_students()
    sessions = load_sessions()

    if args.ajouter_eleve:
        ajouter_eleve(students)
    elif args.modifier_settings:
        modifier_settings_eleve(students)
    elif args.ajouter_session:
        saisir_session(students, sessions)
    elif args.rapport:
        rapport_quotidien(students, sessions)
    elif args.eleve:
        eleve = next((e for e in students if e["id"] == args.eleve), None)
        if not eleve:
            print(f"Élève '{args.eleve}' introuvable.")
        else:
            vue_eleve(eleve, sessions)
    else:
        vue_globale(students, sessions)
        rapport_quotidien(students, sessions)


if __name__ == "__main__":
    main()
