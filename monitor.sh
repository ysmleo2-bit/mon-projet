#!/bin/bash
# ── Maintenance automatique Setting Training ─────────────────
# Surveille l'app, la redémarre si elle tombe, log tout

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
LOG="$APP_DIR/monitor.log"
PID_FILE="$APP_DIR/app.pid"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

start_app() {
    cd "$APP_DIR"
    nohup python3 app.py --port $PORT >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    log "✅ App démarrée (PID: $!)"
}

is_running() {
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        kill -0 "$pid" 2>/dev/null && \
        curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/login" 2>/dev/null | grep -q "200"
    else
        return 1
    fi
}

# Arrêter une ancienne instance si besoin
if [ -f "$PID_FILE" ]; then
    old_pid=$(cat "$PID_FILE")
    kill "$old_pid" 2>/dev/null
    rm -f "$PID_FILE"
fi
fuser -k ${PORT}/tcp 2>/dev/null

log "🚀 Agent de maintenance démarré"
start_app

# Boucle de surveillance
while true; do
    if ! is_running; then
        log "⚠️  App hors ligne — redémarrage..."
        fuser -k ${PORT}/tcp 2>/dev/null
        start_app
    fi
    # Nettoyage sessions expirées (>7 jours) toutes les 24h
    if [ $(( $(date +%s) % 86400 )) -lt 30 ]; then
        log "🧹 Nettoyage périodique..."
        cd "$APP_DIR" && python3 -c "
import json, os
from datetime import date, timedelta
f = 'sim_sessions.json'
if os.path.exists(f):
    with open(f) as fp: sessions = json.load(fp)
    cutoff = (date.today() - timedelta(days=90)).isoformat()
    kept = [s for s in sessions if s.get('date','') >= cutoff]
    if len(kept) < len(sessions):
        with open(f,'w') as fp: json.dump(kept, fp, ensure_ascii=False, indent=2)
        print(f'Supprimé {len(sessions)-len(kept)} sessions anciennes')
" 2>/dev/null
    fi
    sleep 30
done
