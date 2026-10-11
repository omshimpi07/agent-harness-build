# AI Agent Harness — V5: Reliable, Observable & Multi-Model

An enterprise-ready AI Agent Harness built in Python that wraps language models (local Ollama or Cloud APIs) with deterministic safety controls, structured execution tracing, and automated empirical evaluation.

Developed as a progressive architectural evolution from basic LLM request/response to a resilient runtime.

---

## 🏛️ Architectural Progression (The Story)

- **v0**: Raw prompt-response boundary via an OpenAI-compatible API.
- **v1**: First local tool execution (`list_files`, `read_file`) with explicit JSON schemas.
- **v2**: Multi-turn agent loop (`while True`) with observations appended to context.
- **v3**: Model Context Protocol (MCP) integration over Stdio for decoupled external tools (`time`, `fetch`).
- **v4**: Persistent file-based memory (`memory.md`) injected into the system prompt.
- **v5 (Current Milestone)**: **Hardened Runtime**
  - **Deterministic Safety**: Path traversal sandbox, human-in-the-loop write approval gates, circuit breaker limits.
  - **Observability**: Structured JSON Lines tracing per step with token/latency instrumentation.
  - **Context Defense**: Character truncation safeguards preventing context blowout.
  - **Empirical Evaluation**: 7-task automated benchmark showing measurable baseline vs harness improvements.

---

## 🛡️ Deterministic Safety Controls

1. **Filesystem Sandboxing (`_safe_path`)**:
   - Resolves all file operations strictly against `workspace/`.
   - Any attempt to read or write parent directories (e.g., `../secret.txt`) raises an immediate `PermissionError` handled before disk access.
2. **Human-in-the-Loop Write Gates (`APPROVE_WRITES`)**:
   - Configurable modes: `"ask"` (interactive prompt previewing content), `"auto"` (automated CI/eval), `"deny"` (read-only lockdown).
3. **Execution Circuit Breaker (`MAX_STEPS = 8`)**:
   - The application layer strictly bounds iterative loop cycles. Runaway loops exit deterministically with an inspectable reason.
4. **Context Saturation Defense (`MAX_TOOL_CHARS = 4000`)**:
   - External fetch or read outputs exceeding 4000 characters are safely truncated to protect small model context windows.
5. **Tool Error Isolation**:
   - Individual tool exceptions (e.g., missing files, network drops) are intercepted and formatted as standard observations instead of crashing the runtime.
6. **Context Trimming (Sliding Window)**:
   - Before every model call, the harness enforces a message-count sliding window (`MAX_CONTEXT_MESSAGES = 20`).
   - Preserves the system prompt and drops oldest turns via FIFO eviction, preventing context overflow on small models.
7. **Output Verification (Post-Check)**:
   - Before returning a response to the user, the harness runs a 4-point verification pass:
     - System prompt leak detection (catches verbatim fragments)
     - Hallucinated tool reference detection
     - Raw JSON bleed recovery (extracts content from leaked message objects)
     - Defense-in-depth secret re-masking on generated output

---

## 🚀 Quickstart

### 1. Requirements
- Python 3.13+ (managed via `uv`)
- Local Ollama running `qwen3.5:4b`

### 2. Running the Harness
```powershell
# Run the hardened V5 harness
.venv\Scripts\python.exe v5.py
```

### 3. Interactive Slash Commands
- `/models`: View configured local and cloud model endpoints.
- `/model <name>`: Switch model provider at runtime (e.g., `/model local`, `/model gpt`, `/model claude`).
- `/tools`: Inspect active local Python tools and live MCP tools.
- `/trace`: Inspect the full execution trace of the last run.
- `/memory`: View durable memory stored across sessions.
- `/quit`: Exit the harness.

---

## 📊 Automated Evaluation Suite

The harness includes an automated 7-task code-scored benchmark (`eval/run_eval.py`) assessing single-tool execution, multi-step chains, security containment, and missing-resource recovery.

```powershell
# 1. Run baseline evaluation (unhardened loop)
.venv\Scripts\python.exe eval/run_eval.py --baseline

# 2. Run hardened V5 evaluation
.venv\Scripts\python.exe eval/run_eval.py

# 3. View before/after comparison matrix
.venv\Scripts\python.exe eval/compare.py
```

---

## 🔍 Structured Tracing

Every execution session creates a trace in `traces/run_<id>.jsonl` recording:
- `event`: `run_started`, `model_response`, `tool_call`, `run_ended`
- `duration_ms`: Latency profiling per step
- `prompt_tokens` & `completion_tokens`: Token consumption tracking
- `exit_reason`: `completed`, `max_steps_exceeded`, `model_error`
