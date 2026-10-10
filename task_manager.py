"""
task_manager.py — Task Persistence & Crash Recovery for Agent Harness
======================================================================
Implements Anthropic's Long-Running Agent Pattern:
  - Tracks goal decomposition into subtasks with status flags ('pending', 'in_progress', 'completed').
  - Persists state atomically to tasks.json.
  - On harness startup, detects unfinished tasks and enables seamless session resumption.
"""

import json
from pathlib import Path

TASKS_FILE = Path(__file__).parent / "tasks.json"


class TaskManager:
    """Manages multi-step task state and crash recovery."""

    @staticmethod
    def load_active_task() -> dict | None:
        """Returns the active task dict if an incomplete goal exists, else None."""
        if not TASKS_FILE.exists():
            return None
        try:
            data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
            if data and data.get("status") != "completed":
                return data
        except Exception:
            pass
        return None

    @staticmethod
    def save_task(goal: str, subtasks: list[dict], current_index: int = 0) -> str:
        """
        Initialize or update a structured task plan.
        Each subtask is a dict: {"id": int, "description": str, "status": "pending"|"completed"}
        """
        data = {
            "goal": goal,
            "status": "in_progress",
            "current_step": current_index,
            "subtasks": subtasks,
        }
        TASKS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return f"task saved: '{goal}' ({len(subtasks)} steps)"

    @staticmethod
    def update_step_status(step_id: int, status: str) -> str:
        """Mark a specific step as 'completed', 'failed', or 'in_progress'."""
        if not TASKS_FILE.exists():
            return "error: no active tasks.json found"
        try:
            data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
            found = False
            for step in data.get("subtasks", []):
                if step.get("id") == step_id:
                    step["status"] = status
                    found = True
                    break

            if not found:
                return f"error: step {step_id} not found"

            # Check if all completed
            if all(s.get("status") == "completed" for s in data["subtasks"]):
                data["status"] = "completed"

            TASKS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return f"step {step_id} updated to {status}"
        except Exception as e:
            return f"error: updating step failed: {e}"

    @staticmethod
    def clear_task() -> str:
        """Clear active task on completion or explicit reset."""
        if TASKS_FILE.exists():
            TASKS_FILE.unlink()
        return "tasks cleared"
