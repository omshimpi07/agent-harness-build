import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Cpu, FilePen, Globe, HardDrive, HelpCircle, Layers, ListChecks, Loader2, Network, Play, ShieldCheck, Terminal, Trash2, Wrench } from "lucide-react";
import { useHarness } from "@/hooks/use-harness";
import { MODELS, type ModelKey } from "@/lib/harness-types";
import type { Diagnostic } from "@/lib/harness-sim";
import { cn } from "@/lib/utils";
import { Badge, Kbd, LiveDot, SectionLabel } from "@/components/console/primitives";
import { ChatCard } from "@/components/console/chat-stream";
import { ApprovalDialog } from "@/components/console/approval-dialog";
import { ToolsModal } from "@/components/console/tools-modal";
import { AuditPanel, TasksPanel, TelemetryPanel } from "@/components/console/side-panels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harness Operations Console — AI Agent Observability" },
      { name: "description", content: "Enterprise observability console for AI agent runs: tool traces, telemetry, compliance audit and human-in-the-loop approvals." },
      { property: "og:title", content: "Harness Operations Console" },
      { property: "og:description", content: "Monitor AI agent runs, tool calls, telemetry and policy compliance in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Console,
});

const DIAGS: { key: Diagnostic; label: string; sub: string; Icon: typeof HardDrive; tooltip: string }[] = [
  { key: "storage", label: "Storage Policy", sub: "Sandbox isolation check", Icon: HardDrive, tooltip: "Tests path traversal guard: attempts to read outside /workspace (e.g. ../secret.txt)" },
  { key: "egress", label: "Egress Policy", sub: "Outbound API rules", Icon: Globe, tooltip: "Egress Policy: Blocks requests to external unapproved destinations, cloud metadata (169.254.169.254), or unauthorized domains" },
  { key: "network", label: "Network Policy", sub: "Internal routing limits", Icon: Network, tooltip: "Network Policy: Enforces SSRF defense — blocks private RFC1918 subnets (10.0.0.0/8, 192.168.0.0/16, loopback)" },
  { key: "write", label: "File Write Request", sub: "Authorization prompt", Icon: FilePen, tooltip: "Human-in-the-loop approval: Prompts operator for approval before modifying filesystem" },
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
  const chatRef = useRef<HTMLDivElement>(null);
  const busy = h.telemetry.status === "RUNNING" || h.telemetry.status === "AWAITING APPROVAL";

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [h.chat]);
  useEffect(() => { if (!busy) setActive(null); }, [busy]);

  const submit = () => {
    if (!prompt.trim() || busy) return;
    h.run(prompt);
    setPrompt("");
  };
  const blocked = h.audit.filter((a) => a.status === "BLOCKED").length;

  return (
    <div className="flex h-screen flex-col bg-background bg-ambient text-foreground antialiased">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/70 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30"><Layers className="h-4 w-4" /></div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
              <span className="text-muted-foreground">Harness</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-muted-foreground">Agents</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="flex items-center gap-2 font-semibold tracking-wide">HARNESS OPERATIONS CONSOLE <LiveDot /></span>
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Badge tone={h.connected ? "ok" : "warn"} className="h-7 px-2.5 text-[11.5px]" title="Backend WebSocket status">
                <LiveDot tone={h.connected ? "ok" : "warn"} />
                {h.connected ? <>Connected <span className="font-mono opacity-80">(127.0.0.1:8000)</span></> : "Connecting to Harness…"}
              </Badge>
              <Badge className="h-7 px-2.5 text-[11.5px] cursor-help" title="Circuit breaker: hard ceiling of 8 steps prevents runaway loops and token drain">
                Limit: <span className="font-mono text-foreground">{h.telemetry.maxSteps}</span> Steps
              </Badge>
              <button
                onClick={() => setShowToolsModal(true)}
                title="Click to view all 12 registered agent tools"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-secondary/80 px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                <Wrench className="h-3 w-3 text-primary" />
                <span className="font-mono font-semibold">{h.toolsAvailable}</span> Tools
                <span className="ml-1 text-[10px] text-muted-foreground underline">(view)</span>
              </button>
            </div>
            <label className="relative flex h-8 items-center gap-2 rounded-md border border-input bg-surface pl-2.5 pr-1 text-[12.5px] focus-within:ring-1 focus-within:ring-ring">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="sr-only">Model</span>
              <select value={h.model} onChange={(e) => h.setModel(e.target.value as ModelKey)} className="h-full appearance-none bg-transparent pr-5 focus:outline-none">
                {(Object.keys(MODELS) as ModelKey[]).map((k) => <option key={k} value={k} className="bg-popover">{k} · {MODELS[k]}</option>)}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2 h-3 w-3 rotate-90 text-muted-foreground" />
            </label>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-col lg:w-[60%] lg:border-r lg:border-border">
          <div className="border-b border-border px-5 py-4">
            <SectionLabel right={<span className="text-[11px] text-muted-foreground">One-click policy probes</span>}>Diagnostics</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {DIAGS.map(({ key, label, sub, Icon, tooltip }) => {
                const on = active === key;
                return (
                  <button key={key} disabled={busy} onClick={() => { setActive(key); h.runDiagnostic(key); }}
                    title={tooltip}
                    className={cn("group relative flex items-start gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-card transition-all duration-200 disabled:cursor-not-allowed",
                      on ? "border-primary/50 shadow-glow" : "border-border hover:-translate-y-px hover:border-muted-foreground/40 disabled:opacity-50 disabled:hover:translate-y-0")}>
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 transition-colors", on ? "bg-primary/15 text-primary ring-primary/30" : "bg-secondary text-muted-foreground ring-border group-hover:text-foreground")}>
                      <Icon className={cn("h-4 w-4", on && "animate-pulse")} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold">{label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{on ? "Running…" : sub}</div>
                    </div>
                    {on && <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={chatRef} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {h.chat.length === 0 ? (
              <div className="mx-auto mt-16 max-w-sm text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-secondary ring-1 ring-border"><Terminal className="h-5 w-5 text-muted-foreground" /></div>
                <h2 className="mt-4 text-[15px] font-semibold">No runs yet</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Launch a diagnostic probe above or send an instruction to the agent. Tool calls, responses and approvals stream here.</p>
              </div>
            ) : h.chat.map((c) => <ChatCard key={c.id} entry={c} />)}
            {busy && (
              <div className="ml-10 flex items-center gap-2 text-[12px] text-muted-foreground animate-in fade-in">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>
                  {h.telemetry.status === "AWAITING APPROVAL"
                    ? "Paused: Awaiting your authorization in the approval modal…"
                    : `Agent is working · step ${h.telemetry.steps}/${h.telemetry.maxSteps}`}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-surface/80 p-4 backdrop-blur">
            <div className={cn("rounded-xl border border-input bg-card shadow-card transition-shadow focus-within:border-primary/40 focus-within:shadow-glow", busy && "opacity-90")}>
              <textarea
                value={prompt}
                rows={2}
                disabled={busy}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
                placeholder={busy ? "Agent is currently executing a task… please wait." : "Instruct the agent… e.g. calculate 450 * 12 + 85, read summary.txt"}
                className="block w-full resize-none bg-transparent px-3.5 pt-3 text-[13.5px] leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
                <Badge mono><Cpu className="h-3 w-3" />{MODELS[h.model]}</Badge>
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd> to execute</span>
                <div className="ml-auto flex gap-2">
                  <button onClick={h.clear} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-40">
                    <Trash2 className="h-3.5 w-3.5" />CLEAR
                  </button>
                  <button onClick={submit} disabled={!prompt.trim() || busy} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    {busy ? "BUSY…" : "EXECUTE"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-surface/40 lg:w-[40%]">
          <div role="tablist" className="flex gap-1 border-b border-border px-4">
            {TABS.map(({ k, l, Icon }) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("relative flex items-center gap-1.5 px-3 py-3 text-[12.5px] font-medium transition-colors",
                  tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" />{l}
                {k === "audit" && blocked > 0 && <Badge tone="danger" mono className="ml-0.5">{blocked}</Badge>}
                {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <div key={tab} className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 animate-in fade-in duration-200">
            {tab === "telemetry" && <TelemetryPanel h={h} />}
            {tab === "audit" && <AuditPanel h={h} />}
            {tab === "tasks" && <TasksPanel h={h} />}
          </div>
        </section>
      </main>

      {h.approval && <ApprovalDialog req={h.approval} onRespond={h.respondApproval} />}
      <ToolsModal open={showToolsModal} onClose={() => setShowToolsModal(false)} tools={h.toolsList} />
    </div>
  );
}
