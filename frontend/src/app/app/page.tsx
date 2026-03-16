"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { AgentSelector, type ChatTarget } from "@/components/chat/AgentSelector";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { useWebSocket } from "@/lib/websocket";
import {
  agentsApi,
  chatApi,
  type AgentDefinition,
  type ChatSession,
} from "@/lib/api";
import {
  Wifi,
  WifiOff,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  History,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const CHAT_MIN = 280;
const CHAT_MAX_RATIO = 0.7;
const CHAT_DEFAULT = 400;
const CHAT_COLLAPSED = 0;
const STORAGE_KEY = "fact_chat_width";

function getInitialWidth(): number {
  if (typeof window === "undefined") return CHAT_DEFAULT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n)) return n;
  }
  return CHAT_DEFAULT;
}

export default function HomePage() {
  const {
    connected,
    events,
    sendMessage,
    addTask,
    createTask,
    removeTask,
    clearEvents,
    prependEvents,
  } = useWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<ChatTarget>({
    type: "auto",
    name: "Auto-route",
  });
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  const [chatWidth, setChatWidth] = useState(getInitialWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const widthBeforeCollapse = useRef(CHAT_DEFAULT);

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const sessionCreated = useRef(false);

  useEffect(() => {
    agentsApi.listFlat().then(setAgents).catch(() => {});
  }, []);

  // Create a new session on mount
  useEffect(() => {
    if (sessionCreated.current) return;
    sessionCreated.current = true;

    chatApi.createSession().then((sess) => {
      setCurrentSessionId(sess.id);
    }).catch(() => {});

    chatApi.listSessions(20).then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  useEffect(() => {
    if (!collapsed) {
      localStorage.setItem(STORAGE_KEY, String(chatWidth));
    }
  }, [chatWidth, collapsed]);

  const loadSession = useCallback(async (sessionId: string) => {
    clearEvents();
    setCurrentSessionId(sessionId);
    setShowSessions(false);
    try {
      const data = await chatApi.getSessionMessages(sessionId);
      if (data.events.length > 0) {
        prependEvents(data.events);
      }
    } catch {}
  }, [clearEvents, prependEvents]);

  const startNewSession = useCallback(async () => {
    clearEvents();
    setShowSessions(false);
    try {
      const sess = await chatApi.createSession();
      setCurrentSessionId(sess.id);
      const list = await chatApi.listSessions(20);
      setSessions(list);
    } catch {}
  }, [clearEvents]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        await startNewSession();
      }
    } catch {}
  }, [currentSessionId, startNewSession]);

  // Drag resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const startX = e.clientX;
      const startWidth = chatWidth;

      const onMove = (ev: MouseEvent) => {
        const containerWidth =
          containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
        const maxW = containerWidth * CHAT_MAX_RATIO;
        const delta = startX - ev.clientX;
        const newW = Math.min(maxW, Math.max(CHAT_MIN, startWidth + delta));
        setChatWidth(newW);
      };

      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [chatWidth]
  );

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setChatWidth(widthBeforeCollapse.current);
    } else {
      widthBeforeCollapse.current = chatWidth;
      setCollapsed(true);
    }
  }, [collapsed, chatWidth]);

  // Slash command parsing
  const handleSend = useCallback(
    (content: string) => {
      if (/^\/clear\s*$/i.test(content)) {
        clearEvents();
        return;
      }

      if (/^\/auto\s*$/i.test(content)) {
        setTarget({ type: "auto", name: "Auto-route" });
        return;
      }

      const deptMatch = content.match(/^\/department\s+(.+)/i);
      if (deptMatch) {
        const deptName = deptMatch[1].trim();
        setTarget({ type: "department", name: deptName, department: deptName });
        return;
      }

      const agentMatch = content.match(/^\/agent\s+(.+)/i);
      if (agentMatch) {
        const agentName = agentMatch[1].trim();
        const found = agents.find(
          (a) => a.name.toLowerCase() === agentName.toLowerCase()
        );
        if (found) {
          setTarget({ type: "agent", id: found.id, name: found.name });
        } else {
          setTarget({ type: "auto", name: "Auto-route" });
        }
        return;
      }

      const meetingMatch = content.match(/^\/meeting\s+(.+)/i);
      if (meetingMatch) {
        const deptName = meetingMatch[1].trim();
        setTarget({ type: "department", name: `${deptName} dept`, department: deptName });
        return;
      }

      const taskMatch = content.match(/^\/task\s+(.+)/i);
      if (taskMatch) {
        const rest = taskMatch[1].trim();
        const agentMention = rest.match(/^@(\S+)\s+(.*)/);
        if (agentMention) {
          const mentionName = agentMention[1];
          const directive = agentMention[2].trim();
          const found = agents.find(
            (a) => a.name.toLowerCase().replace(/\s+/g, "") === mentionName.toLowerCase()
          );
          if (found && directive) {
            createTask(directive, { agent_id: found.id });
            return;
          }
        }
        if (rest) {
          createTask(rest);
        }
        return;
      }

      const opts: Record<string, string> = {};
      if (target.type === "agent" && target.id) opts.agentId = target.id;
      if (target.type === "department" && target.department)
        opts.department = target.department;
      if (currentSessionId) opts.sessionId = currentSessionId;
      sendMessage(content, opts);
    },
    [target, sendMessage, createTask, clearEvents, agents, currentSessionId]
  );

  const selectedAgentId =
    target.type === "agent" ? target.id : undefined;
  const selectedDepartment =
    target.type === "department" ? target.department : undefined;

  const effectiveWidth = collapsed ? CHAT_COLLAPSED : chatWidth;

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden relative">
      {/* Task Board */}
      <div className="flex-1 min-w-0">
        <TaskPanel
          selectedAgentId={selectedAgentId}
          selectedDepartment={selectedDepartment}
          events={events}
          onAddTask={addTask}
          onRemoveTask={removeTask}
        />
      </div>

      {/* Drag Handle */}
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center z-10",
          collapsed ? "w-0" : "w-1.5 cursor-col-resize group"
        )}
        onMouseDown={collapsed ? undefined : handleMouseDown}
      >
        {!collapsed && (
          <div
            className={cn(
              "absolute inset-y-0 w-1.5 transition-colors",
              dragging ? "bg-primary" : "bg-border group-hover:bg-primary/50"
            )}
          />
        )}
      </div>

      {/* Collapse/Expand toggle */}
      <button
        onClick={toggleCollapse}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-8 w-5 rounded-l-md bg-muted border border-r-0 border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        style={collapsed ? {} : { right: `${effectiveWidth}px` }}
        title={collapsed ? "Open chat" : "Close chat"}
      >
        {collapsed ? (
          <PanelRightOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelRightClose className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Chat Panel */}
      <div
        className="shrink-0 flex flex-col border-l border-border overflow-hidden bg-card transition-[width] duration-150"
        style={{ width: `${effectiveWidth}px` }}
      >
        {!collapsed && effectiveWidth >= CHAT_MIN && (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-border px-3 h-14 gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <AgentSelector target={target} onSelect={setTarget} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setShowSessions((v) => !v);
                    if (!showSessions) {
                      chatApi.listSessions(20).then(setSessions).catch(() => {});
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    showSessions
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title="Chat history"
                >
                  <History className="h-4 w-4" />
                </button>
                <button
                  onClick={startNewSession}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <Badge
                  variant={connected ? "default" : "destructive"}
                  className="gap-1 ml-1"
                >
                  {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {connected ? "Live" : "Off"}
                </Badge>
              </div>
            </div>

            {showSessions ? (
              /* Session List */
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-2 pb-1">
                    Chat History
                  </p>
                  {sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No previous sessions
                    </p>
                  ) : (
                    sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={cn(
                          "group flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                          sess.id === currentSessionId
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        )}
                        onClick={() => loadSession(sess.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {sess.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {sess.message_count} message{sess.message_count !== 1 ? "s" : ""}
                            {sess.created_at && (
                              <> &middot; {formatDistanceToNow(new Date(sess.created_at), { addSuffix: true })}</>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(sess.id);
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all shrink-0"
                          title="Delete session"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="flex flex-col py-4">
                    {events.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">Chat with your AI team</p>
                        <p className="text-xs mt-1 text-center opacity-70">
                          Type <span className="font-mono">/</span> for commands
                        </p>
                      </div>
                    )}
                    {events.map((event, i) => (
                      <MessageBubble key={i} event={event} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* Input */}
                <ChatInput
                  onSend={handleSend}
                  disabled={!connected}
                  agents={agents}
                  placeholder={
                    target.type === "auto"
                      ? "Message the office... auto-route falls back to CEO Office (/ for commands)"
                      : target.type === "department"
                        ? `Message ${target.department} dept lead...`
                        : `Message ${target.name}...`
                  }
                />
              </>
            )}
          </>
        )}
      </div>

      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  );
}
