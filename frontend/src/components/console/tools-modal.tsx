import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Wrench, ShieldAlert, Cpu, ExternalLink, X, Search, CheckCircle2 } from "lucide-react";
import type { ToolItem } from "@/lib/harness-types";
import { Badge } from "./primitives";

export function ToolsModal({
  open,
  onClose,
  tools,
}: {
  open: boolean;
  onClose: () => void;
  tools: ToolItem[];
}) {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    const dismiss = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open, onClose]);
  if (!open) return null;

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.description.toLowerCase().includes(filter.toLowerCase()) ||
      t.source.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-card animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold tracking-normal">
                Registered Tool Schemas ({tools.length})
              </h2>
              <p className="text-[11.5px] text-muted-foreground">
                All deterministic Python capabilities & external MCP tools available to the agent
              </p>
            </div>
          </div>
          <Button variant="unstyled" size="none"
            aria-label="Close tools" title="Close tools" onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b border-border bg-card/50 px-5 py-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter tools by name, description or source…"
              className="h-8 w-full rounded-md border border-input bg-surface pl-8 pr-3 text-[12px] placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No tools matching &quot;{filter}&quot;
            </p>
          ) : (
            filtered.map((t) => (
              <div
                key={t.name}
                className="rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-primary">
                      {t.name}()
                    </span>
                    <Badge
                      tone={t.source === "Local Python" ? "ok" : "info"}
                      mono
                      className="text-[10px]"
                    >
                      {t.source}
                    </Badge>
                    {t.requires_approval && (
                      <Badge tone="warn" className="gap-1 text-[10px]">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        Needs Approval Gate
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3 text-[11.5px] text-muted-foreground">
          <span>9 Built-in Python tools · 3 External MCP protocol tools</span>
          <Button variant="unstyled" size="none"
            aria-label="Close tools" title="Close tools" onClick={onClose}
            className="rounded-md bg-secondary px-3 py-1 font-medium text-foreground hover:bg-secondary/80"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
