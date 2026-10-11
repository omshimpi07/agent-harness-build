"""Lightweight JSONL trace logger for agent runs."""

import json
import time
import uuid
from pathlib import Path

from security import Sandbox

TRACE_DIR = Path(__file__).parent / "traces"
TRACE_DIR.mkdir(exist_ok=True)


def _mask_data(obj):
    """Recursively mask secrets across dicts, lists, and strings before writing to trace."""
    if isinstance(obj, str):
        return Sandbox.mask_secrets(obj)
    elif isinstance(obj, dict):
        return {k: _mask_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_mask_data(v) for v in obj]
    return obj


class Tracer:
    """Records every meaningful event in a single agent run to a JSONL file."""

    def __init__(self):
        self.run_id = str(uuid.uuid4())[:8]
        self.step = 0
        self.events: list[dict] = []
        self.file = TRACE_DIR / f"run_{self.run_id}.jsonl"
        self._start = time.time()

    def log(self, event: str, **data):
        """Append one event to the trace with automatic secret masking."""
        self.step += 1
        sanitized_data = _mask_data(data)
        entry = {
            "run_id": self.run_id,
            "step": self.step,
            "event": event,
            "time": time.strftime("%H:%M:%S"),
            "elapsed_ms": int((time.time() - self._start) * 1000),
            **sanitized_data,
        }
        self.events.append(entry)
        with self.file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def summary(self) -> str:
        """One-line summary printed at the end of a run."""
        tool_events = [e for e in self.events if e["event"] == "tool_call"]
        errors = [e for e in self.events if e.get("status") == "error" or e["event"] == "security_block"]
        total_ms = int((time.time() - self._start) * 1000)

        # Count actual LLM turns
        llm_steps = sum(1 for e in self.events if e["event"] in ("model_response", "run_ended") and "model_ms" in e)
        if not llm_steps:
            llm_steps = max((e.get("llm_step", 1) for e in self.events), default=1)

        exit_reason = "unknown"
        for e in reversed(self.events):
            if "exit_reason" in e:
                exit_reason = e["exit_reason"]
                break

        total_tokens = sum(
            e.get("prompt_tokens", 0) + e.get("completion_tokens", 0)
            for e in self.events
        )

        parts = [
            f"run={self.run_id}",
            f"llm_steps={llm_steps}",
            f"tools={len(tool_events)}",
            f"errors={len(errors)}",
            f"tokens={total_tokens}",
            f"time={total_ms}ms",
            f"exit={exit_reason}",
        ]
        return "  [trace] " + " | ".join(parts)
