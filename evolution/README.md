# Architectural Evolution (v0 → v4)

This folder documents the progressive engineering evolution of the agent harness prior to the hardened `v5.py` production runtime.

| Version | Focus | What Was Introduced |
|:---|:---|:---|
| **v0.py** | Raw Model Call | Basic OpenAI-compatible completion loop without tools. |
| **v1.py** | Tool Calling | Local Python function dispatch via OpenAI tool schemas. |
| **v2.py** | Error Isolation | Safe JSON argument parsing and per-tool exception boundaries. |
| **v3.py** | State & Memory | Multi-turn conversational history and durable `memory.md`. |
| **v4.py** | Protocol Expansion | MCP (Model Context Protocol) external tool servers via stdio. |
| **v5.py** | **Production Harness** | Complete sandboxing, circuit breakers, context trimming, write approval gates, output checks, and real-time tracing. |
