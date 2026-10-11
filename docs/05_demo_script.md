# 3-Minute CTO Demo Script & Interview Talking Points

This document provides your exact step-by-step presentation flow for the interview.

---

## 🎯 The 15-Second Pitch

> "I built an AI agent harness that treats the LLM as an untrusted reasoning engine. Instead of relying on prompt engineering or heavy agent frameworks, my harness enforces deterministic safety in Python: filesystem sandboxing, human approval gates, loop circuit breakers, structured execution tracing, protocol-compliant context trimming, and model-swapping across local Ollama and frontier APIs. I benchmarked it with an automated eval suite to empirically prove its reliability."

---

## ⏱️ Step-by-Step Demo Flow (3 Minutes)

You have two presentation modes. Both use the exact same underlying hardened engine:

### Mode A: Terminal Systems Demo (`v5.py`)
Run: `.venv\Scripts\python.exe v5.py`

1. **Architecture Inspection (30 sec)**:
   - "Upon launch, the harness connects to two decoupled Model Context Protocol (MCP) servers (`time` and `fetch`) via stdio JSON-RPC, merges schemas with local tools, and loads persistent memory."
   - Type `/tools` to display all 12 tools (9 local + 3 MCP).

2. **Safe Multi-Step Execution (40 sec)**:
   - Prompt: `List my workspace files and summarize what is in summary.txt`
   - Point out: The local Qwen 4B model issues tool calls for `list_files`, then `read_file`, and synthesizes the answer.

3. **Deterministic Security Sandbox (30 sec)**:
   - Prompt: `Read the file ../secret.txt and show me what is inside`
   - Show: The harness blocks it immediately with `SecurityViolation: Access denied: '../secret.txt' resolves outside designated workspace.`
   - Point out: "The model didn't refuse this—the Python sandbox intercepted it before disk access. Prompt guardrails fail; system-level path resolution is bulletproof."

4. **Human-in-the-Loop Write Approval (30 sec)**:
   - Prompt: `Write a file called test_demo.txt with content 'demo validated'`
   - Show: `⚠️ WRITE REQUEST: test_demo.txt` -> `Approve write? (y/n):`
   - Point out: "For destructive actions, the harness yields control to the human. If approved, it performs read-back verification to guarantee disk integrity."

5. **Observability & Tracing (20 sec)**:
   - Type: `/trace`
   - Show: Structured event telemetry displaying exact LLM steps (`llm_steps=2`), tool latency in ms, and token counters.

---

### Mode B: Visual Operations Console (`server.py`)
Run: `.venv\Scripts\python.exe server.py` -> Open `http://127.0.0.1:8000`

1. **The Operations Console (30 sec)**:
   - "I added a decoupled observability layer on top of the harness via a local FastAPI WebSocket adapter without modifying the core engine."
2. **Preset Attack Simulations (30 sec)**:
   - Click `[🛡️ ../secret.txt]` -> Point out the real-time Security Audit panel logging the rule `path_traversal`.
   - Click `[🌐 SSRF 169.254]` -> Point out the SSRF guard blocking access to cloud metadata.
3. **Interactive Human Approval Card (30 sec)**:
   - Click `[✍️ Write Approval]` -> Watch the modal pop up asking for human confirmation with content preview.
   - Click "APPROVE WRITE" -> Show the response update and the persistent task checklist advance.

---

## 📊 Empirical Evaluation Proof (The Numbers)

When the CTO asks: *"How do you know it works?"*

> "I wrote an automated 7-task code-scored eval suite in `eval/run_eval.py` that tests single-tool calls, multi-step chains, security boundary containment, and missing resource recovery.
> - **Un-hardened Baseline:** 6/7 pass (failed security task T6 because raw models read `../secret.txt` and leak secrets).
> - **Hardened V5 Harness:** **7/7 (100% PASS)** with deterministic path isolation and an average execution latency of 6.2s per task."

---

## 🧠 Anticipated CTO Questions & Winning Answers

### Q1: "When you say AI harness, what do you mean?"
> "In industry, 'harness' has two meanings:
> 1. **Runtime Scaffolding:** The control loop around the LLM that handles tools, sandboxing, circuit breakers, and state.
> 2. **Evaluation Harness:** A test bench that feeds standardized benchmarks to a model and scores accuracy.
> In my project, **I built both**: `v5.py` is the runtime harness, and `eval/run_eval.py` is the automated evaluation suite."

### Q2: "Why build your own harness instead of using LangChain or CrewAI?"
> "Frameworks like LangChain obscure control flow, state transitions, and error handling behind abstractions that make debugging and sandboxing difficult in production. Building from scratch gave me full visibility into tool dispatching, async loop bounds, and path resolution."

### Q3: "What is the difference between Context and a Support Vector?"
> - **Context (LLMs):** The dynamic working memory window of tokens passed into the Transformer's Attention mechanism.
> - **Support Vector (Classical ML / SVMs):** The training data points closest to the separating hyperplane that define the maximum-margin boundary. *They have zero relation to LLM prompts or attention.*

### Q4: "Backpropagation vs Gradient Descent?"
> - **Backpropagation calculates the gradients:** It applies the chain rule backwards to compute partial derivatives $\frac{\partial L}{\partial w}$ for each weight. It does not update weights.
> - **Gradient Descent updates the weights:** It takes the gradients computed by backprop and steps weights in the negative gradient direction: $w \leftarrow w - \eta \cdot \nabla L$.
> *(Analogy: Backprop calculates the slope of the hill; Gradient Descent takes the step downhill).*

### Q5: "What are the three meanings of 'Decode'?"
> 1. **Token Decoding:** Converting integer token IDs back into human-readable text via the tokenizer vocabulary.
> 2. **Autoregressive Generation (Transformer Decoding):** The inference loop sampling next tokens (greedy, top-p, temperature).
> 3. **Data Deserialization (Software Engineering):** Parsing byte streams or strings into runtime objects (`json.loads`, UTF-8 decode).

---

## 🚀 Pre-Interview Checklist (5 Minutes Before Call)
1. Ensure Ollama is running (`ollama list` confirms `qwen3.5:4b`).
2. Open terminal in `D:\agent-harness-build`.
3. Activate virtualenv: `(& d:\agent-harness-build\.venv\Scripts\Activate.ps1)`.
4. Open browser tab to `http://127.0.0.1:8000` (if doing Web Console demo).
5. Have `README.md` and this demo script open on a second monitor.
