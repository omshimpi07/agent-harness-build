import { useState } from "react";
import { AlertOctagon, Bot, ChevronRight, User, Wrench } from "lucide-react";
import type { ChatEntry } from "@/lib/harness-types";
import { cn } from "@/lib/utils";
import { Badge, CopyButton, JsonBlock, Markdown } from "./primitives";

function preview(v: unknown) {
  const s = JSON.stringify(v) ?? "";
  return s.length > 72 ? s.slice(0, 72) + "…" : s;
}

export function ChatCard({ entry }: { entry: ChatEntry }) {
  const [open, setOpen] = useState(false);
  const base = "animate-in fade-in slide-in-from-bottom-1 duration-300";

  if (entry.kind === "user")
    return (
      <div className={cn("flex gap-3", base)}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/15 text-info ring-1 ring-info/30"><User className="h-3.5 w-3.5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold">Operator</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{entry.ts}</span>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-foreground/90">{entry.text}</p>
        </div>
      </div>
    );

  if (entry.kind === "assistant" || entry.kind === "error") {
    const err = entry.kind === "error";
    return (
      <div className={cn("flex gap-3", base)}>
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1", err ? "bg-destructive/15 text-destructive ring-destructive/30" : "bg-primary/15 text-primary ring-primary/30")}>
          {err ? <AlertOctagon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <div className="group min-w-0 flex-1 rounded-lg border border-border bg-card p-3.5 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[12.5px] font-semibold">{err ? "Run error" : "Harness Agent"}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{entry.ts}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {entry.kind === "assistant" && entry.tokens != null && <Badge mono>{entry.tokens.toLocaleString()} tok</Badge>}
              <CopyButton text={entry.text} className="opacity-60 group-hover:opacity-100" />
            </div>
          </div>
          <Markdown text={entry.text} />
        </div>
      </div>
    );
  }

  const [ns, method] = entry.tool.includes(".") ? entry.tool.split(".") : ["tool", entry.tool];
  const failed = typeof entry.result === "object" && entry.result !== null && "error" in entry.result;
  return (
    <div className={cn("ml-10", base)}>
      <div className={cn("overflow-hidden rounded-lg border bg-surface transition-colors", open ? "border-border" : "border-border/70 hover:border-border")}>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
          <Wrench className="h-3.5 w-3.5 text-warning" />
          <span className="font-mono text-[12px]"><span className="text-muted-foreground">{ns}.</span><span className="text-foreground">{method}</span></span>
          <Badge tone={failed ? "danger" : "ok"}>{failed ? "denied" : "ok"}</Badge>
          <span className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground sm:block">{preview(entry.result)}</span>
          <Badge tone="warn" mono className="ml-auto">{entry.durationMs}ms</Badge>
        </button>
        {open && (
          <div className="grid gap-3 border-t border-border/70 p-3 animate-in fade-in">
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Arguments</div>
              <JsonBlock value={entry.args} />
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Output</div>
              <JsonBlock value={entry.result} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
