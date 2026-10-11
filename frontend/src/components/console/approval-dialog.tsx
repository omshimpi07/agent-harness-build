import { useEffect } from "react";
import { FileWarning, ShieldAlert } from "lucide-react";
import type { ApprovalRequest } from "@/lib/harness-types";
import { Badge, Kbd } from "./primitives";

function highlight(line: string) {
  const m = line.match(/^(\s*-?\s*)([\w.-]+)(:)(.*)$/);
  if (!m || m[4] === undefined) return <span className="text-foreground/85">{line}</span>;
  return (
    <>
      {m[1]}<span className="text-info">{m[2]}</span><span className="text-muted-foreground">{m[3]}</span>
      <span className={/^\s*["\d]/.test(m[4]) ? "text-warning" : "text-primary"}>{m[4]}</span>
    </>
  );
}

export function ApprovalDialog({ req, onRespond }: { req: ApprovalRequest; onRespond: (ok: boolean) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRespond(false);
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRespond(true);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onRespond]);

  const lines = req.content_preview.split("\n");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-md animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="approval-title">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-card animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3 border-b border-warning/25 bg-warning/[0.07] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning ring-1 ring-warning/30"><ShieldAlert className="h-4.5 w-4.5" /></div>
          <div className="flex-1">
            <h2 id="approval-title" className="text-[14px] font-semibold tracking-wide text-warning">⚠️ SENSITIVE WRITE APPROVAL</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">The agent paused and needs your approval before it writes to the filesystem.</p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[88px_1fr] gap-y-2 text-[12.5px]">
            <span className="text-muted-foreground">Tool</span><span><Badge tone="warn" mono>{req.tool}</Badge></span>
            <span className="text-muted-foreground">Target</span><span className="flex items-center gap-1.5 font-mono text-[12px] text-info"><FileWarning className="h-3.5 w-3.5" />{req.filename}</span>
            <span className="text-muted-foreground">Request ID</span><span className="font-mono text-[11.5px] text-muted-foreground">{req.approval_id}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-mono">{req.filename.split("/").pop()}</span><span>{lines.length} lines</span>
            </div>
            <pre className="scroll-thin max-h-72 overflow-auto py-2 font-mono text-[12px] leading-[1.65]">
              {lines.map((l, i) => (
                <div key={i} className="flex hover:bg-accent/40">
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/60">{i + 1}</span>
                  <span className="pr-4">{highlight(l)}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex"><Kbd>Esc</Kbd> deny · <Kbd>⌘↵</Kbd> approve</span>
          <div className="flex gap-2">
            <button onClick={() => onRespond(false)} className="h-9 rounded-md border border-destructive/40 px-4 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive">DENY</button>
            <button autoFocus onClick={() => onRespond(true)} className="h-9 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover">APPROVE WRITE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
