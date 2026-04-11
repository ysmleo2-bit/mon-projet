import asyncio
import logging
from pathlib import Path

logger = logging.getLogger("jarvis.work")


async def start_work_session(task_description: str, directory: str = "~/Desktop") -> str:
    """Launch Claude Code in the background to work on a development task."""
    work_dir = Path(directory).expanduser().resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    prompt = (
        f"Complete the following task carefully and systematically:\n\n"
        f"{task_description}\n\n"
        f"When done, summarize what you built or changed."
    )

    try:
        process = await asyncio.create_subprocess_exec(
            "claude",
            "-p",
            prompt,
            cwd=str(work_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Give the process a moment to start
        await asyncio.sleep(1)

        if process.returncode is not None and process.returncode != 0:
            _, stderr = await process.communicate()
            return f"Work session failed to start: {stderr.decode()[:300]}"

        return (
            f"Work session started in {work_dir}. "
            f"Claude Code is now tackling: {task_description[:120]}..."
        )

    except FileNotFoundError:
        return (
            "Claude Code CLI is not installed. "
            "Install it with: npm install -g @anthropic-ai/claude-code"
        )
    except Exception as e:
        logger.error(f"Work mode error: {e}")
        return f"Unable to start work session: {str(e)}"


async def run_claude_task(prompt: str, directory: str = ".") -> str:
    """Run a one-shot Claude Code task and capture output."""
    try:
        process = await asyncio.create_subprocess_exec(
            "claude",
            "-p",
            prompt,
            cwd=directory,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120.0)
        if process.returncode == 0:
            return stdout.decode()[:2000]
        return f"Task failed: {stderr.decode()[:500]}"
    except asyncio.TimeoutError:
        return "Task timed out after 120 seconds."
    except FileNotFoundError:
        return "Claude Code not found. Install: npm install -g @anthropic-ai/claude-code"
    except Exception as e:
        return f"Error running task: {str(e)}"
