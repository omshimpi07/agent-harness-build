import { Button } from "@/components/ui/button";
import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
        {children}
      </h3>
      {right}
    </div>
  );
}

const tones = {
  neutral: "border-border bg-secondary/60 text-muted-foreground",
  ok: "border-primary/30 bg-primary/10 text-primary",
  warn: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/35 bg-destructive/10 text-destructive",
  cyan: "border-cyan/25 bg-cyan/10 text-cyan",
  info: "border-info/30 bg-info/10 text-info",
  violet: "border-violet/30 bg-violet/10 text-violet",
} as const;
export type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  mono,
  className,
  children,
  title,
}: {
  tone?: Tone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium leading-none",
        mono && "font-mono",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ tone = "ok" }: { tone?: "ok" | "warn" | "danger" }) {
  const c = tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <span className="relative flex h-2 w-2">
      <span
        className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", c)}
      />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", c)} />
    </span>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="unstyled"
      size="none"
      type="button"
      aria-label="Copy"
      title={done ? "Copied" : "Copy to clipboard"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          setDone(false);
        }
      }}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {done ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

const TOKEN_RE = /("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g;

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  const json = JSON.stringify(value, null, 2) ?? "null";
  return (
    <pre
      className={cn(
        "scroll-thin overflow-x-auto rounded-md border border-border/70 bg-background/70 p-3 font-mono text-[11.5px] leading-relaxed",
        className,
      )}
    >
      {json.split(TOKEN_RE).map((p, i) => {
        let c = "text-muted-foreground";
        if (/^".*"\s*:$/.test(p)) c = "text-info";
        else if (p.startsWith('"')) c = "text-primary";
        else if (/^-?\d/.test(p)) c = "text-warning";
        else if (/^(true|false|null)$/.test(p)) c = "text-violet";
        return (
          <span key={i} className={c}>
            {p}
          </span>
        );
      })}
    </pre>
  );
}
