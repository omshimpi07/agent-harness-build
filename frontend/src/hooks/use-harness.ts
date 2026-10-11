import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ApprovalRequest,
  type AuditEvent,
  type ChatEntry,
  type ModelKey,
  type ServerMessage,
  type TaskState,
  type Telemetry,
  type TraceEvent,
  nowTs,
  uid,
} from "@/lib/harness-types";
import {
  DEFAULT_TASK,
  DIAGNOSTIC_PROMPTS,
  type Diagnostic,
  buildApprovalFollowup,
  buildScript,
} from "@/lib/harness-sim";

const WS_URL = "ws://localhost:8000/ws";

export function useHarness() {
  const [connected, setConnected] = useState(false);
  const [model, setModelState] = useState<ModelKey>("local");
  const [toolsAvailable, setToolsAvailable] = useState(12);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [task, setTask] = useState<TaskState>(DEFAULT_TASK);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    steps: 0, maxSteps: 8, tokens: 0, toolCount: 0, status: "IDLE",
  });
  const wsRef = useRef<WebSocket | null>(null);
  const timers = useRef<number[]>([]);

  const handle = useCallback((msg: ServerMessage) => {
    const ts = nowTs();
    setTrace((t) => [...t.slice(-300), { id: uid(), ts, event: msg.type, payload: msg as Record<string, unknown> }]);
    switch (msg.type) {
      case "init":
        if (msg.tools) setToolsAvailable(msg.tools);
        if (msg.max_steps) setTelemetry((t) => ({ ...t, maxSteps: msg.max_steps! }));
        if (msg.task) setTask(msg.task);
        break;
      case "run_started":
        setTelemetry((t) => ({ ...t, steps: 0, toolCount: 0, status: "RUNNING" }));
        break;
      case "tool_call":
        setChat((c) => [...c, { kind: "tool", id: uid(), tool: msg.tool, durationMs: msg.duration_ms ?? 0, args: msg.args ?? {}, result: msg.result, ts }]);
        setTelemetry((t) => ({ ...t, steps: Math.min(t.steps + 1, t.maxSteps), toolCount: t.toolCount + 1, tokens: t.tokens + 120 + Math.round(Math.random() * 200) }));
        break;
      case "policy_event":
        setAudit((a) => [{ id: uid(), severity: msg.status === "PENDING" ? "WARN" : msg.status === "ALLOWED" ? "INFO" : msg.rule === "Egress Policy" ? "HIGH" : "CRITICAL", rule: msg.rule, status: msg.status, target: msg.target, ts }, ...a]);
        break;
      case "task_update":
        setTask((tk) => ({ ...tk, subtasks: tk.subtasks.map((s) => (s.id === msg.subtask_id ? { ...s, done: msg.done } : s)) }));
        break;
      case "approval_required":
        setApproval({ approval_id: msg.approval_id, tool: msg.tool, filename: msg.filename, content_preview: msg.content_preview });
        setTelemetry((t) => ({ ...t, status: "AWAITING APPROVAL" }));
        break;
      case "run_completed":
        if (msg.response) setChat((c) => [...c, { kind: "assistant", id: uid(), text: msg.response!, ts, tokens: msg.tokens }]);
        setTelemetry((t) => ({ ...t, steps: Math.min(t.steps + 1, t.maxSteps), tokens: t.tokens + (msg.tokens ?? 0), status: "COMPLETE" }));
        break;
      case "run_error":
        setChat((c) => [...c, { kind: "error", id: uid(), text: msg.message ?? "Run failed", ts }]);
        setTelemetry((t) => ({ ...t, status: "ERROR" }));
        break;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onmessage = (e) => {
          try { handle(JSON.parse(e.data)); } catch { /* ignore */ }
        };
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!cancelled) retry = window.setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
      } catch {
        retry = window.setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
      timers.current.forEach(clearTimeout);
    };
  }, [handle]);

  const play = useCallback((steps: { delay: number; msg: ServerMessage }[]) => {
    let acc = 0;
    for (const st of steps) {
      acc += st.delay;
      timers.current.push(window.setTimeout(() => handle(st.msg), acc));
    }
  }, [handle]);

  const run = useCallback((prompt: string, diag?: Diagnostic) => {
    if (!prompt.trim()) return;
    setChat((c) => [...c, { kind: "user", id: uid(), text: prompt, ts: nowTs() }]);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "run", prompt, diagnostic: diag }));
    } else {
      play(buildScript(prompt, diag));
    }
  }, [play]);

  const runDiagnostic = useCallback((d: Diagnostic) => run(DIAGNOSTIC_PROMPTS[d], d), [run]);

  const respondApproval = useCallback((approved: boolean) => {
    if (!approval) return;
    const ws = wsRef.current;
    const payload = { type: "approval_response", approval_id: approval.approval_id, approved };
    setTrace((t) => [...t, { id: uid(), ts: nowTs(), event: "approval_response", payload }]);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    else play(buildApprovalFollowup(approved, approval.filename));
    setTelemetry((t) => ({ ...t, status: "RUNNING" }));
    setApproval(null);
  }, [approval, play]);

  const setModel = useCallback(async (m: ModelKey) => {
    setModelState(m);
    try { await fetch(`/api/model/${m}`, { method: "POST" }); } catch { /* offline */ }
    setTrace((t) => [...t, { id: uid(), ts: nowTs(), event: "model_changed", payload: { model: m } }]);
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setChat([]);
    setApproval(null);
    setTelemetry((t) => ({ ...t, steps: 0, tokens: 0, toolCount: 0, status: "IDLE" }));
  }, []);

  const toggleSubtask = useCallback((id: string) => {
    setTask((tk) => ({ ...tk, subtasks: tk.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) }));
  }, []);

  return { connected, model, setModel, toolsAvailable, chat, trace, audit, task, approval, telemetry, run, runDiagnostic, respondApproval, clear, toggleSubtask };
}
