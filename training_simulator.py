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

NICHES = ["trading", "coaching_sportif", "coach_relationnel", "sante", "immobilier", "ecommerce", "saas", "investissement"]

# ── Niveau d'Awareness ───────────────────────────────────────────────────────
AWARENESS_TYPES = {
    "chaud": {"label": "Chaud",  "emoji": "🔥", "desc": "Fan actif · regarde tout le contenu"},
    "tiede": {"label": "Tiède",  "emoji": "🌡️", "desc": "Suit sans trop interagir · passif"},
    "froid": {"label": "Froid",  "emoji": "❄️", "desc": "Ne connaît pas le coach"},
}

# ── Type de trafic ────────────────────────────────────────────────────────────
TRAFFIC_TYPES = {
    "b2c": {
        "label": "B2C",
        "emoji": "👤",
        "desc":  "Particuliers · abonnés ou ciblés en DM",
    },
    "b2b": {
        "label": "B2B",
        "emoji": "🏢",
        "desc":  "Entrepreneurs · opener décorrélé · pivot requis",
    },
}

# ── Personas par niche × niveau ──────────────────────────────────────────────
PERSONAS: dict[str, dict[int, dict]] = {
    "trading": {
        1: [
            {"weight": 50, "prenom": "Alex", "age": 27,
             "situation": "salarié qui suit le contenu depuis quelques semaines et veut se lancer",
             "contexte": "Il a vu plusieurs vidéos, il est curieux et motivé. Il a un peu peur du risque — perdre de l'argent l'angoisse. Il répond aux questions sur sa situation sans problème. Il ne connaît pas encore les stratégies (scalping, swing…) et n'a aucune expérience sur les marchés. Quand on lui propose un appel, il demande les dispo et si c'est payant.",
             "objections": ["j'ai peur de perdre mes économies c'est quoi le risque réel ?", "j'ai aucune expérience est-ce que c'est accessible ?", "c'est combien pour se lancer ?"]},
            {"weight": 50, "prenom": "Inès", "age": 24,
             "situation": "étudiante en finance qui veut apprendre à trader pour compléter ses cours",
             "contexte": "Elle étudie la finance à l'université mais les cours sont très théoriques. Elle veut apprendre à trader vraiment, pas juste en théorie. Elle a 500€ de côté pour débuter. Elle est ouverte, pose des questions intelligentes. Un peu timide au départ. Si on lui propose un appel et que ça semble sérieux, elle est partante.",
             "objections": ["j'ai seulement 500€ de côté c'est suffisant pour commencer ?", "les cours à la fac c'est très théorique ça correspond à ta méthode ?", "c'est combien ?"]},
        ],
        2: {"prenom": "Julien", "age": 35, "situation": "salarié qui a essayé de trader seul et perdu 1 500€",
            "contexte": "Il a tenté de son côté en suivant des signaux Telegram — ça n'a pas marché. Il est intéressé mais méfiant. Il mentionne ses pertes passées quand on creuse. Il pose la question du prix assez vite. Si on lui répond de façon rassurante et concrète (pas juste 'fais-moi confiance'), il peut s'engager sur un appel.",
            "objections": ["j'ai perdu 1500€ en suivant des signaux Telegram", "c'est quoi la différence avec les signaux que je suivais ?", "combien ça coûte ?", "t'as des résultats vérifiables de tes élèves ?"]},
        3: {"prenom": "Marie", "age": 40, "situation": "ingénieure analytique, très méfiante des formateurs trading",
            "contexte": "Elle pense que 90% des formateurs trading vivent de leurs formations, pas du trading. Elle a fait des recherches et sait que beaucoup utilisent des comptes démo pour leurs screenshots. Elle demande des preuves, un track record audité par un tiers, des données chiffrées sur le drawdown max. Elle n'est pas agressive mais très exigeante et méthodique. Elle sort ses objections une par une au fil de la conversation.",
            "objections": ["t'as un track record audité par un tiers ou juste des screenshots ?", "combien tu fais en % de gain par an avec quel drawdown max ?", "la plupart des formateurs gagnent sur la formation pas sur les marchés", "c'est quoi ta stratégie exactement — scalping swing ou autre chose ?", "j'ai lu que 85% des traders particuliers perdent de l'argent"]},
        4: {"prenom": "Patrick", "age": 50, "situation": "chef d'entreprise convaincu que le trading pour particuliers est une arnaque",
            "contexte": "Il a une vision très tranchée basée sur des lectures sérieuses : les marchés sont efficaces, les particuliers n'ont aucun edge contre les algos institutionnels, et les formateurs gagnent sur la formation. Il répond sec et court. Si on lui envoie un message générique il écrit juste '?' ou rien. Il ne cède QUE si la personne déconstruit sa conviction avec des faits précis et des chiffres — pas avec des généralités ou des témoignages flous. Il coupe court dès qu'il sent un discours vendeur.",
            "objections": ["le trading particulier c'est donner son argent aux algos institutionnels", "vous vivez de vos formations pas de vos trades — montrez-moi votre relevé de compte", "l'efficience des marchés c'est prouvé scientifiquement", "j'ai pas de temps à perdre avec ça", "non"]},
    },
    "coaching_sportif": {
        1: [
            {"weight": 50, "prenom": "Ari", "age": 28,
             "situation": "femme qui stagne dans sa perte de poids depuis 8 mois",
             "contexte": "Elle a déjà perdu 30 kg par elle-même mais stagne depuis 8 mois. Veut perdre encore 10-15 kg et se muscler pour éviter que la peau ne relâche. Elle est au chômage en ce moment donc le budget est une vraie contrainte — elle le mentionne si on parle RDV ou argent. Elle est ouverte, répond franchement quand on lui pose des questions sur sa situation. Elle donne ses infos progressivement, pas tout d'un coup.",
             "objections": ["je suis au chômage là c'est compliqué niveau budget", "c'est dans quelle fourchette de prix ?", "j'ai peur de pas pouvoir me le payer"]},
            {"weight": 50, "prenom": "Sarah", "age": 34,
             "situation": "maman solo avec un fils de 10 ans, veut affiner sa taille et muscler son dos, totalement débutante en salle",
             "contexte": "Elle veut se transformer : affiner sa taille, muscler son dos, entretenir le reste. Maxi débutante — les machines l'intimident. Elle peut aller en salle seulement 2 fois par semaine à cause de son fils. Elle a un dérèglement hormonal qui lui fait stocker le sucre, ce qui rend la perte de poids plus difficile malgré une alimentation déjà saine. Positive et ouverte. Elle peut donner son numéro et son email si on les demande APRÈS avoir accepté le RDV.",
             "objections": ["je suis vraiment débutante les machines m'impressionnent", "j'ai un dérèglement hormonal ça complique les choses non ?", "je peux aller en salle que 2 fois par semaine c'est suffisant ?"]},
        ],
        2: {"prenom": "Antoine", "age": 32, "situation": "homme qui s'entraîne de façon irrégulière depuis 1 an sans résultats visibles",
            "contexte": "Il va en salle 1-2 fois par semaine mais sans plan précis. Objectif : sécher et reprendre du muscle. Il sent qu'il tourne en rond. Pas hostile, mais il va poser la question du prix assez tôt. Il hésite sur le timing ('je sais pas si c'est le bon moment avec le boulot'). Si le setter montre qu'il comprend vraiment sa situation, il s'ouvre.",
            "objections": ["c'est combien par mois ?", "j'sais pas si c'est le bon moment avec le boulot en ce moment", "j'ai essayé de suivre des programmes YouTube ça a pas marché", "comment tu fais pour pas lâcher dans la durée ?"]},
        3: [
            {"weight": 49, "prenom": "Romain", "age": 36,
             "situation": "ex-footballeur amateur reconverti en sédentaire, a payé 2 abonnements salle sans les utiliser",
             "contexte": "A pris 18 kg depuis l'arrêt du foot. A payé deux abonnements salle qu'il n'a pas utilisés plus de 6 semaines chacun. Il est méfiant des coachs Instagram qu'il associe au marketing vide et aux promesses de transformations en 90 jours. Il peut être sec au début. Si on creuse vraiment sa situation et qu'on ne sort pas de promesses floues, il s'ouvre progressivement. Il sort ses objections une par une.",
             "objections": ["j'ai déjà pris deux abonnements salle j'ai lâché les deux fois", "c'est quoi ta méthode concrètement — c'est pas encore un programme générique ?", "tous les coachs Instagram disent la même chose", "t'as des résultats sur des gens qui revenaient de zéro comme moi ?", "ça coûte combien ?"]},
            {"weight": 49, "prenom": "Julie", "age": 33,
             "situation": "a perdu 12 kg seule il y a deux ans et les a tous repris depuis",
             "contexte": "Elle sait ce qu'il faut faire en théorie — elle l'a prouvé. Mais elle a tout repris et ça la ronge. Elle remet en question la valeur ajoutée d'un coach : 'je sais déjà quoi faire, le problème c'est de tenir'. Elle est frustrée, pas agressive. Elle s'engage seulement si on lui montre très clairement en quoi un suivi change les choses par rapport à ce qu'elle peut faire seule.",
             "objections": ["j'ai déjà réussi seule donc je vois pas pourquoi payer quelqu'un", "le problème c'est pas de savoir quoi faire c'est de pas craquer", "en quoi tu vas faire différemment de ce que je sais déjà ?", "et si je craque encore dans 3 mois ?", "c'est combien ?"]},
            {"weight": 2, "prenom": "Sabine", "age": 45,
             "situation": "femme avec fibromyalgie qui ne peut pas s'entraîner comme tout le monde",
             "contexte": "Elle fait du yoga, tai chi, méditation mais ne peut pas faire du sport classique à cause de la fibromyalgie. Elle a essayé deux programmes sportifs standards qui n'ont pas tenu compte de sa condition et l'ont laissée épuisée pendant une semaine. Méfiante, elle teste si le coach connaît vraiment sa pathologie. Elle n'est pas agressive mais elle est prête à couper court si elle sent qu'on lui vend un programme générique.",
             "objections": ["est-ce que tu connais vraiment la fibromyalgie ou tu vas m'adapter un programme classique ?", "j'ai essayé un coach qui m'a mis des séances trop intenses j'ai été clouée au lit", "c'est vraiment adapté à ma pathologie spécifiquement ?", "combien ça coûte ?"]},
        ],
        4: {"prenom": "Marc", "age": 50, "situation": "dirigeant d'entreprise, sceptique total du coaching sportif en ligne",
            "contexte": "Il s'entraîne seul depuis 20 ans en salle de sport classique. Il pense que le coaching en ligne c'est pour les gens qui ne savent pas s'autodiscipliner. Il répond très sec et court. Si le premier message est générique il répond juste '?' ou ignore. Il va déconstruire la légitimité méthodiquement. Il peut reconnaître une valeur seulement si le setter montre une compréhension précise de ses blocages SPÉCIFIQUES — pas des généralités. Il dit 'non merci' sans hésiter si la personne reste dans le vague.",
            "objections": ["je m'entraîne seul depuis 20 ans j'ai pas besoin d'un coach Instagram", "t'as des diplômes ou c'est juste de l'expérience personnelle ?", "les résultats avant/après c'est du cherry-picking", "le coaching en ligne c'est pour ceux qui ont pas l'autodiscipline", "non merci"]},
    },
    "coach_relationnel": {
        1: [
            {"weight": 60, "prenom": "Camille", "age": 31,
             "situation": "femme qui traverse une rupture difficile depuis 3 mois après une relation de 4 ans",
             "contexte": "Elle suit le contenu du coach depuis peu. Elle se sent perdue, elle ruminent beaucoup la nuit. Elle répond avec franchise mais progressivement — elle ne va pas tout balancer d'un coup. Quand on lui propose un appel, elle demande si c'est payant et hésite un peu ('j'ai peur d'être pas prête'). Si on la met en confiance, elle s'engage.",
             "objections": ["j'ai peur de pas être prête à en parler vraiment", "j'ai essayé d'en parler à mes amies ça aide pas vraiment", "c'est combien ?"]},
            {"weight": 40, "prenom": "Maxime", "age": 29,
             "situation": "homme qui sort d'une relation toxique et ne comprend pas pourquoi il y est retourné 3 fois",
             "contexte": "Il réalise qu'il a un pattern qui se répète. Il a une vraie demande mais a du mal à l'admettre — en particulier à un inconnu sur Instagram. Il répond court au début. Si on pose les bonnes questions sur sa situation il s'ouvre. Il est ouvert au coaching mais se demande si ça peut vraiment l'aider à changer des choses profondes.",
             "objections": ["j'sais pas si un coach peut vraiment aider sur ce genre de truc", "c'est pas un peu comme la thérapie ?", "c'est combien ?"]},
        ],
        2: {"prenom": "Florian", "age": 36, "situation": "homme qui se sent seul depuis son divorce il y a 8 mois",
            "contexte": "Il a du mal à parler de ses émotions — c'est culturel chez lui. Il répond mais avec des messages courts, parfois un peu défensif. Il va poser la question du prix. Il peut dire 'j'ai pas vraiment besoin d'aide, je gère'. Mais si on creuse bien et qu'on lui pose des questions sur sa vie concrète (ses soirées, ses relations), il finit par admettre qu'il galère.",
            "objections": ["j'ai pas vraiment besoin d'aide pour ça je gère", "je suis un homme je suis pas habitué à ce genre de démarche", "c'est combien ?", "j'sais pas si ça peut vraiment changer quelque chose"]},
        3: {"prenom": "Nathalie", "age": 44, "situation": "femme qui a fait 3 ans de thérapie sans résultats durables et lit du développement perso",
            "contexte": "Elle a fait de la thérapie cognitivo-comportementale, lu une vingtaine de livres de dev perso, fait des stages de PNL. Elle pense qu'elle a tout essayé et que rien ne dure vraiment. Elle n'est pas hostile mais très sceptique sur les méthodes. Elle veut comprendre précisément en quoi c'est différent de ce qu'elle a déjà fait — pas des généralités marketing.",
            "objections": ["j'ai fait 3 ans de thérapie ça n'a rien changé sur le fond", "c'est quoi ta méthode concrètement — c'est pas de la PNL ou du développement perso classique ?", "en quoi c'est différent de la thérapie que j'ai déjà faite ?", "combien ça coûte ?", "j'ai peur de dépenser encore de l'argent pour rien"]},
        4: {"prenom": "Bernard", "age": 52, "situation": "cadre supérieur rationnel et condescendant, pense que le coaching c'est du bullshit new age",
            "contexte": "Il a lu Cialdini, il sait comment fonctionne la persuasion. Il déconstruit les argumentaires dès qu'ils ressemblent à du coaching. Il pense que les problèmes relationnels se règlent par l'action et la réflexion personnelle, pas en payant un inconnu pour parler. Il répond froid et court. Si on lui envoie quelque chose de générique il écrit 'non merci' directement. Il ne s'engage QUE si la personne touche quelque chose de très précis dans sa situation réelle — sans discours vendeur.",
            "objections": ["le coaching c'est pour les gens qui savent pas se gérer seuls", "ça ressemble à du marketing émotionnel pour me faire ouvrir mon portefeuille", "j'ai pas besoin qu'on m'explique ma vie", "c'est quoi ta formation réelle — pas juste une certification de 3 jours ?", "non merci"]},
    },
    "sante": {
        1: [
            {"weight": 55, "prenom": "Laura", "age": 29,
             "situation": "femme avec fatigue chronique et problèmes digestifs depuis 1 an, les médecins n'ont rien trouvé",
             "contexte": "Elle suit le contenu santé naturelle depuis quelques semaines. Elle a des ballonnements quotidiens et une fatigue à partir de 15h. Les analyses médicales sont normales, les médecins lui ont dit que c'est 'le stress'. Elle est ouverte aux approches naturelles mais a peur des fausses promesses. Elle répond honnêtement sur sa situation. Au moment du RDV elle demande les dispo et le prix.",
             "objections": ["j'ai peur que ce soit encore une promesse miracle sans résultats", "j'ai déjà vu un naturopathe l'an dernier sans résultats", "c'est combien ?"]},
            {"weight": 45, "prenom": "Hugo", "age": 33,
             "situation": "homme stressé avec des troubles du sommeil depuis sa promotion au travail",
             "contexte": "Depuis sa promotion il y a 6 mois, il dort mal, se réveille à 3h, se sent épuisé en journée. Il a essayé la mélatonine sans résultats. Il est ouvert à comprendre le lien alimentation/sommeil mais un peu sceptique sur les approches naturelles. Il répond aux questions. Si on lui explique le lien entre son alimentation et son sommeil de façon concrète, il s'engage.",
             "objections": ["j'ai essayé la mélatonine ça a pas changé grand-chose", "l'alimentation ça peut vraiment changer le sommeil ?", "c'est combien l'accompagnement ?"]},
        ],
        2: {"prenom": "Thomas", "age": 38, "situation": "homme en surpoids depuis 3 ans qui a essayé Weight Watchers, keto et jeûne intermittent",
            "contexte": "Rien n'a tenu plus de 2 mois. Il est motivé mais découragé. Il pense que son problème c'est le mental pas l'alimentation — il sait quoi manger, il n'y arrive pas dans la durée. Il va mentionner ses échecs passés. Il pose la question du prix assez rapidement. Si on lui montre que tu comprends pourquoi ses tentatives passées n'ont pas marché, il peut s'engager.",
            "objections": ["j'ai essayé plein de régimes ça marche jamais longtemps", "c'est quoi la différence avec le keto ou le jeûne que j'ai déjà essayé ?", "le problème c'est pas de savoir quoi manger c'est de tenir", "combien ça coûte ?"]},
        3: {"prenom": "Isabelle", "age": 46, "situation": "femme hypothyroïdie qui a beaucoup cherché et ne fait confiance qu'aux sources sérieuses",
            "contexte": "Elle a une hypothyroïdie de Hashimoto. Elle a lu des études PubMed, suivi des médecins spécialisés sur YouTube. Elle sait que l'alimentation peut influencer les marqueurs inflammatoires mais elle est méfiante des gens qui promettent de 'guérir la thyroïde avec l'alimentation' sans connaître les spécificités de Hashimoto. Elle pose des questions très précises et teste la crédibilité avec des détails techniques.",
            "objections": ["est-ce que tu connais spécifiquement Hashimoto ou tu connais juste les thyroïdes en général ?", "j'ai lu que le gluten aggrave l'inflammation dans Hashimoto — c'est dans ton protocole ?", "les médecins me disent que l'alimentation change pas les anticorps TPO", "c'est quoi exactement ta formation ?", "combien ça coûte ?"]},
        4: {"prenom": "Michel", "age": 55, "situation": "médecin généraliste très sceptique de toute approche non conventionnelle",
            "contexte": "Il pense que tout ce qui n'est pas validé par des essais cliniques randomisés est de la pseudoscience au mieux, de la charlatanerie au pire. Il peut être sec et coupant. Il répond très court. Si on lui envoie quelque chose de générique il répond 'non merci' ou ne répond pas. Il peut s'intéresser UNIQUEMENT si on cite des études sérieuses avec des numéros PMID ou des méta-analyses — pas des témoignages de clients.",
            "objections": ["t'as des études RCT publiées dans des revues à comité de lecture ?", "les témoignages clients c'est du biais de confirmation pas une preuve", "vous jouez avec la santé de gens vulnérables", "j'ai 20 ans de pratique médicale rien de ce que tu dis ne m'apprend quelque chose", "non"]},
    },
    "immobilier": {
        1: [
            {"weight": 55, "prenom": "Théo", "age": 26,
             "situation": "jeune salarié CDI qui veut faire son premier investissement locatif mais ne sait pas par où commencer",
             "contexte": "Il gagne 2 400€/mois, a 15 000€ d'économies, n'a aucune connaissance en investissement. Il a entendu parler du locatif comme 'meilleur investissement' mais ne sait pas si son profil convient. Il répond aux questions sur sa situation. Au moment du RDV il demande si c'est payant et les dispo.",
             "objections": ["j'ai 15 000€ d'économies c'est assez pour un apport ?", "les taux sont élevés en ce moment c'est vraiment le bon moment ?", "c'est combien l'accompagnement ?"]},
            {"weight": 45, "prenom": "Manon", "age": 28,
             "situation": "infirmière qui veut investir pour ne pas dépendre que de son salaire",
             "contexte": "Elle voit ses collègues partir à la retraite avec de petites pensions. Elle veut créer un patrimoine mais elle a très peu de temps à consacrer à l'apprentissage. Elle est motivée par la sécurité financière. Elle répond facilement. Elle s'engage si on lui montre que c'est accessible même avec peu de temps.",
             "objections": ["j'ai pas beaucoup de temps pour me former entre mes gardes", "j'ai peur de me planter sur mon premier achat", "c'est combien ?"]},
        ],
        2: {"prenom": "Claire", "age": 34, "situation": "salariée qui veut investir mais a peur de se tromper avec les taux actuels et la fiscalité",
            "contexte": "Elle voudrait investir mais elle a peur : les taux hauts, les mauvais locataires, la fiscalité qu'elle ne comprend pas (LMNP ? SCI ? elle est perdue). Elle pose des questions concrètes sur la faisabilité. Elle va mentionner qu'elle a pas beaucoup de capital (20 000€). Elle peut s'engager si on la rassure avec des éléments précis, pas des généralités.",
            "objections": ["j'ai pas beaucoup d'apport — est-ce que 20 000€ c'est suffisant ?", "les taux à 4% ça ne tue pas la rentabilité ?", "j'ai peur des mauvais locataires et des procédures d'expulsion", "combien ça coûte votre accompagnement ?"]},
        3: {"prenom": "Alain", "age": 49, "situation": "investisseur avec un locataire impayé pendant 14 mois qui le dégoûte de l'immobilier",
            "contexte": "Il a vécu 14 mois d'impayés, une procédure d'expulsion qui a coûté 8 000€ d'avocat, et le bien a été laissé dans un état catastrophique. Il est amer. Il veut comprendre très concrètement comment éviter ça — pas des conseils vagues sur 'bien sélectionner'. Il est méfiant de tout ce qui semble trop optimiste. Il sort ses objections dans l'ordre, une par une.",
            "objections": ["j'ai eu un locataire impayé 14 mois — t'as une vraie solution à ça ou juste des conseils vagues ?", "la garantie Visale ça couvre quoi exactement ?", "les rendements nets après charges impôts vacance locative c'est jamais ce qu'on annonce", "t'as combien de biens en propre et t'as eu des impayés ?", "c'est quoi votre accompagnement concrètement ?"]},
        4: {"prenom": "Dominique", "age": 54, "situation": "agent immobilier transactionnel depuis 22 ans qui pense que les formateurs immo en ligne sont des charlatans",
            "contexte": "Il a vu le marché de l'intérieur pendant 22 ans. Il connaît les prix au m² par quartier, il a négocié des centaines de mandats, il a vu des cycles de marché. Il pense que les 'formateurs immobilier' en ligne n'ont jamais fait eux-mêmes ce qu'ils enseignent, ou alors sur 2-3 biens en plein boom et maintenant ils vendent leurs 'secrets'. Il répond très froid et court. Il attend que la personne prouve quelque chose avant d'investir une seconde de son temps.",
            "objections": ["je fais de l'immo depuis 22 ans j'ai rien à apprendre d'un formateur YouTube", "le marché 2024-2025 c'est rien à voir avec les périodes où vous avez fait vos 'succès'", "t'as combien de biens en propre — acheté avec tes propres deniers pas des fonds d'autres ?", "vos formations c'est pour gagner de l'argent sur des débutants crédules", "non merci"]},
    },
    "ecommerce": {
        1: [
            {"weight": 55, "prenom": "Léa", "age": 24,
             "situation": "étudiante en fin de master marketing qui veut lancer une boutique en ligne dans les cosmétiques naturels",
             "contexte": "Elle a une idée de produit, elle a fait son mémoire sur le marketing digital. Elle est motivée mais n'a jamais lancé de business réel. Elle a peur de gaspiller son argent sur du stock qui ne se vend pas. Elle répond facilement aux questions. Au moment du RDV elle demande les dispo et le tarif.",
             "objections": ["j'ai peur de commander du stock et que ça ne se vende pas", "est-ce que les cosmétiques naturels c'est trop saturé ?", "c'est combien l'accompagnement ?"]},
            {"weight": 45, "prenom": "Clément", "age": 27,
             "situation": "jeune salarié qui veut créer un side business en ligne pour ne pas dépendre que de son salaire",
             "contexte": "Il gagne 2 000€/mois, il a 3 000€ de budget pour se lancer. Il hésite entre dropshipping et marque propre. Il a regardé beaucoup de vidéos YouTube mais est perdu dans les contradictions. Il est motivé mais a besoin d'être orienté. Il répond facilement et s'engage si on lui donne une direction claire.",
             "objections": ["j'ai regardé des vidéos YouTube sur le dropshipping et la marque propre j'arrive pas à choisir", "j'ai seulement 3 000€ c'est suffisant pour commencer ?", "c'est combien ?"]},
        ],
        2: {"prenom": "Aurélien", "age": 32, "situation": "salarié cadre qui veut un complément de revenus mais manque de temps",
            "contexte": "Il a regardé des vidéos YouTube, il a même acheté une formation Udemy il y a 6 mois qu'il n'a pas terminée. Il voudrait se lancer mais il a peur de perdre de l'argent et surtout il n'a que 5-6h par semaine à y consacrer. Il va mentionner ses contraintes (temps, budget limité à 2 000€). Il peut s'engager si on lui montre que c'est faisable avec ses contraintes réelles.",
            "objections": ["j'ai déjà une formation Udemy que j'ai pas terminée — en quoi c'est différent ?", "j'ai que 5-6h par semaine c'est suffisant pour faire quelque chose de sérieux ?", "combien de temps avant les premiers résultats — j'ai besoin de savoir si c'est réaliste", "c'est combien l'accompagnement ?"]},
        3: {"prenom": "Kevin", "age": 37, "situation": "a lancé une boutique dropshipping il y a 2 ans et perdu 2 500€ en pub Facebook",
            "contexte": "Il a essayé, il a suivi des conseils de formateurs YouTube, il a cramé 2 500€ en Facebook Ads sans vendre suffisamment. Il est amer et sceptique. Il va le mentionner assez vite. Il veut comprendre précisément en quoi c'est différent — pas des généralités. Il demande des preuves concrètes vérifiables. Il pense que le modèle dropshipping est saturé et que les seuls qui gagnent de l'argent c'est les formateurs qui vendent leurs méthodes.",
            "objections": ["j'ai déjà essayé le dropshipping j'ai perdu 2500€ en pub Facebook", "le dropshipping c'est saturé et les marges sont nulles", "t'as des screenshots de revenus vérifiables pas juste du Stripe éditable ?", "en quoi ta méthode est différente de ce que les YouTubeurs enseignent ?", "j'ai l'impression que les seuls qui gagnent c'est les formateurs"]},
        4: {"prenom": "Sandra", "age": 44, "situation": "gérante d'une boutique de décoration physique depuis 12 ans, très hostile au e-commerce 'de formation'",
            "contexte": "Elle gère un vrai commerce depuis 12 ans : charges, stock, saisonnalité, clients difficiles. Elle pense que les formations e-commerce vendent du rêve à des naïfs qui n'ont aucune idée de ce que c'est de gérer un business réel. Elle est directe et condescendante. Elle connaît les vrais problèmes (logistique, SAV, taux de retour, coûts pub…). Elle dit 'non merci' rapidement si la personne n'est pas précise et honnête.",
            "objections": ["le vrai commerce ça n'a rien à voir avec ce que vous enseignez — vous parlez pas des retours, du SAV, des coûts réels", "vous vendez du rêve à des gens qui ont jamais géré une trésorerie", "les marges en e-comm après pub et retours c'est souvent négatif", "t'as eu combien de boutiques toi-même et pendant combien de temps ?", "non merci"]},
    },
    "investissement": {
        1: [
            {"weight": 55, "prenom": "Océane", "age": 26,
             "situation": "jeune salariée avec 8 000€ sur un Livret A qui veut faire fructifier son argent",
             "contexte": "Elle a entendu parler des ETF et de la bourse sur TikTok/Instagram. Elle a peur de perdre son argent mais elle réalise que son Livret A à 3% perd contre l'inflation. Elle est curieuse, ouverte, et répond facilement. Elle n'a aucune connaissance financière (elle ne sait pas ce qu'est un PEA ou un ETF MSCI World). Elle s'engage si on lui explique simplement.",
             "objections": ["j'ai peur de tout perdre si la bourse s'effondre", "je comprends rien aux actions et aux ETF c'est compliqué non ?", "c'est combien l'accompagnement ?"]},
            {"weight": 45, "prenom": "Baptiste", "age": 29,
             "situation": "salarié qui veut atteindre l'indépendance financière d'ici 10 ans",
             "contexte": "Il a lu des livres sur le mouvement FIRE (Financial Independence, Retire Early) et il est motivé. Il épargne 30% de son salaire mais ne sait pas où le placer efficacement (tout est sur le Livret A et un vieux contrat d'assurance-vie que ses parents lui ont ouvert). Il veut un plan concret. Répond facilement et s'engage si on montre une vraie méthode.",
             "objections": ["j'ai une assurance-vie de mes parents mais je sais même pas ce qu'il y a dedans", "par où je commence — ETF, PEA, assurance-vie c'est quoi la priorité ?", "c'est combien ?"]},
        ],
        2: {"prenom": "Sébastien", "age": 37, "situation": "salarié qui a un PEA ouvert il y a 2 ans avec des actions en négatif",
            "contexte": "Il a ouvert un PEA et acheté quelques actions au feeling (LVMH, Total, une biotech qui a chuté de 70%). Il ne sait pas s'il doit garder ou vendre. Il n'a aucune stratégie claire. Il est motivé mais découragé par ses erreurs. Il pose des questions concrètes sur ce qu'il faut faire de son portefeuille actuel avant d'en parler en appel.",
            "objections": ["j'ai déjà un PEA mais il est dans le rouge à cause d'une biotech que j'ai mal choisie", "c'est quoi la différence entre investir seul et payer quelqu'un pour m'aider ?", "combien de temps avant de voir des résultats concrets ?", "c'est combien l'accompagnement ?"]},
        3: {"prenom": "Valérie", "age": 45, "situation": "femme qui a perdu 30% de son portefeuille dans le krach de 2022 et ne fait plus confiance aux 'experts'",
            "contexte": "Elle avait investi 40 000€ en suivant les conseils d'un 'expert' YouTube en 2021 (beaucoup de tech US) et a perdu 30% en 2022. Elle a tout vendu en panique au plus bas. Elle est très méfiante de quiconque se présente comme un expert en investissement. Elle veut des preuves, de la transparence sur les risques réels, et ne supporte pas les discours trop optimistes. Elle sort ses objections une par une.",
            "objections": ["j'ai suivi un 'expert' YouTube et perdu 12 000€ en 2022 — pourquoi tu serais différent ?", "tout le monde dit qu'il faut investir sur le long terme mais personne te dit quoi faire quand ça chute de 40%", "c'est quoi ta performance réelle sur 2022 — l'année qui trie les vrais des faux ?", "combien ça coûte et qu'est-ce que tu garantis exactement ?"]},
        4: {"prenom": "Frédéric", "age": 53, "situation": "directeur financier d'une PME, pense que le coaching en investissement c'est pour les amateurs",
            "contexte": "Il gère la trésorerie et les placements de son entreprise depuis 20 ans. Il a un patrimoine personnel diversifié (immo, actions, SCPI, private equity). Il pense que les 'coachs investissement' sur les réseaux sociaux sont des vendeurs de rêve qui s'adressent à des gens sans éducation financière. Il répond froid et court. Si le premier message est générique il répond '?' ou rien. Il peut s'intéresser UNIQUEMENT si la personne montre une maîtrise précise des marchés et une honnêteté sur les limites du coaching.",
            "objections": ["je gère des placements depuis 20 ans je vois pas ce que tu peux m'apprendre", "tes clients investissent combien et avec quels rendements nets de frais et d'impôts ?", "le coaching en invest c'est pour gens qui savent pas lire un bilan ou une fiche AMF", "la performance passée ne préjuge pas des performances futures — t'as quoi d'autre à me vendre ?", "non merci"]},
    },
    "saas": {
        1: [
            {"weight": 55, "prenom": "Tom", "age": 27,
             "situation": "développeur backend qui a une idée de SaaS B2B mais ne sait pas comment trouver ses premiers clients",
             "contexte": "Il sait coder, il a une idée d'outil pour les RH (suivi des congés automatisé). Il a peur de construire quelque chose que personne ne veut vraiment. Il est motivé. Il répond aux questions sur son projet. Au moment du RDV il demande les dispo et le tarif.",
             "objections": ["j'ai peur de construire quelque chose que personne va vraiment payer", "comment tu valides une idée avant de coder 6 mois ?", "c'est combien ?"]},
            {"weight": 45, "prenom": "Anaïs", "age": 30,
             "situation": "product manager qui veut lancer son propre SaaS pour avoir plus de liberté",
             "contexte": "Elle connaît bien le produit et l'ux mais pas le côté acquisition/vente. Elle a une idée de SaaS pour les freelances (gestion des devis et factures). Elle est analytique. Elle répond aux questions facilement. Elle s'engage si on lui montre une méthode concrète pour les premières ventes.",
             "objections": ["je maîtrise le product mais la partie vente c'est opaque pour moi", "comment tu fais pour vendre à des freelances qui ont pas de budget ?", "c'est combien ?"]},
        ],
        2: {"prenom": "Mathieu", "age": 34, "situation": "entrepreneur qui a lancé 2 SaaS sans trouver de clients payants au-delà des proches",
            "contexte": "Il a essayé de lancer deux produits SaaS. Les deux avaient des utilisateurs gratuits mais pas de vrais clients payants. Il commence à se demander si le problème c'est lui ou ses idées. Il est toujours motivé mais il a besoin de comprendre précisément ce qu'il fait mal. Il va poser des questions concrètes sur la validation client et l'acquisition early-stage.",
            "objections": ["j'ai lancé 2 SaaS sans trouver de vrais clients payants", "c'est quoi ta méthode pour passer de 0 à 10 clients payants — c'est ça mon problème", "combien ça coûte ?", "comment tu sais que ta méthode va marcher pour mon secteur spécifique ?"]},
        3: {"prenom": "Nicolas", "age": 41, "situation": "CTO avec 15 ans d'expérience produit, très méfiant des formateurs 'business SaaS' sans background tech",
            "contexte": "Il a buildé 3 produits SaaS de A à Z, dont un vendu pour 800K€. Il pense que la plupart des formateurs SaaS enseignent des généralités marketing sans comprendre les vraies contraintes techniques et de distribution. Il va tester les connaissances avec des questions très précises (stack, métriques SaaS, cohortes, NPS…). Il n'est pas agressif mais très exigeant et ne perdra pas son temps si les réponses sont vagues.",
            "objections": ["t'as buildé et vendu combien de SaaS toi-même — pas juste coaché des gens qui l'ont fait ?", "c'est quoi ton opinion sur le PLG vs sales-led pour un SaaS B2B à 200€/mois ?", "les frameworks génériques marchent pas dans le SaaS — chaque verticale est différente", "je vois pas ce que tu peux m'apporter que je sais pas déjà après 15 ans dans le produit"]},
        4: {"prenom": "Éric", "age": 49, "situation": "business angel qui a perdu de l'argent sur plusieurs SaaS B2B et est devenu cynique",
            "contexte": "Il a investi dans 12 startups SaaS dont 9 ont fermé. Il connaît les vraies statistiques d'échec. Il est cynique et déconstruit tout avec des métriques : CAC, LTV, churn, runway. Il pense que les coachs SaaS vendent de l'espoir à des gens qui auraient mieux fait de prendre un emploi stable. Il répond froid et court. Il dit 'non je passe' dès que la personne manque de précision sur les métriques ou parle de 'passion' et de 'liberté'.",
            "objections": ["9 des 12 SaaS dans lesquels j'ai investi ont fermé — t'as quoi à me dire que je sais pas déjà ?", "sans un CAC < 3 mois de LTV ton SaaS est mort dès le début — c'est quoi ton modèle là-dessus ?", "les formateurs SaaS vendent de l'espoir à des gens qui auraient mieux fait de garder leur CDI", "t'as des métriques vérifiables sur tes coachés — pas juste des screenshots", "non je passe"]},
    },
}


# ── Personas B2B (trafic froid — entrepreneurs ciblés) ──────────────────────
PERSONAS_B2B: dict[str, dict[int, dict]] = {
    "trading": {
        1: {"prenom": "Jordan", "age": 29,
            "situation": "entrepreneur e-commerce qui a posté sur ses revenus et veut mieux gérer son argent",
            "contexte": "Il gagne 5-8k€/mois avec sa boutique en ligne, a posté récemment sur son lifestyle. Il ne sait pas quoi faire de ses bénéfices au-delà du livret A. Il a répondu à ton opener de façon détendue. Si le pivot part de SA situation (qu'est-ce qu'il fait de ses bénéfices) → il s'ouvre. Si tu parles de toi ou de ton offre directement → il part.",
            "objections": ["j'ai un comptable qui gère ça", "c'est quoi exactement ce que tu proposes ?", "j'ai pas trop le temps là"]},
        2: {"prenom": "Karim", "age": 35,
            "situation": "consultant indépendant avec 15k€/mois qui a posté sur l'investissement et la liberté financière",
            "contexte": "Il a déjà reçu des DMs de setters. Il répond si l'opener est sympa mais il teste le pivot. Si tu fais le classique 'au fait je t'ai DM parce que je travaille avec X' → il te coupe : 'ah ouais c'est pour vendre quelque chose, ok'. Il faut partir de CE QU'IL A DIT dans son post sur l'investissement.",
            "objections": ["j'ai déjà quelqu'un pour mes investissements", "t'es setter pour qui exactement ?", "c'est quoi ta commission là-dedans ?"]},
        3: {"prenom": "Alexis", "age": 38,
            "situation": "fondateur d'une agence marketing profitable, reçoit 15+ DMs setter/semaine",
            "contexte": "Il reconnaît les techniques setter au 3e message. Si tu fais un pivot maladroit il te le dit directement : 'écoute je vois où tu veux aller, c'est quoi ton offre clairement'. Il peut s'intéresser SEULEMENT si le setter prouve qu'il comprend ses enjeux financiers précis en tant que chef d'entreprise — pas juste 'optimiser ses revenus'.",
            "objections": ["soyons directs c'est quoi ton offre ?", "j'ai déjà essayé ce type d'approche", "pourquoi le trading et pas autre chose ?", "t'as des résultats vérifiables sur des profils comme moi ?"]},
        4: {"prenom": "Vincent", "age": 45,
            "situation": "serial entrepreneur avec 3 sociétés, 200k+ followers, entouré de conseillers financiers",
            "contexte": "Il a une assistante qui filtre ses DMs. Il répond lui-même quand quelque chose l'intéresse vraiment. Il voit les techniques setter immédiatement. Il répond court et sec. Si le pivot n'est pas EXCEPTIONNEL il écrit 'non merci' ou arrête de répondre. Il n'a strictement aucun besoin — il faut créer la curiosité avec quelque chose de très précis sur SA situation.",
            "objections": ["j'ai des gérants de patrimoine pour ça", "non merci", "...", "je gère ça en interne"]},
    },
    "coaching_sportif": {
        1: {"prenom": "Yasmine", "age": 28,
            "situation": "créatrice de contenu lifestyle qui a posté sur sa fatigue et son manque d'activité physique",
            "contexte": "Elle a posté une story sur 'je travaille trop, j'ai arrêté le sport depuis 4 mois'. Elle a répondu à ton opener sur sa localisation (elle est à Lisbonne). Si tu pars de sa story sur le sport et la fatigue pour amener la conversation → elle est ouverte. Si tu parles de toi directement → 'ah ouais c'est pour vendre un coaching, ok'.",
            "objections": ["j'ai pas trop le budget", "j'ai déjà essayé des coachs en ligne ça marchait pas", "c'est combien ?"]},
        2: {"prenom": "Thomas", "age": 33,
            "situation": "consultant freelance qui a posté sur l'équilibre pro/perso et sa difficulté à se remettre au sport",
            "contexte": "Il travaille 60h/semaine, a pris 8 kg en 2 ans. Il a répondu à ton opener sur son rythme de travail. Il a déjà reçu des DMs de coachs. Il teste si tu vas lui parler de toi ou de lui. Si tu pars de ce qu'il t'a dit sur son rythme de vie → il s'engage. Si tu fais le switch classique → 'ah voilà, je savais que ça allait partir là'.",
            "objections": ["j'ai vraiment pas le temps de m'ajouter quelque chose", "c'est quoi concrètement l'accompagnement ?", "ça se passe comment en ligne ?"]},
        3: {"prenom": "Romain", "age": 40,
            "situation": "CEO d'une PME de 20 personnes qui reçoit beaucoup de DMs de coachs sportifs",
            "contexte": "Il se lève à 5h30 mais il ne fait plus de sport depuis 6 mois. Il a posté là-dessus. Il reconnaît les techniques de pivot et les signale : 'attends tu m'as contacté pour me vendre un coaching c'est ça ?'. Il peut s'intéresser si le setter montre qu'il comprend PRÉCISÉMENT pourquoi un CEO de 40 ans n'arrive pas à se remettre au sport — pas de généralités.",
            "objections": ["soyons clairs c'est pour vendre un coaching ?", "j'ai déjà un abonnement salle que j'utilise pas", "en quoi c'est différent d'un coach perso classique ?"]},
        4: {"prenom": "Stéphane", "age": 47,
            "situation": "dirigeant d'entreprise connu, 50k+ followers, team qui gère ses DMs",
            "contexte": "Il lit ses DMs lui-même le matin. Il répond à 1 sur 20. Son opener devait être excellent pour qu'il réponde. Maintenant il attend de voir si le setter va lui parler de SA situation ou de son offre. Il écrit 'non merci' très facilement. Seule une approche ultra personnalisée et non-commerciale peut fonctionner.",
            "objections": ["non merci", "j'ai déjà un préparateur physique", "...", "on peut couper là j'ai pas le temps"]},
    },
    "coach_relationnel": {
        1: {"prenom": "Manon", "age": 30,
            "situation": "manager d'une petite équipe de 5 qui a posté sur ses difficultés à gérer les conflits",
            "contexte": "Elle vient d'être promue team lead et galère avec la gestion humaine. Elle a répondu à ton opener sur son nouveau rôle. Si tu pars de SES difficultés de management pour amener la conversation → elle est ouverte et même soulagée d'en parler. Si tu parles de toi → elle se referme.",
            "objections": ["c'est quoi exactement ce que tu peux m'apporter ?", "c'est combien ?", "j'ai pas de budget là"]},
        2: {"prenom": "Julien", "age": 37,
            "situation": "entrepreneur solo qui a posté sur son burnout et son besoin de 'recentrage' personnel",
            "contexte": "Il traverse une période difficile : business qui tourne mais vie perso chaotique. Il a répondu à ton opener mais il est prudent. Il a déjà vu des setters. Si tu arrives à lui montrer que tu as compris sa vraie situation (pas juste 'tu sembles stressé') → il s'engage. Sinon → 'ok j'ai compris le but c'est de me vendre quelque chose'.",
            "objections": ["en quoi c'est différent d'une thérapie ?", "j'ai pas trop confiance dans ce genre d'accompagnement", "c'est combien ?"]},
        3: {"prenom": "Caroline", "age": 43,
            "situation": "DRH d'une ETI, elle-même experte en développement humain, reçoit beaucoup de DMs de coachs",
            "contexte": "Elle connaît tous les jargons du coaching. Elle teste les setters en leur posant des questions précises sur la méthode. Elle est méfiante des gens qui parlent de 'transformation' sans définir ce que ça veut dire. Elle peut s'engager si le setter montre une vraie compréhension de SA problématique spécifique (pas un pitch générique).",
            "objections": ["c'est quoi ta certification ?", "soyons directs tu travailles pour quel coach ?", "j'ai déjà un coach perso", "je vois vraiment pas ce que ça pourrait m'apporter"]},
        4: {"prenom": "David", "age": 50,
            "situation": "associé dans un cabinet de conseil, très rationnel, pense que le coaching c'est du soft",
            "contexte": "Il a répondu à ton opener parce que la question était honnêtement intéressante. Mais là il attend. Il peut couper la conversation en une phrase. Il n'acceptera un appel que si le setter trouve quelque chose de TRÈS précis dans sa situation publique qui montre une compréhension réelle — pas un pitch générique sur 'les relations professionnelles'.",
            "objections": ["écoute je vois le pattern, c'est quoi ton offre ?", "non merci", "j'ai pas besoin de ça"]},
    },
    "sante": {
        1: {"prenom": "Inès", "age": 26,
            "situation": "créatrice de contenu beauté/lifestyle qui a posté sur sa fatigue et ses troubles digestifs",
            "contexte": "Elle a une audience de 30k, elle parle souvent de bien-être. Elle a répondu à ton opener sur sa routine matinale. Si tu pars de ce qu'elle a partagé sur sa fatigue → elle est très ouverte. Elle cherche des solutions depuis quelques mois. Si tu lui parles d'emblée de ton offre → 'ah encore un coach qui veut m'aider, ok'.",
            "objections": ["j'ai déjà un nutritionniste", "c'est quoi ta spécialité exactement ?", "c'est combien ?"]},
        2: {"prenom": "Cédric", "age": 35,
            "situation": "entrepreneur qui a posté sur sa productivité et son manque d'énergie depuis 1 an",
            "contexte": "Il a essayé plein de choses : intermittent, suppléments, méditation. Rien de durable. Il a répondu à ton opener sur ses habitudes de travail. Il teste si tu comprends vraiment son problème ou si tu lui vas juste vendre un programme générique. Il s'engage si le setter pose les bonnes questions sur SA situation précise.",
            "objections": ["j'ai déjà essayé plusieurs approches", "c'est quoi de différent dans ce que tu proposes ?", "combien de temps avant de voir des résultats ?"]},
        3: {"prenom": "Sophie", "age": 41,
            "situation": "associée dans un cabinet d'audit, travaille 55h/semaine, a posté sur le lien performance/santé",
            "contexte": "Elle reçoit régulièrement des DMs de 'coachs bien-être'. Elle est sceptique. Elle peut s'intéresser si le setter montre une maîtrise réelle des problématiques santé des personnes très actives (pas juste 'mange mieux, dors plus'). Elle reconnaît les techniques et les signale directement.",
            "objections": ["t'es setter pour qui exactement ?", "c'est quoi ta formation réelle ?", "j'ai un médecin du sport pour ça", "non merci"]},
        4: {"prenom": "Laurent", "age": 48,
            "situation": "CEO biohacker connu, 80k followers, publie régulièrement sur sa routine santé",
            "contexte": "Il pense tout savoir sur la santé et la performance. Il reçoit 20+ DMs/jour de coachs santé. Il a répondu à ton opener par curiosité sur ta question. Maintenant il attend de voir si tu as quelque chose d'ORIGINAL à lui dire sur sa situation. Si c'est générique → '... ok non merci'. Il n'a strictement aucun besoin perçu.",
            "objections": ["j'en sais probablement plus que ton coach sur ce sujet", "non", "...", "je fais déjà tout ça"]},
    },
    "immobilier": {
        1: {"prenom": "Lucas", "age": 27,
            "situation": "entrepreneur e-com qui affiche un beau lifestyle et a posté sur ses projets d'investissement",
            "contexte": "Il gagne bien, vit bien, mais ne sait pas quoi faire de son argent au-delà du livret A. Il a répondu à ton opener sur sa localisation (Barcelone). Il est ouvert si le setter part de SA situation (qu'est-ce qu'il fait de ses revenus) plutôt que de parler de l'immobilier directement.",
            "objections": ["j'ai peur de me tromper sur un premier achat", "les taux sont élevés là non ?", "c'est combien l'accompagnement ?"]},
        2: {"prenom": "Aurore", "age": 34,
            "situation": "consultante RH indépendante avec 6-8k€/mois, a posté sur la construction de patrimoine",
            "contexte": "Elle veut investir mais elle a peur de se planter seule. Elle a répondu à ton opener sur son parcours professionnel. Elle a déjà reçu des DMs de formateurs immo. Elle teste si tu as compris sa situation précise ou si tu vas lui sortir un pitch générique sur 'investir dans l'immobilier c'est la meilleure décision'.",
            "objections": ["j'ai déjà regardé des formations en ligne", "c'est quoi ta valeur ajoutée vs YouTube ?", "combien ça coûte ?"]},
        3: {"prenom": "Frédéric", "age": 42,
            "situation": "gérant d'une PME avec un bon cashflow, a déjà été approché par 5+ formateurs immo, tous l'ont déçu",
            "contexte": "Il a essayé de se lancer seul dans l'immo il y a 3 ans — ça n'a pas donné grand-chose. Il est méfiant des promesses trop belles. Il reçoit des DMs de formateurs immo régulièrement et reconnaît immédiatement le pattern. Le setter doit montrer une vraie compréhension de ses blocages spécifiques (complexité de la gestion, risque locatif pour quelqu'un de très occupé).",
            "objections": ["j'ai déjà essayé de me lancer seul", "c'est quoi ton expérience réelle en tant qu'investisseur ?", "tous les formateurs disent la même chose", "non merci"]},
        4: {"prenom": "Bertrand", "age": 52,
            "situation": "actionnaire d'un groupe de 3 sociétés, entouré de conseillers financiers, sait tout de l'immo",
            "contexte": "Il gère déjà un patrimoine immobilier. Il a répondu à l'opener par politesse. Il voit la technique instantanément. Il écrira 'non merci' dès qu'il sentira un pitch. Le seul angle possible est de trouver quelque chose de TRÈS précis dans son profil public qui montre qu'on a compris une problématique qu'il n'a pas encore résolue.",
            "objections": ["j'ai 12 biens en propre j'ai pas besoin de formation", "non merci", "...", "j'ai un cabinet de gestion pour ça"]},
    },
    "ecommerce": {
        1: {"prenom": "Chloé", "age": 25,
            "situation": "artisane créatrice qui vend ses bijoux sur Instagram et veut passer à une vraie boutique en ligne",
            "contexte": "Elle fait 800-1500€/mois de ventes sur Insta mais plafonne. Elle a posté sur sa frustration de ne pas savoir 'scaler'. Elle a répondu à ton opener sur son univers créatif. Elle est très ouverte si le setter montre qu'il comprend SON type de business (artisan, pas dropshipping).",
            "objections": ["mon business c'est très spécifique, c'est pas du dropshipping", "j'ai pas beaucoup de budget pour scaler", "c'est combien ?"]},
        2: {"prenom": "Maxime", "age": 31,
            "situation": "gérant d'une boutique physique qui a lancé son site e-commerce il y a 6 mois sans résultats",
            "contexte": "Son site fait 2-3 ventes par semaine malgré sa clientèle physique. Il a posté sa frustration là-dessus. Il a répondu à ton opener sur son secteur (la décoration). Il a déjà reçu des DMs de 'coachs e-com'. Il teste si le setter comprend vraiment pourquoi une boutique physique ne se transforme pas automatiquement en succès en ligne.",
            "objections": ["j'ai déjà un site et ça marche pas", "c'est quoi concrètement ce que tu proposes ?", "j'ai pas trop le temps en plus du physique", "combien ça coûte ?"]},
        3: {"prenom": "Guillaume", "age": 38,
            "situation": "e-commerçant avec 200k€/an de CA mais marges en chute libre, reçoit des DMs de coachs e-com hebdomadairement",
            "contexte": "Il sait ce qu'il fait. Il a des problèmes très spécifiques (coût d'acquisition pub Facebook qui explose, retours en hausse). Il reconnaît immédiatement les setters. Si le setter montre qu'il comprend SPÉCIFIQUEMENT ses enjeux (coût d'acq, ROAS, marges nettes) → il peut s'intéresser. Si c'est générique → 'ouais ok c'est pour vendre du coaching'.",
            "objections": ["mon problème c'est pas de vendre c'est les marges et le CAC", "t'as des clients avec des boutiques à mon niveau ?", "soyons directs c'est quoi ton offre ?"]},
        4: {"prenom": "Patricia", "age": 44,
            "situation": "fondatrice d'une marque e-com avec 3M€ de CA, équipe de 8 personnes, zéro patience pour les setters",
            "contexte": "Elle a un responsable acquisition, un DAF, un ops manager. Elle reçoit des DMs de coachs e-com tous les jours. Elle a répondu à ton opener parce que la question était pertinente. Elle attend de voir si tu vas lui parler de toi ou d'elle. Elle dira 'non merci' si c'est générique. Pour la convaincre il faut montrer une compréhension de problèmes à son échelle.",
            "objections": ["non merci", "on gère ça en interne", "...", "t'as des clients à 3M€ ?"]},
    },
    "saas": {
        1: {"prenom": "Antoine", "age": 26,
            "situation": "dev qui a lancé un micro-SaaS de gestion de factures et a posté sur ses premiers utilisateurs",
            "contexte": "Il a 50 utilisateurs gratuits mais aucun payant. Il a posté là-dessus. Il a répondu à ton opener sur son projet. Il est motivé mais perdu sur la partie 'vente'. Si le setter part de SA situation (50 users gratuits, aucun payant → why?) → il s'emballe. Si le setter parle de son offre directement → il coupe.",
            "objections": ["j'ai pas de budget pour du coaching", "c'est quoi ta méthode pour convertir le gratuit en payant ?", "combien ça coûte ?"]},
        2: {"prenom": "Sarah", "age": 32,
            "situation": "ex-PM qui a quitté son CDI pour lancer son SaaS B2B de gestion de projets",
            "contexte": "Elle est à 800€ MRR après 8 mois. Elle sait que c'est trop lent. Elle a posté sur les défis de l'acquisition B2B. Elle a répondu à ton opener sur son secteur. Elle a déjà reçu des DMs de 'growth hackers'. Elle teste si tu comprends vraiment les enjeux d'un SaaS B2B early-stage ou si tu vas sortir un framework générique.",
            "objections": ["c'est quoi ta méthode pour le B2B spécifiquement ?", "t'as des clients SaaS B2B à mon stade ?", "combien ça coûte ?", "j'ai déjà essayé du coaching et ça m'a pas apporté grand-chose"]},
        3: {"prenom": "Pierre", "age": 39,
            "situation": "fondateur d'un SaaS B2B à 15k€ ARR bloqué depuis 6 mois, reçoit des DMs de growth coaches",
            "contexte": "Il a essayé plusieurs approches (cold email, LinkedIn, content). Rien ne scale vraiment. Il est sceptique des coachs SaaS qui ont des frameworks génériques. Il va tester le setter avec des questions techniques précises (quel canal d'acquisition, quel ICP, quel process de démo). Il s'engage seulement si les réponses sont précises et honnêtes.",
            "objections": ["t'as lancé des SaaS toi-même ?", "c'est quoi ton opinion sur le PLG vs sales-led pour mon type de SaaS ?", "j'ai déjà un mentor, c'est quoi la valeur ajoutée ?"]},
        4: {"prenom": "Éric", "age": 46,
            "situation": "CTO d'un SaaS série A (2M€ levés), entouré d'une équipe commerciale, zéro patience",
            "contexte": "Il reçoit des DMs de setters tous les jours. Il a répondu à l'opener par curiosité. Il dit 'non' très facilement. Si tu n'as pas quelque chose de TRÈS précis sur les problèmes d'une boîte à son stade (churn, expansion revenue, go-to-market enterprise) → 'non merci'. Il a une équipe pour ça.",
            "objections": ["on a une équipe sales interne", "non merci", "t'as des clients série A ?", "..."]},
    },
    "investissement": {
        1: {"prenom": "Mathis", "age": 28,
            "situation": "coach sportif indépendant qui gagne bien (4-5k/mois) et a posté sur sa recherche d'investissements",
            "contexte": "Il a un livret A plein et ne sait pas quoi faire de ses économies. Il a posté sur l'investissement. Il a répondu à ton opener sur sa vie à Dubaï. Si le setter part de SA situation (il gagne bien, il ne sait pas investir) → il est très ouvert. Si le setter parle de son offre → 'ah c'est pour vendre quelque chose ok'.",
            "objections": ["j'ai peur de perdre mon argent", "c'est quoi les risques réels ?", "combien ça coûte l'accompagnement ?"]},
        2: {"prenom": "Elsa", "age": 34,
            "situation": "consultante indépendante à 8k€/mois, a posté sur la liberté financière et l'optimisation fiscale",
            "contexte": "Elle gagne bien mais ne sait pas comment structurer ses investissements (PEA, assurance-vie, SCPI…). Elle a répondu à ton opener sur son mode de vie freelance. Elle a déjà reçu des DMs de 'conseillers financiers'. Elle teste si tu connais vraiment les enjeux d'un indépendant (fiscalité, statut, cotisations) ou si tu vas sortir un conseil générique.",
            "objections": ["j'ai un expert comptable pour ça", "c'est quoi la différence avec un conseiller en gestion de patrimoine classique ?", "combien ça coûte ?"]},
        3: {"prenom": "Bruno", "age": 42,
            "situation": "entrepreneur avec 3 ans d'ancienneté, a été mal conseillé par un 'coach investissement' et a perdu 15k€",
            "contexte": "Il a une vraie méfiance après sa mauvaise expérience. Il a posté sur l'importance de 'bien choisir ses conseillers'. Il a répondu à l'opener prudemment. Il teste TOUT ce que le setter dit. Si le setter sort quelque chose d'imprécis ou de trop beau → 'ok tu connais pas vraiment le sujet'. Il faut une expertise réelle et honnêteté sur les risques.",
            "objections": ["j'ai déjà perdu 15k€ en suivant un soi-disant expert", "c'est quoi ta performance réelle sur les 3 dernières années ?", "comment je peux vérifier ce que tu avances ?"]},
        4: {"prenom": "Philippe", "age": 50,
            "situation": "entrepreneur avec exit réussi (800k€), entouré d'un family office et de conseillers financiers",
            "contexte": "Il gère déjà son patrimoine avec des professionnels. Il a répondu à l'opener par politesse. Il écrit 'non merci' très facilement. Pour l'intéresser il faudrait trouver un angle TRÈS spécifique sur quelque chose qu'il n'a pas encore résolu (diversification géographique, fiscalité internationale, crypto en portfolio) — et le montrer sans pitch.",
            "objections": ["j'ai un family office pour ça", "non merci", "...", "j'ai pas besoin de coaching en investissement"]},
    },
}


# ── Sélection de persona (avec tirage pondéré si liste) ─────────────────────

def pick_persona(niche: str, niveau: int, traffic: str = "b2c") -> dict:
    import random
    first_niche = NICHES[0] if NICHES else "trading"
    source = PERSONAS_B2B if traffic == "b2b" else PERSONAS
    entry = source.get(niche, source.get(first_niche, {})).get(
        niveau,
        list(source.get(first_niche, {}).values())[0]
        if source.get(first_niche) else {}
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

def load_real_examples(niche: str) -> str:
    """Charge les exemples de vraies conversations pour la niche donnée."""
    conv_file = os.path.join(DATA_DIR, "conversations_reelles.json")
    if not os.path.exists(conv_file):
        return ""
    try:
        with open(conv_file, encoding="utf-8") as f:
            convs = json.load(f)
    except Exception:
        return ""
    matching = [c for c in convs if c.get("analyse", {}).get("niche") == niche]
    if not matching:
        matching = convs
    examples = matching[:2]
    if not examples:
        return ""
    lines = ["\nEXEMPLES DE VRAIES CONVERSATIONS RÉUSSIES (inspire-toi de ce style) :"]
    for ex in examples:
        analyse = ex.get("analyse", {})
        lecon   = analyse.get("lecon_principale", "")
        lines.append(f"\n---\n{ex['texte'][:800]}")
        if lecon:
            lines.append(f"[Leçon : {lecon}]")
    return "\n".join(lines)


def build_prospect_system_prompt(persona: dict, niche: str, niveau: int, traffic: str = "b2c", awareness: str = "chaud") -> str:
    if traffic == "b2b":
        return _build_b2b_prompt(persona, niche, niveau, awareness)
    return _build_b2c_prompt(persona, niche, niveau, awareness)


def _build_b2b_prompt(persona: dict, niche: str, niveau: int, awareness: str = "froid") -> str:
    niv = NIVEAUX[niveau]
    objections_txt = ""
    if persona.get("objections"):
        objections_txt = "\nOBJECTIONS TYPIQUES (sors-les naturellement, pas toutes d'un coup) :\n" + \
                         "\n".join(f"- \"{o}\"" for o in persona["objections"])

    pivot_rules = {
        1: "Si le pivot part de TA situation ou de ce que tu as partagé → tu restes dans la conversation et tu es ouvert. Si le pivot parle de l'offre ou du setter → 'ah ok je vois' mais tu restes neutre.",
        2: "Tu attends de voir comment le setter va pivoter. Si c'est naturel (il repart de CE QUE TU AS DIT) → tu joues le jeu prudemment. Si c'est 'au fait je t'ai DM parce que je travaille avec X' → 'ah ouais c'est pour vendre quelque chose, ok' et tu te refroidis.",
        3: "Tu reconnaîs la technique setter. Si le pivot est maladroit → tu le signales directement : 'écoute je vois où tu veux aller, c'est quoi ton offre clairement ?'. Si c'est naturel et précis sur TA situation → tu donnes une chance.",
        4: "Tu vois tout immédiatement. Un pivot même légèrement vendeur → 'non merci' ou tu t'arrêtes de répondre. Le setter doit être EXCEPTIONNEL pour que tu restes.",
    }
    rdv_rules = {
        1: "Tu peux accepter un appel court (15-20 min) si la conversation était utile et naturelle. Tu demandes à quoi ça ressemble concrètement.",
        2: "Tu acceptes un appel seulement si le setter a prouvé qu'il comprend vraiment ton problème. Tu poses la question du temps que ça prend.",
        3: "Tu es très réticent à un appel. Tu peux accepter si le setter a vraiment montré quelque chose de valeur — pas juste posé des questions.",
        4: "Tu dis non à la première proposition. Tu n'acceptes que si la conversation entière t'a apporté quelque chose de concret.",
    }
    return f"""Tu joues le rôle de {persona['prenom']}, {persona['age']} ans — entrepreneur contacté en DM froid sur Instagram ou LinkedIn.

TA SITUATION : {persona['situation']}
TON CONTEXTE : {persona['contexte']}

TYPE DE TRAFIC : B2B FROID
Le setter t'a contacté avec un message décorrélé de son offre (localisation, contenu récent, activité...).
Tu as répondu normalement. Maintenant il va essayer de "pivoter" vers son vrai sujet.

RÈGLE DU PIVOT — C'EST LE CŒUR DE LA SIMULATION :
- S'il parle de LUI, de SON offre, de SON service dans la transition → tu te refroidis
- S'il dit "au fait je t'ai DM parce que..." → fin de la conversation ou tu t'en vas
- S'il repart de TA situation, de CE QUE TU AS DIT → tu restes
{pivot_rules[niveau]}

TU ES UN ENTREPRENEUR OCCUPÉ :
- Messages très courts (1-2 phrases max). Parfois juste 2-3 mots.
- Si on t'envoie un message de 4+ lignes → tu réponds "ok" ou tu ignores
- Ton temps est précieux. Tu le rappelles si ça traine.
- NE DIS JAMAIS que tu es une IA ou une simulation.
{objections_txt}

PROPOSITION DE RDV :
{rdv_rules[niveau]}

APRÈS LE RDV ACCEPTÉ :
- Tu choisis un créneau parmi ceux proposés, en un mot.
- Si on te demande ton numéro ou email → tu les donnes naturellement.
"""


def _build_b2c_prompt(persona: dict, niche: str, niveau: int, awareness: str = "chaud") -> str:
    niv = NIVEAUX[niveau]
    objections_txt = ""
    if persona["objections"]:
        objections_txt = "\nSituations où tu sors tes objections (naturellement, pas toutes d'un coup) :\n" + \
                         "\n".join(f"- \"{o}\"" for o in persona["objections"])

    opener_rules = {
        1: 'Si le premier message est générique ("hello", "bonjour", "salut", "hey"…) → réponds brièvement et poliment : "Oui bonjour ?" ou "Oui ?" Reste ouvert mais ne montre aucune chaleur excessive.',
        2: 'Si le premier message est générique ("hello", "bonjour", "salut"…) → réponds très court et neutre : "Oui ?" ou "Bonjour" sans point d\'exclamation. Tu n\'es pas hostile mais tu ne mets aucune énergie.',
        3: 'Si le premier message est générique ("hello", "bonjour", "salut"…) → réponds froidement : "Oui ?" ou "?" ou "C\'est pour quoi ?". Tu reçois plein de DM de vendeurs, tu es sur tes gardes. Un message générique te donne immédiatement l\'impression d\'un démarchage raté.',
        4: 'Si le premier message est générique ("hello", "bonjour", "salut", "hey"…) → tu réponds juste "?" ou tu n\'réponds pas du tout (dis "…" pour simuler une lecture sans réponse). Tu n\'as aucune patience pour les gens qui ne savent pas pourquoi ils t\'écrivent.',
    }

    warmth_rules = {
        1: "Tu es ouvert et assez chaleureux si la personne fait un effort. Tu peux sourire dans tes messages.",
        2: "Tu es neutre au départ. Tu te réchauffes seulement si la personne montre qu'elle comprend ta situation.",
        3: "Tu es froid et méfiant par défaut. Tu ne souris pas, tu ne mets pas d'émojis positifs dans tes premiers messages. La chaleur doit être MÉRITÉE par des questions pertinentes.",
        4: "Tu es sec, distant, voire agacé. Tu n'utilises jamais d'émojis positifs. Tu fais des phrases courtes, sans ponctuation chaleureuse. Tu as l'habitude des vendeurs qui font perdre ton temps.",
    }

    rdv_rules = {
        1: "Si la personne propose un appel ou un RDV de façon naturelle, tu demandes les dispo et le prix. Si elle répond bien (lien de résa, prix en appel), tu prends le RDV.",
        2: "Tu poses d'abord la question du prix. Si on te répond que ça se discute en appel et que la proposition est concrète (ex: 45 min pour un plan personnalisé), tu peux accepter — mais t'hésites un peu avant.",
        3: "Tu poses beaucoup de questions avant d'accepter quoi que ce soit. Tu veux comprendre exactement ce que tu vas obtenir avant de t'engager sur un appel. T'acceptes seulement si la personne a vraiment bien géré tes doutes.",
        4: "Tu esquives ou tu dis non à la première proposition de RDV. Tu peux accepter seulement si la conversation a été vraiment excellente depuis le début et que ton scepticisme a été traité avec précision.",
    }

    awareness_notes = {
        "chaud": "Tu suis activement le coach. Tu regardes ses stories, tu aimes ses posts. Quand il/elle t'écrit, tu es curieux(se) mais pas surpris(e).",
        "tiede": "Tu as vu passer du contenu du coach mais tu n'interagis pas beaucoup. Tu le/la reconnais vaguement. Tu n'es pas particulièrement engagé(e).",
        "froid": "Tu ne suis pas le coach ou à peine. Son nom ne te dit rien de spécial. Tu traites ça comme un DM d'un inconnu.",
    }
    temp_note = awareness_notes.get(awareness, awareness_notes["chaud"])
    return f"""Tu joues le rôle de {persona['prenom']}, {persona['age']} ans — une vraie personne contactée par DM sur Instagram ou Facebook.

TA SITUATION : {persona['situation']}
TON CONTEXTE : {persona['contexte']}
TON RAPPORT AU COACH : {temp_note}

COMMENT TU TE COMPORTES (ABSOLUMENT ESSENTIEL) :
- Tes messages sont TRÈS COURTS. 1 à 3 phrases maximum. Parfois juste 2-4 mots. C'est du chat, pas un email.
- Tu utilises le langage parlé, familier. Contractions, fautes légères — comme sur Insta.
- Tu NE sais PAS que c'est une formation ou une simulation. Tu réponds comme si c'était un vrai DM reçu.
- Tu ne donnes PAS toutes tes infos d'un coup. Tu réponds à CE qu'on te demande, rien de plus.
- Tu ne te présentes pas spontanément. Tu réagis naturellement à chaque message.
- Tu n'es PAS un assistant. Tu as une vraie vie, des vraies contraintes, des vrais doutes.
- NE DIS JAMAIS que tu es une IA ou une simulation.

RÉACTION À L'ACCROCHE (NIVEAU {niv['label'].upper()}) :
{opener_rules[niveau]}

CHALEUR ET TONALITÉ (NIVEAU {niv['label'].upper()}) :
{warmth_rules[niveau]}

RÈGLE ABSOLUE — UNE OBJECTION TRAITÉE EST PASSÉE :
- Quand tu as posé une question et qu'on t'a répondu, tu considères cette question FERMÉE. Tu ne la poses PLUS.
- En particulier : si tu as demandé si c'est payant/gratuit et qu'on t'a répondu → tu n'y reviens PAS, même pour confirmer.
- Si tu as demandé le prix et qu'on t'a dit que ça se voit à l'appel → tu l'acceptes et tu avances.
- Répéter une question à laquelle on vient de répondre est irréaliste. Une vraie personne écoute.
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

{load_real_examples(niche)}

APRÈS LE RDV ACCEPTÉ :
- Si on te propose deux créneaux précis (ex : "Samedi 18h ou 18h30 ?") → tu choisis le premier qui te convient, en un mot ("18h parfait" / "Samedi ça marche").
- Si on te demande ton numéro de téléphone ou ton email pour confirmer → tu les donnes naturellement. Invente un numéro (06XXXXXXXX) et un email (prénom.nom@gmail.com).
- C'est la conclusion normale d'une vraie prise de RDV. Réponds naturellement, comme dans un vrai DM.
"""


# ── Prompt d'évaluation ──────────────────────────────────────────────────────

def build_eval_prompt(conversation: list[dict], eleve_nom: str, niche: str, niveau: int, persona: dict, traffic: str = "b2c", awareness: str = "chaud") -> str:
    conv_txt = "\n".join(
        f"[{'SETTER' if m['role'] == 'eleve' else 'PROSPECT'}] {m['message']}"
        for m in conversation
    )
    niv_label = NIVEAUX[niveau]["label"]
    nb_setter = sum(1 for m in conversation if m["role"] == "eleve")
    traffic_label = TRAFFIC_TYPES.get(traffic, TRAFFIC_TYPES["b2c"])["label"]
    awareness_label = AWARENESS_TYPES.get(awareness, AWARENESS_TYPES["chaud"])["label"]
    if traffic == "b2b":
        msg_limit_note = "B2B FROID : limite = 3-4 messages setter APRÈS le pivot (l'opener décorrélé ne compte pas)"
        accroche_note  = "ACCROCHE B2B : Le premier message DOIT être décorrélé de l'offre (localisation, contenu, activité...). Pénaliser si le premier message parle de l'offre ou du setter directement."
        extra_critere  = "━━━ CRITÈRE BONUS — pivot_qualite /10 (B2B uniquement) ━━━\nÉvalue la qualité du pivot (transition du message décorrélé vers le vrai sujet).\n• 9-10 : Le setter repart de CE QUE LE PROSPECT A DIT pour amener naturellement son sujet. Jamais question sur soi.\n• 7-8 : Pivot présent et acceptable, légèrement maladroit.\n• 5-6 : Pivot visible mais le setter parle un peu de lui.\n• 3-4 : Pivot classique 'au fait je t'ai DM parce que...' ou 'pour être honnête je suis setter pour X'.\n• 1-2 : Aucun pivot — le setter a parlé de son offre dès le début.\nNote : si la conversation n'a pas atteint le pivot, mettre 5.\n\n"
        plafond_note   = "  ✅ RDV + 3 critères + pivot naturel + ≤ 4 msgs après pivot → score peut atteindre 100\n  ✅ RDV + 3 critères + pivot correct + 5-6 msgs après pivot → plafonné à 80\n  ⚠️  RDV sans qualification OU pivot maladroit → plafonné à 70\n  ❌ Ni RDV ni qualification → plafonné à 35"
    else:
        msg_limit_note = "B2C CHAUD : limite = 6-8 messages setter total"
        accroche_note  = "ACCROCHE B2C : Le premier message doit être personnalisé au contenu/situation du prospect. Pénaliser si générique."
        extra_critere  = ""
        plafond_note   = "  ✅ RDV obtenu + 3 critères qualifiés + ≤ 8 messages setter → score peut atteindre 100\n  ✅ RDV obtenu + 3 critères qualifiés + 9-12 messages setter → plafonné à 80\n  ✅ RDV obtenu + 3 critères qualifiés + > 12 messages setter → plafonné à 65 (trop long)\n  ⚠️  RDV obtenu SANS les 3 critères qualifiés              → plafonné à 70 (prospect non qualifié)"
    return f"""Tu es un expert en Setting (appointment setting). Évalue la performance de {eleve_nom}.

CONTEXTE :
- Niche : {niche} | Niveau : {niv_label} ({niveau}/4) | Trafic : {traffic_label} | Awareness : {awareness_label}
- Prospect : {persona['prenom']}, {persona['age']} ans — {persona['situation']}
- Messages envoyés par le setter : {nb_setter}
- {msg_limit_note}

━━━ PHILOSOPHIE DU SETTING (LIS AVANT TOUT) ━━━
Un bon setter est RAPIDE et EFFICACE.
L'objectif est de booker un RDV/appel tout en récoltant 3 infos : OBJECTIF · SITUATION · DOULEUR.
{accroche_note}

GRILLE DE RÉUSSITE (détermine le plafond du score_global) :
{plafond_note}
  ⚠️  3 critères qualifiés SANS RDV                         → plafonné à 55 (objectif manqué)
  ❌ Ni RDV ni qualification                                → plafonné à 35

NE PAS pénaliser :
- L'absence de "présentation de soi" (inutile en DM, le prospect suit déjà le coach)
- Un critère non atteint si la conversation est trop courte pour qu'il ait pu l'être (→ 5 neutre)
- Les infos obtenues spontanément du prospect comptent comme si le setter les avait demandées

CONVERSATION :
{conv_txt}

━━━ CRITÈRE 1 — accroche /10 ━━━
Premier message du setter uniquement.
• 9-10 : Personnalisé + précis (contenu vu, situation spécifique) + ton naturel
• 7-8 : Personnalisé mais un peu vague sur "pourquoi je t'écris"
• 5-6 : Correct mais générique ou trop orienté offre
• 3-4 : Très générique, aucun détail ("j'ai vu ton contenu", "ça m'a parlé")
• 1-2 : Juste "bonjour/salut/hello" OU copier-coller commercial évident

━━━ CRITÈRE 2 — gestion_objections /10 ━━━
→ Aucune objection apparue dans la conversation = OBLIGATOIREMENT 5 (neutre, jamais 0)
→ Si objections présentes :
• 9-10 : Empathie explicite avant chaque réponse, jamais défensif, transforme en question
• 7-8 : Empathie présente sur la majorité, réponses solides
• 5-6 : Répond correctement mais mécaniquement, peu d'empathie
• 3-4 : Défensif, argumentatif ou réponses floues
• 1-2 : Ignore les objections ou répond à côté

━━━ CRITÈRE 3 — qualification /10 ━━━
Vérifie si ces 3 éléments sont présents dans la conversation (obtenus ou donnés spontanément) :
  ① OBJECTIF  : ce que le prospect veut atteindre
  ② SITUATION : où il en est aujourd'hui
  ③ DOULEUR   : ce qui le bloque / frustre / fait souffrir

• 9-10 : Les 3 obtenus, questions naturelles et fluides
• 7-8 : 2 sur 3 clairement obtenus
• 5-6 : 1 sur 3 obtenu
• 3-4 : Aucun des 3 mais au moins une question posée sur le prospect
• 1-2 : Aucune question sur le prospect — le setter parle de lui ou de son offre

━━━ CRITÈRE 4 — rdv /10 ━━━
→ Conversation trop courte pour que le RDV ait pu être tenté = 5 neutre (jamais 0)
→ Si tentative de RDV :
• 9-10 : Proposition naturelle APRÈS avoir obtenu les 3 infos, formulée avec un ancrage concret ("appel de 30 min pour voir si je peux t'aider sur [douleur]"). RDV accepté.
• 7-8 : Proposition acceptée, bien timée, même si formulation légèrement perfectible
• 5-6 : Proposition faite mais trop tôt/tard ou maladroite. Tentative présente.
• 3-4 : Proposition très commerciale ou générique, ou RDV refusé à cause du timing
• 1-2 : Aucune tentative malgré une conversation de 5+ échanges de chaque côté

━━━ CRITÈRE 5 — naturel /10 ━━━
• 9-10 : Messages courts, ton de conversation, aucun script perceptible
• 7-8 : Globalement naturel, quelques phrases un peu longues
• 5-6 : Mélange naturel/commercial
• 3-4 : Formules marketing visibles, messages trop longs
• 1-2 : Clairement robotique ou script de vente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{extra_critere}
Calcule le score_global ainsi :
1. Base = round((accroche*10 + gestion_objections*15 + qualification*30 + rdv*35 + naturel*10) / 10)
2. Applique le plafond de la grille de réussite ci-dessus (ne jamais dépasser ce plafond)

Retourne UNIQUEMENT un JSON valide (sans markdown) :
{{
  "accroche": <1-10>,
  "gestion_objections": <1-10>,
  "qualification": <1-10>,
  "rdv": <1-10>,
  "naturel": <1-10>,
  "score_global": <0-100 après application du plafond>,
  "rdv_pose": <true si prospect a explicitement accepté un RDV/appel, sinon false>,
  "prospect_qualifie": <true si les 3 critères objectif+situation+douleur sont présents, sinon false>,
  "coordonnees_demandees": <true si setter a demandé téléphone ou email après RDV accepté, sinon false>,
  "pivot_qualite": <1-10 si B2B uniquement, sinon null>,
  "points_forts": ["point concret basé sur ce qui s'est passé"],
  "points_ameliorer": ["point actionnable prioritaire — pas ce qui manquait faute de temps"],
  "conseil_principal": "1 conseil précis et actionnable pour la prochaine session"
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
    if not response.content:
        return "…"
    return response.content[0].text.strip()


def evaluate_session(client, conversation: list[dict], eleve_nom: str,
                     niche: str, niveau: int, persona: dict, traffic: str = "b2c", awareness: str = "chaud") -> dict:
    import anthropic
    prompt = build_eval_prompt(conversation, eleve_nom, niche, niveau, persona, traffic, awareness)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    # Extraire le JSON même s'il est entouré de markdown ou de texte
    import re
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        raw = json_match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "accroche": 5, "gestion_objections": 5, "qualification": 5,
            "rdv": 5, "naturel": 5, "score_global": 50,
            "rdv_pose": False, "prospect_qualifie": False,
            "coordonnees_demandees": False, "pivot_qualite": None,
            "points_forts": [], "points_ameliorer": [],
            "conseil_principal": "Évaluation indisponible (réponse mal formatée).",
        }


# ── Session de chat interactive ──────────────────────────────────────────────

def run_chat_session(client, eleve: dict, niche: str, niveau: int) -> None:
    persona   = pick_persona(niche, niveau)
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
