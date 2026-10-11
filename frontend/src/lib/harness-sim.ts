import type { ServerMessage, TaskState } from "./harness-types";
import { uid } from "./harness-types";

export const DEFAULT_TASK: TaskState = {
  goal: "Validate sandbox isolation & policy enforcement for harness v2",
  subtasks: [
    { id: "t1", label: "Verify storage boundary isolation", done: false },
    { id: "t2", label: "Confirm egress allow-list rules", done: false },
    { id: "t3", label: "Audit internal network routing", done: false },
    { id: "t4", label: "Exercise human-in-the-loop write approval", done: false },
    { id: "t5", label: "Summarize compliance report", done: false },
  ],
};

export type Diagnostic = "storage" | "egress" | "network" | "write";

export const DIAGNOSTIC_PROMPTS: Record<Diagnostic, string> = {
  storage: "Run sandbox storage isolation check: attempt reads outside /workspace.",
  egress: "Verify outbound API rules: test allow-listed and blocked hosts.",
  network: "Check internal routing restrictions against 10.0.0.0/8 and metadata endpoints.",
  write: "Write a deployment config to /workspace/deploy/config.yaml.",
};

type Step = { delay: number; msg: ServerMessage };

const rnd = (a: number, b: number) => Math.round(a + Math.random() * (b - a));

export function buildScript(prompt: string, diag?: Diagnostic): Step[] {
  const s: Step[] = [{ delay: 150, msg: { type: "run_started", prompt } }];
  const tool = (tool: string, args: Record<string, unknown>, result: unknown, delay = 700) =>
    s.push({ delay, msg: { type: "tool_call", tool, duration_ms: rnd(18, 420), args, result } });
  const policy = (
    rule: "Storage Boundary" | "Egress Policy" | "Network Routing" | "Write Authorization",
    status: "ALLOWED" | "BLOCKED" | "PENDING",
    target: string,
  ) => s.push({ delay: 120, msg: { type: "policy_event", rule, status, target } });
  const task = (id: string) => s.push({ delay: 100, msg: { type: "task_update", subtask_id: id, done: true } });

  switch (diag) {
    case "storage":
      tool("fs.list", { path: "/workspace" }, { entries: ["src/", "tasks.json", "README.md"] });
      policy("Storage Boundary", "ALLOWED", "/workspace");
      tool("fs.read", { path: "/etc/passwd" }, { error: "EACCES: path outside sandbox root" });
      policy("Storage Boundary", "BLOCKED", "/etc/passwd");
      tool("fs.read", { path: "../../root/.ssh/id_rsa" }, { error: "path traversal rejected" });
      policy("Storage Boundary", "BLOCKED", "../../root/.ssh/id_rsa");
      task("t1");
      s.push({ delay: 600, msg: { type: "run_completed", tokens: rnd(900, 1600), response: "**Storage isolation verified.**\n\n- Reads inside `/workspace` succeed\n- 2 out-of-root attempts blocked (absolute path, traversal)\n\nSandbox boundary holds." } });
      break;
    case "egress":
      tool("http.get", { url: "https://api.github.com/zen" }, { status: 200, body: "Keep it logically awesome." });
      policy("Egress Policy", "ALLOWED", "api.github.com:443");
      tool("http.get", { url: "https://pastebin.com/raw/x" }, { error: "egress denied: host not in allow-list" });
      policy("Egress Policy", "BLOCKED", "pastebin.com:443");
      tool("dns.resolve", { host: "exfil.attacker.io" }, { error: "resolver blocked" });
      policy("Egress Policy", "BLOCKED", "exfil.attacker.io");
      task("t2");
      s.push({ delay: 600, msg: { type: "run_completed", tokens: rnd(1100, 1800), response: "**Egress policy enforced.**\n\n- `api.github.com` reachable (allow-listed)\n- `pastebin.com` and `exfil.attacker.io` blocked\n\nEnforced at proxy and DNS layers." } });
      break;
    case "network":
      tool("net.connect", { host: "169.254.169.254", port: 80 }, { error: "metadata endpoint blocked" });
      policy("Network Routing", "BLOCKED", "169.254.169.254:80");
      tool("net.connect", { host: "10.0.4.12", port: 5432 }, { error: "RFC1918 range denied" });
      policy("Network Routing", "BLOCKED", "10.0.4.12:5432");
      tool("net.connect", { host: "127.0.0.1", port: 8000 }, { connected: true, latency_ms: 1 });
      policy("Network Routing", "ALLOWED", "127.0.0.1:8000");
      task("t3");
      s.push({ delay: 600, msg: { type: "run_completed", tokens: rnd(1000, 1500), response: "**Internal routing restricted.**\n\n- `169.254.169.254` metadata blocked\n- `10.0.0.0/8` denied\n- Loopback `127.0.0.1:8000` allowed\n\nOnly the local harness loopback is permitted." } });
      break;
    case "write":
      tool("fs.stat", { path: "/workspace/deploy" }, { exists: true, type: "dir" });
      tool("plan.compose", { target: "config.yaml" }, { lines: 9 });
      policy("Write Authorization", "PENDING", "/workspace/deploy/config.yaml");
      s.push({
        delay: 500,
        msg: {
          type: "approval_required",
          approval_id: uid(),
          tool: "fs.write",
          filename: "/workspace/deploy/config.yaml",
          content_preview: `service: harness-agent\nreplicas: 2\nimage: registry.local/harness:2.4.1\nresources:\n  limits:\n    cpu: "500m"\n    memory: 512Mi\negress:\n  allow: [api.github.com]`,
        },
      });
      break;
    default:
      tool("context.search", { query: prompt.slice(0, 60) }, { hits: rnd(2, 7) });
      tool("tasks.read", { file: "tasks.json" }, { goal: DEFAULT_TASK.goal, pending: 3 });
      tool("reasoning.plan", { steps: 3 }, { plan: ["analyze", "act", "summarize"] });
      task("t5");
      s.push({ delay: 800, msg: { type: "run_completed", tokens: rnd(700, 2200), response: `Simulated response for: "${prompt}". Context gathered across 3 tool calls; no policy violations detected. (Offline simulation mode)` } });
  }
  return s;
}

export function buildApprovalFollowup(approved: boolean, filename: string): Step[] {
  if (!approved)
    return [
      { delay: 200, msg: { type: "policy_event", rule: "Write Authorization", status: "BLOCKED", target: filename } },
      { delay: 500, msg: { type: "run_completed", tokens: rnd(300, 600), response: `Write to ${filename} was denied by the operator. No changes were made.` } },
    ];
  return [
    { delay: 200, msg: { type: "policy_event", rule: "Write Authorization", status: "ALLOWED", target: filename } },
    { delay: 300, msg: { type: "tool_call", tool: "fs.write", duration_ms: rnd(8, 40), args: { path: filename }, result: { bytes_written: 214 } } },
    { delay: 100, msg: { type: "task_update", subtask_id: "t4", done: true } },
    { delay: 500, msg: { type: "run_completed", tokens: rnd(400, 800), response: `Operator approved. Wrote 214 bytes to ${filename}.` } },
  ];
}
