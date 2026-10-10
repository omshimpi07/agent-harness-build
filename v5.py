"""
v5.py — Reliable & Observable AI Harness
=========================================
Evolution of harness.py with production safety controls:
  • Path traversal protection (_safe_path)
  • Write approval gate (human-in-the-loop)
  • Circuit breaker (MAX_STEPS)
  • Tool error isolation (no single tool crash kills the run)
  • JSON argument validation
  • Model connection error handling
  • Structured JSONL tracing (via trace.py)
  • Token & latency accounting per step
  • /trace command to inspect last run

Same tools, same MCP servers, same memory — better engineering.
"""

import sys

sys.stdout.reconfigure(encoding="utf-8")  # so emoji don't crash the Windows console

import asyncio
import json
import os
import time
from contextlib import AsyncExitStack
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import AsyncOpenAI
from pydantic import BaseModel

from trace import Tracer

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent
WORKSPACE = ROOT / "workspace"
MEMORY_FILE = ROOT / "memory.md"
MCP_CONFIG = ROOT / "mcp_servers.json"

# ---------------------------------------------------------------------------
# Safety constants
# ---------------------------------------------------------------------------

MAX_STEPS = 8  # hard ceiling — the model never decides when to stop the loop


# ---------------------------------------------------------------------------
# Harness mode flags (toggled by eval runner for unattended operation)
# ---------------------------------------------------------------------------

APPROVE_WRITES: str = "ask"  # "ask" | "auto" | "deny"
MAX_TOOL_CHARS: int = 4000  # Truncate tool outputs to avoid context blowout on small models


# ---------------------------------------------------------------------------
# Model registry — every entry is an OpenAI-compatible endpoint.
# Cloud or local, frontier or free — same client, same harness.
# ---------------------------------------------------------------------------

class ModelConfig(BaseModel):
    base_url: str
    api_key: str = "none"
    model: str


MODELS: dict[str, ModelConfig] = {
    "local": ModelConfig(
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model="qwen3.5:4b",
    ),
    "local-small": ModelConfig(
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model="qwen3.5:2b",
    ),
    "gpt": ModelConfig(
        base_url="https://api.openai.com/v1",
        api_key=os.getenv("OPENAI_API_KEY", ""),
        model="gpt-5.2",
    ),
    "claude": ModelConfig(
        # Anthropic's OpenAI-compatible endpoint — same client works.
        base_url="https://api.anthropic.com/v1/",
        api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        model="claude-sonnet-5",
    ),
}

model_name = "local"  # switch at runtime with /model


# ---------------------------------------------------------------------------
# Memory — a markdown file in the prompt + a tool to append to it
# ---------------------------------------------------------------------------

def load_memory() -> str:
    if MEMORY_FILE.is_file():
        return MEMORY_FILE.read_text(encoding="utf-8")
    return "(nothing saved yet)"


def save_memory(fact: str) -> str:
    with MEMORY_FILE.open("a", encoding="utf-8") as f:
        f.write(f"- {fact}\n")
    return f"saved: {fact}"


# ---------------------------------------------------------------------------
# Safety: path traversal guard
# ---------------------------------------------------------------------------

def _safe_path(filename: str) -> Path:
    """Resolve a filename inside the workspace. Reject path traversal."""
    target = (WORKSPACE / filename).resolve()
    workspace_resolved = WORKSPACE.resolve()
    if not str(target).startswith(str(workspace_resolved)):
        raise PermissionError(
            f"blocked: '{filename}' is outside the workspace"
        )
    return target


# ---------------------------------------------------------------------------
# Local tools — with safety controls
# ---------------------------------------------------------------------------

def list_files() -> str:
    return "\n".join(p.name for p in WORKSPACE.iterdir()) or "(empty)"


def read_file(filename: str) -> str:
    path = _safe_path(filename)  # ← path traversal guard
    return path.read_text(encoding="utf-8") if path.is_file() else f"error: no {filename}"


def write_file(filename: str, content: str) -> str:
    path = _safe_path(filename)  # ← path traversal guard

    # Human-in-the-loop approval gate
    if APPROVE_WRITES == "deny":
        return "error: write denied by policy (APPROVE_WRITES=deny)"
    elif APPROVE_WRITES == "ask":
        print(f"\n  ⚠️  WRITE REQUEST: {filename}")
        print(f"  Content preview: {content[:200]}{'...' if len(content) > 200 else ''}")
        try:
            approval = input("  Approve write? (y/n): ").strip().lower()
        except EOFError:
            approval = "n"
        if approval != "y":
            return "error: write denied by user"
    # If APPROVE_WRITES == "auto", proceed without prompting

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return f"wrote {filename}"


LOCAL_TOOLS = {
    "list_files": list_files,
    "read_file": read_file,
    "write_file": write_file,
    "save_memory": save_memory,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List the files in the user's workspace folder.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read one file from the user's workspace folder.",
            "parameters": {
                "type": "object",
                "properties": {"filename": {"type": "string"}},
                "required": ["filename"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write a file in the user's workspace folder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["filename", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": (
                "Save one short fact about the user to long-term memory. "
                "Use whenever you learn something lasting: their name, "
                "preferences, projects, recurring tasks."
            ),
            "parameters": {
                "type": "object",
                "properties": {"fact": {"type": "string"}},
                "required": ["fact"],
            },
        },
    },
]


SYSTEM_PROMPT = """\
You are a helpful personal assistant running inside a custom harness. Be concise.

The user's workspace folder holds their personal files: notes, todo lists, \
ideas. You have tools to list, read, and write those files. Never claim you \
lack access to the user's files or tasks - use your tools to look.

Here is what you remember about the user from previous sessions:
{memory}

When you learn a new lasting fact about the user, save it with save_memory."""

# the running conversation — shared by every model we switch to
messages: list[dict] = []


def reset_conversation():
    """Clear conversation history for a fresh run (used by eval)."""
    global messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(memory=load_memory())}
    ]


# Initialize on import
reset_conversation()


# ---------------------------------------------------------------------------
# MCP — discover and call external tool servers
# ---------------------------------------------------------------------------

mcp_sessions: dict[str, ClientSession] = {}  # tool name -> its server session


async def connect_mcp(stack: AsyncExitStack):
    """Launch every server in mcp_servers.json and merge in its tools."""
    if not MCP_CONFIG.is_file():
        print("  [mcp] no mcp_servers.json found, skipping")
        return

    config = json.loads(MCP_CONFIG.read_text(encoding="utf-8"))
    for name, spec in config["mcpServers"].items():
        params = StdioServerParameters(command=spec["command"], args=spec["args"])
        try:
            read, write = await stack.enter_async_context(stdio_client(params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        except Exception as e:
            print(f"  [mcp] '{name}' failed to start: {e}")
            continue

        tools = (await session.list_tools()).tools
        for tool in tools:
            mcp_sessions[tool.name] = session
            TOOL_SCHEMAS.append(
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema,
                    },
                }
            )
        print(f"  [mcp] connected '{name}': {[t.name for t in tools]}")


async def call_tool(name: str, args: dict) -> str:
    """Dispatch a tool call to local Python or the owning MCP session."""
    if name in LOCAL_TOOLS:
        res = LOCAL_TOOLS[name](**args)
    elif name in mcp_sessions:
        result = await mcp_sessions[name].call_tool(name, args)
        res = "\n".join(c.text for c in result.content if hasattr(c, "text"))
    else:
        res = f"error: unknown tool '{name}'"

    # Enforce safety size limit to prevent small model context saturation
    if len(res) > MAX_TOOL_CHARS:
        res = res[:MAX_TOOL_CHARS] + f"\n... [truncated by harness: output exceeded {MAX_TOOL_CHARS} chars]"
    return res


# ---------------------------------------------------------------------------
# The agent loop — with safety controls and tracing
# ---------------------------------------------------------------------------

async def run_agent(user_message: str) -> str:
    """
    Send user_message through the agent loop.
    Returns the assistant's final text response.

    Safety controls:
      - MAX_STEPS circuit breaker
      - JSON parse error handling on tool arguments
      - try/except around every tool execution
      - try/except around model API calls
      - structured tracing via Tracer
    """
    tracer = Tracer()
    cfg = MODELS[model_name]
    client = AsyncOpenAI(base_url=cfg.base_url, api_key=cfg.api_key)

    messages.append({"role": "user", "content": user_message})
    tracer.log("run_started", prompt=user_message[:200], model=cfg.model)

    steps = 0
    while True:
        # ---- circuit breaker ----
        steps += 1
        if steps > MAX_STEPS:
            msg = f"[harness] Stopped: step limit reached ({MAX_STEPS} steps)."
            tracer.log("run_ended", exit_reason="max_steps_exceeded", steps=steps - 1)
            print(tracer.summary())
            messages.append({"role": "assistant", "content": msg})
            return msg

        # ---- ask the model ----
        t0 = time.time()
        try:
            response = await client.chat.completions.create(
                model=cfg.model, messages=messages, tools=TOOL_SCHEMAS
            )
        except Exception as e:
            error_msg = f"[harness] Model error: {type(e).__name__}: {e}"
            tracer.log("run_ended", exit_reason="model_error", error=str(e))
            print(tracer.summary())
            messages.append({"role": "assistant", "content": error_msg})
            return error_msg

        model_ms = int((time.time() - t0) * 1000)

        # ---- extract token usage if available ----
        usage = {}
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            }

        message = response.choices[0].message

        # ---- final response (no tool calls) ----
        if not message.tool_calls:
            tracer.log(
                "run_ended",
                exit_reason="completed",
                model_ms=model_ms,
                **usage,
            )
            print(tracer.summary())
            messages.append({"role": "assistant", "content": message.content})
            return message.content or ""

        # ---- tool calls requested ----
        tracer.log(
            "model_response",
            model_ms=model_ms,
            tool_calls=len(message.tool_calls),
            **usage,
        )

        messages.append(message)
        for call in message.tool_calls:
            tool_name = call.function.name

            # ---- parse arguments safely ----
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError as e:
                result = f"error: invalid arguments — could not parse JSON: {e}"
                tracer.log(
                    "tool_call",
                    tool=tool_name,
                    status="error",
                    error="json_parse_failed",
                )
                messages.append(
                    {"role": "tool", "tool_call_id": call.id, "content": result}
                )
                continue

            print(f"  [tool] {tool_name}({args})")

            # ---- execute tool with error isolation ----
            t1 = time.time()
            try:
                result = await call_tool(tool_name, args)
                status = "ok"
            except Exception as e:
                result = f"error: tool failed — {type(e).__name__}: {e}"
                status = "error"

            tool_ms = int((time.time() - t1) * 1000)

            tracer.log(
                "tool_call",
                tool=tool_name,
                args=str(args)[:100],
                status=status,
                duration_ms=tool_ms,
            )

            messages.append(
                {"role": "tool", "tool_call_id": call.id, "content": result}
            )


# ---------------------------------------------------------------------------
# Slash commands
# ---------------------------------------------------------------------------

def handle_command(line: str) -> bool:
    """Returns True if the line was a command."""
    global model_name
    if not line.startswith("/"):
        return False
    cmd, _, arg = line.partition(" ")

    if cmd == "/models":
        for name, cfg in MODELS.items():
            marker = "★" if name == model_name else " "
            print(f" {marker} {name:<12} {cfg.model}  ({cfg.base_url})")

    elif cmd == "/model":
        if arg in MODELS:
            model_name = arg
            print(f"  switched to {arg} ({MODELS[arg].model})")
        else:
            print(f"  unknown model '{arg}' - try /models")

    elif cmd == "/tools":
        for schema in TOOL_SCHEMAS:
            fn = schema["function"]
            origin = "local" if fn["name"] in LOCAL_TOOLS else "mcp"
            print(f"  [{origin}] {fn['name']}: {fn['description'][:60]}")

    elif cmd == "/memory":
        print(load_memory())

    elif cmd == "/trace":
        trace_dir = ROOT / "traces"
        if not trace_dir.exists():
            print("  no traces yet")
        else:
            traces = sorted(trace_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)
            if not traces:
                print("  no traces yet")
            else:
                print(f"  ── last trace: {traces[-1].name} ──")
                for line_text in traces[-1].read_text(encoding="utf-8").strip().split("\n"):
                    event = json.loads(line_text)
                    parts = [f"[{event['event']}]"]
                    if "tool" in event:
                        parts.append(f"tool={event['tool']}")
                    if "status" in event:
                        parts.append(f"status={event['status']}")
                    if "duration_ms" in event:
                        parts.append(f"{event['duration_ms']}ms")
                    if "exit_reason" in event:
                        parts.append(f"exit={event['exit_reason']}")
                    if "prompt_tokens" in event:
                        parts.append(
                            f"tokens={event['prompt_tokens']}+{event['completion_tokens']}"
                        )
                    print(f"    step {event['step']:>2}: {' | '.join(parts)}")

    elif cmd == "/quit":
        raise SystemExit

    else:
        print("  commands: /models /model <name> /tools /memory /trace /quit")

    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    async with AsyncExitStack() as stack:
        print("starting harness v5...")
        await connect_mcp(stack)

        cfg = MODELS[model_name]
        print(
            f"\n{'='*55}"
            f"\n  harness v5 ready"
            f"\n  model : {model_name} ({cfg.model})"
            f"\n  tools : {len(TOOL_SCHEMAS)} ({len(LOCAL_TOOLS)} local + "
            f"{len(TOOL_SCHEMAS) - len(LOCAL_TOOLS)} mcp)"
            f"\n  safety: path guard · write approval · {MAX_STEPS}-step limit"
            f"\n  trace : traces/*.jsonl"
            f"\n{'='*55}\n"
        )
        print("type /models, /model <name>, /tools, /memory, /trace, or just talk\n")

        try:
            while True:
                line = (await asyncio.to_thread(input, "you: ")).strip()
                if not line or handle_command(line):
                    continue
                print("\nassistant:", await run_agent(line), "\n")
        except (EOFError, KeyboardInterrupt, SystemExit):
            print("\nbye!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nHarness stopped.")
