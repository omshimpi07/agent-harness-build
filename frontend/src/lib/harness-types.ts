export type ModelKey = "local" | "gpt" | "claude";

export const MODELS: Record<ModelKey, string> = {
  local: "qwen3.5:4b",
  gpt: "gpt-5.2",
  claude: "claude-sonnet-5",
};

export type ChatEntry =
  | { kind: "user"; id: string; text: string; ts: string }
  | {
      kind: "tool";
      id: string;
      tool: string;
      durationMs: number;
      args: Record<string, unknown>;
      result: unknown;
      ts: string;
    }
  | { kind: "assistant"; id: string; text: string; ts: string; tokens?: number | undefined }
  | { kind: "error"; id: string; text: string; ts: string };

export type TraceEvent = {
  id: string;
  ts: string;
  event: string;
  payload: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "WARN" | "INFO";
  rule: "Storage Boundary" | "Egress Policy" | "Network Routing" | "Write Authorization";
  ts: string;
  status: "ALLOWED" | "BLOCKED" | "PENDING";
  target: string;
};

export type Subtask = { id: string; label: string; done: boolean };

export type TaskState = { goal: string; subtasks: Subtask[] };

export type Telemetry = {
  steps: number;
  maxSteps: number;
  tokens: number;
  toolCount: number;
  status: "IDLE" | "RUNNING" | "AWAITING APPROVAL" | "COMPLETE" | "ERROR";
};

export type ApprovalRequest = {
  approval_id: string;
  tool: string;
  filename: string;
  content_preview: string;
};

export type ToolItem = {
  name: string;
  description: string;
  source: string;
  requires_approval: boolean;
};

export type ServerMessage =
  | { type: "init"; tools?: number; tools_list?: ToolItem[]; max_steps?: number; task?: TaskState }
  | { type: "run_started"; prompt?: string }
  | {
      type: "tool_call";
      tool: string;
      duration_ms?: number;
      args?: Record<string, unknown>;
      result?: unknown;
    }
  | { type: "run_completed"; response?: string; tokens?: number | undefined }
  | ({ type: "approval_required" } & ApprovalRequest)
  | { type: "run_error"; message?: string }
  | { type: "policy_event"; rule: AuditEvent["rule"]; status: AuditEvent["status"]; target: string }
  | { type: "task_update"; subtask_id: string; done: boolean };

export const nowTs = () => new Date().toISOString().slice(11, 23);
export const uid = () => Math.random().toString(36).slice(2, 10);
