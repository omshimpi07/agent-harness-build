import { describe, expect, it } from "vitest";
import {
  ACTIVE_POLICY_COUNT,
  serializeAuditLog,
  toolPresentation,
  tracePresentation,
} from "@/lib/console-presentation";
import type { ChatEntry } from "@/lib/harness-types";
const tool = (name: string, result: unknown): Extract<ChatEntry, { kind: "tool" }> => ({
  kind: "tool",
  id: "t1",
  ts: "17:00:00.000",
  tool: name,
  args: {},
  durationMs: 12,
  result,
});
describe("Console data presentation", () => {
  it("shows the three configured active policies", () => expect(ACTIVE_POLICY_COUNT).toBe(3));
  it("preserves every received audit field when exporting JSON", () => {
    const events = [
      {
        id: "a1",
        ts: "17:00:00.000",
        severity: "CRITICAL" as const,
        rule: "Storage Boundary" as const,
        status: "BLOCKED" as const,
        target: "../secret",
      },
    ];
    expect(JSON.parse(serializeAuditLog(events))).toEqual(events);
    expect(JSON.parse(serializeAuditLog([]))).toEqual([]);
  });
  it("classifies completed reads as cyan with no approval state", () => {
    expect(toolPresentation(tool("tool.read_file", { content: "ok" }))).toMatchObject({
      tone: "cyan",
      state: "output-available",
    });
  });
  it("classifies writes as amber without falsely claiming pending approval", () => {
    expect(toolPresentation(tool("tool.write_file", { written: true }))).toMatchObject({
      tone: "warn",
      label: "Approval-gated",
      state: "output-available",
    });
  });
  it("classifies explicit security blocks as crimson denied outcomes", () => {
    expect(
      toolPresentation(tool("tool.security_block", { error: "Blocked by Policy" })),
    ).toMatchObject({ tone: "danger", label: "Blocked by Policy", state: "output-denied" });
  });
  it("does not mislabel unrelated tool errors as policy blocks", () => {
    expect(toolPresentation(tool("tool.read_file", { error: "File not found" }))).toMatchObject({
      blocked: false,
      label: "Execution Error",
    });
  });
  it("labels blocked policy events as violations without changing the payload", () => {
    const e = {
      id: "e1",
      ts: "17:00:00.000",
      event: "policy_event",
      payload: { status: "BLOCKED" },
    };
    expect(tracePresentation(e)).toEqual({ label: "policy_violation", tone: "danger" });
    expect(e.event).toBe("policy_event");
  });
});
