#!/bin/bash
# test_webhooks.sh — Simule les 6 événements Zapier en local
# Usage : bash test_webhooks.sh
# Prérequis : l'agent doit être démarré (bash start.sh dans un autre terminal)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PORT=${WEBHOOK_PORT:-5002}
BASE="http://localhost:$PORT"

echo ""
echo -e "${BOLD}=== Test des webhooks Zapier (port $PORT) ===${NC}"
echo ""

# Vérifie que le serveur tourne
if ! curl -s "$BASE/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Le serveur webhook ne répond pas sur le port $PORT${NC}"
    echo ""
    echo "  Lance d'abord l'agent dans un autre terminal :"
    echo "  bash start.sh"
    exit 1
fi

echo -e "${GREEN}✓ Serveur webhook actif${NC}"
echo ""

run_test() {
    local endpoint="$1"
    local label="$2"
    local payload="$3"

    printf "  %-25s" "$label"
    result=$(curl -s -o /tmp/wh_result.json -w "%{http_code}" \
        -X POST "$BASE$endpoint" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if [ "$result" = "200" ]; then
        event=$(cat /tmp/wh_result.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('event_type','?'))" 2>/dev/null)
        echo -e "${GREEN}✓ 200 OK${NC}  (event_type=$event)"
    else
        echo -e "${RED}✗ HTTP $result${NC}"
        cat /tmp/wh_result.json 2>/dev/null
    fi
}

# Test chaque endpoint avec un prospect fictif
run_test "/zapier/optin"        "🟢 Opt-in"        '{"name":"Jean Dupont","email":"jean@test.com","phone":"+33612345678"}'
run_test "/zapier/booked"       "📅 Call Booké"     '{"name":"Jean Dupont","email":"jean@test.com","closer":"Marie"}'
run_test "/zapier/show"         "✅ Show"           '{"name":"Jean Dupont","email":"jean@test.com","closer":"Marie"}'
run_test "/zapier/no-show"      "❌ No-Show"        '{"name":"Paul Martin","email":"paul@test.com","closer":"Thomas"}'
run_test "/zapier/disqualified" "🚫 Disqualifié"    '{"name":"Sophie Blanc","email":"sophie@test.com","closer":"Marie"}'
run_test "/zapier/closed"       "💰 Close"          '{"name":"Jean Dupont","email":"jean@test.com","closer":"Marie","amount":"2500"}'

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "✅ Si tout est vert ci-dessus, vérifie ton Telegram :"
echo -e "   Tu devrais avoir reçu ${YELLOW}6 notifications${NC} en temps réel !"
echo ""
echo -e "📋 Pour voir le récap de test immédiatement :"
echo -e "   Envoie ${YELLOW}/recap${NC} dans ton bot Telegram"
echo ""
