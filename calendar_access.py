import subprocess
import logging
import time
from threading import Thread, Lock

logger = logging.getLogger("jarvis.calendar")

_cache_lock = Lock()
_cache: dict = {"today": "", "week": "", "updated": 0.0}


def _run_applescript(script: str, timeout: int = 15) -> str:
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            logger.debug(f"AppleScript stderr: {result.stderr.strip()}")
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.warning("AppleScript timed out")
        return ""
    except FileNotFoundError:
        logger.error("osascript not found — Calendar requires macOS")
        return ""
    except Exception as e:
        logger.error(f"AppleScript error: {e}")
        return ""


def get_today_events() -> str:
    with _cache_lock:
        if time.time() - _cache["updated"] < 300 and _cache["today"]:
            return _cache["today"]

    script = """
    tell application "Calendar"
        set todayStart to current date
        set todayStart's time to 0
        set todayEnd to todayStart + 86400
        set result to ""
        repeat with cal in calendars
            try
                set evts to (every event of cal whose start date >= todayStart and start date < todayEnd)
                repeat with evt in evts
                    try
                        set evtTitle to summary of evt
                        set evtStart to start date of evt
                        set timeStr to time string of evtStart
                        set result to result & evtTitle & " at " & timeStr & linefeed
                    end try
                end repeat
            end try
        end repeat
        if result is "" then
            return "No events scheduled for today."
        end if
        return result
    end tell
    """
    output = _run_applescript(script) or "Unable to access Calendar. Ensure Calendar has permissions."

    with _cache_lock:
        _cache["today"] = output
        _cache["updated"] = time.time()

    return output


def get_week_events() -> str:
    with _cache_lock:
        if time.time() - _cache["updated"] < 300 and _cache["week"]:
            return _cache["week"]

    script = """
    tell application "Calendar"
        set todayStart to current date
        set todayStart's time to 0
        set weekEnd to todayStart + (7 * 86400)
        set result to ""
        repeat with cal in calendars
            try
                set evts to (every event of cal whose start date >= todayStart and start date < weekEnd)
                repeat with evt in evts
                    try
                        set evtTitle to summary of evt
                        set evtStart to start date of evt
                        set dateStr to date string of evtStart
                        set timeStr to time string of evtStart
                        set result to result & evtTitle & " — " & dateStr & " at " & timeStr & linefeed
                    end try
                end repeat
            end try
        end repeat
        if result is "" then
            return "No events this week."
        end if
        return result
    end tell
    """
    output = _run_applescript(script) or "Unable to access Calendar."

    with _cache_lock:
        _cache["week"] = output
        _cache["updated"] = time.time()

    return output


def _refresh_cache():
    while True:
        try:
            get_today_events()
        except Exception as e:
            logger.error(f"Calendar cache refresh error: {e}")
        time.sleep(300)


Thread(target=_refresh_cache, daemon=True).start()
