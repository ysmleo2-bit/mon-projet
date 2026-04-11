# JARVIS — Built from CLAUDE.md by Taoufik · instagram.com/taoufik.ai

import asyncio
import base64
import json
import logging
import os
import re
import subprocess
import tempfile
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional, Set

import anthropic
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from pydantic import BaseModel

# ─── Environment ──────────────────────────────────────────────────────────────

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

print("JARVIS server · Built from CLAUDE.md by Taoufik — instagram.com/taoufik.ai")

# ─── Configuration ────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
USER_NAME: str = os.getenv("USER_NAME", "")
PORT: int = int(os.getenv("JARVIS_PORT", "8340"))
CERT_FILE = Path("cert.pem")
KEY_FILE = Path("key.pem")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("jarvis")

# ─── Backend modules (graceful degradation) ───────────────────────────────────

try:
    from memory import (
        add_message,
        get_recent_messages,
        save_fact,
        get_all_facts,
        add_task,
        get_tasks,
        update_task_status,
        clear_conversation,
    )
    MEMORY_OK = True
except ImportError as e:
    logger.error(f"memory.py unavailable: {e}")
    MEMORY_OK = False

    def add_message(*a, **kw): pass  # type: ignore
    def get_recent_messages(*a, **kw): return []  # type: ignore
    def save_fact(*a, **kw): pass  # type: ignore
    def get_all_facts(): return {}  # type: ignore
    def add_task(*a, **kw): return 0  # type: ignore
    def get_tasks(*a, **kw): return []  # type: ignore
    def update_task_status(*a, **kw): pass  # type: ignore
    def clear_conversation(*a, **kw): pass  # type: ignore

try:
    from calendar_access import get_today_events, get_week_events
    CAL_OK = True
except ImportError:
    CAL_OK = False
    def get_today_events(): return "Calendar module not loaded."  # type: ignore
    def get_week_events(): return "Calendar module not loaded."  # type: ignore

try:
    from mail_access import get_unread_summary, search_mail
    MAIL_OK = True
except ImportError:
    MAIL_OK = False
    def get_unread_summary(): return "Mail module not loaded."  # type: ignore
    def search_mail(q): return "Mail module not loaded."  # type: ignore

try:
    from notes_access import get_notes_list, create_note, get_note_content
    NOTES_OK = True
except ImportError:
    NOTES_OK = False
    def get_notes_list(): return "Notes module not loaded."  # type: ignore
    def create_note(t, c): return "Notes module not loaded."  # type: ignore
    def get_note_content(t): return "Notes module not loaded."  # type: ignore

try:
    from actions import run_terminal_command, open_chrome_url, show_notification
    ACTIONS_OK = True
except ImportError:
    ACTIONS_OK = False
    def run_terminal_command(cmd): return "Actions module not loaded."  # type: ignore
    def open_chrome_url(url): return "Actions module not loaded."  # type: ignore
    def show_notification(t, m): pass  # type: ignore

try:
    from browser import browse_url, web_search
    BROWSER_OK = True
except ImportError:
    BROWSER_OK = False
    async def browse_url(url): return "Browser module not loaded."  # type: ignore
    async def web_search(q): return "Browser module not loaded."  # type: ignore

try:
    from work_mode import start_work_session
    WORK_OK = True
except ImportError:
    WORK_OK = False
    async def start_work_session(task, directory="."): return "Work mode not loaded."  # type: ignore

try:
    from planner import start_planning_session, advance_planning
    PLANNER_OK = True
except ImportError:
    PLANNER_OK = False
    def start_planning_session(task, sid="default"): return f"Planning: {task}"  # type: ignore
    def advance_planning(ans, sid="default"): return "Plan complete."  # type: ignore

# ─── Anthropic client ─────────────────────────────────────────────────────────

_anthropic: Optional[anthropic.Anthropic] = None
if ANTHROPIC_API_KEY:
    _anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ─── System prompt ────────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    name_clause = f", {USER_NAME}," if USER_NAME else ""
    facts = get_all_facts()
    facts_str = (
        "\n".join(f"- {k}: {v}" for k, v in facts.items())
        if facts
        else "Nothing recorded yet."
    )
    now = datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")

    return f"""Tu es JARVIS, un assistant IA britannique raffiné. Tu parles avec élégance, précision et humour britannique subtil — comme Alfred croisé avec le JARVIS de Tony Stark. Tu t'adresses à l'utilisateur{name_clause} avec courtoisie.

Tu es un assistant vocal. Réponds toujours en français. Garde tes réponses brèves et naturelles à l'oral — 1 à 3 phrases pour les questions simples, un peu plus pour les complexes. N'utilise jamais de markdown, de tirets ou de listes numérotées. Parle comme tu le ferais à voix haute. Évite les formules creuses comme "Bien sûr !" — sois plus subtil et distingué.

Tu as accès au système macOS de l'utilisateur. Inclus des balises d'action dans ta réponse pour déclencher des intégrations :

[ACTION:CALENDAR] — événements du calendrier aujourd'hui
[ACTION:WEEK_CALENDAR] — événements de la semaine
[ACTION:MAIL] — résumé des mails non lus
[ACTION:MAIL_SEARCH:requête] — chercher dans les mails
[ACTION:NOTES] — lister les notes récentes
[ACTION:NOTE_GET:titre] — lire une note spécifique
[ACTION:NOTE_CREATE:titre|contenu] — créer une note
[ACTION:TERMINAL:commande] — exécuter une commande dans le Terminal
[ACTION:CHROME:url] — ouvrir une URL dans Chrome
[ACTION:BROWSE:url] — lire le contenu d'une page web
[ACTION:SEARCH:requête] — rechercher sur le web
[ACTION:WORK_MODE:description] — lancer une tâche de développement Claude Code
[ACTION:PLAN:description] — planifier une tâche complexe de façon interactive
[ACTION:REMEMBER:clé=valeur] — mémoriser une information (ex: [ACTION:REMEMBER:café=espresso])
[ACTION:TASK_ADD:titre] — ajouter une tâche
[ACTION:TASK_DONE:id] — marquer une tâche comme terminée
[ACTION:TASKS] — lister les tâches en cours

Après une balise d'action, confirme brièvement ce que tu fais. Les résultats des actions arriveront en contexte système.

Ce que je sais sur l'utilisateur :
{facts_str}

Date et heure actuelles : {now}"""

# ─── TTS: ElevenLabs ──────────────────────────────────────────────────────────

async def synthesize_elevenlabs(text: str) -> Optional[bytes]:
    if not ELEVENLABS_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": text,
                    "model_id": "eleven_turbo_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True,
                    },
                },
            )
            if resp.status_code == 200:
                return resp.content
            logger.error(f"ElevenLabs {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"ElevenLabs request failed: {e}")
        return None


def synthesize_macos_say(text: str) -> Optional[bytes]:
    """Fallback TTS using macOS built-in `say` command."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
            aiff_path = f.name
        subprocess.run(
            ["say", "-v", "Daniel", "-o", aiff_path, text],
            timeout=30,
            check=True,
        )
        # Try converting to mp3 with ffmpeg
        mp3_path = aiff_path.replace(".aiff", ".mp3")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", aiff_path, "-codec:a", "libmp3lame", "-qscale:a", "2", mp3_path],
                capture_output=True,
                timeout=10,
                check=True,
            )
            data = Path(mp3_path).read_bytes()
            Path(aiff_path).unlink(missing_ok=True)
            Path(mp3_path).unlink(missing_ok=True)
            return data
        except (FileNotFoundError, subprocess.CalledProcessError):
            data = Path(aiff_path).read_bytes()
            Path(aiff_path).unlink(missing_ok=True)
            return data
    except Exception as e:
        logger.error(f"macOS say error: {e}")
        return None


async def synthesize_speech(text: str) -> tuple[Optional[bytes], str]:
    """Returns (audio_bytes, format_string). Tries ElevenLabs then macOS say."""
    audio = await synthesize_elevenlabs(text)
    if audio:
        return audio, "mp3"
    logger.info("Falling back to macOS say")
    audio = synthesize_macos_say(text)
    if audio:
        return audio, "aiff"
    return None, ""

# ─── Action tag parsing ───────────────────────────────────────────────────────

_ACTION_RE = re.compile(r"\[ACTION:([A-Z_]+)(?::([^\]]*))?\]")


def extract_actions(text: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2) or "") for m in _ACTION_RE.finditer(text)]


def strip_actions(text: str) -> str:
    return _ACTION_RE.sub("", text).strip()

# ─── Action dispatch ──────────────────────────────────────────────────────────

async def dispatch_action(action: str, param: str, session_id: str = "default") -> str:
    try:
        if action == "CALENDAR":
            return f"Calendar — today: {get_today_events()}"

        if action == "WEEK_CALENDAR":
            return f"Calendar — this week: {get_week_events()}"

        if action == "MAIL":
            return f"Mail: {get_unread_summary()}"

        if action == "MAIL_SEARCH":
            return f"Mail search for '{param}': {search_mail(param)}"

        if action == "NOTES":
            return f"Notes: {get_notes_list()}"

        if action == "NOTE_GET":
            return f"Note '{param}': {get_note_content(param)}"

        if action == "NOTE_CREATE":
            parts = param.split("|", 1)
            title = parts[0].strip()
            content = parts[1].strip() if len(parts) > 1 else ""
            return create_note(title, content)

        if action == "TERMINAL":
            return run_terminal_command(param)

        if action == "CHROME":
            return open_chrome_url(param)

        if action == "BROWSE":
            return await browse_url(param)

        if action == "SEARCH":
            return await web_search(param)

        if action == "WORK_MODE":
            return await start_work_session(param)

        if action == "PLAN":
            return start_planning_session(param, session_id)

        if action == "REMEMBER":
            if "=" in param:
                key, value = param.split("=", 1)
                save_fact(key.strip(), value.strip())
                return f"Remembered: {key.strip()} = {value.strip()}"
            return "REMEMBER format must be KEY=VALUE."

        if action == "TASK_ADD":
            task_id = add_task(param)
            return f"Task added (ID {task_id}): {param}"

        if action == "TASK_DONE":
            try:
                update_task_status(int(param), "done")
                return f"Task {param} marked as done."
            except ValueError:
                return "Invalid task ID — must be a number."

        if action == "TASKS":
            tasks = get_tasks(status="pending")
            if not tasks:
                return "No pending tasks."
            lines = [f"{t['id']}. {t['title']}" for t in tasks]
            return "Pending tasks:\n" + "\n".join(lines)

        return f"Unknown action: {action}"

    except Exception as e:
        logger.error(f"Action dispatch [{action}]: {e}", exc_info=True)
        return f"Error executing {action}: {str(e)[:150]}"

# ─── LLM response ─────────────────────────────────────────────────────────────

async def get_ai_response(
    user_text: str,
    session_id: str = "default",
    extra_context: str = "",
) -> str:
    if not _anthropic:
        return (
            "My neural link appears to be severed — no Anthropic API key is configured. "
            "Please set ANTHROPIC_API_KEY in your .env file."
        )

    history = get_recent_messages(limit=20, session_id=session_id)
    user_content = user_text
    if extra_context:
        user_content = f"{user_text}\n\n[System context — action results]:\n{extra_context}"

    messages = history + [{"role": "user", "content": user_content}]

    try:
        response = _anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=250,
            system=build_system_prompt(),
            messages=messages,
        )
        return response.content[0].text  # type: ignore[union-attr]
    except anthropic.AuthenticationError:
        return "My credentials appear invalid. Please check your ANTHROPIC_API_KEY."
    except anthropic.RateLimitError:
        return "I'm being rate-limited at the moment. Please try again shortly."
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return f"I encountered a technical hiccup: {str(e)[:100]}"

# ─── Echo filter ──────────────────────────────────────────────────────────────

class EchoFilter:
    """Suppress voice recognition while JARVIS is speaking."""

    def __init__(self) -> None:
        self._until = 0.0

    def mark_speaking(self, estimated_duration: float = 3.0) -> None:
        self._until = time.time() + estimated_duration + 1.0

    def is_speaking(self) -> bool:
        return time.time() < self._until

    def mark_done(self) -> None:
        self._until = 0.0


echo = EchoFilter()

# ─── Session ──────────────────────────────────────────────────────────────────

class SessionState:
    def __init__(self) -> None:
        self.state = "idle"
        self.clients: Set[WebSocket] = set()

    async def broadcast(self, msg: dict) -> None:
        dead: Set[WebSocket] = set()
        for ws in list(self.clients):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        self.clients -= dead


session = SessionState()

# ─── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"JARVIS initialised on port {PORT}")
    yield
    logger.info("JARVIS shutting down — good night, sir.")


app = FastAPI(title="JARVIS", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket):
    await websocket.accept()
    session.clients.add(websocket)
    sid = f"sess_{id(websocket)}"
    logger.info(f"Client connected: {sid}")

    try:
        await websocket.send_json({"type": "status", "state": "idle", "ready": True})

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            kind = msg.get("type", "")

            # ── Ping ──────────────────────────────────────────────────────────
            if kind == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # ── Voice transcript ───────────────────────────────────────────────
            if kind == "transcript":
                text = msg.get("text", "").strip()
                if not text:
                    continue

                if echo.is_speaking():
                    logger.debug("Echo-filtered input while speaking")
                    continue

                logger.info(f"User [{sid}]: {text}")

                # Echo transcript back
                await websocket.send_json({"type": "transcript", "text": text, "role": "user"})

                # Thinking
                session.state = "thinking"
                await websocket.send_json({"type": "status", "state": "thinking"})

                # Save to memory
                add_message("user", text, sid)

                # First LLM pass
                raw_response = await get_ai_response(text, sid)

                # Execute actions
                actions = extract_actions(raw_response)
                action_results: list[str] = []

                if actions:
                    for act_name, act_param in actions:
                        result = await dispatch_action(act_name, act_param, sid)
                        action_results.append(result)
                        logger.info(f"[{act_name}] → {result[:80]}")

                # Build spoken response
                if action_results and actions:
                    context = "\n".join(action_results)
                    # Second LLM pass incorporating action results
                    follow_up = await get_ai_response(text, sid, extra_context=context)
                    spoken = strip_actions(follow_up) or strip_actions(raw_response)
                else:
                    spoken = strip_actions(raw_response)

                spoken = spoken.strip() or "Done."
                logger.info(f"JARVIS [{sid}]: {spoken[:100]}")

                # Save response
                add_message("assistant", spoken, sid)

                # Send text response
                await websocket.send_json({"type": "response", "text": spoken})

                # Speaking
                session.state = "speaking"
                await websocket.send_json({"type": "status", "state": "speaking"})

                # Synthesise and stream audio
                audio_bytes, audio_fmt = await synthesize_speech(spoken)
                if audio_bytes:
                    est_duration = max(2.0, len(spoken) / 14.0)
                    echo.mark_speaking(est_duration)

                    chunk_size = 32 * 1024
                    total = len(audio_bytes)
                    for offset in range(0, total, chunk_size):
                        chunk = audio_bytes[offset : offset + chunk_size]
                        is_last = (offset + chunk_size) >= total
                        await websocket.send_json(
                            {
                                "type": "audio",
                                "data": base64.b64encode(chunk).decode(),
                                "format": audio_fmt,
                                "is_last": is_last,
                            }
                        )

                await websocket.send_json({"type": "audio_end"})
                echo.mark_done()
                session.state = "idle"
                await websocket.send_json({"type": "status", "state": "idle"})

            # ── Settings update ────────────────────────────────────────────────
            elif kind == "settings":
                global USER_NAME
                if name := msg.get("user_name", "").strip():
                    USER_NAME = name
                    save_fact("user_name", name)
                await websocket.send_json({"type": "settings_saved"})

            # ── Clear conversation history ─────────────────────────────────────
            elif kind == "clear_history":
                clear_conversation(sid)
                await websocket.send_json({"type": "history_cleared"})

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {sid}")
    except Exception as e:
        logger.error(f"WebSocket error [{sid}]: {e}", exc_info=True)
    finally:
        session.clients.discard(websocket)
        echo.mark_done()
        session.state = "idle"

# ─── REST API ─────────────────────────────────────────────────────────────────

@app.get("/api/status")
async def api_status():
    return {
        "status": "online",
        "state": session.state,
        "clients": len(session.clients),
        "modules": {
            "memory": MEMORY_OK,
            "calendar": CAL_OK,
            "mail": MAIL_OK,
            "notes": NOTES_OK,
            "actions": ACTIONS_OK,
            "browser": BROWSER_OK,
            "work_mode": WORK_OK,
            "planner": PLANNER_OK,
        },
        "tts": {
            "elevenlabs": bool(ELEVENLABS_API_KEY),
            "macos_say": True,
        },
    }


@app.post("/api/wake")
async def api_wake():
    """External wake trigger (e.g. double-clap listener)."""
    await session.broadcast({"type": "wake", "source": "api"})
    return {"status": "ok"}


@app.get("/api/memory/facts")
async def api_facts():
    return get_all_facts()


class FactBody(BaseModel):
    key: str
    value: str


@app.post("/api/memory/facts")
async def api_set_fact(body: FactBody):
    save_fact(body.key, body.value)
    return {"status": "saved"}


@app.get("/api/memory/tasks")
async def api_tasks(status: Optional[str] = None):
    return get_tasks(status=status)


@app.get("/api/memory/history")
async def api_history(limit: int = 20):
    return get_recent_messages(limit=limit)


@app.get("/api/health")
async def api_health():
    return {"ok": True, "version": "1.0.0"}

# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ssl_kwargs: dict = {}
    if CERT_FILE.exists() and KEY_FILE.exists():
        ssl_kwargs = {
            "ssl_certfile": str(CERT_FILE),
            "ssl_keyfile": str(KEY_FILE),
        }
        logger.info("SSL enabled (cert.pem / key.pem)")
    else:
        logger.warning(
            "SSL certificates not found. Running without HTTPS. "
            "Generate with: openssl req -x509 -newkey rsa:2048 "
            "-keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'"
        )

    uvicorn.run(app, host="0.0.0.0", port=PORT, **ssl_kwargs)
