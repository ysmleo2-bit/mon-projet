#!/bin/bash
# start.sh — Démarre cloudflared + l'agent iClosed en une commande
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

# Vérifie cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}! cloudflared non installé — téléchargement...${NC}"
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    if [ "$OS" = "darwin" ]; then
        if [ "$ARCH" = "arm64" ]; then
            CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
        else
            CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
        fi
        curl -sL "$CF_URL" -o /tmp/cloudflared.tgz
        tar -xzf /tmp/cloudflared.tgz -C /tmp/
        sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
    else
        if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
            CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
        else
            CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
        fi
        curl -sL "$CF_URL" -o /tmp/cloudflared
        sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
    fi
    sudo chmod +x /usr/local/bin/cloudflared
    rm -f /tmp/cloudflared.tgz
    echo -e "${GREEN}✓ cloudflared installé${NC}"
fi

# Tue les processus existants sur le port 5002
if lsof -i :5002 -t &>/dev/null; then
    echo "⚡ Libération du port 5002..."
    kill -9 $(lsof -i :5002 -t) 2>/dev/null || true
    # Attend que le port soit vraiment libéré (max 5s)
    for i in $(seq 1 10); do
        lsof -i :5002 -t &>/dev/null || break
        sleep 0.5
    done
fi

# Démarre cloudflared en arrière-plan
echo -e "🌐 Démarrage du tunnel Cloudflare..."
cloudflared tunnel --url http://localhost:5002 --no-autoupdate > /tmp/cloudflared.log 2>&1 &
CF_PID=$!

# Attend que le tunnel soit prêt et récupère l'URL
echo -e "   (attente de l'URL publique...)"
PUBLIC_URL=""
for i in $(seq 1 20); do
    sleep 2
    PUBLIC_URL=$(grep -o 'https://[a-zA-Z0-9._-]*\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
done

if [ -z "$PUBLIC_URL" ]; then
    echo -e "${RED}✗ Impossible de récupérer l'URL Cloudflare${NC}"
    echo "  Logs : cat /tmp/cloudflared.log"
    kill $CF_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Tunnel actif : ${PUBLIC_URL}${NC}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  URLs à configurer dans Zapier (copie-colle) :${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🟢 Opt-in        ${YELLOW}${PUBLIC_URL}/zapier/optin${NC}"
echo -e "  📅 Call booké    ${YELLOW}${PUBLIC_URL}/zapier/booked${NC}"
echo -e "  ✅ Show          ${YELLOW}${PUBLIC_URL}/zapier/show${NC}"
echo -e "  ❌ No-Show       ${YELLOW}${PUBLIC_URL}/zapier/no-show${NC}"
echo -e "  🚫 Disqualifié   ${YELLOW}${PUBLIC_URL}/zapier/disqualified${NC}"
echo -e "  💰 Close         ${YELLOW}${PUBLIC_URL}/zapier/closed${NC}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "🤖 Démarrage de l'agent..."
echo ""

# Démarre l'agent (prend le dessus sur le terminal)
PYTHON=$(command -v python3 || command -v python)
$PYTHON agent.py

# Nettoyage à l'arrêt
kill $CF_PID 2>/dev/null
echo ""
echo "Agent et tunnel arrêtés."
