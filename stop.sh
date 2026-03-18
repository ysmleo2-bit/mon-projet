#!/bin/bash
# stop.sh — Arrête le daemon Setting

PROJET_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJET_DIR/data/daemon.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  Aucun PID enregistré. Le daemon est peut-être déjà arrêté."
    # Chercher quand même
    PIDS=$(pgrep -f "daemon.py" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "   Processus trouvés : $PIDS — arrêt forcé..."
        kill $PIDS 2>/dev/null || true
        echo "✅ Arrêté."
    fi
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f "$PID_FILE"
    echo "✅ Daemon arrêté (PID $PID)"
else
    echo "⚠️  Le processus $PID n'existe plus."
    rm -f "$PID_FILE"
fi
