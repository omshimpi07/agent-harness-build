"""
server.py — Agent Operations Console Server (FastAPI Adapter)
=============================================================
Connects the production AI Harness (v5.py) to a lightweight, zero-build
observability frontend via WebSocket and REST APIs.

Key features:
  - Strict host binding: 127.0.0.1 only
  - Origin header validation on WebSockets
  - Concurrency isolation: single agent execution lock (asyncio.Lock)
  - Live approval hook: routes write_file confirmations directly to the UI
  - Real-time telemetry streaming: steps, tools, latency, tokens, security blocks
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from contextlib import asynccontextmanager, AsyncExitStack

import v5
from task_manager import TaskManager
from security import SEC_LOG_FILE

ROOT = Path(__file__).parent
STATIC_DIR = ROOT / "static"
STATIC_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: connects external MCP tool servers on boot."""
    async with AsyncExitStack() as stack:
        print("  [console] connecting MCP servers for agent harness...")
        try:
            await v5.connect_mcp(stack)
        except Exception as e:
            print(f"  [console] MCP connection notice: {e}")
        yield


app = FastAPI(title="AI Agent Operations Console", lifespan=lifespan)

# Single-execution lock to prevent race conditions on v5.messages and tasks.json
agent_lock = asyncio.Lock()

# Active WebSocket connections
active_connections: list[WebSocket] = []

# Pending approvals: approval_id -> asyncio.Future[bool]
pending_approvals: dict[str, asyncio.Future] = {}


# ---------------------------------------------------------------------------
# Custom WebSocket Approval Handler
# ---------------------------------------------------------------------------

async def ws_approval_handler(tool: str, args: dict) -> bool:
    """
    Overrides v5.approval_handler: routes sensitive action approvals
    to connected WebSocket clients and awaits user decision.
    """
    if not active_connections:
        # Fallback to auto-deny if no UI is connected to prevent hangs
        return False

    approval_id = f"appr_{int(asyncio.get_event_loop().time() * 1000)}"
    loop = asyncio.get_event_loop()
    fut = loop.create_future()
    pending_approvals[approval_id] = fut

    # Broadcast approval request to UI
    msg = {
        "type": "approval_required",
        "approval_id": approval_id,
        "tool": tool,
        "filename": args.get("filename", ""),
        "content_preview": args.get("content", "")[:300],
    }
    for ws in active_connections:
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            pass

    try:
        # Wait up to 60 seconds for human approval
        result = await asyncio.wait_for(fut, timeout=60.0)
        return bool(result)
    except asyncio.TimeoutError:
        return False
    finally:
        pending_approvals.pop(approval_id, None)


# Plug into harness engine
v5.approval_handler = ws_approval_handler


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "active_model": v5.model_name,
        "tools_count": len(v5.TOOL_SCHEMAS),
        "models": list(v5.MODELS.keys()),
    }


@app.get("/api/models")
async def get_models():
    return {
        "current": v5.model_name,
        "available": {k: {"model": v.model, "base_url": v.base_url} for k, v in v5.MODELS.items()},
    }


@app.post("/api/model/{name}")
async def set_model(name: str):
    if name not in v5.MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {name}")
    v5.model_name = name
    return {"status": "ok", "active_model": v5.model_name}


@app.get("/api/tasks")
async def get_tasks():
    task = TaskManager.load_active_task()
    return task or {"status": "none", "goal": "No active task in progress.", "subtasks": []}


@app.get("/api/traces")
async def get_traces():
    trace_dir = ROOT / "traces"
    if not trace_dir.exists():
        return []
    traces = sorted(trace_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    summaries = []
    for t in traces[:10]:
        try:
            lines = [json.loads(l) for l in t.read_text(encoding="utf-8").strip().split("\n") if l]
            last_event = lines[-1] if lines else {}
            summaries.append({
                "file": t.name,
                "events_count": len(lines),
                "exit_reason": last_event.get("exit_reason", "in_progress"),
                "time": last_event.get("time", ""),
                "tokens": sum(e.get("prompt_tokens", 0) + e.get("completion_tokens", 0) for e in lines),
            })
        except Exception:
            continue
    return summaries


@app.get("/api/security-log")
async def get_security_log():
    if not SEC_LOG_FILE.exists():
        return []
    records = []
    for line in SEC_LOG_FILE.read_text(encoding="utf-8").strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except Exception:
            records.append({
                "time": line[:19] if len(line) >= 19 else "",
                "event": "SECURITY_VIOLATION",
                "message": line.split("]", 1)[-1].strip() if "]" in line else line,
            })
    return records[-20:]


# ---------------------------------------------------------------------------
# WebSocket Endpoint (with Origin Validation)
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Validate Origin header to prevent cross-site hijacking
    origin = websocket.headers.get("origin", "")
    if origin and not any(allowed in origin for allowed in ["localhost", "127.0.0.1"]):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    active_connections.append(websocket)

    active_task = TaskManager.load_active_task()
    task_payload = None
    if active_task:
        task_payload = {
            "goal": active_task.get("goal", ""),
            "subtasks": [
                {"id": str(s.get("id")), "label": s.get("description", ""), "done": s.get("status") == "completed"}
                for s in active_task.get("subtasks", [])
            ],
        }

    # Send initial status snapshot matching Lovable useHarness hook
    await websocket.send_text(json.dumps({
        "type": "init",
        "model": v5.model_name,
        "tools": len(v5.TOOL_SCHEMAS),
        "max_steps": v5.MAX_STEPS,
        "task": task_payload,
    }))

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type")

            # 1. Approval response from UI
            if msg_type == "approval_response":
                approval_id = data.get("approval_id")
                approved = bool(data.get("approved", False))
                if approval_id in pending_approvals:
                    pending_approvals[approval_id].set_result(approved)

            # 2. Reset conversation
            elif msg_type == "reset":
                v5.reset_conversation()
                await websocket.send_text(json.dumps({
                    "type": "chat_reset",
                    "status": "Conversation context cleared.",
                }))

            # 3. User message / Run agent (supports both 'message' and 'run' schemas)
            elif msg_type in ("message", "run"):
                prompt = (data.get("content") or data.get("prompt") or "").strip()
                if not prompt:
                    continue

                if agent_lock.locked():
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "content": "An agent task is already running. Please wait.",
                    }))
                    continue

                async with agent_lock:
                    await websocket.send_text(json.dumps({
                        "type": "run_started",
                        "prompt": prompt,
                    }))

                    # Run agent loop
                    try:
                        response_text = await v5.run_agent(prompt)
                        # Read the latest trace for this run
                        trace_dir = ROOT / "traces"
                        latest_traces = sorted(trace_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)
                        last_trace_events = []
                        if latest_traces:
                            last_trace_events = [
                                json.loads(l) for l in latest_traces[-1].read_text(encoding="utf-8").strip().split("\n") if l
                            ]

                        # Stream individual tool calls and security events to UI
                        for e in last_trace_events:
                            if e.get("event") == "tool_call":
                                tool_args = e.get("args", {})
                                if isinstance(tool_args, str):
                                    try:
                                        import ast
                                        tool_args = ast.literal_eval(tool_args)
                                    except Exception:
                                        tool_args = {"raw": tool_args}
                                await websocket.send_text(json.dumps({
                                    "type": "tool_call",
                                    "tool": e.get("tool", "unknown"),
                                    "duration_ms": e.get("duration_ms", 0),
                                    "args": tool_args if isinstance(tool_args, dict) else {"value": str(tool_args)},
                                    "result": e.get("result_preview", ""),
                                }))
                            elif e.get("event") == "security_block":
                                rule_name = "Storage Boundary" if "path" in str(e.get("rule", "")).lower() else "Egress Policy"
                                await websocket.send_text(json.dumps({
                                    "type": "policy_event",
                                    "rule": rule_name,
                                    "status": "BLOCKED",
                                    "target": str(e.get("detail", "")),
                                }))

                        # Format active task for UI checklist
                        updated_task = TaskManager.load_active_task()
                        updated_task_payload = None
                        if updated_task:
                            updated_task_payload = {
                                "goal": updated_task.get("goal", ""),
                                "subtasks": [
                                    {"id": str(s.get("id")), "label": s.get("description", ""), "done": s.get("status") == "completed"}
                                    for s in updated_task.get("subtasks", [])
                                ],
                            }

                        tokens = sum(e.get("prompt_tokens", 0) + e.get("completion_tokens", 0) for e in last_trace_events)

                        await websocket.send_text(json.dumps({
                            "type": "run_completed",
                            "response": response_text,
                            "tokens": tokens,
                            "trace_events": last_trace_events,
                            "task": updated_task_payload,
                        }))
                    except Exception as e:
                        await websocket.send_text(json.dumps({
                            "type": "run_error",
                            "message": str(e),
                        }))

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)


# ---------------------------------------------------------------------------
# Static UI Hosting
# ---------------------------------------------------------------------------

@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Loading Console...</h1>", status_code=200)
    return HTMLResponse(index_file.read_text(encoding="utf-8"))

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn
    # Enforce local binding only
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
