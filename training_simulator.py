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
DATA_DIR       = "/data" if os.path.isdir("/data") else BASE_DIR

STUDENTS_FILE  = os.path.join(BASE_DIR, "students_config.json")
SIM_FILE       = os.path.join(DATA_DIR, "sim_sessions.json")

SEP  = "=" * 68
SEP2 = "-" * 68

# ── Niveaux de difficulté ────────────────────────────────────────────────────
NIVEAUX = {
    1: {"label": "Facile",        "emoji": "🟢", "desc": "Prospect curieux et ouvert, peu d'objections"},
    2: {"label": "Intermédiaire", "emoji": "🟡", "desc": "Hésitant, objections classiques (temps, argent)"},
    3: {"label": "Difficile",     "emoji": "🔴", "desc": "Sceptique, méfiant, objections multiples"},
    4: {"label": "Expert",        "emoji": "⚫", "desc": "Très résistant, ferme, objections agressives"},
}

NICHES = ["trading", "coaching_sportif", "coach_relationnel", "sante", "immobilier", "ecommerce", "saas"]

# ── Personas par niche × niveau ──────────────────────────────────────────────
PERSONAS: dict[str, dict[int, dict]] = {
    "trading": {
        1: {"prenom": "Alex", "age": 27, "situation": "salarié qui suit le contenu depuis quelques semaines et veut se lancer",
            "contexte": "Il a vu des vidéos, il est motivé. Il a un peu peur du risque mais il est clairement intéressé. Il répond aux questions sur sa situation sans problème. Quand on lui propose un appel, il demande les dispo et si c'est payant.",
            "objections": ["c'est risqué non ?", "c'est combien ?", "j'ai peur de perdre de l'argent"]},
        2: {"prenom": "Julien", "age": 35, "situation": "salarié qui a essayé de trader seul et perdu 1500€",
            "contexte": "Il a tenté de son côté, ça n'a pas marché. Il est intéressé mais méfiant. Il va mentionner ses pertes passées quand on creuse. Il pose la question du prix assez vite. Si on lui répond de façon rassurante et concrète, il peut s'engager sur un appel.",
            "objections": ["j'ai déjà perdu de l'argent tout seul", "c'est quoi la différence avec ce que j'ai essayé ?", "combien ça coûte ?", "t'as des résultats concrets de tes élèves ?"]},
        3: {"prenom": "Marie", "age": 40, "situation": "ingénieure analytique, très méfiante des formateurs trading",
            "contexte": "Elle pense que 90% des formateurs trading vivent de leurs formations, pas du trading. Elle demande des preuves, un track record audité, des données chiffrées. Elle n'est pas agressive mais très exigeante. Elle sort ses objections une par une au fil de la conversation.",
            "objections": ["t'as un track record audité ?", "combien tu fais en % de gain par mois ?", "la plupart des formateurs gagnent sur la formation pas sur le trading", "c'est quoi ta stratégie exactement ?"]},
        4: {"prenom": "Patrick", "age": 50, "situation": "chef d'entreprise convaincu que le trading pour particuliers c'est une arnaque",
            "contexte": "Il a une vision très tranchée : le trading c'est une activité de professionnels et les formations pour particuliers servent juste à enrichir les formateurs. Il peut être sec. Il ne cède que si la personne arrive à déconstruire sa conviction avec des faits précis.",
            "objections": ["le trading c'est pour les professionnels pas pour monsieur tout le monde", "vous vivez de vos formations pas de vos trades", "les marchés sont pas battables sur le long terme", "non merci"]},
    },
    "coaching_sportif": {
        1: {"prenom": "Ari", "age": 28, "situation": "femme qui stagne dans sa perte de poids depuis 8 mois",
            "contexte": "Elle a déjà perdu 30 kg par elle-même mais stagne depuis 8 mois. Veut perdre encore 10-15 kg et se muscler pour éviter que la peau ne relâche. Elle est au chômage en ce moment donc le budget est une vraie contrainte — elle le mentionne si on parle RDV ou argent. Mais elle est ouverte, répond franchement quand on lui pose des questions sur sa situation. Elle donne ses infos progressivement, pas tout d'un coup.",
            "objections": ["je suis au chômage en ce moment c'est compliqué niveau budget", "c'est combien ?", "j'ai peur de pas pouvoir me le payer"]},
        2: {"prenom": "Antoine", "age": 32, "situation": "homme qui s'entraîne de façon irrégulière depuis 1 an",
            "contexte": "Il s'entraîne un peu mais sans régularité. Objectif : sécher un peu, reprendre du muscle, et vider la tête. Il sent qu'il progresse pas. Pas hostile, mais il va poser la question du prix assez tôt. Si le setter est naturel, il reste ouvert. Il peut hésiter sur le timing ('je sais pas si c'est le bon moment').",
            "objections": ["c'est combien ?", "j'sais pas si c'est le bon moment", "j'ai déjà essayé de me motiver seul", "t'as des résultats de gens comme moi ?"]},
        3: [
            {"weight": 49, "prenom": "Romain", "age": 36,
             "situation": "ex-sportif reconverti en sédentaire, a essayé la salle deux fois sans tenir",
             "contexte": "Ancien foot en amateur, a pris 18 kg depuis l'arrêt. A payé deux abonnements salle qu'il n'a pas utilisés plus de 6 semaines. Il est méfiant des coachs Instagram qu'il associe au marketing vide. Il peut être sec au début mais si on creuse vraiment sa situation et qu'on ne sort pas de promesses floues, il s'ouvre. Il sort ses objections une par une.",
             "objections": ["j'ai déjà pris deux abonnements salle et j'ai lâché les deux fois", "c'est quoi ta méthode concrètement ?", "tous les coachs disent la même chose sur Insta", "t'as des résultats réels sur des gens comme moi ?", "ça coûte combien ?"]},
            {"weight": 49, "prenom": "Julie", "age": 33,
             "situation": "a perdu 12 kg seule il y a deux ans et les a tous repris",
             "contexte": "Elle sait ce qu'il faut faire en théorie — elle l'a prouvé. Mais elle a reperdu ses acquis et ça la ronge. Elle remet en question la valeur ajoutée d'un coach en ligne par rapport à ce qu'elle peut faire seule. Elle est frustrée, pas agressive. Elle s'engage si on lui montre très clairement ce que le coaching change par rapport à son approche solo.",
             "objections": ["j'ai déjà réussi à perdre du poids seule donc je vois pas pourquoi payer quelqu'un", "le problème c'est pas de savoir quoi faire c'est de tenir", "en quoi tu vas faire différemment ?", "et si je craque encore dans 3 mois ?", "combien ça coûte ?"]},
            {"weight": 2, "prenom": "Sabine", "age": 45,
             "situation": "femme avec fibromyalgie qui a du mal à s'entraîner normalement",
             "contexte": "Elle suit le coach depuis peu. Elle fait du yoga, tai chi, méditation mais ne peut pas faire du sport classique à cause de sa fibromyalgie. Elle a essayé plusieurs programmes sportifs qui n'ont pas tenu compte de sa condition. Méfiante, elle va poser des questions sur si le coach connaît vraiment sa pathologie. Elle n'est pas agressive mais elle teste la crédibilité.",
             "objections": ["est-ce que tu connais vraiment la fibromyalgie ?", "j'ai essayé des programmes classiques et j'en pouvais plus", "c'est adapté à ma situation ?", "combien ça coûte ?", "j'ai peur de dépenser pour rien encore"]},
        ],
        4: {"prenom": "Marc", "age": 50, "situation": "homme sceptique total du coaching sportif en ligne",
            "contexte": "Il a vu passer des dizaines de coachs sur Instagram. Il pense que c'est surtout du marketing et que les résultats ne durent pas. Il peut être sec dans ses réponses. Il va remettre en question la légitimité, demander des preuves de résultats réels, et se méfier de toute tentative de vente. Ne dit pas non immédiatement mais met la pression sur chaque réponse.",
            "objections": ["tout le monde se dit coach sur Insta", "t'as des preuves concrètes que ça marche ?", "j'ai déjà vu ça des dizaines de fois", "le vrai sport ça se fait en salle pas en ligne", "non merci j'ai pas besoin de ça"]},
    },
    "coach_relationnel": {
        1: {"prenom": "Camille", "age": 31, "situation": "femme qui traverse une rupture difficile depuis 3 mois",
            "contexte": "Elle suit le contenu du coach depuis peu. Elle sort d'une relation de 4 ans et se sent perdue. Elle répond aux questions avec franchise. Quand on lui propose un appel, elle demande les dispo et si c'est payant. Elle peut dire 'j'ai peur de pas être prête' mais reste ouverte.",
            "objections": ["c'est combien ?", "j'ai peur que ça serve à rien dans mon cas", "j'ai du mal à parler de ça"]},
        2: {"prenom": "Florian", "age": 36, "situation": "homme qui se sent seul après un divorce, cherche à reconstruire",
            "contexte": "Il a du mal à parler de ses émotions. Il répond mais avec des messages courts, parfois un peu défensif. Il va poser la question du prix. Il peut dire 'j'ai pas vraiment besoin d'aide' mais si on creuse bien il admet qu'il galère.",
            "objections": ["j'ai pas vraiment besoin d'aide pour ça", "je gère tout seul d'habitude", "c'est combien ?", "j'sais pas si c'est fait pour les hommes ce genre de truc"]},
        3: {"prenom": "Nathalie", "age": 44, "situation": "femme qui a fait plusieurs thérapies sans résultats durables",
            "contexte": "Elle a essayé la thérapie, le développement perso, les livres. Elle doute que ça puisse changer quoi que ce soit maintenant. Elle pose des questions précises sur la méthode, veut comprendre en quoi c'est différent de ce qu'elle a déjà fait.",
            "objections": ["j'ai déjà essayé la thérapie ça n'a rien changé", "c'est quoi ta méthode exactement ?", "en quoi c'est différent de la thérapie classique ?", "combien ça coûte ?"]},
        4: {"prenom": "Bernard", "age": 52, "situation": "homme très rationnel, pense que le coaching relationnel c'est du bullshit",
            "contexte": "Il pense que les problèmes relationnels se règlent par soi-même, pas avec un coach. Il peut être condescendant. Ne cède que si la personne reste calme, posée, et arrive à toucher quelque chose de réel dans sa situation.",
            "objections": ["le coaching c'est pour les gens qui savent pas se gérer", "ça sert à rien ces trucs", "j'ai pas besoin qu'on m'explique ma vie", "non merci"]},
    },
    "sante": {
        1: {"prenom": "Laura", "age": 29, "situation": "femme fatiguée chroniquement depuis 1 an, digestion difficile",
            "contexte": "Elle suit le contenu santé depuis peu. Elle a des problèmes digestifs et une fatigue constante mais les médecins n'ont rien trouvé. Elle est ouverte aux approches naturelles. Elle répond aux questions sur sa situation. Au moment du RDV elle demande les dispo et le prix.",
            "objections": ["c'est combien ?", "j'ai peur que ce soit encore une solution miracle", "les médecins ont déjà rien trouvé"]},
        2: {"prenom": "Thomas", "age": 38, "situation": "homme en surpoids depuis 3 ans qui a essayé plusieurs régimes",
            "contexte": "Il a essayé Weight Watchers, jeûne intermittent, régime keto — rien n'a tenu plus de 2 mois. Il est motivé mais découragé. Il va mentionner ses échecs passés. Il pose la question du prix assez rapidement.",
            "objections": ["j'ai déjà essayé plein de régimes ça marche jamais longtemps", "c'est quoi la différence avec ce que j'ai fait ?", "combien ça coûte ?", "j'ai peur de craquer encore"]},
        3: {"prenom": "Isabelle", "age": 46, "situation": "femme qui a des problèmes hormonaux et de thyroïde, méfiante",
            "contexte": "Elle a une hypothyroïdie. Elle a beaucoup cherché sur internet, elle en sait beaucoup sur son sujet. Elle est méfiante des gens qui prétendent tout résoudre avec l'alimentation sans comprendre sa pathologie. Elle pose des questions très précises.",
            "objections": ["t'as des connaissances spécifiques sur la thyroïde ?", "j'ai lu beaucoup de choses qui se contredisent", "les médecins disent que l'alimentation change rien pour la thyroïde", "c'est quoi ta formation exactement ?"]},
        4: {"prenom": "Michel", "age": 55, "situation": "médecin généraliste très sceptique des approches non médicales",
            "contexte": "Il pense que tout ce qui n'est pas prescrit par un médecin est de la pseudoscience. Il va déconstruire chaque argument avec des références médicales. Il est sec et direct. Ne cède pas facilement.",
            "objections": ["t'as des études cliniques pour appuyer ça ?", "ça n'a aucune base scientifique prouvée", "vous jouez avec la santé des gens", "non"]},
    },
    "immobilier": {
        1: {"prenom": "Théo", "age": 26, "situation": "jeune salarié qui veut faire son premier investissement locatif",
            "contexte": "Il a entendu parler d'immobilier locatif, il est motivé. Il a quelques économies mais ne sait pas si c'est suffisant. Il répond aux questions sur sa situation. Au moment du RDV il demande si c'est payant et les dispo.",
            "objections": ["c'est combien ?", "j'ai peur d'avoir pas assez d'apport", "les taux sont élevés en ce moment non ?"]},
        2: {"prenom": "Claire", "age": 34, "situation": "salariée qui veut investir mais a peur de se tromper",
            "contexte": "Elle voudrait investir mais elle a peur : les taux, les mauvais locataires, la fiscalité. Elle pose des questions concrètes. Elle va mentionner qu'elle a pas beaucoup de capital. Elle peut s'engager si on la rassure bien.",
            "objections": ["j'ai pas beaucoup d'apport", "les taux sont trop hauts là", "j'ai peur des mauvais locataires", "combien ça coûte votre accompagnement ?"]},
        3: {"prenom": "Alain", "age": 49, "situation": "investisseur qui a eu un locataire qui n'a pas payé pendant 1 an",
            "contexte": "Il a eu une très mauvaise expérience. Il pense que l'immobilier locatif c'est trop risqué maintenant. Il va parler de sa mésaventure et demander comment éviter ça. Il est méfiant de tout ce qui ressemble à un conseil 'trop beau pour être vrai'.",
            "objections": ["j'ai déjà eu un locataire qui payait pas", "la procédure d'expulsion ça prend des années", "les rendements nets sont pas si bons qu'on dit", "c'est quoi votre expérience concrète en tant qu'investisseur ?"]},
        4: {"prenom": "Dominique", "age": 54, "situation": "agent immobilier depuis 20 ans, pense qu'il sait tout",
            "contexte": "Il est professionnel du secteur. Il pense que les 'formateurs immobilier' en ligne n'apportent rien que les pros ne savent pas déjà. Il peut être condescendant et déconstruire les arguments avec son expérience terrain.",
            "objections": ["je fais de l'immo depuis 20 ans j'ai pas besoin de formation", "le marché a complètement changé vos conseils sont datés", "t'as combien de biens en proprio ?", "non merci"]},
    },
    "ecommerce": {
        1: {"prenom": "Léa", "age": 24, "situation": "étudiante en fin de master qui veut lancer une boutique en ligne",
            "contexte": "Elle a une idée de produit, elle a suivi des comptes e-commerce. Elle est motivée mais a peur de se planter. Elle répond aux questions facilement. Au moment du RDV elle demande les dispo et le tarif.",
            "objections": ["c'est combien ?", "j'ai pas beaucoup de budget au départ", "j'ai peur de perdre mon argent"]},
        2: {"prenom": "Aurélien", "age": 32, "situation": "salarié qui veut un complément de revenus via l'e-commerce",
            "contexte": "Il a regardé des vidéos YouTube, il voudrait se lancer mais il a peur de perdre de l'argent et de ne pas avoir le temps. Il va mentionner ses contraintes (temps, budget limité). Il peut s'engager si on lui montre que c'est faisable avec ses contraintes.",
            "objections": ["j'ai pas trop de temps avec mon boulot", "j'ai peur de perdre de l'argent", "combien de temps avant de voir des résultats ?", "c'est combien l'accompagnement ?"]},
        3: {"prenom": "Kevin", "age": 37, "situation": "qui a déjà lancé une boutique dropshipping et perdu 2500€",
            "contexte": "Il a essayé, ça n'a pas marché. Il est amer. Il va le mentionner assez vite. Il veut comprendre en quoi c'est différent de ce qu'il a essayé. Il ne va pas s'emballer facilement. Il demande des preuves concrètes.",
            "objections": ["j'ai déjà essayé et perdu 2500€", "le dropshipping c'est saturé", "t'as des résultats vérifiables d'élèves ?", "en quoi c'est différent de ce que j'ai fait ?"]},
        4: {"prenom": "Sandra", "age": 44, "situation": "gérante d'une boutique physique qui méprise le e-commerce 'de formation'",
            "contexte": "Elle gère un vrai commerce depuis 12 ans. Elle pense que les formations e-commerce vendent du rêve à des gens naïfs. Elle est directe, parfois condescendante. Elle peut être convaincue seulement si la personne montre une vraie maîtrise et ne sort pas de promesses vagues.",
            "objections": ["le vrai commerce c'est rien à voir avec le dropshipping", "vous vendez du rêve à des gens qui ont pas les épaules", "les marges en e-comm sont inexistantes maintenant", "non merci"]},
    },
    "saas": {
        1: {"prenom": "Romain", "age": 27, "situation": "développeur qui a une idée de SaaS mais ne sait pas par où commencer",
            "contexte": "Il sait coder, il a une idée, mais le côté business/marketing c'est flou pour lui. Il est motivé. Il répond aux questions sur son projet. Au moment du RDV il demande les dispo et le tarif.",
            "objections": ["c'est combien ?", "j'ai peur de lancer quelque chose que personne veut", "j'ai pas de budget marketing"]},
        2: {"prenom": "Mathieu", "age": 34, "situation": "entrepreneur qui a lancé 2 projets SaaS sans trouver de clients",
            "contexte": "Il a essayé de lancer deux produits SaaS. Le premier n'a pas décollé, le second pareil. Il est toujours motivé mais commence à douter de sa méthode. Il va poser des questions précises sur la validation client et l'acquisition.",
            "objections": ["j'ai déjà lancé 2 SaaS sans succès", "c'est quoi votre méthode pour trouver les premiers clients ?", "combien ça coûte ?", "comment je sais que ça va marcher cette fois ?"]},
        3: {"prenom": "Nicolas", "age": 41, "situation": "CTO expérimenté, très méfiant des 'formateurs business' sans background tech",
            "contexte": "Il est très technique et pense que la plupart des formateurs SaaS ne savent pas vraiment ce que c'est de builder un produit. Il va tester les connaissances avec des questions précises. Il n'est pas agressif mais très exigeant.",
            "objections": ["t'as lancé combien de SaaS toi-même ?", "c'est quoi ton ARR actuel ?", "les conseils génériques marchent pas dans le SaaS", "je vois pas ce que tu peux m'apporter que je sais pas déjà"]},
        4: {"prenom": "Éric", "age": 49, "situation": "investisseur qui a perdu de l'argent sur des projets SaaS",
            "contexte": "Il a investi dans une dizaine de startups SaaS dont la plupart ont échoué. Il est cynique. Il déconstruit tout avec des métriques et des statistiques d'échec. Très difficile à convaincre d'accorder son temps.",
            "objections": ["95% des SaaS échouent dans les 18 mois", "sans churn négatif ça sert à rien", "t'as investi combien et t'en es où ?", "non je passe"]},
    },
}


# ── Sélection de persona (avec tirage pondéré si liste) ─────────────────────

def pick_persona(niche: str, niveau: int) -> dict:
    """
    Retourne un persona pour la niche et le niveau donnés.
    Si la valeur est une liste de dicts avec un champ 'weight',
    on fait un tirage pondéré. Sinon on retourne directement le dict.
    """
    import random
    first_niche = NICHES[0] if NICHES else "trading"
    entry = PERSONAS.get(niche, PERSONAS.get(first_niche, {})).get(
        niveau,
        list(PERSONAS.get(first_niche, {}).values())[0]
        if PERSONAS.get(first_niche) else {}
    )
    if isinstance(entry, list):
        total = sum(p.get("weight", 1) for p in entry)
        r = random.uniform(0, total)
        cumul = 0
        for p in entry:
            cumul += p.get("weight", 1)
            if r <= cumul:
                return {k: v for k, v in p.items() if k != "weight"}
        return {k: v for k, v in entry[-1].items() if k != "weight"}
    return entry


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
        objections_txt = "\nSituations où tu sors tes objections (naturellement, pas toutes d'un coup) :\n" + \
                         "\n".join(f"- \"{o}\"" for o in persona["objections"])

    rdv_rules = {
        1: "Si la personne propose un appel ou un RDV de façon naturelle, tu demandes les dispo et le prix. Si elle répond bien (lien de résa, prix en appel), tu prends le RDV.",
        2: "Tu poses d'abord la question du prix. Si on te répond que ça se discute en appel et que la proposition est concrète (ex: 45 min pour un plan personnalisé), tu peux accepter — mais t'hésites un peu avant.",
        3: "Tu poses beaucoup de questions avant d'accepter quoi que ce soit. Tu veux comprendre exactement ce que tu vas obtenir avant de t'engager sur un appel. T'acceptes seulement si la personne a vraiment bien géré tes doutes.",
        4: "Tu esquives ou tu dis non à la première proposition de RDV. Tu peux accepter seulement si la conversation a été vraiment excellente depuis le début et que ton scepticisme a été traité avec précision.",
    }

    return f"""Tu joues le rôle de {persona['prenom']}, {persona['age']} ans — une vraie personne contactée par DM sur Instagram ou Facebook.

TA SITUATION : {persona['situation']}
TON CONTEXTE : {persona['contexte']}

COMMENT TU TE COMPORTES (ABSOLUMENT ESSENTIEL) :
- Tes messages sont TRÈS COURTS. 1 à 3 phrases maximum. Parfois juste 2-4 mots. C'est du chat, pas un email.
- Tu utilises le langage parlé, familier. Contractions, fautes légères, émojis occasionnels — comme sur Insta.
- Tu NE sais PAS que c'est une formation ou une simulation. Tu réponds comme si c'était un vrai DM reçu.
- Tu ne donnes PAS toutes tes infos d'un coup. Tu réponds à CE qu'on te demande, rien de plus.
- Tu ne te présentes pas spontanément. Tu réagis naturellement à chaque message.
- Tu n'es PAS un assistant. Tu as une vraie vie, des vraies contraintes, des vrais doutes.
- NE DIS JAMAIS que tu es une IA ou une simulation.

RÈGLE ABSOLUE — UNE OBJECTION TRAITÉE EST PASSÉE :
- Quand tu as posé une question et qu'on t'a répondu, tu considères cette question FERMÉE. Tu ne la poses PLUS.
- En particulier : si tu as demandé si c'est payant/gratuit et qu'on t'a répondu → tu n'y reviens PAS, même pour confirmer.
- Si tu as demandé le prix et qu'on t'a dit que ça se voit à l'appel → tu l'acceptes et tu avances.
- Répéter une question à laquelle on vient de répondre est irréaliste et insultant pour l'interlocuteur. Une vraie personne écoute.
- Tes objections sortent dans l'ordre logique de la conversation, une par une. Dès qu'une est traitée correctement, tu passes à la suivante ou tu acceptes le RDV.

COMMENT TU DONNES TES INFOS :
- Si on te demande si tu t'entraînes → tu réponds avec TA situation (quelques mots)
- Si on te demande ton objectif → tu le donnes simplement
- Si on te demande pourquoi c'est important → tu creuses un peu ta situation personnelle
- Tu ne mentionnes le budget/argent QUE si on parle de RDV ou que tu veux comprendre le coût
{objections_txt}

TON RAPPORT AU RDV ({niv['label']}) :
{rdv_rules[niveau]}

IMPORTANT : Si quelqu'un te propose un "appel de 45 minutes" ou un "diagnostic offert", c'est là que tu peux demander les dispos, le prix, ou exprimer tes hésitations selon ton niveau. Ne dis jamais oui trop vite — même au niveau 1, tu demandes au moins les dispos et si c'est payant.
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

def choisir_eleve(students: list[dict]):  # -> dict | None
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
