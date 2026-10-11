import { useMemo, useState } from "react";
import { Check, ChevronRight, Circle, Loader2, Search } from "lucide-react";
import type { useHarness } from "@/hooks/use-harness";
import type { AuditEvent, TraceEvent } from "@/lib/harness-types";
import { cn } from "@/lib/utils";
import { Badge, CopyButton, JsonBlock, SectionLabel, type Tone } from "./primitives";

type H = ReturnType<typeof useHarness>;
const COST_PER_1K = 0.003;

function Tile({ label, children, foot }: { label: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5">{children}</div>
      {foot && <div className="mt-2 text-[11px] text-muted-foreground">{foot}</div>}
    </div>
  );
}

const levelOf = (e: TraceEvent): "info" | "warn" | "error" =>
  e.event === "run_error" || (e.event === "policy_event" && e.payload["status"] === "BLOCKED") ? "error"
  : e.event === "approval_required" || e.event === "approval_response" ? "warn" : "info";

export function TelemetryPanel({ h }: { h: H }) {
  const t = h.telemetry;
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const breakdown = useMemo(() => {
    const m: Record<string, number> = {};
    h.chat.forEach((c) => { if (c.kind === "tool") m[c.tool] = (m[c.tool] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [h.chat]);
  const max = Math.max(1, ...breakdown.map((b) => b[1]));
  const traces = h.trace.filter((e) => (level === "all" || levelOf(e) === level) && (!q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase())));
  const statusTone: Tone = t.status === "COMPLETE" ? "ok" : t.status === "ERROR" ? "danger" : t.status === "IDLE" ? "neutral" : "warn";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Step limit" foot={`${t.maxSteps - t.steps} remaining`}>
          <div className="font-mono text-xl font-semibold tabular-nums">{t.steps}<span className="text-muted-foreground">/{t.maxSteps}</span></div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: t.maxSteps }).map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", i < t.steps ? (t.steps >= t.maxSteps ? "bg-destructive" : "bg-primary") : "bg-secondary")} />
            ))}
          </div>
        </Tile>
        <Tile label="Total tokens" foot={
          h.model === "local" ? (
            <span className="font-mono text-emerald-400 font-medium">$0.0000 (Local Ollama · Free)</span>
          ) : (
            <span className="font-mono">≈ ${(t.tokens / 1000 * COST_PER_1K).toFixed(4)} est.</span>
          )
        }>
          <div className="font-mono text-xl font-semibold tabular-nums">{t.tokens.toLocaleString()}</div>
        </Tile>
        <Tile label="Tool invocations" foot={`${h.toolsAvailable} tools registered`}>
          <div className="font-mono text-xl font-semibold tabular-nums">{t.toolCount}</div>
        </Tile>
        <Tile label="Run status" foot={h.connected ? "Live server (127.0.0.1:8000)" : "Connecting…"}>
          <Badge tone={statusTone} className="mt-1 px-2 py-1 text-[11.5px]">
            {t.status === "RUNNING" && <Loader2 className="h-3 w-3 animate-spin" />}{t.status}
          </Badge>
        </Tile>
      </div>

      <div>
        <SectionLabel>Tool breakdown</SectionLabel>
        <div className="space-y-1.5 rounded-lg border border-border bg-card p-3">
          {breakdown.length === 0 && <p className="text-[12px] text-muted-foreground">No tool calls recorded yet.</p>}
          {breakdown.map(([name, n]) => (
            <div key={name} className="flex items-center gap-3 text-[12px]">
              <span className="w-32 truncate font-mono text-foreground/85">{name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-info transition-all" style={{ width: `${(n / max) * 100}%` }} /></div>
              <span className="w-5 text-right font-mono tabular-nums text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel right={<CopyButton text={traces.map((e) => JSON.stringify({ ts: e.ts, event: e.event, ...e.payload })).join("\n")} />}>trace.jsonl · {traces.length}</SectionLabel>
        <div className="mb-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="h-8 w-full rounded-md border border-input bg-surface pl-8 pr-2 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex rounded-md border border-input bg-surface p-0.5">
            {(["all", "info", "warn", "error"] as const).map((l) => (
              <button key={l} onClick={() => setLevel(l)} className={cn("rounded px-2 text-[11px] capitalize transition-colors", level === l ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
        </div>
        <div className="scroll-thin max-h-[420px] divide-y divide-border/60 overflow-y-auto rounded-lg border border-border bg-background/60">
          {traces.length === 0 && <p className="p-4 text-center text-[12px] text-muted-foreground">No matching events.</p>}
          {traces.slice().reverse().map((e) => <TraceRow key={e.id} e={e} />)}
        </div>
      </div>
    </div>
  );
}

function TraceRow({ e }: { e: TraceEvent }) {
  const [open, setOpen] = useState(false);
  const lv = levelOf(e);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11.5px] hover:bg-accent/40">
        <span className={cn("h-1.5 w-1.5 rounded-full", lv === "error" ? "bg-destructive" : lv === "warn" ? "bg-warning" : "bg-info")} />
        <span className="text-muted-foreground">{e.ts}</span>
        <span className="text-foreground">{e.event}</span>
        <ChevronRight className={cn("ml-auto h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && <div className="px-3 pb-2"><JsonBlock value={e.payload} /></div>}
    </div>
  );
}

const sevTone: Record<AuditEvent["severity"], Tone> = { CRITICAL: "danger", HIGH: "warn", WARN: "violet", INFO: "neutral" };

export function AuditPanel({ h }: { h: H }) {
  const counts = h.audit.reduce<Record<string, number>>((m, a) => ({ ...m, [a.severity]: (m[a.severity] ?? 0) + 1 }), {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {(["CRITICAL", "HIGH", "WARN", "INFO"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[10.5px] font-medium text-muted-foreground">{s}</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>
      <SectionLabel>Incident log</SectionLabel>
      {h.audit.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-[12.5px] text-muted-foreground">No policy events yet. Run a diagnostic to generate enforcement records.</div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {h.audit.map((a) => <AuditRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function AuditRow({ a }: { a: AuditEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="animate-in fade-in slide-in-from-top-1">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/30">
        <Badge tone={sevTone[a.severity]} className="w-[68px] justify-center">{a.severity}</Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="font-medium">{a.rule}</span>
            <Badge tone={a.status === "ALLOWED" ? "ok" : a.status === "BLOCKED" ? "danger" : "warn"}>{a.status.toLowerCase()}</Badge>
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{a.target}</div>
        </div>
        <span className="font-mono text-[10.5px] text-muted-foreground">{a.ts}</span>
        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && <div className="px-3 pb-3"><JsonBlock value={{ rule: a.rule, severity: a.severity, decision: a.status, target: a.target, timestamp: a.ts, event_id: a.id }} /></div>}
    </div>
  );
}

export function TasksPanel({ h }: { h: H }) {
  const [open, setOpen] = useState(true);
  const subs = h.task.subtasks;
  const done = subs.filter((s) => s.done).length;
  const running = h.telemetry.status === "RUNNING" || h.telemetry.status === "AWAITING APPROVAL";
  const activeId = running ? subs.find((s) => !s.done)?.id : undefined;
  const goalState = done === subs.length ? "Done" : done > 0 || running ? "In Progress" : "Pending";
  const chip = (s: string) => <Badge tone={s === "Done" ? "ok" : s === "In Progress" ? "info" : "neutral"}>{s}</Badge>;

  return (
    <div className="space-y-4">
      <SectionLabel right={<span className="font-mono text-[11px] text-muted-foreground">tasks.json</span>}>Active goal</SectionLabel>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-3.5 text-left">
          <ChevronRight className={cn("mt-0.5 h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
          <div className="flex-1">
            <div className="flex items-center gap-2">{chip(goalState)}<span className="font-mono text-[11px] text-muted-foreground">{done}/{subs.length}</span></div>
            <p className="mt-1.5 text-[13.5px] font-medium leading-snug">{h.task.goal}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(done / subs.length) * 100}%` }} /></div>
          </div>
        </button>
        {open && (
          <ul className="relative border-t border-border py-1.5 pl-6 pr-2">
            <span className="absolute bottom-4 left-[29px] top-4 w-px bg-border" />
            {subs.map((s) => {
              const st = s.done ? "Done" : s.id === activeId ? "In Progress" : "Pending";
              return (
                <li key={s.id}>
                  <button onClick={() => h.toggleSubtask(s.id)} className="relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent/40">
                    <span className={cn("relative z-10 flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300",
                      s.done ? "scale-100 border-primary bg-primary text-primary-foreground" : st === "In Progress" ? "border-info bg-card text-info" : "border-muted-foreground/50 bg-card")}>
                      {s.done ? <Check className="h-2.5 w-2.5 animate-in zoom-in duration-300" strokeWidth={3} /> : st === "In Progress" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Circle className="h-1.5 w-1.5 fill-current opacity-0" />}
                    </span>
                    <span className={cn("flex-1 text-[12.5px] transition-colors", s.done ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground/90")}>{s.label}</span>
                    {chip(st)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
