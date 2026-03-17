# CLAUDE.md — Rivia Coaching · Usage interne
# Guide Opérationnel v1.0 appliqué

## Projet
Nom : Bot Telegram × Zapier × iClosed
Stack : Python 3.11 + Flask + python-telegram-bot + APScheduler
DB : JSON local (data/) + Google Sheets (via gspread)
Déployé sur : Local / VPS Ubuntu

## RÈGLES DE RÉPONSE — TOUJOURS
- Réponds en français
- Code uniquement, sans explication sauf si je demande explicitement
- Ne montre que les lignes modifiées, jamais le fichier entier
- Avant de modifier un fichier : liste les fichiers concernés + 1 ligne d'explication
- Ne jamais modifier la DB ou les données sans confirmation explicite
- Ne jamais installer de nouvelles librairies sans demander (hors requirements.txt)
- Signale toute anomalie de sécurité immédiatement dans ALERTS.md

## AUTONOMIE — ce que tu peux faire SANS demander
- Créer, modifier, supprimer des fichiers dans CE projet uniquement
- Commits et push git sur la branche claude/fix-telegram-zapier-bot-RojMO
- Lancer les scripts : cleanup.sh, status.sh, backup.sh
- Lire les logs pour diagnostiquer
- Nettoyer : __pycache__, logs anciens, fichiers tmp

## LIMITES ABSOLUES — jamais en autonome
- JAMAIS lire ou modifier les fichiers .env
- JAMAIS push sur main/master sans confirmation explicite
- JAMAIS supprimer des données utilisateurs
- JAMAIS sortir du dossier /home/user/mon-projet/
- JAMAIS envoyer des credentials vers des URLs externes
- JAMAIS modifier les variables d'environnement de production

## CONVENTIONS DU PROJET
- Nommage : snake_case (Python)
- Langue du code : anglais (commentaires en français)
- Format des commits : feat/fix/chore: description
- Chaque tâche terminée = commit immédiat avec message descriptif

## ARCHITECTURE
- bot.py — point d'entrée principal
- scheduler.py — cron jobs (recap 9h)
- webhook.py — réception des données Zapier (Flask)
- sheets.py — lecture Google Sheets via gspread
- data/ — stockage JSON local
- logs/ — logs applicatifs

## VARIABLES D'ENV REQUISES (sans valeurs)
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
GOOGLE_SHEETS_ID, GOOGLE_CREDENTIALS_JSON (chemin)

## COMPORTEMENT EN CAS DE DOUTE
1. Ne pas exécuter l'action incertaine
2. Expliquer ce qui allait être fait
3. Demander confirmation en 1 phrase

## RÈGLES DU GUIDE OPÉRATIONNEL (synthèse)
1. Chaque tâche terminée = commit immédiat avec message descriptif
2. Tout problème observé hors tâche = entrée dans ALERTS.md
3. Avant de clore une session : git status propre, pip check, pm2 list équivalent

## RAPPORT DE FIN DE SESSION
Générer systématiquement :
- Fichiers créés/modifiés
- Commits effectués
- Problèmes rencontrés
- Prochaines actions recommandées
