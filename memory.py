import sqlite3
from pathlib import Path
from typing import Optional, List, Dict

DB_PATH = Path("data/jarvis.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = _get_conn()
    conn.executescript("""
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS conversation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            session_id TEXT DEFAULT 'default',
            timestamp TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT DEFAULT 'jarvis',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title, content, content='notes', content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content)
            VALUES (new.id, new.title, new.content);
        END;
    """)
    conn.commit()
    conn.close()


def save_fact(key: str, value: str):
    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO facts (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        (key, value),
    )
    conn.commit()
    conn.close()


def get_fact(key: str) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM facts WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def get_all_facts() -> Dict[str, str]:
    conn = _get_conn()
    rows = conn.execute("SELECT key, value FROM facts").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def add_message(role: str, content: str, session_id: str = "default"):
    conn = _get_conn()
    conn.execute(
        "INSERT INTO conversation (role, content, session_id) VALUES (?, ?, ?)",
        (role, content, session_id),
    )
    conn.commit()
    conn.close()


def get_recent_messages(limit: int = 20, session_id: str = "default") -> List[Dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT role, content FROM conversation WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def add_task(title: str, notes: str = "") -> int:
    conn = _get_conn()
    cursor = conn.execute(
        "INSERT INTO tasks (title, notes) VALUES (?, ?)",
        (title, notes),
    )
    task_id = cursor.lastrowid or 0
    conn.commit()
    conn.close()
    return task_id


def get_tasks(status: Optional[str] = None) -> List[Dict]:
    conn = _get_conn()
    if status:
        rows = conn.execute(
            "SELECT id, title, status, notes, created_at FROM tasks WHERE status = ? ORDER BY id DESC LIMIT 20",
            (status,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, status, notes, created_at FROM tasks ORDER BY id DESC LIMIT 20"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_task_status(task_id: int, status: str):
    conn = _get_conn()
    conn.execute(
        "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (status, task_id),
    )
    conn.commit()
    conn.close()


def search_memory(query: str) -> List[Dict]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT title, content FROM notes_fts WHERE notes_fts MATCH ? LIMIT 5",
            (query,),
        ).fetchall()
        return [{"title": r["title"], "content": r["content"]} for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def clear_conversation(session_id: str = "default"):
    conn = _get_conn()
    conn.execute("DELETE FROM conversation WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()


init_db()
