import subprocess
import logging

logger = logging.getLogger("jarvis.notes")


def _run_applescript(script: str, timeout: int = 15) -> str:
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.warning("Notes AppleScript timed out")
        return ""
    except FileNotFoundError:
        logger.error("osascript not found — Notes requires macOS")
        return ""
    except Exception as e:
        logger.error(f"Notes AppleScript error: {e}")
        return ""


def get_notes_list(limit: int = 10) -> str:
    script = f"""
    tell application "Notes"
        set result to ""
        set noteList to notes of default account
        set shown to 0
        repeat with n in noteList
            if shown >= {limit} then exit repeat
            set noteTitle to name of n
            set result to result & noteTitle & linefeed
            set shown to shown + 1
        end repeat
        if result is "" then
            return "No notes found."
        end if
        return result
    end tell
    """
    output = _run_applescript(script)
    return output or "Unable to access Notes."


def get_note_content(title: str) -> str:
    safe_title = title.replace('"', '\\"')
    script = f"""
    tell application "Notes"
        try
            set matchedNote to first note of default account whose name contains "{safe_title}"
            return body of matchedNote
        on error
            return "Note not found."
        end try
    end tell
    """
    output = _run_applescript(script)
    return (output or "Unable to read note.")[:3000]


def create_note(title: str, content: str) -> str:
    safe_title = title.replace('"', '\\"').replace("\\", "\\\\")
    safe_content = content.replace('"', '\\"').replace("\\", "\\\\")
    script = f"""
    tell application "Notes"
        tell default account
            make new note with properties {{name:"{safe_title}", body:"{safe_content}"}}
        end tell
        return "Note \\"{safe_title}\\" created."
    end tell
    """
    output = _run_applescript(script)
    return output or f'Note "{title}" created.'
