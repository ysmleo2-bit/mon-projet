# CONTEXT.md — mis à jour le 2026-03-17

## Dernière session
Date : 2026-03-17
Travail effectué : Création complète du projet depuis zéro — CLAUDE.md, CONTEXT.md, ALERTS.md, bot complet
Résultat : En cours

## Prochaine tâche
Fournir les credentials (.env) et tester le bot : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_ID

## Objectif du projet
Bot Telegram qui envoie un récap quotidien à 9h sur l'état des équipes de vente iClosed :
- Prospects ayant opté in
- Calls bookés
- Calls disqualifiés
- No-shows
- Taux de show (shows / calls bookés)

## Source des données
Google Sheets alimenté par Zapier depuis iClosed CRM

## Flux
iClosed → Zapier → Google Sheets → bot Python lit Sheets → récap Telegram 9h

## Décisions techniques prises
- 2026-03-17 : Python (requirements.txt déjà fourni avec python-telegram-bot, APScheduler, gspread, Flask)
- 2026-03-17 : Stockage en JSON local pour cache + lecture Google Sheets à chaque récap
- 2026-03-17 : APScheduler pour le cron 9h (pas de systemd cron pour portabilité)
- 2026-03-17 : Flask gardé pour recevoir éventuels webhooks Zapier en direct

## Problèmes ouverts
- [ ] Credentials Google Sheets à configurer (.env)
- [ ] TELEGRAM_BOT_TOKEN à renseigner
- [ ] TELEGRAM_CHAT_ID à renseigner
- [ ] Structure exacte du Google Sheets iClosed à vérifier (noms de colonnes)

## Fichiers importants
- bot.py : point d'entrée, initialise le bot et le scheduler
- scheduler.py : cron 9h, construit et envoie le récap
- sheets.py : lit et parse les données Google Sheets
- webhook.py : endpoint Flask optionnel pour webhooks Zapier
- .env.example : variables d'env requises (sans valeurs)
- requirements.txt : dépendances Python

## Notes
- Le récap est envoyé à 9h heure locale (pytz configuré Europe/Paris)
- En cas de panne Google Sheets, le bot envoie une alerte d'erreur au lieu de rien
