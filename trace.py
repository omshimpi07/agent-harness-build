"""Lightweight JSONL trace logger for agent runs."""

import json
import time
import uuid
from pathlib import Path

TRACE_DIR = Path(__file__).parent / "traces"
TRACE_DIR.mkdir(exist_ok=True)


class Tracer:
    """Records every meaningful event in a single agent run to a JSONL file."""

    def __init__(self):
        self.run_id = str(uuid.uuid4())[:8]
        self.step = 0
        self.events: list[dict] = []
        self.file = TRACE_DIR / f"run_{self.run_id}.jsonl"
        self._start = time.time()

    def log(self, event: str, **data):
        """Append one event to the trace."""
        self.step += 1
        entry = {
            "run_id": self.run_id,
            "step": self.step,
            "event": event,
            "time": time.strftime("%H:%M:%S"),
            "elapsed_ms": int((time.time() - self._start) * 1000),
            **data,
        }
        self.events.append(entry)
        with self.file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def summary(self) -> str:
        """One-line summary printed at the end of a run."""
        tool_events = [e for e in self.events if e["event"] == "tool_call"]
        errors = [e for e in self.events if e.get("status") == "error"]
        total_ms = int((time.time() - self._start) * 1000)

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
            f"steps={self.step}",
            f"tools={len(tool_events)}",
            f"errors={len(errors)}",
            f"tokens={total_tokens}",
            f"time={total_ms}ms",
            f"exit={exit_reason}",
        ]
        return "  [trace] " + " | ".join(parts)
