# V5 Architecture — Full Blueprint Before We Build

## File Structure

```
d:\agent-harness-build\
│
├── harness.py              ← UNTOUCHED (your v4/current — the "before")
├── v5.py                   ← NEW: the upgraded harness (standalone)
├── trace.py                ← NEW: trace logger (imported by v5.py)
│
├── v0.py … v4.py           ← your history (untouched)
│
├── eval/
│   ├── run_eval.py          ← NEW: 7-task automated eval
│   └── compare.py           ← NEW: before/after table
│
├── traces/                  ← NEW: auto-generated JSONL logs
├── docs/                    ← already done
│
├── workspace/               ← shared (both harness.py and v5.py use it)
│   ├── demo_notes.md        ← NEW fixture
│   └── ... existing files
│
├── secret.txt               ← NEW: outside workspace (safety test)
├── memory.md                ← shared
├── mcp_servers.json         ← shared
└── pyproject.toml           ← unchanged
```

> [!IMPORTANT]
> `v5.py` is a **standalone file**. It reuses the same *patterns* and *config* from harness.py but does NOT import from it. Same way v3.py didn't import from v2.py.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        v5.py                            │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 USER / CLI                       │   │
│  │  input loop + slash commands                     │   │
│  │  /model /tools /memory /trace /quit              │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                       │
│  ┌──────────────▼───────────────────────────────────┐   │
│  │            AGENT RUNTIME (run_agent)              │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │           SAFETY CONTROLS                   │  │   │
│  │  │  • MAX_STEPS circuit breaker                │  │   │
│  │  │  • JSON parse error handling                │  │   │
│  │  │  • Model connection error handling          │  │   │
│  │  │  • Per-step tracing via trace.py            │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                   │   │
│  │  ask model ──► inspect response ──► dispatch tool │   │
│  │       ▲              │                    │       │   │
│  │       └──────────────┴── append result ◄──┘       │   │
│  │                      │                            │   │
│  │              (repeat until done or limit hit)     │   │
│  └──────────────┬──────────────┬─────────────────────┘   │
│                 │              │                         │
│  ┌──────────────▼────┐  ┌─────▼──────────────────────┐  │
│  │   MODEL ADAPTER   │  │      TOOL LAYER            │  │
│  │                   │  │                            │  │
│  │  ModelConfig      │  │  ┌───────────────────────┐ │  │
│  │  • local (Qwen)   │  │  │   LOCAL TOOLS         │ │  │
│  │  • gpt            │  │  │   list_files          │ │  │
│  │  • claude         │  │  │   read_file  ◄─ _safe_path()  │
│  │  • local-small    │  │  │   write_file ◄─ _safe_path()  │
│  │                   │  │  │              ◄─ approval gate  │
│  │  AsyncOpenAI      │  │  │   save_memory         │ │  │
│  │  (same client     │  │  └───────────────────────┘ │  │
│  │   for all)        │  │                            │  │
│  └───────────────────┘  │  ┌───────────────────────┐ │  │
│                         │  │   MCP TOOLS            │ │  │
│  ┌───────────────────┐  │  │   get_current_time    │ │  │
│  │  STATE / MEMORY   │  │  │   convert_time        │ │  │
│  │                   │  │  │   fetch               │ │  │
│  │  messages[]       │  │  └───────────────────────┘ │  │
│  │  memory.md        │  └────────────────────────────┘  │
│  │  reset_convo()    │                                  │
│  └───────────────────┘                                  │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  trace.py   │
                    │             │
                    │  Tracer     │
                    │  • log()    │
                    │  • summary()│
                    │             │
                    │  writes →   │
                    │  traces/    │
                    │  run_XX.jsonl│
                    └─────────────┘
```

---

## What's REUSED vs What's NEW

| Component | From harness.py | New in v5.py |
|---|---|---|
| `ModelConfig` + `MODELS` dict | ✅ Same code, copied | — |
| `load_memory` / `save_memory` | ✅ Same code, copied | — |
| `list_files` | ✅ Same | — |
| `read_file` | Pattern reused | 🆕 + `_safe_path()` guard |
| `write_file` | Pattern reused | 🆕 + `_safe_path()` + approval gate |
| `TOOL_SCHEMAS` | ✅ Same | — |
| `SYSTEM_PROMPT` | ✅ Same | — |
| `connect_mcp` | ✅ Same code, copied | — |
| `call_tool` | Pattern reused | 🆕 + try/except wrapping |
| `run_agent` | Pattern reused | 🆕 + MAX_STEPS + tracing + error handling |
| `handle_command` | Pattern reused | 🆕 + `/trace` command |
| `main` | ✅ Same pattern | — |
| `trace.py` | — | 🆕 Entirely new module |
| `_safe_path()` | — | 🆕 Path traversal guard |
| `reset_conversation()` | — | 🆕 For eval suite |
| `auto_approve` flag | — | 🆕 For unattended eval |

---

## Data Flow — One Complete Request

```
User types: "Read summary.txt and tell me what it says"
│
▼
v5.py: main() receives input
│
▼
run_agent(user_message)
│
├── tracer = Tracer()
├── tracer.log("run_started", prompt=..., model=...)
├── messages.append(user message)
│
├── STEP 1: ──────────────────────────────────────────
│   ├── steps=1, check MAX_STEPS → ok
│   ├── try: client.chat.completions.create(...)
│   ├── tracer.log("model_response", tool_calls=1, tokens=...)
│   │
│   ├── Model returns: tool_call(read_file, {"filename": "summary.txt"})
│   │
│   ├── try: json.loads(arguments) → ok
│   ├── try: call_tool("read_file", {"filename": "summary.txt"})
│   │   └── _safe_path("summary.txt") → inside workspace → ok
│   │   └── returns file content
│   ├── tracer.log("tool_call", tool="read_file", status="ok", duration_ms=5)
│   ├── messages.append(tool result)
│   └── continue loop
│
├── STEP 2: ──────────────────────────────────────────
│   ├── steps=2, check MAX_STEPS → ok
│   ├── try: client.chat.completions.create(...)
│   ├── Model returns: final text (no tool calls)
│   ├── tracer.log("run_ended", exit_reason="completed", tokens=...)
│   ├── print(tracer.summary())
│   └── return answer
│
▼
main() prints: "assistant: The summary.txt contains..."
Trace saved to: traces/run_a1b2c3d4.jsonl
```

## Data Flow — Safety Block

```
User types: "Read ../secret.txt"
│
▼
run_agent → model returns tool_call(read_file, {"filename": "../secret.txt"})
│
├── call_tool("read_file", {"filename": "../secret.txt"})
│   └── _safe_path("../secret.txt")
│       └── resolved path = d:\agent-harness-build\secret.txt
│       └── NOT inside d:\agent-harness-build\workspace\
│       └── raises PermissionError("blocked: outside workspace")
│
├── except Exception → result = "error: tool failed — PermissionError: blocked..."
├── tracer.log("tool_call", tool="read_file", status="error")
├── messages.append(error as tool result)
│
├── Model sees the error, responds: "I can't read that file, it's outside..."
├── tracer.log("run_ended", exit_reason="completed")
└── return
```

## Data Flow — Circuit Breaker

```
Model stuck in loop, keeps calling tools...
│
├── STEP 7: tool call → ok, continue
├── STEP 8: tool call → ok, continue
├── STEP 9: steps > MAX_STEPS (8)
│   ├── tracer.log("run_ended", exit_reason="max_steps_exceeded")
│   ├── return "[harness] Stopped: step limit reached"
│   └── LOOP ENDS — harness stays in control
```

---

## Module Boundaries

### `v5.py` (~350–400 lines estimated)
Everything in one file, same as your existing pattern. Contains:
- Config (models, paths, constants)
- Memory functions
- Tool functions (with safety)
- Tool schemas
- MCP connection
- Agent runtime loop (with safety + tracing)
- Slash commands (with /trace)
- Main entry point
- `reset_conversation()` and `auto_approve` for eval

### `trace.py` (~50 lines)
Separate because:
- It's a clean, independent utility
- Both `v5.py` and `eval/run_eval.py` import it
- Easy to test independently

### `eval/run_eval.py` (~120 lines)
Separate because:
- It's a test runner, not part of the harness
- Imports from `v5.py` (calls `run_agent`, `reset_conversation`)
- Runs independently: `python eval/run_eval.py`

---

## Ready to Build?

The architecture is complete. When you approve, I will build in this order:

1. **`trace.py`** — standalone, no dependencies (5 min)
2. **`v5.py`** — the full upgraded harness (the main work)
3. **Test fixtures** — `demo_notes.md`, `secret.txt`
4. **`eval/run_eval.py`** — the eval suite
5. **Verify** — run v5.py and confirm everything works
