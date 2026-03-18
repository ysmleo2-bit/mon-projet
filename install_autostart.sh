#!/bin/bash
# install_autostart.sh — Configure le démarrage automatique du daemon sur macOS
# À lancer UNE SEULE FOIS depuis le dossier du projet.

set -e

PROJET_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$PROJET_DIR/com.setting.daemon.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.setting.daemon.plist"
PYTHON=$(command -v python3)

echo "📦 Installation du daemon Setting (démarrage automatique macOS)"
echo "   Dossier projet : $PROJET_DIR"
echo "   Python         : $PYTHON"
echo ""

# Détecter le bon python3 (Homebrew ou système)
if [ -f "/usr/local/bin/python3" ]; then
    PYTHON="/usr/local/bin/python3"
elif [ -f "/opt/homebrew/bin/python3" ]; then
    PYTHON="/opt/homebrew/bin/python3"
fi

# Créer dossier data + logs
mkdir -p "$PROJET_DIR/data"

# Copier et personnaliser le plist
cp "$PLIST_SRC" "$PLIST_DST"
# Remplacer PROJET_DIR par le vrai chemin
sed -i '' "s|PROJET_DIR|$PROJET_DIR|g" "$PLIST_DST"
# Remplacer python3 par le chemin complet
sed -i '' "s|/usr/bin/python3|$PYTHON|g" "$PLIST_DST"

# Charger .env dans le plist (ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN…)
if [ -f "$PROJET_DIR/.env" ]; then
    echo "   ✓ Chargement des variables .env dans le plist..."
    # Lire chaque ligne du .env et injecter dans EnvironmentVariables
    EXTRA_VARS=""
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignorer lignes vides et commentaires
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        [[ "$line" =~ ^# ]] && continue
        KEY="${line%%=*}"
        VAL="${line#*=}"
        EXTRA_VARS="$EXTRA_VARS        <key>$KEY</key>\n        <string>$VAL</string>\n"
    done < "$PROJET_DIR/.env"
    # Injecter dans le plist avant </dict> de EnvironmentVariables
    perl -i -0pe "s|(<key>PYTHONUNBUFFERED</key>\n\s*<string>1</string>)|$1\n$EXTRA_VARS|" "$PLIST_DST" 2>/dev/null || true
fi

# Désinstaller l'ancienne version si présente
launchctl unload "$PLIST_DST" 2>/dev/null || true

# Charger le service
launchctl load "$PLIST_DST"

sleep 2

# Vérifier
if launchctl list | grep -q "com.setting.daemon"; then
    echo ""
    echo "✅ Daemon installé et démarré avec succès !"
    echo ""
    echo "   • Il se relancera automatiquement à chaque redémarrage du Mac"
    echo "   • Il redémarre tout seul en cas de crash"
    echo ""
    echo "   Commandes utiles :"
    echo "   launchctl stop  com.setting.daemon   ← arrêter"
    echo "   launchctl start com.setting.daemon   ← démarrer"
    echo "   tail -f $PROJET_DIR/data/daemon.log  ← voir les logs"
else
    echo ""
    echo "⚠️  Le service n'apparaît pas dans launchctl. Vérifie les logs :"
    echo "   tail -20 $PROJET_DIR/data/daemon.log"
    echo ""
    echo "   Ou démarre manuellement : bash $PROJET_DIR/start.sh"
fi
