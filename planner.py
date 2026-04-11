import logging
from typing import Dict, List

logger = logging.getLogger("jarvis.planner")

# In-memory planning sessions keyed by session_id
_sessions: Dict[str, dict] = {}


def start_planning_session(task_description: str, session_id: str = "default") -> str:
    """Begin a planning session with clarifying questions."""
    questions = _generate_questions(task_description)

    _sessions[session_id] = {
        "task": task_description,
        "questions": questions,
        "answers": [],
        "current": 0,
        "status": "questioning",
    }

    if questions:
        return f"Certainly. Before I begin, a quick question: {questions[0]}"
    return f"Very well. I'll plan this straightaway: {task_description}. Shall I proceed?"


def advance_planning(answer: str, session_id: str = "default") -> str:
    """Record an answer and return the next question or a final plan."""
    session = _sessions.get(session_id)
    if not session:
        return "No active planning session, I'm afraid."

    session["answers"].append(answer)
    session["current"] += 1

    if session["current"] < len(session["questions"]):
        next_q = session["questions"][session["current"]]
        return f"Understood. And one more: {next_q}"

    session["status"] = "complete"
    return _build_plan(session)


def get_planning_status(session_id: str = "default") -> dict:
    return _sessions.get(session_id, {})


def clear_session(session_id: str = "default"):
    _sessions.pop(session_id, None)


def _generate_questions(task: str) -> List[str]:
    task_lower = task.lower()
    questions: List[str] = []

    if any(w in task_lower for w in ["website", "web app", "frontend", "ui", "landing"]):
        questions.append("What's the primary purpose — personal project, business, or portfolio?")
        questions.append("Do you have a colour scheme or design style in mind, or shall I choose?")
    elif any(w in task_lower for w in ["script", "tool", "automate", "bot"]):
        questions.append("Will this run on a schedule, on demand, or in response to an event?")
    elif any(w in task_lower for w in ["api", "integration", "connect", "sync"]):
        questions.append("Do you have the API credentials ready, or do you need guidance obtaining them?")

    if any(w in task_lower for w in ["app", "application", "system"]) and not questions:
        questions.append("Who is the primary user — just yourself, or others as well?")

    if not questions:
        questions.append("Could you tell me a bit more about what you'd like to achieve?")

    return questions[:2]


def _build_plan(session: dict) -> str:
    task = session["task"]
    answers = session["answers"]

    plan = f"Excellent. Here is my plan for '{task}'. "
    if answers:
        plan += (
            "Taking your requirements into account, I shall start with the foundation, "
            "then implement the core features, and finish with testing and refinement. "
            "Shall I proceed?"
        )
    else:
        plan += "I'll work through it systematically. Shall I begin?"
    return plan
