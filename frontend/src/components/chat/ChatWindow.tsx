"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { AgentSelector, type ChatTarget } from "./AgentSelector";
import { useWebSocket } from "@/lib/websocket";
import { Wifi, WifiOff } from "lucide-react";

interface ChatWindowProps {
  onTargetChange?: (target: ChatTarget) => void;
}

export function ChatWindow({ onTargetChange }: ChatWindowProps) {
  const { connected, events, sendMessage } = useWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<ChatTarget>({
    type: "auto",
    name: "Auto-route",
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const handleTargetChange = (newTarget: ChatTarget) => {
    setTarget(newTarget);
    onTargetChange?.(newTarget);
  };

  const handleSend = (content: string) => {
    const opts: Record<string, string> = {};
    if (target.type === "agent" && target.id) opts.agentId = target.id;
    if (target.type === "department" && target.department)
      opts.department = target.department;
    sendMessage(content, opts);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14 gap-3">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden flex-1">
          <h1 className="text-sm font-semibold shrink-0">Talking to:</h1>
          <AgentSelector target={target} onSelect={handleTargetChange} />
        </div>
        <Badge
          variant={connected ? "default" : "destructive"}
          className="gap-1 shrink-0"
        >
          {connected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {connected ? "Live" : "Offline"}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col py-4">
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">Welcome, CEO</p>
              <p className="text-sm mt-1">
                Select an agent or department above, then give your directive.
              </p>
            </div>
          )}
          {events.map((event, i) => (
            <MessageBubble key={i} event={event} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput
        onSend={handleSend}
        disabled={!connected}
        placeholder={
          target.type === "auto"
            ? "Give a directive (AI will route it)..."
            : target.type === "department"
              ? `Message the ${target.department} department...`
              : `Message ${target.name}...`
        }
      />
    </div>
  );
}

export { useWebSocket };
