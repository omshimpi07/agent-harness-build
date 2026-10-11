import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

const tones = {
  neutral: "border-border bg-secondary/60 text-muted-foreground",
  ok: "border-primary/30 bg-primary/10 text-primary",
  warn: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/35 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  violet: "border-violet/30 bg-violet/10 text-violet",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", mono, className, children }: { tone?: Tone; mono?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium leading-none", mono && "font-mono", tones[tone], className)}>
      {children}
    </span>
  );
}

export function LiveDot({ tone = "ok" }: { tone?: "ok" | "warn" | "danger" }) {
  const c = tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", c)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", c)} />
    </span>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
    >
      {done ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}

const TOKEN_RE = /("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g;

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  const json = JSON.stringify(value, null, 2) ?? "null";
  return (
    <pre className={cn("scroll-thin overflow-x-auto rounded-md border border-border/70 bg-background/70 p-3 font-mono text-[11.5px] leading-relaxed", className)}>
      {json.split(TOKEN_RE).map((p, i) => {
        let c = "text-muted-foreground";
        if (/^".*"\s*:$/.test(p)) c = "text-info";
        else if (p.startsWith('"')) c = "text-primary";
        else if (/^-?\d/.test(p)) c = "text-warning";
        else if (/^(true|false|null)$/.test(p)) c = "text-violet";
        return <span key={i} className={c}>{p}</span>;
      })}
    </pre>
  );
}

/** Full-featured markdown renderer: headings, tables, numbered/bullet lists, bold, inline code, blockquotes, code blocks. */
export function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith("**") ? (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      ) : p.startsWith("`") ? (
        <code key={i} className="rounded bg-secondary px-1 py-0.5 font-mono text-[12px] text-primary">
          {p.slice(1, -1)}
        </code>
      ) : (
        p
      )
    );

  // Split content by double newlines or single newlines for headers/tables
  const rawLines = text.split("\n");
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^---$|^\*\*\*$|^___$/.test(trimmed)) {
      elements.push(<hr key={i} className="my-3 border-border" />);
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-[13.5px] font-semibold text-foreground">
          {inline(trimmed.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-4 mb-1.5 text-[15px] font-semibold tracking-tight text-foreground border-b border-border/60 pb-1">
          {inline(trimmed.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mt-4 mb-2 text-[16px] font-bold tracking-tight text-foreground">
          {inline(trimmed.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground text-[13px]">
          {inline(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Markdown Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|") && rawLines[i].trim().endsWith("|")) {
        tableLines.push(rawLines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split("|").slice(1, -1).map((c) => c.trim());
        const contentRows = tableLines.slice(1).filter((r) => !/^[|\s:-]+$/.test(r)).map((r) =>
          r.split("|").slice(1, -1).map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-border bg-secondary/50 font-semibold text-muted-foreground">
                <tr>
                  {headerRow.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 font-mono text-[11.5px]">{inline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {contentRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-secondary/20">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-foreground/90">{inline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Bullet List (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^[-*]\s+/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5 ml-4 list-disc space-y-1 marker:text-primary">
          {listItems.map((item, li) => (
            <li key={li} className="text-[13px] text-foreground/90 leading-relaxed">{inline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered List (1. 2. etc)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1.5 ml-4 list-decimal space-y-1 marker:text-muted-foreground font-medium">
          {listItems.map((item, li) => (
            <li key={li} className="text-[13px] text-foreground/90 font-normal leading-relaxed">{inline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular Paragraph
    elements.push(
      <p key={i} className="text-[13px] leading-relaxed text-foreground/90">
        {inline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2">{elements}</div>;
}
