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
} from "@/lib/harness-sim";

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname || "127.0.0.1"}:8000/ws`
    : "ws://127.0.0.1:8000/ws";

export function useHarness() {
  const [connected, setConnected] = useState(false);
  const [model, setModelState] = useState<ModelKey>("local");
  const [toolsAvailable, setToolsAvailable] = useState(12);
  const [toolsList, setToolsList] = useState<import("@/lib/harness-types").ToolItem[]>([]);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [task, setTask] = useState<TaskState>(DEFAULT_TASK);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    steps: 0,
    maxSteps: 8,
    tokens: 0,
    toolCount: 0,
    status: "IDLE",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueue = useRef<string[]>([]);
  const reconnectTimer = useRef<number | undefined>(undefined);

  const handle = useCallback((msg: ServerMessage) => {
    const ts = nowTs();
    setTrace((t) => [
      ...t.slice(-300),
      { id: uid(), ts, event: msg.type, payload: msg as Record<string, unknown> },
    ]);

    switch (msg.type) {
      case "init":
        if (msg.tools) setToolsAvailable(msg.tools);
        if (msg.tools_list) setToolsList(msg.tools_list);
        if (msg.max_steps) setTelemetry((t) => ({ ...t, maxSteps: msg.max_steps! }));
        if (msg.task) setTask(msg.task);
        break;

      case "run_started":
        setTelemetry((t) => ({ ...t, steps: 0, toolCount: 0, status: "RUNNING" }));
        break;

      case "tool_call":
        setChat((c) => [
          ...c,
          {
            kind: "tool",
            id: uid(),
            tool: msg.tool,
            durationMs: msg.duration_ms ?? 0,
            args: msg.args ?? {},
            result: msg.result,
            ts,
          },
        ]);
        setTelemetry((t) => ({
          ...t,
          steps: Math.min(t.steps + 1, t.maxSteps),
          toolCount: t.toolCount + 1,
        }));
        break;

      case "policy_event":
        setAudit((a) => [
          {
            id: uid(),
            severity:
              msg.status === "PENDING"
                ? "WARN"
                : msg.status === "ALLOWED"
                ? "INFO"
                : msg.rule === "Egress Policy"
                ? "HIGH"
                : "CRITICAL",
            rule: msg.rule,
            status: msg.status,
            target: msg.target,
            ts,
          },
          ...a,
        ]);
        break;

      case "task_update":
        setTask((tk) => ({
          ...tk,
          subtasks: tk.subtasks.map((s) =>
            s.id === msg.subtask_id ? { ...s, done: msg.done } : s
          ),
        }));
        break;

      case "approval_required":
        setApproval({
          approval_id: msg.approval_id,
          tool: msg.tool,
          filename: msg.filename,
          content_preview: msg.content_preview,
        });
        setTelemetry((t) => ({ ...t, status: "AWAITING APPROVAL" }));
        break;

      case "run_completed":
        if (msg.response) {
          setChat((c) => [
            ...c,
            { kind: "assistant", id: uid(), text: msg.response!, ts, tokens: msg.tokens },
          ]);
        }
        setTelemetry((t) => ({
          ...t,
          steps: Math.min(t.steps + 1, t.maxSteps),
          tokens: t.tokens + (msg.tokens ?? 0),
          status: "COMPLETE",
        }));
        break;

      case "run_error":
        setChat((c) => [...c, { kind: "error", id: uid(), text: msg.message ?? "Run failed", ts }]);
        setTelemetry((t) => ({ ...t, status: "ERROR" }));
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Flush any queued prompts that were submitted while connecting
        while (pendingQueue.current.length > 0) {
          const item = pendingQueue.current.shift();
          if (item) {
            console.log("[Harness Console] Flushing queued message to live WebSocket:", item);
            ws.send(item);
          }
        }
      };

      ws.onmessage = (e) => {
        try {
          handle(JSON.parse(e.data));
        } catch (err) {
          console.warn("[Harness Console] Error parsing message:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!reconnectTimer.current) {
          reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = undefined;
            connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (!reconnectTimer.current) {
        reconnectTimer.current = window.setTimeout(() => {
          reconnectTimer.current = undefined;
          connect();
        }, 2000);
      }
    }
  }, [handle]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = undefined;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendPayload = useCallback((payload: Record<string, unknown>) => {
    const jsonStr = JSON.stringify(payload);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(jsonStr);
    } else {
      console.log("[Harness Console] WebSocket connecting, queueing payload:", payload);
      pendingQueue.current.push(jsonStr);
      connect();
    }
  }, [connect]);

  const run = useCallback(
    (prompt: string, diag?: Diagnostic) => {
      if (!prompt.trim()) return;
      setChat((c) => [...c, { kind: "user", id: uid(), text: prompt, ts: nowTs() }]);
      setTelemetry((t) => ({ ...t, status: "RUNNING" }));
      sendPayload({ type: "run", prompt, diagnostic: diag });
    },
    [sendPayload]
  );

  const runDiagnostic = useCallback(
    (d: Diagnostic) => run(DIAGNOSTIC_PROMPTS[d], d),
    [run]
  );

  const respondApproval = useCallback(
    (approved: boolean) => {
      if (!approval) return;
      const payload = { type: "approval_response", approval_id: approval.approval_id, approved };
      setTrace((t) => [...t, { id: uid(), ts: nowTs(), event: "approval_response", payload }]);
      sendPayload(payload);
      setTelemetry((t) => ({ ...t, status: "RUNNING" }));
      setApproval(null);
    },
    [approval, sendPayload]
  );

  const setModel = useCallback(async (m: ModelKey) => {
    setModelState(m);
    try {
      await fetch(`/api/model/${m}`, { method: "POST" });
    } catch {
      /* offline */
    }
    setTrace((t) => [
      ...t,
      { id: uid(), ts: nowTs(), event: "model_changed", payload: { model: m } },
    ]);
  }, []);

  const clear = useCallback(() => {
    setChat([]);
    setApproval(null);
    setTelemetry((t) => ({ ...t, steps: 0, tokens: 0, toolCount: 0, status: "IDLE" }));
    sendPayload({ type: "reset" });
  }, [sendPayload]);

  const toggleSubtask = useCallback((id: string) => {
    setTask((tk) => ({
      ...tk,
      subtasks: tk.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    }));
  }, []);

  return {
    connected,
    model,
    setModel,
    toolsAvailable,
    toolsList,
    chat,
    trace,
    audit,
    task,
    approval,
    telemetry,
    run,
    runDiagnostic,
    respondApproval,
    clear,
    toggleSubtask,
  };
}
