import subprocess
import logging

logger = logging.getLogger("jarvis.mail")


def _run_applescript(script: str, timeout: int = 20) -> str:
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.warning("Mail AppleScript timed out")
        return ""
    except FileNotFoundError:
        logger.error("osascript not found — Mail requires macOS")
        return ""
    except Exception as e:
        logger.error(f"Mail AppleScript error: {e}")
        return ""


def get_unread_summary() -> str:
    script = """
    tell application "Mail"
        set unreadCount to unread count of inbox
        set result to "You have " & unreadCount & " unread message"
        if unreadCount is not 1 then
            set result to result & "s"
        end if
        set result to result & " in your inbox."
        if unreadCount > 0 then
            set recentMails to (messages of inbox whose read status is false)
            set shown to 0
            repeat with msg in recentMails
                if shown >= 3 then exit repeat
                set senderName to sender of msg
                set subjectLine to subject of msg
                set result to result & linefeed & "From " & senderName & ": " & subjectLine
                set shown to shown + 1
            end repeat
        end if
        return result
    end tell
    """
    output = _run_applescript(script)
    return output or "Unable to access Mail. Please ensure Mail app has permission."


def search_mail(query: str) -> str:
    safe_query = query.replace('"', '\\"')
    script = f"""
    tell application "Mail"
        set found to (messages of inbox whose subject contains "{safe_query}" or sender contains "{safe_query}")
        set result to ""
        set shown to 0
        repeat with msg in found
            if shown >= 5 then exit repeat
            set senderName to sender of msg
            set subjectLine to subject of msg
            set dateRec to date received of msg as string
            set result to result & "From " & senderName & ": " & subjectLine & " (" & dateRec & ")" & linefeed
            set shown to shown + 1
        end repeat
        if result is "" then
            return "No messages found matching your search."
        end if
        return result
    end tell
    """
    output = _run_applescript(script)
    return output or "Unable to search Mail."


def get_message_body(sender: str) -> str:
    safe_sender = sender.replace('"', '\\"')
    script = f"""
    tell application "Mail"
        try
            set msg to first message of inbox whose sender contains "{safe_sender}"
            return content of msg
        on error
            return "Message not found."
        end try
    end tell
    """
    output = _run_applescript(script)
    return (output or "Unable to read message.")[:2000]
