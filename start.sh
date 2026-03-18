#!/bin/bash
# start.sh — Démarre le daemon Setting sur macOS
# Usage :  bash start.sh          # Démarrage normal
#          bash start.sh --test   # Test Telegram seulement

set -e

PROJET_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$PROJET_DIR/data/daemon.log"
PID_FILE="$PROJET_DIR/data/daemon.pid"
PYTHON=$(command -v python3)

mkdir -p "$PROJET_DIR/data"

# ── Vérifier si déjà en cours ─────────────────────────────────────────────────
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "⚠️  Le daemon tourne déjà (PID $OLD_PID)"
        echo "    Pour l'arrêter : bash stop.sh"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# ── Charger .env si présent ──────────────────────────────────────────────────
if [ -f "$PROJET_DIR/.env" ]; then
    set -a
    source "$PROJET_DIR/.env"
    set +a
fi

cd "$PROJET_DIR"

# ── Mode test : juste Telegram ────────────────────────────────────────────────
if [ "${1}" = "--test" ]; then
    echo "🔧 Test de connexion Telegram..."
    "$PYTHON" daemon.py --task telegram_test
    exit 0
fi

# ── Démarrage en arrière-plan ─────────────────────────────────────────────────
echo "🚀 Démarrage du daemon Setting..."
nohup "$PYTHON" "$PROJET_DIR/daemon.py" >> "$LOG_FILE" 2>&1 &
DAEMON_PID=$!
echo "$DAEMON_PID" > "$PID_FILE"

sleep 2
if kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo "✅ Daemon démarré (PID $DAEMON_PID)"
    echo "   Logs : tail -f $LOG_FILE"
    echo "   Arrêt : bash $PROJET_DIR/stop.sh"
else
    echo "❌ Le daemon a crashé au démarrage. Consulte les logs :"
    tail -20 "$LOG_FILE"
    exit 1
fi
