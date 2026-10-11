import { AlertOctagon, FilePenLine, FileText, ShieldAlert, User } from "lucide-react";
import type { ApprovalRequest, ChatEntry } from "@/lib/harness-types";
import { toolPresentation } from "@/lib/console-presentation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge, CopyButton, JsonBlock } from "./primitives";
import { cn } from "@/lib/utils";
const tones = {
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  warn: "border-warning/25 bg-warning/10 text-warning",
  cyan: "border-cyan/25 bg-cyan/10 text-cyan",
};
export function ChatCard({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "tool") {
    const status = toolPresentation(entry);
    const Icon = status.blocked ? ShieldAlert : status.write ? FilePenLine : FileText;
    return (
      <Message from="assistant" className="ml-0 max-w-full pl-0 sm:pl-10">
        <MessageContent className="w-full">
          <Tool
            defaultOpen={false}
            className="mb-0 overflow-hidden border-border-subtle bg-surface/80 hover:border-border"
          >
            <ToolHeader
              type="dynamic-tool"
              toolName={entry.tool}
              state={status.state}
              statusLabel={status.label}
              statusClassName={tones[status.tone]}
              icon={
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    status.tone === "danger"
                      ? "text-destructive"
                      : status.tone === "warn"
                        ? "text-warning"
                        : "text-cyan",
                  )}
                />
              }
              meta={
                <Badge tone={status.tone} mono>
                  {entry.durationMs}ms
                </Badge>
              }
              className="px-3 py-2.5"
            />
            <ToolContent className="space-y-3 border-t border-border-subtle bg-background/40 p-3">
              <ToolInput input={entry.args} />
              <ToolOutput output={<JsonBlock value={entry.result} />} errorText={undefined} />
            </ToolContent>
          </Tool>
        </MessageContent>
      </Message>
    );
  }
  const user = entry.kind === "user";
  const error = entry.kind === "error";
  return (
    <Message from={user ? "user" : "assistant"} className="ml-0 max-w-full">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
            user
              ? "border-info/20 bg-info/10 text-info"
              : error
                ? "border-destructive/20 bg-destructive/10 text-destructive"
                : "border-primary/20 bg-primary/5",
          )}
        >
          {user ? (
            <User size={14} />
          ) : error ? (
            <AlertOctagon size={14} />
          ) : (
            <img src="/favicon.svg" width={24} height={24} alt="Aegis Sentinel" />
          )}
        </div>
        <MessageContent
          className={cn(
            "w-full",
            user
              ? "group-[.is-user]:ml-0 group-[.is-user]:border group-[.is-user]:border-border group-[.is-user]:bg-chat-user group-[.is-user]:text-chat-user-foreground group-[.is-user]:px-4 group-[.is-user]:py-3"
              : "py-1",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">
              {user ? "Operator" : error ? "Execution error" : "Sentinel Agent"}
            </span>
            {!user && !error && <span className="text-[9px] text-primary">AEGIS RUNTIME</span>}
            <time className="font-mono text-[10px] text-muted-foreground">{entry.ts}</time>
            <div className="ml-auto flex items-center gap-2">
              {entry.kind === "assistant" && entry.tokens !== undefined && (
                <Badge mono tone="cyan">
                  {entry.tokens.toLocaleString()} tokens
                </Badge>
              )}
              <CopyButton text={entry.text} />
            </div>
          </div>
          {user ? (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-6">{entry.text}</p>
          ) : (
            <MessageResponse
              mode="static"
              className={cn("console-markdown", error && "text-destructive")}
            >
              {entry.text}
            </MessageResponse>
          )}
        </MessageContent>
      </div>
    </Message>
  );
}
export function PendingApprovalTool({ req }: { req: ApprovalRequest }) {
  return (
    <Message from="assistant" className="max-w-full sm:pl-10">
      <MessageContent className="w-full">
        <Tool defaultOpen={false} className="mb-0 border-warning/25 bg-warning/5">
          <ToolHeader
            type="dynamic-tool"
            toolName={req.tool}
            state="approval-requested"
            statusLabel="Requires Approval"
            statusClassName={tones.warn}
            icon={<FilePenLine size={14} className="text-warning" />}
          />
          <ToolContent>
            <ToolInput input={{ filename: req.filename }} />
            <ToolOutput output={<JsonBlock value={req.content_preview} />} errorText={undefined} />
          </ToolContent>
        </Tool>
      </MessageContent>
    </Message>
  );
}
