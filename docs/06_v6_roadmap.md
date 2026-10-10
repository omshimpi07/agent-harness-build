# AI Harness V6 — Production Architecture & Scaling Roadmap

This document outlines the architectural evolution from **V5 (Single-Agent Hardened Runtime)** to **V6 (Distributed Production Agent Engine)**.

---

## 🏗️ The Evolution: V5 vs V6

| Dimension | V5 (Current Milestone) | V6 (Production Target) |
| :--- | :--- | :--- |
| **Interface** | Terminal CLI (`input()` approval) | Async Webhook / WebSocket Event Bus (Web UI) |
| **Agent Pattern** | Single-Agent with Task Persistence | Hierarchical Multi-Agent (Supervisor + Specialists) |
| **Observability** | Local JSON Lines (`traces/*.jsonl`) | OpenTelemetry (OTel) + Prometheus / Jaeger |
| **Storage** | Markdown & Local JSON (`tasks.json`) | PostgreSQL (pgvector) + Redis State Cache |
| **Execution Sandbox** | Python-level path & SSRF guards | Ephemeral Docker containers / WebAssembly (Wasm) |

---

## 🌟 The 3 Pillars of V6

### 1. Event-Driven Human-in-the-Loop (Decoupled UI)
In V5, write approvals pause Python's synchronous `input()`. For V6:
- The agent loop emits a `WAITING_FOR_APPROVAL` event to Redis Pub/Sub.
- A Next.js/React web dashboard displays the pending file diff or web request.
- The human clicks "Approve" or "Reject", sending an API webhook back to resume the execution thread.

### 2. Hierarchical Multi-Agent Orchestration
Anthropic and Google both recommend keeping single-agent harnesses until parallel delegation is required:
- **Supervisor Agent (Orchestrator)**: Triages user requests, maintains the global `tasks.json` plan, and delegates subtasks.
- **Coder / Research Specialist**: Given an isolated workspace and tools to execute deep code or scrape documentation.
- **Evaluator / Critic Agent**: Reviews the specialist's output before reporting back to the supervisor, preventing agents from declaring victory prematurely.

### 3. Enterprise Observability & Cost Management
- Export step latency, token metrics, and tool execution graphs directly to OpenTelemetry collectors.
- Real-time token budget alerts: Automatically terminate or downgrade agent runs exceeding pre-configured cost thresholds ($0.50/run).
