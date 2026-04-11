import subprocess
import logging

logger = logging.getLogger("jarvis.actions")


def _run_applescript(script: str, timeout: int = 10) -> str:
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.warning("AppleScript timed out")
        return ""
    except FileNotFoundError:
        logger.error("osascript not found — requires macOS")
        return ""
    except Exception as e:
        logger.error(f"AppleScript error: {e}")
        return ""


def run_terminal_command(command: str) -> str:
    """Open Terminal and run a shell command."""
    safe_command = command.replace("\\", "\\\\").replace('"', '\\"')
    script = f"""
    tell application "Terminal"
        activate
        do script "{safe_command}"
        return "Command sent to Terminal."
    end tell
    """
    output = _run_applescript(script)
    return output or f"Command dispatched: {command}"


def open_chrome_url(url: str) -> str:
    """Open a URL in Google Chrome."""
    safe_url = url.replace('"', '\\"')
    script = f"""
    tell application "Google Chrome"
        activate
        if (count of windows) > 0 then
            tell window 1
                set newTab to make new tab with properties {{URL:"{safe_url}"}}
                set active tab index to index of newTab
            end tell
        else
            make new window
            set URL of active tab of window 1 to "{safe_url}"
        end if
        return "Opened in Chrome."
    end tell
    """
    output = _run_applescript(script)
    return output or f"Opened {url} in Chrome."


def open_application(app_name: str) -> str:
    """Activate a macOS application."""
    safe_name = app_name.replace('"', '\\"')
    script = f'tell application "{safe_name}" to activate'
    _run_applescript(script)
    return f"Opened {app_name}."


def show_notification(title: str, message: str) -> str:
    """Show a macOS system notification."""
    safe_title = title.replace('"', '\\"')
    safe_message = message.replace('"', '\\"')
    script = f'display notification "{safe_message}" with title "{safe_title}"'
    _run_applescript(script)
    return "Notification sent."


def set_volume(level: int) -> str:
    """Set system volume 0-100."""
    apple_vol = min(7, max(0, round(level / 100 * 7)))
    _run_applescript(f"set volume {apple_vol}")
    return f"Volume set to {level}%."


def get_frontmost_app() -> str:
    """Return the name of the frontmost application."""
    script = 'tell application "System Events" to return name of first application process whose frontmost is true'
    return _run_applescript(script) or "Unknown"
