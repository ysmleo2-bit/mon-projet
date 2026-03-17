#!/bin/bash
# start.sh — Démarre ngrok + l'agent iClosed en une commande
# Usage : bash start.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}=== Agent iClosed ↔ Telegram ===${NC}"
echo ""

# Vérifie que .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ Fichier .env manquant${NC}"
    echo "  Lance : cp .env.example .env"
    exit 1
fi

# Vérifie les dépendances Python
echo -e "📦 Vérification des dépendances..."
PIP=$(command -v pip3 || command -v pip)
$PIP install -r requirements.txt -q

# Vérifie ngrok
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}! ngrok non installé — téléchargement...${NC}"
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    if [ "$ARCH" = "arm64" ]; then
        NGROK_ZIP="ngrok-v3-stable-${OS}-arm64.zip"
    else
        NGROK_ZIP="ngrok-v3-stable-${OS}-amd64.zip"
    fi
    curl -sL "https://bin.equinox.io/c/bNyj1mQVY4c/${NGROK_ZIP}" -o /tmp/ngrok.zip
    unzip -q /tmp/ngrok.zip -d /tmp/
    sudo mv /tmp/ngrok /usr/local/bin/ngrok
    sudo chmod +x /usr/local/bin/ngrok
    rm /tmp/ngrok.zip
    echo -e "${GREEN}✓ ngrok installé${NC}"
fi

# Tue les processus existants sur le port 5000
if lsof -i :5001 -t &>/dev/null; then
    echo "⚡ Libération du port 5001..."
    kill $(lsof -i :5001 -t) 2>/dev/null || true
    sleep 1
fi

# Démarre ngrok en arrière-plan
echo -e "🌐 Démarrage du tunnel ngrok..."
ngrok http 5001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Attend que ngrok soit prêt
sleep 3

# Récupère l'URL publique ngrok
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for t in tunnels:
        if t.get('proto') == 'https':
            print(t['public_url'])
            break
except:
    pass
" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}✗ Impossible de récupérer l'URL ngrok${NC}"
    echo "  Vérifie que ngrok est bien connecté : http://localhost:4040"
    echo "  Si c'est la première fois, crée un compte gratuit sur ngrok.com et lance :"
    echo "  ngrok config add-authtoken TON_TOKEN"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Tunnel actif : ${NGROK_URL}${NC}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  URLs à configurer dans Zapier (copie-colle) :${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🟢 Opt-in        ${YELLOW}${NGROK_URL}/zapier/optin${NC}"
echo -e "  📅 Call booké    ${YELLOW}${NGROK_URL}/zapier/booked${NC}"
echo -e "  ✅ Show          ${YELLOW}${NGROK_URL}/zapier/show${NC}"
echo -e "  ❌ No-Show       ${YELLOW}${NGROK_URL}/zapier/no-show${NC}"
echo -e "  🚫 Disqualifié   ${YELLOW}${NGROK_URL}/zapier/disqualified${NC}"
echo -e "  💰 Close         ${YELLOW}${NGROK_URL}/zapier/closed${NC}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "🤖 Démarrage de l'agent..."
echo ""

# Démarre l'agent (prend le dessus sur le terminal)
PYTHON=$(command -v python3 || command -v python)
$PYTHON agent.py

# Nettoyage à l'arrêt
kill $NGROK_PID 2>/dev/null
echo ""
echo "Agent et tunnel arrêtés."
