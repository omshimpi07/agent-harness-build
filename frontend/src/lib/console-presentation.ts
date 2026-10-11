import type { AuditEvent, ChatEntry, TraceEvent } from "@/lib/harness-types";

export const ACTIVE_POLICY_COUNT = 3;
export function serializeAuditLog(events: readonly AuditEvent[]) {
  return JSON.stringify(events, null, 2);
}
export function toolPresentation(entry: Extract<ChatEntry, { kind: "tool" }>) {
  const result = entry.result;
  const record =
    typeof result === "object" && result !== null ? (result as Record<string, unknown>) : undefined;
  const error = record?.["error"];
  const blocked =
    /security_block/.test(entry.tool) ||
    record?.["status"] === "BLOCKED" ||
    record?.["blocked"] === true ||
    (typeof error === "string" &&
      /policy|blocked|denied|sandbox|boundary|traversal|ssrf|private|egress|unauthorized/i.test(
        error,
      ));
  const failed = error !== undefined && error !== null && error !== false;
  const write = /write|delete|remove/.test(entry.tool);
  return {
    blocked,
    failed,
    write,
    tone: blocked || failed ? ("danger" as const) : write ? ("warn" as const) : ("cyan" as const),
    label: blocked
      ? "Blocked by Policy"
      : failed
        ? "Execution Error"
        : write
          ? "Approval-gated"
          : "Completed",
    state: blocked
      ? ("output-denied" as const)
      : failed
        ? ("output-error" as const)
        : ("output-available" as const),
  };
}
export function tracePresentation(event: TraceEvent) {
  const violation =
    event.event === "policy_violation" ||
    (event.event === "policy_event" && event.payload["status"] === "BLOCKED");
  return {
    label: violation ? "policy_violation" : event.event,
    tone:
      violation || event.event === "run_error"
        ? ("danger" as const)
        : event.event === "run_completed"
          ? ("ok" as const)
          : /approval/.test(event.event)
            ? ("warn" as const)
            : event.event === "tool_call"
              ? ("cyan" as const)
              : ("info" as const),
  };
}
