"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatEvent } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Database, FileText, Brain, MessageSquare, Plug, Sparkles, Building2, Users } from "lucide-react";

interface MessageBubbleProps {
  event: ChatEvent;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(type: string): string {
  if (type === "ceo_message") return "bg-primary";
  if (type === "routing") return "bg-blue-600";
  if (type === "tool_call" || type === "tool_result") return "bg-amber-600";
  return "bg-emerald-600";
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Database; color: string }> = {
  company_knowledge: { label: "Company", icon: Building2, color: "text-blue-500" },
  department_knowledge: { label: "Department", icon: Users, color: "text-violet-500" },
  department_context: { label: "Dept Context", icon: Users, color: "text-violet-400" },
  chat_history: { label: "Chat History", icon: MessageSquare, color: "text-green-500" },
  agent_memory: { label: "Memory", icon: Brain, color: "text-amber-500" },
  agent_knowledge: { label: "Knowledge", icon: FileText, color: "text-orange-500" },
  mcp_tools: { label: "MCP", icon: Plug, color: "text-cyan-500" },
  team_members: { label: "Team", icon: Users, color: "text-pink-500" },
  llm_knowledge: { label: "LLM", icon: Sparkles, color: "text-gray-400" },
};

function ContextBar({ event }: { event: ChatEvent }) {
  const pct = event.context_percentage ?? 0;
  const sources = event.sources ?? {};

  const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="mx-4 my-1.5 rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">
          Context: {event.tokens_used?.toLocaleString()} / {event.context_window?.toLocaleString()} tokens
        </span>
        <span className={cn("text-[10px] font-bold", pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-emerald-500")}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      {Object.keys(sources).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(sources).map(([key, count]) => {
            const cfg = SOURCE_CONFIG[key] || { label: key, icon: Database, color: "text-muted-foreground" };
            const Icon = cfg.icon;
            return (
              <span key={key} className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                <Icon className={cn("h-2.5 w-2.5", cfg.color)} />
                <span className="truncate max-w-[60px]">{cfg.label}</span>
                {count > 1 && <span className="opacity-60">({count})</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ event }: MessageBubbleProps) {
  const isCeo = event.type === "ceo_message";
  const name = isCeo ? "You" : event.agent_name || "System";

  if (event.type === "context_info") {
    return <ContextBar event={event} />;
  }

  if (event.type === "history_divider") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider shrink-0">
          Previous messages
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
    );
  }

  if (event.type === "agent_start" || event.type === "agent_done") {
    return (
      <div className="flex justify-center py-2 px-4">
        <Badge variant="secondary" className="text-xs max-w-full">
          <span className="truncate">
            {event.type === "agent_start"
              ? `${event.agent_name} is working...`
              : `${event.agent_name} finished`}
          </span>
        </Badge>
      </div>
    );
  }

  if (event.type === "routing") {
    return (
      <div className="mx-4 my-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-center">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Routing to <span className="text-foreground">{event.department}</span>
        </p>
        {event.reasoning && (
          <p className="text-[11px] text-muted-foreground/80 mt-0.5 whitespace-pre-wrap break-words">
            {event.reasoning}
          </p>
        )}
      </div>
    );
  }

  if (event.type === "task_created") {
    return (
      <div className="flex justify-center py-2 px-4">
        <Badge variant="outline" className="text-xs max-w-full">
          <span className="truncate">Task assigned to {event.agent_name}</span>
        </Badge>
      </div>
    );
  }

  if (event.type === "tool_call") {
    return (
      <div className="mx-4 my-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground overflow-hidden">
        <span className="font-medium">Tool call:</span>{" "}
        <span className="break-all">{event.tool}({JSON.stringify(event.arguments).slice(0, 120)}...)</span>
      </div>
    );
  }

  if (event.type === "tool_result") {
    const preview = event.result?.slice(0, 200) || "";
    return (
      <div className="mx-4 my-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground overflow-hidden">
        <span className="font-medium">Result:</span>{" "}
        <span className="break-words">{preview}{(event.result?.length || 0) > 200 ? "..." : ""}</span>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="mx-4 my-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive break-words">
        Error: {event.error}
      </div>
    );
  }

  const content = event.content || "";

  return (
    <div
      className={cn("flex gap-3 px-4 py-3", isCeo ? "flex-row-reverse" : "")}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn("text-xs text-white", getAvatarColor(event.type))}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-1 min-w-0 max-w-[75%]", isCeo ? "items-end" : "")}>
        <span className="text-xs font-medium text-muted-foreground truncate max-w-full">{name}</span>
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm break-words overflow-hidden",
            isCeo
              ? "bg-primary text-primary-foreground whitespace-pre-wrap"
              : "bg-muted text-foreground"
          )}
        >
          {isCeo ? (
            content
          ) : (
            <div className="chat-markdown overflow-hidden">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    return <pre className="chat-md-pre overflow-x-auto">{children}</pre>;
                  },
                  code({ node, children, ...props }) {
                    const isBlock = node?.position && node.position.start.line !== node.position.end.line;
                    if (isBlock) {
                      return (
                        <code className="chat-md-code-block break-all" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="chat-md-inline-code break-all" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
