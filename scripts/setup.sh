#!/usr/bin/env bash
# JARVIS Setup Script — Built from CLAUDE.md by Taoufik · instagram.com/taoufik.ai
set -euo pipefail

BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

header() { echo -e "\n${BOLD}${CYAN}$1${RESET}"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()   { echo -e "  ${YELLOW}!${RESET} $1"; }
fail()   { echo -e "  ${RED}✗${RESET} $1"; }
step()   { echo -e "  ${BOLD}→${RESET} $1"; }

echo -e "${BOLD}"
echo "  ╔════════════════════════════════════╗"
echo "  ║          JARVIS SETUP              ║"
echo "  ║  Built by Taoufik · taoufik.ai     ║"
echo "  ╚════════════════════════════════════╝"
echo -e "${RESET}"

# ─── Prerequisites check ──────────────────────────────────────────────────────

header "1. Checking prerequisites"

# Python 3.11+
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
    PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
        ok "Python $PY_VER"
    else
        fail "Python 3.11+ required (found $PY_VER)"
        echo "     Install from https://www.python.org/downloads/"
        exit 1
    fi
else
    fail "python3 not found. Install from https://www.python.org/downloads/"
    exit 1
fi

# Node.js 18+
if command -v node &>/dev/null; then
    NODE_VER=$(node --version | tr -d 'v')
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        ok "Node.js $NODE_VER"
    else
        fail "Node.js 18+ required (found $NODE_VER)"
        echo "     Install from https://nodejs.org/"
        exit 1
    fi
else
    fail "node not found. Install from https://nodejs.org/"
    exit 1
fi

# npm
if command -v npm &>/dev/null; then
    ok "npm $(npm --version)"
else
    fail "npm not found"
    exit 1
fi

# openssl
if command -v openssl &>/dev/null; then
    ok "openssl $(openssl version | awk '{print $2}')"
else
    warn "openssl not found — SSL cert generation will be skipped"
fi

# ─── Environment file ─────────────────────────────────────────────────────────

header "2. Environment configuration"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    ok "Created .env from .env.example"
    warn "You must edit .env and add your API keys before starting JARVIS."
    echo ""
    echo "     Required:"
    echo "       ANTHROPIC_API_KEY  — get from console.anthropic.com"
    echo "       ELEVENLABS_API_KEY — get from elevenlabs.io (free tier OK)"
    echo ""
    echo "     Optional:"
    echo "       USER_NAME          — JARVIS will address you by name"
    echo ""
    read -rp "  Press Enter to open .env in your editor (or Ctrl+C to skip)..." _
    "${EDITOR:-nano}" "$ROOT/.env"
else
    ok ".env already exists"
fi

# ─── Python virtual environment ───────────────────────────────────────────────

header "3. Python virtual environment"

cd "$ROOT"

if [ ! -d ".venv" ]; then
    step "Creating .venv..."
    python3 -m venv .venv
    ok "Virtual environment created"
else
    ok ".venv already exists"
fi

step "Installing Python dependencies..."
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
ok "Python dependencies installed"

# ─── Playwright browsers ──────────────────────────────────────────────────────

header "4. Playwright browser (for web search)"

if python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    step "Installing Chromium..."
    playwright install chromium --with-deps 2>/dev/null || playwright install chromium
    ok "Chromium installed"
else
    warn "Playwright install failed — web browsing will be unavailable"
fi

# ─── SSL certificates ─────────────────────────────────────────────────────────

header "5. SSL certificates"

if [ ! -f "$ROOT/cert.pem" ] || [ ! -f "$ROOT/key.pem" ]; then
    if command -v openssl &>/dev/null; then
        step "Generating self-signed certificate..."
        openssl req -x509 -newkey rsa:2048 \
            -keyout "$ROOT/key.pem" \
            -out "$ROOT/cert.pem" \
            -days 365 -nodes \
            -subj '/CN=localhost' 2>/dev/null
        ok "cert.pem + key.pem generated (self-signed, 365 days)"
        warn "Chrome will warn about the certificate on first visit — click Advanced → Proceed."
    else
        warn "openssl not found — skipping SSL cert generation"
        warn "Server will run without HTTPS (voice recognition may not work in Chrome)"
    fi
else
    ok "SSL certificates already exist"
fi

# ─── Frontend dependencies ────────────────────────────────────────────────────

header "6. Frontend dependencies"

cd "$ROOT/frontend"
step "Running npm install..."
npm install --silent
ok "Frontend dependencies installed"

# ─── Done ─────────────────────────────────────────────────────────────────────

cd "$ROOT"

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  JARVIS is set up and ready to start.${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  To start JARVIS, open two Terminal windows:"
echo ""
echo -e "  ${BOLD}Terminal 1 (backend):${RESET}"
echo "    source .venv/bin/activate"
echo "    python server.py"
echo ""
echo -e "  ${BOLD}Terminal 2 (frontend):${RESET}"
echo "    cd frontend && npm run dev"
echo ""
echo -e "  Then open ${BOLD}Google Chrome${RESET} and go to:"
echo -e "  ${CYAN}http://localhost:5173${RESET}"
echo ""
echo "  Click the page, then speak to JARVIS."
echo ""
