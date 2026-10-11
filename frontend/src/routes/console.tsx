import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ACTIVE_POLICY_COUNT, serializeAuditLog } from "@/lib/console-presentation";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Download,
  ChevronRight,
  Cpu,
  FilePen,
  Globe,
  HardDrive,
  HelpCircle,
  Layers,
  ListChecks,
  Loader2,
  Network,
  Play,
  ShieldCheck,
  Terminal,
  Trash2,
  Wrench,
} from "lucide-react";
import { useHarness } from "@/hooks/use-harness";
import { MODELS, type ModelKey } from "@/lib/harness-types";
import type { Diagnostic } from "@/lib/harness-sim";
import { cn } from "@/lib/utils";
import { Badge, Kbd, LiveDot, SectionLabel } from "@/components/console/primitives";
import { ChatCard, PendingApprovalTool } from "@/components/console/chat-stream";
import { ApprovalDialog } from "@/components/console/approval-dialog";
import { ToolsModal } from "@/components/console/tools-modal";
import { AuditPanel, TasksPanel, TelemetryPanel } from "@/components/console/side-panels";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Operations Console — Aegis Agent Harness" },
      {
        name: "description",
        content:
          "Enterprise observability console for AI agent runs: tool traces, telemetry, compliance audit and human-in-the-loop approvals.",
      },
      { property: "og:title", content: "Aegis Operations Console" },
      {
        property: "og:description",
        content: "Monitor AI agent runs, tool calls, telemetry and policy compliance in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Console,
});

const DIAGS: {
  key: Diagnostic;
  label: string;
  id: string;
  sub: string;
  Icon: typeof HardDrive;
  tooltip: string;
}[] = [
  {
    key: "storage",
    label: "Sandbox Root",
    id: "SEC-01",
    sub: "Sandbox isolation check",
    Icon: HardDrive,
    tooltip: "Tests path traversal guard: attempts to read outside /workspace (e.g. ../secret.txt)",
  },
  {
    key: "egress",
    label: "SSRF / Egress",
    id: "NET-01",
    sub: "Outbound API rules",
    Icon: Globe,
    tooltip:
      "Egress Policy: Blocks requests to external unapproved destinations, cloud metadata (169.254.169.254), or unauthorized domains",
  },
  {
    key: "network",
    label: "Internal Routing",
    id: "NET-02",
    sub: "Internal routing limits",
    Icon: Network,
    tooltip:
      "Network Policy: Enforces SSRF defense — blocks private RFC1918 subnets (10.0.0.0/8, 192.168.0.0/16, loopback)",
  },
  {
    key: "write",
    label: "Write Gate",
    id: "AUTH-01",
    sub: "Authorization prompt",
    Icon: FilePen,
    tooltip:
      "Human-in-the-loop approval: Prompts operator for approval before modifying filesystem",
  },
];

const TABS = [
  { k: "telemetry", l: "Telemetry", Icon: Activity },
  { k: "audit", l: "Compliance Audit", Icon: ShieldCheck },
  { k: "tasks", l: "Tasks", Icon: ListChecks },
] as const;

function Console() {
  const h = useHarness();
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("telemetry");
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState<Diagnostic | null>(null);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const busy = h.telemetry.status === "RUNNING" || h.telemetry.status === "AWAITING APPROVAL";

  useEffect(() => {
    if (!busy) setActive(null);
  }, [busy]);

  const submit = () => {
    if (!prompt.trim() || busy) return;
    h.run(prompt);
    setPrompt("");
  };
  useEffect(() => {
    const dismiss = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || h.approval || showToolsModal) return;
      if (!busy) setPrompt("");
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [busy, h.approval, showToolsModal]);
  const exportAudit = () => {
    const url = URL.createObjectURL(
      new Blob([serializeAuditLog(h.audit)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const blocked = h.audit.filter((a) => a.status === "BLOCKED").length;

  return (
    <div className="console-shell flex min-h-screen flex-col lg:h-screen bg-background  text-foreground antialiased">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-semibold"
              aria-label="Aegis home"
            >
              <img src="/favicon.svg" width={30} height={30} alt="" />
              <span className="text-base">Aegis</span>
            </Link>
            <ChevronRight size={13} className="text-muted-foreground/50" />
            <span className="text-[13px] font-medium">Sentinel Console</span>
            <span className="production-badge flex items-center gap-1.5 rounded border border-primary/20 px-2 py-1 text-[9px] text-primary">
              <span className="font-mono">v2.4</span>
              <span className="h-2.5 w-px bg-primary/20" />
              Production
            </span>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1" aria-label="Console navigation">
              <Button asChild variant="ghost" size="sm">
                <Link to="/">Home</Link>
              </Button>
              <span className="rounded bg-secondary px-3 py-1.5 text-xs font-medium">Console</span>
            </nav>
            <span className="h-5 w-px bg-border" />
            <label className="relative flex h-8 items-center gap-2 rounded-md border border-border bg-surface pl-2.5 pr-1 text-[11px] focus-within:ring-1 focus-within:ring-ring">
              <Cpu size={13} className="text-muted-foreground" />
              <span className="sr-only">Model</span>
              <select
                value={h.model}
                disabled={busy}
                onChange={(e) => h.setModel(e.target.value as ModelKey)}
                className="h-full max-w-[160px] appearance-none bg-transparent pr-5 focus:outline-none"
              >
                {(Object.keys(MODELS) as ModelKey[]).map((k) => (
                  <option key={k} value={k} className="bg-popover">
                    {k} · {MODELS[k]}
                  </option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2 h-3 w-3 rotate-90 text-muted-foreground" />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface/40 px-5 py-2">
          <div
            role="status"
            className={cn(
              "flex items-center gap-2 text-[11px]",
              h.connected ? "text-primary" : "text-warning",
            )}
          >
            <LiveDot tone={h.connected ? "ok" : "warn"} />
            <span>{h.connected ? "Live WebSocket" : "WebSocket disconnected"}</span>
            <span className="font-mono text-[10px] text-muted-foreground">(127.0.0.1:8000)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone="ok"
              className="h-7 px-2"
              title="Configured policy baseline; enforcement is performed by the connected harness"
            >
              <ShieldCheck size={12} />
              Active Policies: {ACTIVE_POLICY_COUNT} Enforced
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToolsModal(true)}
              className="h-7 border-border-subtle bg-transparent text-[10px]"
            >
              <Wrench size={12} />
              {h.toolsAvailable} Tools
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAudit}
              className="h-7 border-border-subtle bg-transparent text-[10px]"
            >
              <Download size={12} />
              Export Audit Log (JSON)
            </Button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-col lg:w-[61%] lg:border-r lg:border-border">
          <div className="border-b border-border px-5 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-[16px] font-semibold">Agent workspace</h1>
              <Badge tone={h.connected ? "ok" : "warn"}>{h.connected ? "SECURE" : "OFFLINE"}</Badge>
            </div>
            <SectionLabel
              right={
                <span className="text-[11px] text-muted-foreground">One-click policy probes</span>
              }
            >
              Diagnostics
            </SectionLabel>
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {DIAGS.map(({ key, label, id, sub, Icon, tooltip }) => {
                const on = active === key;
                return (
                  <Button
                    variant="unstyled"
                    size="none"
                    key={key}
                    disabled={busy}
                    onClick={() => {
                      setActive(key);
                      h.runDiagnostic(key);
                    }}
                    title={tooltip}
                    className={cn(
                      "group relative flex min-h-[100px] flex-col items-start justify-start gap-2.5 overflow-hidden rounded-md border bg-card/60 p-3 text-left shadow-card transition-all duration-200 disabled:cursor-not-allowed",
                      on
                        ? "border-primary/50 shadow-glow"
                        : "border-border-subtle hover:-translate-y-px hover:border-primary/30 hover:shadow-glow disabled:opacity-50 disabled:hover:translate-y-0",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          on
                            ? "animate-pulse text-primary"
                            : key === "write"
                              ? "text-warning"
                              : key === "storage"
                                ? "text-primary"
                                : "text-cyan",
                        )}
                      />
                      <span className="font-mono text-[9px] text-muted-foreground">[{id}]</span>
                    </div>
                    <div className="w-full min-w-0">
                      <div className="flex items-center justify-between gap-2 text-[12px] font-medium">
                        <span>{label}</span>
                        <ArrowRight
                          className={cn(
                            "h-3 w-3 shrink-0 text-primary transition-all",
                            on
                              ? "opacity-100"
                              : "translate-x-[-3px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                          )}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {on ? "Executing probe…" : sub}
                      </div>
                    </div>
                    {on && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-2.5">
            <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <Terminal size={12} />
              EXECUTION TIMELINE
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {h.chat.length} events <span className="mx-2">·</span> {h.telemetry.steps}/
              {h.telemetry.maxSteps} steps
            </span>
          </div>
          <Conversation className="min-h-[300px] flex-1 lg:min-h-0">
            <ConversationContent className="gap-4 px-5 py-5">
              {h.chat.length === 0 ? (
                <ConversationEmptyState
                  title="Awaiting instruction"
                  description={
                    h.connected
                      ? "Runtime connected. No agent activity recorded."
                      : "Waiting for the harness connection."
                  }
                  icon={<img src="/favicon.svg" width={40} height={40} alt="Aegis Sentinel" />}
                  className="min-h-[240px]"
                />
              ) : (
                h.chat.map((c) => <ChatCard key={c.id} entry={c} />)
              )}
              {h.approval && <PendingApprovalTool req={h.approval} />}
              {busy && (
                <div className="ml-0 flex items-center gap-2 text-xs text-muted-foreground sm:ml-10">
                  <Loader2 size={13} className="animate-spin text-primary" />
                  <Shimmer>
                    {h.telemetry.status === "AWAITING APPROVAL"
                      ? "Awaiting operator authorization…"
                      : h.connected
                        ? `Executing · step ${h.telemetry.steps}/${h.telemetry.maxSteps}`
                        : "Queued · waiting for harness connection…"}
                  </Shimmer>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton aria-label="Scroll to latest event" />
          </Conversation>
          <div className="border-t border-border bg-surface/60 p-4">
            <PromptInput
              onSubmit={submit}
              className="console-command rounded-md transition-shadow focus-within:ring-1 focus-within:ring-primary/40"
            >
              <PromptInputTextarea
                aria-label="Agent instruction"
                value={prompt}
                rows={2}
                disabled={busy}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    if (!e.nativeEvent.isComposing) submit();
                  } else if (!e.shiftKey) {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    setPrompt(prompt.slice(0, start) + "\n" + prompt.slice(end));
                    requestAnimationFrame(() => textarea.setSelectionRange(start + 1, start + 1));
                  }
                }}
                placeholder={busy ? "Agent execution in progress…" : "Instruct the agent…"}
                className="min-h-[76px] px-3.5 font-mono text-xs leading-6"
              />
              <PromptInputFooter className="flex-wrap gap-2 px-3 pb-3">
                <Badge mono>
                  <Cpu size={11} />
                  {MODELS[h.model]}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Clear timeline"
                    aria-label="Clear timeline"
                    onClick={h.clear}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                  </Button>
                  <PromptInputSubmit
                    status={busy ? "submitted" : h.telemetry.status === "ERROR" ? "error" : "ready"}
                    disabled={!prompt.trim() || busy}
                    title="Execute instruction (⌘+Enter)"
                    aria-label="Execute instruction"
                    className="h-8 w-8 shrink-0 p-0"
                  />
                </div>
              </PromptInputFooter>
            </PromptInput>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Kbd>⌘</Kbd>
                <span>+</span>
                <Kbd>Enter</Kbd>
                <span className="ml-1">Run</span>
                <span className="mx-1.5 text-border">/</span>
                <Kbd>Esc</Kbd>
                <span className="ml-1">Cancel {h.approval ? "approval" : "draft"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={11} className="text-primary" />
                Policy-gated execution
              </span>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-surface/25 lg:w-[39%]">
          <div role="tablist" className="flex gap-1 border-b border-border px-4">
            {TABS.map(({ k, l, Icon }) => (
              <Button
                variant="unstyled"
                size="none"
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-3 text-[12.5px] font-medium transition-colors",
                  tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {l}
                {k === "audit" && blocked > 0 && (
                  <Badge tone="danger" mono className="ml-0.5">
                    {blocked}
                  </Badge>
                )}
                {tab === k && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </Button>
            ))}
          </div>
          <div
            key={tab}
            className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 animate-in fade-in duration-200"
          >
            {tab === "telemetry" && <TelemetryPanel h={h} />}
            {tab === "audit" && <AuditPanel h={h} />}
            {tab === "tasks" && <TasksPanel h={h} />}
          </div>
        </section>
      </main>

      {h.approval && <ApprovalDialog req={h.approval} onRespond={h.respondApproval} />}
      <ToolsModal
        open={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        tools={h.toolsList}
      />
    </div>
  );
}
