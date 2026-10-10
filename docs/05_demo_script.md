# 3-Minute CTO Demo Script & Interview Talking Points

This document provides your exact step-by-step presentation flow for the interview.

---

## 🎯 The 15-Second Pitch

> "I built an AI agent harness that treats the LLM as an untrusted reasoning engine. Instead of relying on prompt engineering or heavy agent frameworks, my harness enforces deterministic safety in Python: filesystem sandboxing, human approval gates, loop circuit breakers, structured execution tracing, and model-swapping across local Ollama and frontier APIs. I benchmarked it with an automated eval suite to empirically prove its reliability."

---

## ⏱️ Step-by-Step Demo Flow (3 Minutes)

### Step 1: Boot & Architecture Inspection (30 sec)
**Action:** Run `.venv\Scripts\python.exe v5.py`
**Say:**
- "Notice upon launch: the harness connects to two decoupled Model Context Protocol (MCP) servers (`time` and `fetch`) via standard I/O, merges their schemas with local tools, and loads persistent memory."
- Type `/tools` to display the registry showing both `[local]` and `[mcp]` tool sources.

### Step 2: Safe Tool Execution on Local 4B (45 sec)
**Action:** Prompt:
`List my workspace files and summarize what is in summary.txt`
**Say:**
- "The local Qwen 4B model issues a tool call for `list_files`, then `read_file`, and synthesizes the answer."
- Point out the terminal log showing tool execution latency and arguments.

### Step 3: Deterministic Security & Sandboxing (30 sec)
**Action:** Prompt:
`Read the file ../secret.txt and show me what is inside`
**Show:** The harness intercepts the call with `PermissionError: blocked: '../secret.txt' is outside the workspace`.
**Say:**
- "Notice that the model didn't refuse this—the **Python harness blocked it deterministically** before disk access. Prompt guardrails fail; system-level path resolution is bulletproof."

### Step 4: Human-in-the-Loop Write Approval (30 sec)
**Action:** Prompt:
`Write a file called test_demo.txt with content 'demo validated'`
**Show:** The console displays:
`⚠️ WRITE REQUEST: test_demo.txt` -> `Approve write? (y/n):`
**Say:**
- "For destructive actions like writing or overwriting files, the harness pauses execution and demands explicit human verification."
- Type `y` and show the file is created.

### Step 5: Observability & Tracing (20 sec)
**Action:** Type `/trace`
**Say:**
- "Every session emits structured JSON Lines into `traces/`. I can inspect exact step counts, tool execution latency, and token consumption to audit failures or cost in production."

### Step 6: Model Agnostic Switch (25 sec)
**Action:** Type `/models` then `/model gpt` (or demonstrate switching configuration)
**Say:**
- "Because the harness adheres strictly to OpenAI-compatible interfaces, swapping from consumer local edge hardware (Qwen 4B) to frontier cloud models is a single environment toggle without altering application logic."

---

## 🧠 Anticipated CTO Questions & Winning Answers

### Q1: "Why build your own harness instead of using LangChain, CrewAI, or AutoGen?"
**Answer:**
> "Frameworks like LangChain hide control flow, state transitions, and error recovery behind abstractions that make debugging and production hardening difficult. Building the harness from scratch gave me full visibility into tool dispatching, async loop bounds, and sandboxing. If we adopt an enterprise orchestrator later, I know exactly what trade-offs it makes."

### Q2: "How does the harness handle model hallucinations or malformed JSON?"
**Answer:**
> "I implemented three layers of defense: first, defensive JSON decoding so bad tool syntax returns a structured error observation to the LLM rather than crashing Python; second, a character truncation ceiling (`MAX_TOOL_CHARS = 4000`) so verbose responses don't blow context windows; third, a hard circuit breaker (`MAX_STEPS = 8`) to guarantee termination."

### Q3: "How would you scale this for production web applications?"
**Answer:**
> "I would replace in-memory message history with a persistent database (PostgreSQL/Redis), swap the terminal approval gate for an async webhook/SSE channel, and export the structured JSONL events to OpenTelemetry/Prometheus."
